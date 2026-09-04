import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResponses = [];

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => mockResponses.shift()() }),
      upsert: () => ({ select: () => ({ single: () => mockResponses.shift()() }) }),
      delete: () => ({ eq: () => mockResponses.shift()() }),
    }),
  },
}));

const { fetchAll, clearMeasurementsCache, __test } = await import("./useMeasurements.js");

function row(id, date, overrides = {}) {
  return { id, date, waist_cm: null, neck_cm: null, hip_cm: null, chest_cm: null, arm_cm: null, thigh_cm: null, note: null, ...overrides };
}

beforeEach(() => {
  mockResponses.length = 0;
  clearMeasurementsCache();
});

describe("useMeasurements — cache em memória", () => {
  it("fetchAll() popula o cache, descartando campos nulos (RLS já filtrada no servidor)", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("m1", "2026-01-01", { waist_cm: 90, hip_cm: 100 })], error: null }));
    await fetchAll();
    expect(__test.getStatus()).toBe("ready");
    expect(__test.getCache()).toEqual([{ id: "m1", date: "2026-01-01", waist: 90, hip: 100 }]);
  });

  it("erro na resposta vira status 'error' e cache continua vazio", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    await fetchAll();
    expect(__test.getStatus()).toBe("error");
    expect(__test.getCache()).toBeNull();
  });

  it("clearMeasurementsCache() zera cache e status", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("m1", "2026-01-01")], error: null }));
    await fetchAll();
    expect(__test.getCache()).not.toBeNull();
    clearMeasurementsCache();
    expect(__test.getCache()).toBeNull();
    expect(__test.getStatus()).toBe("idle");
  });

  it("logout → login de outro usuário: nenhuma medida do usuário anterior sobrevive", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("m1", "2026-01-01", { waist_cm: 90 })], error: null }));
    await fetchAll();
    expect(__test.getCache()).toEqual([{ id: "m1", date: "2026-01-01", waist: 90 }]);

    clearMeasurementsCache();

    mockResponses.push(() => Promise.resolve({ data: [row("m2", "2026-02-01", { waist_cm: 70 })], error: null }));
    await fetchAll();
    expect(__test.getCache()).toEqual([{ id: "m2", date: "2026-02-01", waist: 70 }]);
  });
});
