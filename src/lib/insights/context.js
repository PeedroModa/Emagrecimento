// Constrói, UMA VEZ por render, tudo que as regras de insight precisam —
// série, deltas normalizados, banda de ruído pessoal, tendências em várias
// janelas terminando na última pesagem, recordes. Puro: recebe dados já
// carregados (weighIns, settings), nunca busca nada sozinho.
import { daysBetween, computeSeries, computeRecords, bmi, bmiCategory } from "../calculations.js";
import { ols, normalizedDeltas, noiseBand } from "../stats.js";

const TREND_WINDOWS = [14, 28, 56, 90];

export function buildInsightContext({ weighIns, settings, today, measurements = [] }) {
  const sorted = weighIns || [];
  const n = sorted.length;
  const first = sorted[0] ?? null;
  const last = sorted[n - 1] ?? null;
  const t0 = first?.date ?? today;
  const toT = (date) => daysBetween(t0, date);
  const points = sorted.map((w) => ({ t: toT(w.date), v: w.weight, date: w.date }));

  const series = n ? computeSeries(sorted, settings.height_cm) : [];
  const lastSeries = series[series.length - 1] ?? null;

  const { deltas, dropped } = n >= 2 ? normalizedDeltas(points.map((p) => ({ t: p.t, v: p.v }))) : { deltas: [], dropped: [] };
  const denseDeltaCount = deltas.filter((d) => d.gap <= 2).length;
  const band = deltas.length ? noiseBand(deltas.map((d) => d.scaled), { robustMinN: 5 }) : null;

  function trendWindow(windowDays) {
    if (!last) return null;
    const cutoffT = toT(last.date) - windowDays;
    const inWindow = sorted.filter((w) => toT(w.date) >= cutoffT);
    if (inWindow.length < 2) return null;
    const pts = inWindow.map((w) => ({ x: toT(w.date), y: w.weight, date: w.date }));
    const fit = ols(pts);
    if (!fit) return null;
    return { fit, points: pts, fromDate: inWindow[0].date, toDate: inWindow[inWindow.length - 1].date, n: inWindow.length };
  }
  const trends = Object.fromEntries(TREND_WINDOWS.map((d) => [d, trendWindow(d)]));

  const records = n ? computeRecords(sorted) : null;
  const bmiNow = last ? bmi(last.weight, settings.height_cm) : null;
  const journeyDays = first && last ? daysBetween(first.date, last.date) : 0;

  const goal = settings.goal_kg;
  const totalToLose = first ? +(first.weight - goal).toFixed(1) : null;
  const totalLost = first && last ? +(first.weight - last.weight).toFixed(1) : null;
  const progressPct = totalToLose > 0 && totalLost != null
    ? Math.max(0, Math.min(100, (totalLost / totalToLose) * 100))
    : null;

  return {
    today, t0, n, first, last, sorted, points, series, lastSeries,
    deltas, dropped, denseDeltaCount, band, trends, records,
    bmiNow, bmiCat: bmiCategory(bmiNow), journeyDays,
    goal, totalToLose, totalLost, progressPct,
    settings, measurements,
  };
}
