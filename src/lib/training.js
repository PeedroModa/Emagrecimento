// Treinos reais → fator de atividade e marcador "treino". Funções puras.
// A origem hoje é o Gravl (via arquivo JSON ou api/training-sync); o formato
// normalizado é o da tabela training_sessions.
import { daysBetween } from "./calculations.js";
import { localDateISO } from "./hydration.js";

export const TRAINING_WINDOW_DAYS = 28;
export const TRAINING_MIN_SESSIONS = 2;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Aceita tanto a saída bruta do Gravl ({externalId, startDate, duration,
// name, type, calories}) quanto linhas já normalizadas ({external_id, date,
// minutes, ...}). Descarta o que não tiver id, dia e minutos válidos.
export function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const externalId = raw.external_id ?? raw.externalId;
  const minutes = Math.round(+(raw.minutes ?? raw.duration));
  let date = raw.date;
  if (!date && raw.startDate) {
    const d = new Date(raw.startDate);
    if (!Number.isNaN(d.getTime())) date = localDateISO(d);
  }
  if (!externalId || !DATE_RE.test(date || "") || !(minutes > 0) || minutes > 600) return null;
  const name = String(raw.name ?? "").toLowerCase();
  const kind = raw.kind ?? (name.includes("cardio") || raw.volume === 0 ? "cardio" : "strength");
  const calories = raw.calories != null && +raw.calories >= 0 ? Math.round(+raw.calories) : null;
  return { external_id: String(externalId), date, minutes, kind, calories, source: raw.source ?? "gravl" };
}

export function parseTrainingImport(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { error: "Arquivo inválido. Use um .json com os treinos." }; }
  const raw = Array.isArray(parsed) ? parsed : parsed?.workouts ?? parsed?.sessions;
  if (!Array.isArray(raw)) return { error: "Arquivo inválido. Esperava uma lista de treinos." };
  const byId = new Map();
  for (const r of raw) { const s = normalizeSession(r); if (s) byId.set(s.external_id, s); }
  const sessions = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!sessions.length) return { error: "Nenhum treino válido no arquivo." };
  return { error: null, sessions };
}

// Volume real nas últimas `windowDays` até `today`. null quando há menos de
// TRAINING_MIN_SESSIONS na janela — aí Ajustes (botões estáticos) manda.
export function trainingLoad(sessions, today, windowDays = TRAINING_WINDOW_DAYS) {
  const inWindow = (sessions || []).filter((s) => {
    const d = daysBetween(s.date, today);
    return d >= 0 && d < windowDays;
  });
  if (inWindow.length < TRAINING_MIN_SESSIONS) return null;
  const totalMin = inWindow.reduce((a, s) => a + s.minutes, 0);
  const weeks = windowDays / 7;
  return {
    count: inWindow.length,
    windowDays,
    sessionsPerWeek: +(inWindow.length / weeks).toFixed(1),
    avgMinutes: Math.round(totalMin / inWindow.length),
    weeklyMinutes: Math.round(totalMin / weeks),
    lastDate: inWindow.reduce((m, s) => (s.date > m ? s.date : m), inWindow[0].date),
  };
}

// Settings "efetivos": treino real sobrescreve train_days/train_minutes.
// Não persiste nada — só o que a calculadora de calorias vê.
export function applyTrainingLoad(settings, sessions, today) {
  const load = trainingLoad(sessions, today);
  if (!load) return settings;
  return { ...settings, train_days: load.sessionsPerWeek, train_minutes: load.avgMinutes, training_load: load };
}

// Marcador "treino" derivado das sessões, unido aos marcadores manuais.
// Nunca apaga um marcador manual; só liga trained=true nos dias com sessão.
export function mergeTrainingIntoMarkers(markers, sessions) {
  if (!sessions?.length) return markers || [];
  const byDate = new Map((markers || []).map((m) => [m.date, m]));
  for (const s of sessions) {
    const m = byDate.get(s.date);
    byDate.set(s.date, m ? { ...m, trained: true } : { date: s.date, trained: true });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
