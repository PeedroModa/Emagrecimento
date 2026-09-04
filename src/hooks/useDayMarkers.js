import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

// Marcadores casuais do dia — toque único, opcional, sem confirmação. Mesmo
// padrão de store em módulo dos demais hooks. NULL = "não respondeu" (nunca
// tratado como "não aconteceu" — ver comentário na migração SQL).
const MARKER_KEYS = ["trained", "alcohol", "high_sodium", "travel", "slept_badly"];

let cache = null; // array de {date, trained?, alcohol?, high_sodium?, travel?, slept_badly?, note?}
let status = "idle"; // idle | loading | ready | error
let errorMsg = null;
const listeners = new Set();
let epoch = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function clearDayMarkersCache() {
  epoch++;
  cache = null;
  status = "idle";
  errorMsg = null;
  notify();
}

function fromRow(row) {
  const m = { date: row.date };
  for (const k of MARKER_KEYS) if (row[k] != null) m[k] = row[k];
  if (row.note) m.note = row.note;
  return m;
}

export async function fetchAll() {
  const myEpoch = epoch;
  status = "loading";
  errorMsg = null;
  notify();
  const { data, error } = await supabase
    .from("day_markers")
    .select("*")
    .order("date", { ascending: true });
  if (myEpoch !== epoch) return;
  if (error) {
    status = "error";
    errorMsg = "Não consegui carregar os marcadores. Verifique a conexão e tente de novo.";
  } else {
    cache = data.map(fromRow);
    status = "ready";
  }
  notify();
}

// Alterna um marcador booleano para uma data — upsert parcial (nunca
// sobrescreve os outros marcadores do mesmo dia; PostgREST só toca colunas
// presentes no corpo). Exportada separada do hook para ser testável direto.
export async function toggleMarker(date, key, userId) {
  const existing = (cache || []).find((m) => m.date === date);
  const nextVal = existing?.[key] === true ? null : true;
  const merged = { ...(existing || { date }), [key]: nextVal };
  const anyMarkerLeft = MARKER_KEYS.some((k) => merged[k] === true);
  const hasNote = Boolean(merged.note);
  const prev = cache;

  if (!anyMarkerLeft && !hasNote && existing) {
    // desfazendo a última marcação do dia: apaga a linha, senão viola o
    // CHECK do banco (exige ao menos um campo preenchido)
    cache = (cache || []).filter((m) => m.date !== date);
    notify();
    const { error } = await supabase.from("day_markers").delete().eq("user_id", userId).eq("date", date);
    if (error) {
      cache = prev;
      notify();
      return { error: "Não consegui salvar. Tente de novo." };
    }
    return { error: null };
  }

  cache = [...(cache || []).filter((m) => m.date !== date), merged].sort((a, b) => a.date.localeCompare(b.date));
  notify();
  const { data, error } = await supabase
    .from("day_markers")
    .upsert({ user_id: userId, date, [key]: nextVal }, { onConflict: "user_id,date" })
    .select()
    .single();
  if (error) {
    cache = prev;
    notify();
    return { error: "Não consegui salvar. Tente de novo." };
  }
  cache = cache.map((m) => (m.date === date ? fromRow(data) : m));
  notify();
  return { error: null };
}

export const __test = { getCache: () => cache, getStatus: () => status };

export function useDayMarkers() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (status === "idle") fetchAll();
    return () => listeners.delete(fn);
  }, []);

  const retry = useCallback(() => fetchAll(), []);
  const toggle = useCallback((date, key, userId) => toggleMarker(date, key, userId), []);

  return {
    markers: cache || [],
    loading: status === "idle" || status === "loading",
    error: status === "error" ? errorMsg : null,
    retry,
    toggle,
  };
}
