// Métricas derivadas de "acompanhamento" — resumo semanal, peso-tendência como
// número principal, ritmo vs. data-alvo, adaptação metabólica e platô.
// Tudo função pura: recebe as pesagens/configurações já carregadas, nunca
// toca em Date.now() diretamente (a data "hoje" entra por parâmetro, com
// todayISO() só como default), nunca devolve NaN/Infinity.
//
// A matemática de tendência/calorias/recordes vem de calculations.js sem
// reimplementar nada — este arquivo só compõe.

import {
  daysBetween, addDaysISO, todayISO,
  computeTrend, computeCalories, computeRecords, rateStatus,
  AVG_WINDOW_DAYS,
} from "./calculations.js";
import { movingAverageTrailing } from "./stats.js";

// ── #2 Peso-tendência como número principal ─────────────────────────────
// Média móvel retroativa do peso (mesma janela da curva). Serve para a
// página Hoje mostrar a tendência no lugar do número cru da balança.
export function computeTrendWeight(sortedWeights, windowDays = AVG_WINDOW_DAYS) {
  if (!Array.isArray(sortedWeights) || sortedWeights.length < 2) return null;
  const first = sortedWeights[0].date;
  const ma = movingAverageTrailing(
    sortedWeights.map((w) => ({ t: daysBetween(first, w.date), v: w.weight })),
    windowDays,
    { minPoints: 2 }
  );
  const withAvg = ma.filter((p) => p.avg != null);
  if (!withAvg.length) return null;
  const current = withAvg[withAvg.length - 1].avg;
  const prev = withAvg.length >= 2 ? withAvg[withAvg.length - 2].avg : null;
  return {
    current: +current.toFixed(1),
    prev: prev != null ? +prev.toFixed(1) : null,
    delta: prev != null ? +(current - prev).toFixed(1) : null,
    scaleWeight: sortedWeights[sortedWeights.length - 1].weight,
    windowDays,
  };
}

// ── #3 Resumo da semana ────────────────────────────────────────────────
// Janela de 7 dias ancorada na última pesagem; "semana anterior" são os 7
// dias antes disso. Compara nº de pesagens, variação de peso e ritmo da
// tendência (e se a categoria de ritmo virou). null quando não há base.
export function computeWeeklyReview(sortedWeights, settings, today = todayISO(), heightCm) {
  if (!Array.isArray(sortedWeights) || sortedWeights.length < 2) return null;
  const goal = settings?.goal_kg ?? 90;
  const h = heightCm ?? settings?.height_cm;
  const last = sortedWeights[sortedWeights.length - 1];

  // Não mostra resumo se a última pesagem já está velha (semana "morta").
  if (daysBetween(last.date, today) > 14) return null;

  const endThis = last.date;
  const startThis = addDaysISO(endThis, -6);
  const endPrev = addDaysISO(startThis, -1);
  const startPrev = addDaysISO(endPrev, -6);
  const within = (w, a, b) => w.date >= a && w.date <= b;

  const thisWeek = sortedWeights.filter((w) => within(w, startThis, endThis));
  const prevWeek = sortedWeights.filter((w) => within(w, startPrev, endPrev));

  const trendNow = computeTrend(sortedWeights, goal, h);
  const beforeThisWeek = sortedWeights.filter((w) => w.date <= endPrev);
  const trendPrev = beforeThisWeek.length >= 2 ? computeTrend(beforeThisWeek, goal, h) : null;

  const statusNow = rateStatus(trendNow);
  const statusPrev = rateStatus(trendPrev);
  const categoryChanged =
    statusNow && statusPrev && statusNow.key !== statusPrev.key
      ? { from: statusPrev, to: statusNow }
      : null;

  const lastThis = thisWeek[thisWeek.length - 1] ?? last;
  const lastPrev = prevWeek[prevWeek.length - 1] ?? null;
  const weightDelta = lastPrev ? +(lastThis.weight - lastPrev.weight).toFixed(1) : null;
  const rateDelta =
    trendNow && trendPrev ? +(trendNow.perWeek - trendPrev.perWeek).toFixed(2) : null;

  return {
    periodStartISO: startThis,
    periodEndISO: endThis,
    weighCount: thisWeek.length,
    weighCountPrev: prevWeek.length,
    weightDelta,
    ratePerWeekNow: trendNow?.perWeek ?? null,
    ratePerWeekPrev: trendPrev?.perWeek ?? null,
    rateDelta,
    statusNow,
    categoryChanged,
    weeksToGoal: trendNow?.weeksToGoal ?? null,
  };
}

// ── #4 Ritmo vs. data-alvo ─────────────────────────────────────────────
// Compara a data em que a projeção crava a meta (projection.goalDateISO,
// vindo de computeProjection) com a data-alvo escolhida pelo usuário.
export function computeGoalPace({ currentWeight, goal, goalDateISO, projection, today = todayISO() }) {
  if (!goalDateISO) return { status: "no-target" };
  if (currentWeight == null || goal == null) return { status: "no-target" };
  if (currentWeight <= goal) return { status: "reached", goalDateISO };

  const plannedDays = daysBetween(today, goalDateISO);
  if (plannedDays <= 0) return { status: "overdue", goalDateISO, plannedDays };

  const remaining = +(currentWeight - goal).toFixed(1);
  const plannedRatePerWeek = +(remaining / (plannedDays / 7)).toFixed(2);
  const projectedDateISO = projection?.goalDateISO ?? null;

  if (!projectedDateISO) {
    return { status: "no-projection", goalDateISO, plannedDays, plannedRatePerWeek, remaining };
  }

  const deltaDays = daysBetween(goalDateISO, projectedDateISO); // >0 = projeção depois da meta (atrasado)
  let status = "on-track";
  if (deltaDays > 10) status = "behind";
  else if (deltaDays < -10) status = "ahead";

  return { status, goalDateISO, projectedDateISO, deltaDays, plannedRatePerWeek, remaining, plannedDays };
}

// ── #5 Adaptação metabólica visível ───────────────────────────────────
// À medida que o peso cai, o Mifflin-St Jeor recalcula a manutenção para
// baixo. Aqui a trajetória vira série (para um sparkline) + o total perdido
// de gasto. É a estimativa da fórmula, não medição — a UI diz isso.
export function computeMetabolicAdaptation(sortedWeights, settings) {
  if (!Array.isArray(sortedWeights) || sortedWeights.length < 2) return null;
  const spanDays = daysBetween(sortedWeights[0].date, sortedWeights[sortedWeights.length - 1].date);
  if (spanDays < 30) return null;

  const base = {
    hasWeights: true,
    height: settings?.height_cm,
    age: settings?.age,
    sex: settings?.sex,
    trainDays: settings?.train_days,
    deficitPct: settings?.deficit_pct,
  };
  const tdeeAt = (weight) => computeCalories({ ...base, currentWeight: weight }).tdee;

  const step = Math.max(1, Math.ceil(sortedWeights.length / 16));
  const points = [];
  for (let i = 0; i < sortedWeights.length; i += step) {
    const w = sortedWeights[i];
    const tdee = tdeeAt(w.weight);
    if (tdee != null) points.push({ dateISO: w.date, weight: w.weight, tdee });
  }
  const lastW = sortedWeights[sortedWeights.length - 1];
  if (!points.length || points[points.length - 1].dateISO !== lastW.date) {
    const tdee = tdeeAt(lastW.weight);
    if (tdee != null) points.push({ dateISO: lastW.date, weight: lastW.weight, tdee });
  }
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const deltaTdee = last.tdee - first.tdee;
  const months = spanDays / 30.437;

  return {
    points,
    firstTdee: first.tdee,
    lastTdee: last.tdee,
    deltaTdee,
    deltaPerMonth: months >= 1 ? Math.round(deltaTdee / months) : null,
    weightDelta: +(last.weight - first.weight).toFixed(1),
    spanDays,
  };
}

// ── #6 Platô nomeado ───────────────────────────────────────────────────
// Platô = 3+ semanas sem novo mínimo (peso atual ≤ 0,8 kg acima do menor já
// registrado) E tendência recente praticamente plana (|ritmo| < 0,12
// kg/sem). Não dispara se a última pesagem está velha, nem se já chegou na
// meta. `weeksStalled` conta desde a data do mínimo.
export function computePlateau(sortedWeights, goal, heightCm, today = todayISO()) {
  if (!Array.isArray(sortedWeights) || sortedWeights.length < 4) return { inPlateau: false };
  const last = sortedWeights[sortedWeights.length - 1];
  if (daysBetween(last.date, today) > 21) return { inPlateau: false, stale: true };
  if (goal != null && last.weight <= goal) return { inPlateau: false, atGoal: true };

  const records = computeRecords(sortedWeights);
  if (!records?.min) return { inPlateau: false };
  const daysSinceMin = daysBetween(records.min.date, last.date);
  const aboveMin = +(last.weight - records.min.weight).toFixed(1);

  const trend = computeTrend(sortedWeights, goal ?? 0, heightCm);
  const flat = !!trend && Math.abs(trend.perWeek) < 0.12;

  const inPlateau = daysSinceMin >= 21 && aboveMin <= 0.8 && flat;
  return {
    inPlateau,
    weeksStalled: Math.round(daysSinceMin / 7),
    sinceISO: records.min.date,
    aboveMin,
    ratePerWeek: trend?.perWeek ?? null,
  };
}
