import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResponses = [];

function makeBuilder() {
  const builder = {
    select: () => builder,
    upsert: () => builder,
    then: (resolve, reject) => mockResponses.shift()().then(resolve, reject),
  };
  return builder;
}

vi.mock("../lib/supabase.js", () => ({ supabase: { from: () => makeBuilder() } }));

const { fetchInsightStates, flushSeen, dismissInsight, clearInsightStateCache, __test } = await import("./useInsightState.js");

beforeEach(() => {
  mockResponses.length = 0;
  clearInsightStateCache();
});

describe("useInsightState — fetch", () => {
  it("popula o cache indexado por insight_key", async () => {
    mockResponses.push(() => Promise.resolve({
      data: [{ insight_key: "plateau:2026-01-01..2026-01-28", status: "seen", payload_hash: "h1" }],
      error: null,
    }));
    await fetchInsightStates();
    expect(__test.getStatus()).toBe("ready");
    expect(__test.getCache()["plateau:2026-01-01..2026-01-28"].payload_hash).toBe("h1");
  });

  it("erro vira status 'error'", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    await fetchInsightStates();
    expect(__test.getStatus()).toBe("error");
  });

  it("clearInsightStateCache() zera cache e status", async () => {
    mockResponses.push(() => Promise.resolve({ data: [], error: null }));
    await fetchInsightStates();
    clearInsightStateCache();
    expect(__test.getCache()).toEqual({});
    expect(__test.getStatus()).toBe("idle");
  });
});

describe("flushSeen — grava em lote", () => {
  it("upsert bem-sucedido atualiza o cache com status 'seen'", async () => {
    mockResponses.push(() => Promise.resolve({ error: null }));
    const { error } = await flushSeen("u1", [["starting-point:2026-01-01", { ruleId: "starting-point", hash: "h1" }]]);
    expect(error).toBeNull();
    expect(__test.getCache()["starting-point:2026-01-01"].status).toBe("seen");
    expect(__test.getCache()["starting-point:2026-01-01"].payload_hash).toBe("h1");
  });

  it("lista vazia não chama o banco (sem entradas pendentes)", async () => {
    const { error } = await flushSeen("u1", []);
    expect(error).toBeNull();
    expect(mockResponses).toHaveLength(0);
  });

  it("erro na gravação não altera o cache", async () => {
    mockResponses.push(() => Promise.resolve({ error: { message: "boom" } }));
    const { error } = await flushSeen("u1", [["x:1", { ruleId: "x", hash: "h" }]]);
    expect(error).toBeTruthy();
    expect(__test.getCache()["x:1"]).toBeUndefined();
  });
});

describe("dismissInsight — otimista com rollback", () => {
  it("marca como dispensado na hora (otimista) e mantém após sucesso", async () => {
    mockResponses.push(() => Promise.resolve({ error: null }));
    const { error } = await dismissInsight("u1", { key: "plateau:x", ruleId: "plateau", payloadHash: "h1" });
    expect(error).toBeNull();
    expect(__test.getCache()["plateau:x"].status).toBe("dismissed");
  });

  it("reverte o cache se a gravação falhar", async () => {
    mockResponses.push(() => Promise.resolve({ error: { message: "boom" } }));
    const { error } = await dismissInsight("u1", { key: "plateau:x", ruleId: "plateau", payloadHash: "h1" });
    expect(error).toBeTruthy();
    expect(__test.getCache()["plateau:x"]).toBeUndefined();
  });
});
