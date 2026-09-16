import { describe, it, expect } from "vitest";
import { normalizeSession, parseTrainingImport, trainingLoad, applyTrainingLoad, mergeTrainingIntoMarkers } from "./training.js";
import { activityFactor } from "./calculations.js";

const gravl = (externalId, startDate, duration, extra = {}) => ({ externalId, startDate, duration, name: "Monday", type: 0, volume: 1000, calories: 300, ...extra });

describe("training — normalização do Gravl", () => {
  it("converte startDate para dia LOCAL e detecta cardio pelo nome ou volume zero", () => {
    const s = normalizeSession(gravl("a", new Date(2026, 8, 10, 19, 10).toISOString(), 42));
    expect(s).toMatchObject({ external_id: "a", date: "2026-09-10", minutes: 42, kind: "strength", calories: 300, source: "gravl" });
    expect(normalizeSession(gravl("b", "2026-09-01T23:44:26Z", 6, { name: "Cardio" })).kind).toBe("cardio");
    expect(normalizeSession(gravl("c", "2026-09-01T23:44:26Z", 40, { volume: 0 })).kind).toBe("cardio");
  });

  it("descarta sem id, sem data ou minutos inválidos; aceita linhas já normalizadas", () => {
    expect(normalizeSession({ startDate: "2026-09-01T10:00:00Z", duration: 30 })).toBeNull();
    expect(normalizeSession(gravl("x", "lixo", 30))).toBeNull();
    expect(normalizeSession(gravl("x", "2026-09-01T10:00:00Z", 0))).toBeNull();
    expect(normalizeSession({ external_id: "n", date: "2026-09-01", minutes: 50 })).toMatchObject({ external_id: "n", date: "2026-09-01", minutes: 50 });
  });

  it("parseTrainingImport aceita lista ou {workouts}, dedup por id, ordena por data", () => {
    const text = JSON.stringify({ workouts: [gravl("2", "2026-09-05T12:00:00Z", 20), gravl("1", "2026-09-01T12:00:00Z", 50), gravl("2", "2026-09-05T12:00:00Z", 25)] });
    const { error, sessions } = parseTrainingImport(text);
    expect(error).toBeNull();
    expect(sessions.map((s) => [s.external_id, s.minutes])).toEqual([["1", 50], ["2", 25]]);
    expect(parseTrainingImport("{").error).toBeTruthy();
    expect(parseTrainingImport("[]").error).toBeTruthy();
  });
});

describe("training — carga real e fator de atividade", () => {
  const sessions = [
    { external_id: "1", date: "2026-09-14", minutes: 39 },
    { external_id: "2", date: "2026-09-13", minutes: 37 },
    { external_id: "3", date: "2026-09-10", minutes: 42 },
    { external_id: "4", date: "2026-09-07", minutes: 55 },
    { external_id: "5", date: "2026-09-06", minutes: 50 },
    { external_id: "6", date: "2026-09-05", minutes: 20 },
    { external_id: "7", date: "2026-09-03", minutes: 56 },
    { external_id: "8", date: "2026-09-01", minutes: 53 },
    { external_id: "9", date: "2026-07-01", minutes: 60 }, // fora da janela
  ];

  it("janela de 28 dias: sessões/semana, minutos médios; ignora o que está fora", () => {
    const load = trainingLoad(sessions, "2026-09-16");
    expect(load).toMatchObject({ count: 8, sessionsPerWeek: 2, avgMinutes: 44, lastDate: "2026-09-14" });
    expect(load.weeklyMinutes).toBe(Math.round(352 / 4));
  });

  it("menos de 2 sessões na janela → null, e settings ficam como estão", () => {
    expect(trainingLoad(sessions.slice(0, 1), "2026-09-16")).toBeNull();
    const settings = { train_days: 3, train_minutes: 60 };
    expect(applyTrainingLoad(settings, [], "2026-09-16")).toBe(settings);
  });

  it("applyTrainingLoad sobrescreve dias/minutos e o fator muda de acordo", () => {
    const eff = applyTrainingLoad({ train_days: 3, train_minutes: 60, neat_level: "mostly_sitting" }, sessions, "2026-09-16");
    expect(eff.train_days).toBe(2);
    expect(eff.train_minutes).toBe(44);
    expect(eff.training_load.count).toBe(8);
    const f = activityFactor({ neatLevel: eff.neat_level, trainDays: eff.train_days, trainMinutes: eff.train_minutes }).factor;
    expect(f).toBeCloseTo(1.4 + 2 * 44 * 0.00045, 3);
  });

  it("mergeTrainingIntoMarkers liga trained=true sem apagar marcadores manuais", () => {
    const merged = mergeTrainingIntoMarkers(
      [{ date: "2026-09-10", alcohol: true }, { date: "2026-09-11", slept_badly: true }],
      [{ date: "2026-09-10", minutes: 40 }, { date: "2026-09-12", minutes: 40 }]
    );
    expect(merged).toEqual([
      { date: "2026-09-10", alcohol: true, trained: true },
      { date: "2026-09-11", slept_badly: true },
      { date: "2026-09-12", trained: true },
    ]);
  });
});
