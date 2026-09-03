import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";

// Estado de "já visto/dispensado" do feed de descobertas — mesmo padrão de
// store em módulo dos outros hooks. "Visto" é gravado em lote (debounce de
// 1s, fire-and-forget: uma falha de rede aqui não trava a UI, o insight só
// volta a ser marcado como visto na próxima vez). "Dispensar" é otimista
// com rollback, como addOrReplace/update em useWeighIns.js.
let cache = {}; // { [insight_key]: {status, payload_hash, last_seen_at, dismissed_at} }
let status = "idle"; // idle | loading | ready | error
const listeners = new Set();
let epoch = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function clearInsightStateCache() {
  epoch++;
  cache = {};
  status = "idle";
  notify();
}

export async function fetchInsightStates() {
  const myEpoch = epoch;
  status = "loading";
  notify();
  const { data, error } = await supabase.from("insight_state").select("*");
  if (myEpoch !== epoch) return;
  if (error) {
    status = "error";
    notify();
    return;
  }
  const byKey = {};
  for (const row of data) byKey[row.insight_key] = row;
  cache = byKey;
  status = "ready";
  notify();
}

// Grava em lote uma leva de "vistos". Exportada separada do hook (mesmo
// padrão de patchContextTags em useWeighIns.js) para ser testável sem
// precisar renderizar um componente React.
export async function flushSeen(userId, entries) {
  if (!entries.length || !userId) return { error: null };
  const nowISO = new Date().toISOString();
  const rows = entries.map(([insight_key, { ruleId, hash }]) => ({
    user_id: userId, insight_key, rule_id: ruleId, payload_hash: hash,
    status: "seen", last_seen_at: nowISO,
  }));
  const { error } = await supabase.from("insight_state").upsert(rows, { onConflict: "user_id,insight_key" });
  if (error) return { error: "Não consegui salvar. Tente de novo." };
  const next = { ...cache };
  for (const row of rows) next[row.insight_key] = { ...next[row.insight_key], ...row };
  cache = next;
  notify();
  return { error: null };
}

export async function dismissInsight(userId, insight) {
  if (!userId) return { error: null };
  const prev = cache;
  const nowISO = new Date().toISOString();
  cache = {
    ...cache,
    [insight.key]: { ...cache[insight.key], status: "dismissed", payload_hash: insight.payloadHash, dismissed_at: nowISO },
  };
  notify();
  const { error } = await supabase.from("insight_state").upsert({
    user_id: userId, insight_key: insight.key, rule_id: insight.ruleId,
    payload_hash: insight.payloadHash, status: "dismissed", dismissed_at: nowISO, last_seen_at: nowISO,
  }, { onConflict: "user_id,insight_key" });
  if (error) {
    cache = prev;
    notify();
    return { error: "Não consegui salvar. Tente de novo." };
  }
  return { error: null };
}

export const __test = { getCache: () => cache, getStatus: () => status };

export function useInsightState(userId) {
  const [, force] = useState(0);
  const pending = useRef(new Map()); // insight_key -> {ruleId, hash}
  const timerRef = useRef(null);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (status === "idle" && userId) fetchInsightStates();
    return () => listeners.delete(fn);
  }, [userId]);

  // Marca uma leva de insights visíveis como vistos — ignora os que já
  // estão com o mesmo payload_hash (nada mudou, não precisa regravar).
  const markSeen = useCallback((insights) => {
    for (const i of insights) {
      const existing = cache[i.key];
      if (existing?.payload_hash === i.payloadHash && existing?.status === "seen") continue;
      pending.current.set(i.key, { ruleId: i.ruleId, hash: i.payloadHash });
    }
    if (pending.current.size) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const entries = [...pending.current.entries()];
        pending.current.clear();
        flushSeen(userId, entries);
      }, 1000);
    }
  }, [userId]);

  const dismiss = useCallback((insight) => dismissInsight(userId, insight), [userId]);

  return {
    statesByKey: cache,
    loading: status === "idle" || status === "loading",
    markSeen,
    dismiss,
  };
}
