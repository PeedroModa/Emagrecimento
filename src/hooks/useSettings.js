import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { ageFromBirthDate } from "../lib/calculations.js";

export const DEFAULT_SETTINGS = {
  goal_kg: 90,
  bf_target: 15,
  height_cm: 175,
  birth_date: null,
  age: 28,
  sex: "M",
  train_days: 3,
  deficit_pct: 15,
  macro_mode: "pct",
  macro_prot_pct: 30,
  macro_fat_pct: 30,
  macro_prot_per_kg: 2,
  macro_fat_per_kg: 0.9,
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

let cache = null;
let status = "idle"; // idle | loading | ready | error
let errorMsg = null;
let saveState = "idle"; // idle | saving | error
let pendingTimer = null;
let snapshotBeforePending = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

export function clearSettingsCache() {
  clearTimeout(pendingTimer);
  pendingTimer = null;
  snapshotBeforePending = null;
  cache = null;
  status = "idle";
  errorMsg = null;
  saveState = "idle";
  notify();
}

// `birth_date` é a fonte da verdade da idade; `age` vira um espelho recalculado
// (e persistido) a cada carga/edição, servindo de fallback quando não há data.
function syncAge(obj) {
  const derived = ageFromBirthDate(obj?.birth_date);
  if (derived != null) obj.age = derived;
  return obj;
}

function pickSettings(row) {
  const out = {};
  for (const k of SETTING_KEYS) {
    if (row[k] != null) out[k] = typeof DEFAULT_SETTINGS[k] === "number" ? +row[k] : row[k];
  }
  return out;
}

async function fetchSettings() {
  status = "loading";
  errorMsg = null;
  notify();
  const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
  if (error) {
    status = "error";
    errorMsg = "Não consegui carregar as configurações. Verifique a conexão e tente de novo.";
  } else {
    cache = syncAge(data ? { ...DEFAULT_SETTINGS, ...pickSettings(data) } : { ...DEFAULT_SETTINGS });
    status = "ready";
  }
  notify();
}

// Atualização otimista: cache muda na hora, escrita no banco é debounced.
// Se a escrita falhar, reverte para o estado anterior ao lote pendente.
function scheduleSave(userId) {
  clearTimeout(pendingTimer);
  saveState = "saving";
  pendingTimer = setTimeout(async () => {
    const toWrite = { user_id: userId, ...cache, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from("user_settings")
      .upsert(toWrite, { onConflict: "user_id" });
    if (error) {
      cache = snapshotBeforePending || cache;
      saveState = "error";
    } else {
      saveState = "idle";
    }
    snapshotBeforePending = null;
    notify();
  }, 600);
}

export function useSettings() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (status === "idle") fetchSettings();
    return () => listeners.delete(fn);
  }, []);

  const retry = useCallback(() => fetchSettings(), []);

  const save = useCallback((patch, userId) => {
    if (!snapshotBeforePending) snapshotBeforePending = { ...(cache || DEFAULT_SETTINGS) };
    cache = syncAge({ ...(cache || DEFAULT_SETTINGS), ...patch });
    notify();
    scheduleSave(userId);
  }, []);

  const dismissSaveError = useCallback(() => {
    saveState = "idle";
    notify();
  }, []);

  return {
    settings: cache || DEFAULT_SETTINGS,
    loading: status === "idle" || status === "loading",
    error: status === "error" ? errorMsg : null,
    ready: status === "ready",
    saveState,
    retry,
    save,
    dismissSaveError,
  };
}
