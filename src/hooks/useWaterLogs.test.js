import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResponses = [];

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => mockResponses.shift()() }),
      insert: () => ({ select: () => ({ single: () => mockResponses.shift()() }) }),
      delete: () => ({ eq: () => mockResponses.shift()() }),
    }),
  },
}));

const { fetchAll, addLog, removeLog, clearWaterLogsCache, __test } = await import("./useWaterLogs.js");

beforeEach(() => {
  mockResponses.length = 0;
  clearWaterLogsCache();
});

describe("useWaterLogs", () => {
  it("fetchAll popula o cache em ordem desc", async () => {
    mockResponses.push(() => Promise.resolve({ data: [{ id: "a", logged_at: "2026-09-16T11:00:00Z", amount_ml: "650" }], error: null }));
    await fetchAll();
    expect(__test.getStatus()).toBe("ready");
    expect(__test.getCache()).toEqual([{ id: "a", logged_at: "2026-09-16T11:00:00Z", amount_ml: 650 }]);
  });

  it("addLog: otimista, troca o id temporário pelo do banco e mantém ordem desc", async () => {
    mockResponses.push(() => Promise.resolve({ data: [{ id: "a", logged_at: "2026-09-16T11:00:00Z", amount_ml: 650 }], error: null }));
    await fetchAll();
    mockResponses.push(() => Promise.resolve({ data: { id: "b", logged_at: "2026-09-16T14:00:00Z", amount_ml: 1000 }, error: null }));
    const { error, log } = await addLog({ amountMl: 1000, loggedAt: "2026-09-16T14:00:00Z", userId: "u1" });
    expect(error).toBeNull();
    expect(log.id).toBe("b");
    expect(__test.getCache().map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("addLog com erro reverte o cache; removeLog com erro também", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    const { error } = await addLog({ amountMl: 650, loggedAt: "2026-09-16T14:00:00Z", userId: "u1" });
    expect(error).toBeTruthy();
    expect(__test.getCache()).toBeNull();

    mockResponses.push(() => Promise.resolve({ data: [{ id: "a", logged_at: "2026-09-16T11:00:00Z", amount_ml: 650 }], error: null }));
    await fetchAll();
    mockResponses.push(() => Promise.resolve({ error: { message: "boom" } }));
    const r = await removeLog("a");
    expect(r.error).toBeTruthy();
    expect(__test.getCache()).toHaveLength(1);
  });

  it("removeLog remove do cache", async () => {
    mockResponses.push(() => Promise.resolve({ data: [{ id: "a", logged_at: "2026-09-16T11:00:00Z", amount_ml: 650 }], error: null }));
    await fetchAll();
    mockResponses.push(() => Promise.resolve({ error: null }));
    await removeLog("a");
    expect(__test.getCache()).toEqual([]);
  });
});
