import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

// Medidas corporais ampliadas (sessão mensal) — mesmo padrão de store em
// módulo dos outros hooks (cache + listeners + epoch por logout +
// atualização otimista). Ver supabase/migration-body-measurements.sql.
let cache = null; // array de {id, date, waist?, neck?, hip?, chest?, arm?, thigh?, note?}
let status = "idle"; // idle | loading | ready | error
let errorMsg = null;
const listeners = new Set();
let epoch = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function clearMeasurementsCache() {
  epoch++;
  cache = null;
  status = "idle";
  errorMsg = null;
  notify();
}

function fromRow(row) {
  const m = { id: row.id, date: row.date };
  if (row.waist_cm != null) m.waist = +row.waist_cm;
  if (row.neck_cm != null) m.neck = +row.neck_cm;
  if (row.hip_cm != null) m.hip = +row.hip_cm;
  if (row.chest_cm != null) m.chest = +row.chest_cm;
  if (row.arm_cm != null) m.arm = +row.arm_cm;
  if (row.thigh_cm != null) m.thigh = +row.thigh_cm;
  if (row.note) m.note = row.note;
  return m;
}

function toRow(entry, userId) {
  return {
    user_id: userId,
    date: entry.date,
    waist_cm: entry.waist ?? null,
    neck_cm: entry.neck ?? null,
    hip_cm: entry.hip ?? null,
    chest_cm: entry.chest ?? null,
    arm_cm: entry.arm ?? null,
    thigh_cm: entry.thigh ?? null,
    note: entry.note ?? null,
  };
}

export async function fetchAll() {
  const myEpoch = epoch;
  status = "loading";
  errorMsg = null;
  notify();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .order("date", { ascending: true });
  if (myEpoch !== epoch) return;
  if (error) {
    status = "error";
    errorMsg = "Não consegui carregar as medidas. Verifique a conexão e tente de novo.";
  } else {
    cache = data.map(fromRow);
    status = "ready";
  }
  notify();
}

export const __test = { getCache: () => cache, getStatus: () => status };

export function useMeasurements() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (status === "idle") fetchAll();
    return () => listeners.delete(fn);
  }, []);

  const retry = useCallback(() => fetchAll(), []);

  const addOrReplace = useCallback(async (entry, userId) => {
    const prev = cache;
    const optimistic = { ...entry, id: entry.id || `tmp-${Date.now()}` };
    cache = [...(cache || []).filter((m) => m.date !== entry.date), optimistic].sort((a, b) => a.date.localeCompare(b.date));
    notify();
    const { data, error } = await supabase
      .from("body_measurements")
      .upsert(toRow(entry, userId), { onConflict: "user_id,date" })
      .select()
      .single();
    if (error) {
      cache = prev;
      notify();
      return { error: "Não consegui salvar as medidas. Tente de novo." };
    }
    cache = [...cache.filter((m) => m.date !== entry.date), fromRow(data)].sort((a, b) => a.date.localeCompare(b.date));
    notify();
    return { error: null };
  }, []);

  const remove = useCallback(async (id) => {
    const prev = cache;
    cache = (cache || []).filter((m) => m.id !== id);
    notify();
    const { error } = await supabase.from("body_measurements").delete().eq("id", id);
    if (error) {
      cache = prev;
      notify();
      return { error: "Não consegui remover as medidas. Tente de novo." };
    }
    return { error: null };
  }, []);

  return {
    measurements: cache || [],
    loading: status === "idle" || status === "loading",
    error: status === "error" ? errorMsg : null,
    ready: status === "ready",
    retry,
    addOrReplace,
    remove,
  };
}
