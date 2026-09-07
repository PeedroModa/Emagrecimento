import { describe, it, expect } from "vitest";
import {
  computeTrendWeight, computeWeeklyReview, computeGoalPace,
  computeMetabolicAdaptation, computePlateau,
} from "./coaching.js";

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (isoStr, k) => iso(new Date(`${isoStr}T00:00:00Z`).getTime() + k * DAY);
const w = (date, weight, extra = {}) => ({ id: date, date, weight, ...extra });
const weekly = (startISO, n, fn) => {
  const s = new Date(`${startISO}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => w(iso(s + i * 7 * DAY), +fn(i).toFixed(2)));
};
const SETTINGS = { goal_kg: 82, height_cm: 178, age: 30, sex: "M", train_days: 3, deficit_pct: 15 };

describe("computeTrendWeight — peso-tendência como número principal", () => {
  it("null com menos de 2 pesagens", () => {
    expect(computeTrendWeight([])).toBeNull();
    expect(computeTrendWeight([w("2026-01-01", 90)])).toBeNull();
  });

  it("média retroativa: abaixo do peso inicial numa queda, e guarda o peso cru da balança", () => {
    const logs = weekly("2026-01-03", 10, (i) => 92 - i * 0.5);
    const tw = computeTrendWeight(logs);
    expect(tw).not.toBeNull();
    expect(tw.current).toBeLessThan(92);
    expect(tw.current).toBeGreaterThan(logs[logs.length - 1].weight - 0.01); // média fica acima do último ponto numa queda
    expect(tw.delta).toBeLessThan(0);
    expect(tw.scaleWeight).toBe(logs[logs.length - 1].weight);
  });
});

describe("computeWeeklyReview — resumo da semana", () => {
  it("null com menos de 2 pesagens ou dados velhos", () => {
    expect(computeWeeklyReview([w("2026-01-01", 90)], SETTINGS, "2026-01-01")).toBeNull();
    const old = weekly("2026-01-03", 6, (i) => 90 - i * 0.3);
    expect(computeWeeklyReview(old, SETTINGS, "2026-06-01")).toBeNull(); // última pesagem > 14 dias atrás
  });

  it("resume a janela de 7 dias ancorada na última pesagem", () => {
    const logs = weekly("2026-01-03", 12, (i) => 92 - i * 0.4);
    const today = logs[logs.length - 1].date;
    const r = computeWeeklyReview(logs, SETTINGS, today);
    expect(r).not.toBeNull();
    expect(r.weighCount).toBe(1);
    expect(r.weightDelta).toBeLessThan(0);          // perdeu vs. a semana anterior
    expect(typeof r.ratePerWeekNow).toBe("number");
    expect(r.periodEndISO).toBe(today);
    expect(r.periodStartISO).toBe(addDays(today, -6));
  });
});

describe("computeGoalPace — plano (data-alvo) vs. projeção", () => {
  const common = { currentWeight: 88, goal: 82, today: "2026-04-01" };

  it("sem data-alvo → no-target; já na meta → reached", () => {
    expect(computeGoalPace({ ...common, goalDateISO: null }).status).toBe("no-target");
    expect(computeGoalPace({ ...common, currentWeight: 80, goalDateISO: "2026-08-01" }).status).toBe("reached");
  });

  it("data-alvo no passado → overdue", () => {
    expect(computeGoalPace({ ...common, today: "2026-07-01", goalDateISO: "2026-06-01" }).status).toBe("overdue");
  });

  it("sem projeção → no-projection com ritmo planejado", () => {
    const r = computeGoalPace({ ...common, goalDateISO: "2026-06-01", projection: null });
    expect(r.status).toBe("no-projection");
    expect(r.plannedRatePerWeek).toBeGreaterThan(0.6);
    expect(r.plannedRatePerWeek).toBeLessThan(0.8);
  });

  it("projeção antes / perto / depois da data-alvo → ahead / on-track / behind", () => {
    const base = { ...common, goalDateISO: "2026-06-15" };
    expect(computeGoalPace({ ...base, projection: { goalDateISO: "2026-06-01" } }).status).toBe("ahead");
    expect(computeGoalPace({ ...base, projection: { goalDateISO: "2026-06-20" } }).status).toBe("on-track");
    expect(computeGoalPace({ ...base, projection: { goalDateISO: "2026-07-20" } }).status).toBe("behind");
  });
});

describe("computeMetabolicAdaptation — manutenção estimada cai com o peso", () => {
  it("null com histórico curto (< 30 dias)", () => {
    expect(computeMetabolicAdaptation(weekly("2026-01-03", 3, () => 90), SETTINGS)).toBeNull();
  });

  it("queda de peso ao longo de meses derruba o TDEE estimado", () => {
    const logs = weekly("2026-01-03", 14, (i) => 95 - i * 0.5);
    const a = computeMetabolicAdaptation(logs, SETTINGS);
    expect(a).not.toBeNull();
    expect(a.points.length).toBeGreaterThanOrEqual(2);
    expect(a.firstTdee).toBeGreaterThan(a.lastTdee);
    expect(a.deltaTdee).toBeLessThan(0);
    expect(a.weightDelta).toBeLessThan(0);
  });
});

describe("computePlateau — platô nomeado", () => {
  it("queda constante não é platô", () => {
    const logs = weekly("2026-01-03", 12, (i) => 92 - i * 0.6);
    expect(computePlateau(logs, 82, 178, logs[logs.length - 1].date).inPlateau).toBe(false);
  });

  it("3+ semanas sem novo mínimo e tendência plana → platô", () => {
    const logs = weekly("2026-01-03", 10, (i) => (i < 3 ? 90 - i * 1.5 : 86.5));
    const today = logs[logs.length - 1].date;
    const p = computePlateau(logs, 82, 178, today);
    expect(p.inPlateau).toBe(true);
    expect(p.weeksStalled).toBeGreaterThanOrEqual(4);
    expect(p.sinceISO).toBe(logs[3].date);
    expect(p.aboveMin).toBeLessThanOrEqual(0.8);
  });

  it("não dispara com dados velhos nem depois da meta", () => {
    const flat = weekly("2026-01-03", 10, (i) => (i < 3 ? 90 - i : 86.5));
    expect(computePlateau(flat, 82, 178, "2026-09-01").stale).toBe(true);
    const belowGoal = weekly("2026-01-03", 10, (i) => (i < 3 ? 90 - i : 81));
    expect(computePlateau(belowGoal, 82, 178, belowGoal[belowGoal.length - 1].date).atGoal).toBe(true);
  });
});
