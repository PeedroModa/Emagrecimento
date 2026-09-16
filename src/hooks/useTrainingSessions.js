import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

// Treinos importados (Gravl) — mesmo padrão de store em módulo dos demais
// hooks. Só leitura + import em lote (upsert por external_id); não há edição
// manual: a fonte da verdade é o app de treino.
let cache = null; // array de {id, external_id, date, minutes, kind, calories, source} asc por data
let status = "idle";
let errorMsg = null;
const listeners = new Set();
let epoch = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function clearTrainingSessionsCache() {
  epoch++;
  cache = null;
  status = "idle";
  errorMsg = null;
  notify();
}

function fromRow(r) {
  return { id: r.id, external_id: r.external_id, date: r.date, minutes: +r.minutes, kind: r.kind, calories: r.calories, source: r.source };
}

export async function fetchAll() {
  const myEpoch = epoch;
  status = "loading";
  errorMsg = null;
  notify();
  const { data, error } = await supabase.from("training_sessions").select("*").order("date", { ascending: true });
  if (myEpoch !== epoch) return;
  if (error) {
    status = "error";
    errorMsg = "Não consegui carregar os treinos.";
  } else {
    cache = data.map(fromRow);
    status = "ready";
  }
  notify();
}

export async function importSessions(sessions, userId) {
  const rows = sessions.map((s) => ({ ...s, user_id: userId }));
  const { error } = await supabase.from("training_sessions").upsert(rows, { onConflict: "user_id,external_id" });
  if (error) return { error: "Não consegui importar os treinos. Rodou a migração training_sessions no Supabase?" };
  await fetchAll();
  return { error: null };
}

export const __test = { getCache: () => cache, getStatus: () => status };

export function useTrainingSessions() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (status === "idle") fetchAll();
    return () => listeners.delete(fn);
  }, []);
  return {
    sessions: cache || [],
    loading: status === "idle" || status === "loading",
    error: status === "error" ? errorMsg : null,
    retry: useCallback(() => fetchAll(), []),
    importSessions: useCallback((sessions, userId) => importSessions(sessions, userId), []),
  };
}
