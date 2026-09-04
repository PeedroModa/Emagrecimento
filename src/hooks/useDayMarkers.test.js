import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResponses = [];

function makeBuilder() {
  const builder = {
    select: () => builder,
    order: () => mockResponses.shift()(),
    upsert: () => builder,
    single: () => mockResponses.shift()(),
    delete: () => builder,
    eq: () => builder,
    then: (resolve, reject) => mockResponses.shift()().then(resolve, reject),
  };
  return builder;
}

vi.mock("../lib/supabase.js", () => ({ supabase: { from: () => makeBuilder() } }));

const { fetchAll, toggleMarker, clearDayMarkersCache, __test } = await import("./useDayMarkers.js");

beforeEach(() => {
  mockResponses.length = 0;
  clearDayMarkersCache();
});

describe("useDayMarkers — fetch", () => {
  it("popula o cache, descartando campos nulos", async () => {
    mockResponses.push(() => Promise.resolve({ data: [{ date: "2026-01-01", trained: true, alcohol: null, note: null }], error: null }));
    await fetchAll();
    expect(__test.getStatus()).toBe("ready");
    expect(__test.getCache()).toEqual([{ date: "2026-01-01", trained: true }]);
  });
});

describe("toggleMarker — toque único", () => {
  it("primeiro toque marca true; upsert só envia a coluna alterada", async () => {
    mockResponses.push(() => Promise.resolve({ data: { date: "2026-01-01", trained: true }, error: null }));
    const { error } = await toggleMarker("2026-01-01", "trained", "u1");
    expect(error).toBeNull();
    expect(__test.getCache()).toEqual([{ date: "2026-01-01", trained: true }]);
  });

  it("segundo toque no mesmo marcador desfaz — se era o único marcador do dia, apaga a linha (evita violar o CHECK)", async () => {
    // primeiro toque
    mockResponses.push(() => Promise.resolve({ data: { date: "2026-01-01", trained: true }, error: null }));
    await toggleMarker("2026-01-01", "trained", "u1");
    expect(__test.getCache()).toHaveLength(1);

    // segundo toque: desmarca — deve DELETAR, não fazer upsert com tudo null
    mockResponses.push(() => Promise.resolve({ error: null }));
    const { error } = await toggleMarker("2026-01-01", "trained", "u1");
    expect(error).toBeNull();
    expect(__test.getCache()).toHaveLength(0);
  });

  it("desmarcar um de vários marcadores do dia mantém a linha (upsert, não delete)", async () => {
    mockResponses.push(() => Promise.resolve({ data: { date: "2026-01-01", trained: true }, error: null }));
    await toggleMarker("2026-01-01", "trained", "u1");
    mockResponses.push(() => Promise.resolve({ data: { date: "2026-01-01", trained: true, alcohol: true }, error: null }));
    await toggleMarker("2026-01-01", "alcohol", "u1");
    expect(__test.getCache()[0]).toEqual({ date: "2026-01-01", trained: true, alcohol: true });

    // desmarca "trained" — "alcohol" ainda true, então a linha permanece
    mockResponses.push(() => Promise.resolve({ data: { date: "2026-01-01", trained: null, alcohol: true }, error: null }));
    await toggleMarker("2026-01-01", "trained", "u1");
    expect(__test.getCache()).toHaveLength(1);
    expect(__test.getCache()[0]).toEqual({ date: "2026-01-01", alcohol: true });
  });

  it("erro no upsert reverte o cache otimista", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    const { error } = await toggleMarker("2026-01-01", "trained", "u1");
    expect(error).toBeTruthy();
    expect(__test.getCache()).toBeNull(); // cache estava vazio (null) antes da tentativa
  });
});
