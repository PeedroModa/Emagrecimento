import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

// Store em módulo: cache em memória compartilhado entre páginas (1 fetch inicial, sem waterfalls)
let cache = null; // array de {id, date, weight, waist?, neck?, note?}
let status = "idle"; // idle | loading | ready | error
let errorMsg = null;
const listeners = new Set();

// Incrementado a cada clearWeighInsCache() (chamado no logout). fetchAll()
// captura o epoch vigente antes do await e descarta a resposta se ele mudou
// enquanto esperava — sem isso, um fetch lento do usuário A que resolve
// DEPOIS de B já ter logado na mesma aba repopularia o cache com dados de A.
let epoch = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function clearWeighInsCache() {
  epoch++;
  cache = null;
  status = "idle";
  errorMsg = null;
  notify();
}

function fromRow(row) {
  const w = { id: row.id, date: row.date, weight: +row.weight_kg };
  if (row.waist_cm != null) w.waist = +row.waist_cm;
  if (row.neck_cm != null) w.neck = +row.neck_cm;
  if (row.note) w.note = row.note;
  // Sem gate de truthy: null (nunca perguntado) precisa sobreviver distinto
  // de [] (perguntado, pulou) e de um array preenchido.
  w.context_tags = row.context_tags ?? null;
  return w;
}

function toRow(entry, userId) {
  const row = {
    user_id: userId,
    date: entry.date,
    weight_kg: entry.weight,
    waist_cm: entry.waist ?? null,
    neck_cm: entry.neck ?? null,
    note: entry.note ?? null,
  };
  // Só inclui a coluna se o entry explicitamente a trouxer — assim editar
  // peso/cintura/nota de uma pesagem nunca apaga uma tag de contexto já salva
  // (PostgREST só toca colunas presentes no corpo da requisição).
  if (entry.context_tags !== undefined) row.context_tags = entry.context_tags;
  return row;
}

// Exportada só para teste (mock de supabase.js) — dentro do app, use sempre
// o hook useWeighIns(), que coordena cache/status/listeners corretamente.
export async function fetchAll() {
  const myEpoch = epoch;
  status = "loading";
  errorMsg = null;
  notify();
  const { data, error } = await supabase
    .from("weigh_ins")
    .select("*")
    .order("date", { ascending: true });
  if (myEpoch !== epoch) return; // sessão trocou enquanto a resposta estava a caminho
  if (error) {
    status = "error";
    errorMsg = "Não consegui carregar as pesagens. Verifique a conexão e tente de novo.";
  } else {
    cache = data.map(fromRow);
    status = "ready";
  }
  notify();
}

// Patch parcial de context_tags (não passa por toRow/addOrReplace/update,
// que exigem o entry completo) — mesmo padrão otimista+rollback dos demais
// mutadores. Exportada só para teste, dentro do app use setContextTags() do hook.
export async function patchContextTags(id, tags) {
  const prev = cache;
  cache = (cache || []).map((w) => (w.id === id ? { ...w, context_tags: tags } : w));
  notify();
  const { data, error } = await supabase
    .from("weigh_ins")
    .update({ context_tags: tags, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    cache = prev;
    notify();
    return { error: "Não consegui salvar o contexto. Tente de novo." };
  }
  cache = cache.map((w) => (w.id === id ? fromRow(data) : w));
  notify();
  return { error: null };
}

// Só para teste (Vitest, mock de supabase.js) — o app nunca deve ler o
// cache por aqui, só através do hook useWeighIns().
export const __test = { getCache: () => cache, getStatus: () => status };

export function useWeighIns() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (status === "idle") fetchAll();
    return () => listeners.delete(fn);
  }, []);

  const retry = useCallback(() => fetchAll(), []);

  // Adiciona ou substitui a pesagem da data (UNIQUE user_id+date no banco)
  const addOrReplace = useCallback(async (entry, userId) => {
    const prev = cache;
    const optimistic = {
      ...entry,
      id: entry.id || `tmp-${Date.now()}`,
    };
    cache = [...(cache || []).filter((w) => w.date !== entry.date), optimistic].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    notify();
    const { data, error } = await supabase
      .from("weigh_ins")
      .upsert(toRow(entry, userId), { onConflict: "user_id,date" })
      .select()
      .single();
    if (error) {
      cache = prev;
      notify();
      return { error: "Não consegui salvar a pesagem. Tente de novo." };
    }
    cache = [...cache.filter((w) => w.date !== entry.date), fromRow(data)].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    notify();
    return { error: null };
  }, []);

  const update = useCallback(async (id, entry, userId) => {
    const prev = cache;
    cache = (cache || [])
      .map((w) => (w.id === id ? { id, ...entry } : w))
      .sort((a, b) => a.date.localeCompare(b.date));
    notify();
    const { data, error } = await supabase
      .from("weigh_ins")
      .update({ ...toRow(entry, userId), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      cache = prev;
      notify();
      const isDup = error.code === "23505";
      return {
        error: isDup
          ? "Já existe outra pesagem nessa data. Edite ou remova a outra primeiro."
          : "Não consegui salvar a edição. Tente de novo.",
      };
    }
    cache = cache.map((w) => (w.id === id ? fromRow(data) : w));
    notify();
    return { error: null };
  }, []);

  const remove = useCallback(async (id) => {
    const prev = cache;
    cache = (cache || []).filter((w) => w.id !== id);
    notify();
    const { error } = await supabase.from("weigh_ins").delete().eq("id", id);
    if (error) {
      cache = prev;
      notify();
      return { error: "Não consegui remover a pesagem. Tente de novo." };
    }
    return { error: null };
  }, []);

  // Import com merge por data (arquivo vence em datas repetidas)
  const importMerge = useCallback(async (logs, userId) => {
    const rows = logs.map((l) => toRow(l, userId));
    const { error } = await supabase
      .from("weigh_ins")
      .upsert(rows, { onConflict: "user_id,date" });
    if (error) {
      return { error: "Não consegui importar as pesagens. Tente de novo." };
    }
    await fetchAll();
    return { error: null };
  }, []);

  const setContextTags = useCallback((id, tags) => patchContextTags(id, tags), []);

  return {
    weighIns: cache || [],
    loading: status === "idle" || status === "loading",
    error: status === "error" ? errorMsg : null,
    ready: status === "ready",
    retry,
    addOrReplace,
    update,
    remove,
    importMerge,
    setContextTags,
  };
}
