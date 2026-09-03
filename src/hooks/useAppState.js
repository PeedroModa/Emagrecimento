import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

// Mesmo padrão de store em módulo dos outros hooks (cache + listeners +
// epoch por logout). Guarda quando foi a PENÚLTIMA visita — não a última,
// que "agora" acabou de virar — para o feed comparar "o que mudou desde
// então" (ver src/lib/insights). Uma visita só gira a janela depois de
// VISIT_GAP_MS: um F5 na mesma sessão não deve apagar o "desde quando".
const VISIT_GAP_MS = 30 * 60 * 1000;

let cache = null; // { last_visit_at, previous_visit_at, feed_seen_at }
let status = "idle"; // idle | loading | ready | error
const listeners = new Set();
let epoch = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function clearAppStateCache() {
  epoch++;
  cache = null;
  status = "idle";
  notify();
}

export async function fetchAndRotateVisit(userId) {
  const myEpoch = epoch;
  status = "loading";
  notify();
  const { data, error } = await supabase.from("user_app_state").select("*").maybeSingle();
  if (myEpoch !== epoch) return;
  if (error) {
    status = "error";
    notify();
    return;
  }
  const nowISO = new Date().toISOString();

  if (!data) {
    const row = { user_id: userId, last_visit_at: nowISO, previous_visit_at: null };
    const { data: inserted } = await supabase.from("user_app_state").insert(row).select().single();
    if (myEpoch !== epoch) return;
    cache = inserted || row;
    status = "ready";
    notify();
    return;
  }

  const lastVisit = data.last_visit_at ? new Date(data.last_visit_at) : null;
  const gapExpired = !lastVisit || Date.now() - lastVisit.getTime() > VISIT_GAP_MS;
  if (!gapExpired) {
    cache = data;
    status = "ready";
    notify();
    return;
  }

  // guarda otimista (eq no valor lido de last_visit_at) — se duas abas
  // girarem a janela ao mesmo tempo, só a primeira write realmente aplica
  const { data: updated } = await supabase
    .from("user_app_state")
    .update({ previous_visit_at: data.last_visit_at, last_visit_at: nowISO })
    .eq("user_id", userId)
    .eq("last_visit_at", data.last_visit_at)
    .select()
    .maybeSingle();
  if (myEpoch !== epoch) return;
  cache = updated || { ...data, previous_visit_at: data.last_visit_at, last_visit_at: nowISO };
  status = "ready";
  notify();
}

export const __test = { getCache: () => cache, getStatus: () => status };

export function useAppState(userId) {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (status === "idle" && userId) fetchAndRotateVisit(userId);
    return () => listeners.delete(fn);
  }, [userId]);

  return {
    lastVisitAt: cache?.last_visit_at ?? null,
    previousVisitAt: cache?.previous_visit_at ?? null,
    loading: status === "idle" || status === "loading",
    ready: status === "ready",
  };
}
