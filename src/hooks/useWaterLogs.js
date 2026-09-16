import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

// Registros de água — mesmo padrão de store em módulo dos outros hooks
// (cache + listeners + epoch por logout + atualização otimista).
// Ver supabase/migration-hydration.sql.
let cache = null; // array de {id, logged_at, amount_ml}, ordenado desc por logged_at
let status = "idle"; // idle | loading | ready | error
let errorMsg = null;
const listeners = new Set();
let epoch = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function clearWaterLogsCache() {
  epoch++;
  cache = null;
  status = "idle";
  errorMsg = null;
  notify();
}

function fromRow(row) {
  return { id: row.id, logged_at: row.logged_at, amount_ml: +row.amount_ml };
}

const byTimeDesc = (a, b) => b.logged_at.localeCompare(a.logged_at);

// ponytail: carrega tudo (poucos registros/dia → ~1.5k linhas/ano); paginar
// por range de logged_at se um dia pesar.
export async function fetchAll() {
  const myEpoch = epoch;
  status = "loading";
  errorMsg = null;
  notify();
  const { data, error } = await supabase
    .from("water_logs")
    .select("*")
    .order("logged_at", { ascending: false });
  if (myEpoch !== epoch) return;
  if (error) {
    status = "error";
    errorMsg = "Não consegui carregar os registros de água. Verifique a conexão e tente de novo.";
  } else {
    cache = data.map(fromRow);
    status = "ready";
  }
  notify();
}

export async function addLog({ amountMl, loggedAt, userId }) {
  const prev = cache;
  const tmpId = `tmp-${Date.now()}`;
  cache = [{ id: tmpId, logged_at: loggedAt, amount_ml: amountMl }, ...(cache || [])].sort(byTimeDesc);
  notify();
  const { data, error } = await supabase
    .from("water_logs")
    .insert({ user_id: userId, logged_at: loggedAt, amount_ml: amountMl })
    .select()
    .single();
  if (error) {
    cache = prev;
    notify();
    return { error: "Não consegui registrar. Tente de novo." };
  }
  cache = cache.map((l) => (l.id === tmpId ? fromRow(data) : l));
  notify();
  return { error: null, log: fromRow(data) };
}

export async function removeLog(id) {
  const prev = cache;
  cache = (cache || []).filter((l) => l.id !== id);
  notify();
  const { error } = await supabase.from("water_logs").delete().eq("id", id);
  if (error) {
    cache = prev;
    notify();
    return { error: "Não consegui remover o registro. Tente de novo." };
  }
  return { error: null };
}

export const __test = { getCache: () => cache, getStatus: () => status };

export function useWaterLogs() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (status === "idle") fetchAll();
    return () => listeners.delete(fn);
  }, []);

  return {
    logs: cache || [],
    loading: status === "idle" || status === "loading",
    error: status === "error" ? errorMsg : null,
    retry: useCallback(() => fetchAll(), []),
    add: useCallback((args) => addLog(args), []),
    remove: useCallback((id) => removeLog(id), []),
  };
}
