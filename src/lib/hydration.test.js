import { describe, it, expect } from "vitest";
import {
  hydrationGoalMl, hydrationStatus, dayTotalMl, weightForDay, fmtLiters,
  reminderMessage, localDateISO, timestampForDay, hydrationByDay,
} from "./hydration.js";

describe("hydration — meta e status", () => {
  it("meta = peso × 50 ml/kg (108 kg → 5400 ml); sem peso → null", () => {
    expect(hydrationGoalMl(108)).toBe(5400);
    expect(hydrationGoalMl(null)).toBeNull();
    expect(hydrationGoalMl(0)).toBeNull();
  });

  it("estágios por faixa; 100% exato é 'goal', acima é 'over'", () => {
    const g = 5400;
    expect(hydrationStatus({ totalMl: 0, goalMl: g }).stage).toBe("start");
    expect(hydrationStatus({ totalMl: 1350, goalMl: g }).stage).toBe("low");
    expect(hydrationStatus({ totalMl: 2700, goalMl: g })).toMatchObject({ pct: 50, stage: "half", remainingMl: 2700, level: 0.5 });
    expect(hydrationStatus({ totalMl: 4050, goalMl: g }).stage).toBe("near");
    expect(hydrationStatus({ totalMl: 5400, goalMl: g })).toMatchObject({ pct: 100, stage: "goal", excessMl: 0, level: 1 });
    expect(hydrationStatus({ totalMl: 6000, goalMl: g })).toMatchObject({ pct: 111, stage: "over", excessMl: 600, level: 1 });
    expect(hydrationStatus({ totalMl: 650, goalMl: null }).stage).toBeNull();
  });
});

describe("hydration — dias e peso do dia", () => {
  const logs = [
    { id: "a", logged_at: new Date(2026, 8, 16, 8, 42).toISOString(), amount_ml: 650 },
    { id: "b", logged_at: new Date(2026, 8, 16, 23, 30).toISOString(), amount_ml: 1000 },
    { id: "c", logged_at: new Date(2026, 8, 15, 10, 0).toISOString(), amount_ml: 2000 },
  ];

  it("agrupa por dia LOCAL (23:30 fica no mesmo dia)", () => {
    expect(dayTotalMl(logs, "2026-09-16")).toBe(1650);
    expect(dayTotalMl(logs, "2026-09-15")).toBe(2000);
    expect(dayTotalMl(logs, "2026-09-14")).toBe(0);
  });

  it("peso do dia = última pesagem até a data; antes da primeira usa a primeira", () => {
    const w = [{ date: "2026-09-10", weight: 110 }, { date: "2026-09-15", weight: 108.2 }];
    expect(weightForDay(w, "2026-09-16")).toBe(108.2);
    expect(weightForDay(w, "2026-09-12")).toBe(110);
    expect(weightForDay(w, "2026-09-01")).toBe(110);
    expect(weightForDay([], "2026-09-01")).toBeNull();
  });

  it("timestamp de dia passado mantém a hora atual; hoje = agora", () => {
    const now = new Date(2026, 8, 16, 14, 5, 9);
    expect(timestampForDay("2026-09-16", now)).toBe(now.toISOString());
    const past = new Date(timestampForDay("2026-09-14", now));
    expect(localDateISO(past)).toBe("2026-09-14");
    expect(past.getHours()).toBe(14);
  });
});

describe("hydration — formatação e lembrete", () => {
  it("fmtLiters: ml abaixo de 1 L, litros com vírgula acima", () => {
    expect(fmtLiters(650)).toBe("650 ml");
    expect(fmtLiters(1000)).toBe("1 L");
    expect(fmtLiters(2700)).toBe("2,7 L");
    expect(fmtLiters(5400)).toBe("5,4 L");
    expect(fmtLiters(null)).toBe("—");
  });

  it("lembrete: sem registro / gap ≥ 3h / falta X / nada quando meta batida", () => {
    const now = new Date(2026, 8, 16, 15, 0);
    const status = hydrationStatus({ totalMl: 2700, goalMl: 5400 });
    expect(reminderMessage({ logsToday: [], status, now })).toBe("Nenhum registro ainda hoje.");
    const old = [{ logged_at: new Date(2026, 8, 16, 11, 0).toISOString(), amount_ml: 650 }];
    expect(reminderMessage({ logsToday: old, status, now })).toBe("Já faz cerca de 4h desde seu último registro.");
    const recent = [{ logged_at: new Date(2026, 8, 16, 14, 30).toISOString(), amount_ml: 650 }];
    expect(reminderMessage({ logsToday: recent, status, now })).toBe("Ainda faltam 2,7 L para sua meta de hoje.");
    const done = hydrationStatus({ totalMl: 5400, goalMl: 5400 });
    expect(reminderMessage({ logsToday: old, status: done, now })).toBeNull();
    expect(reminderMessage({ logsToday: old, status: { stage: null }, now })).toBeNull();
  });
});

describe("hydration — hydrationByDay (insumo do motor de insights)", () => {
  it("agrupa por dia local e calcula % contra o peso oficial daquele dia", () => {
    const logs = [
      { logged_at: new Date(2026, 8, 16, 8, 0).toISOString(), amount_ml: 2700 },
      { logged_at: new Date(2026, 8, 16, 20, 0).toISOString(), amount_ml: 2700 },
      { logged_at: new Date(2026, 8, 15, 9, 0).toISOString(), amount_ml: 1000 },
    ];
    const w = [{ date: "2026-09-10", weight: 100 }, { date: "2026-09-16", weight: 108 }];
    expect(hydrationByDay(logs, w)).toEqual([
      { date: "2026-09-15", totalMl: 1000, pct: 20 },
      { date: "2026-09-16", totalMl: 5400, pct: 100 },
    ]);
    expect(hydrationByDay(logs, [])).toEqual([]);
  });
});
