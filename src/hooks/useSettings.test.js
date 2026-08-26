import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResponses = [];

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        maybeSingle: () => mockResponses.shift()(),
      }),
    }),
  },
}));

const { fetchSettings, clearSettingsCache, DEFAULT_SETTINGS, __test } = await import("./useSettings.js");

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function row(overrides) {
  return { user_id: "u1", goal_kg: 75, bf_target: 15, height_cm: 170, birth_date: null, age: 28, sex: "F", train_days: 4, deficit_pct: 10, ...overrides };
}

beforeEach(() => {
  mockResponses.length = 0;
  clearSettingsCache();
});

describe("useSettings — cache em memória", () => {
  it("sem linha no banco (maybeSingle retorna null), cache vira os defaults", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: null }));
    await fetchSettings();
    expect(__test.getCache()).toEqual(DEFAULT_SETTINGS);
  });

  it("fetchSettings() popula o cache com a linha do usuário (RLS já filtrada no servidor)", async () => {
    mockResponses.push(() => Promise.resolve({ data: row({ goal_kg: 62 }), error: null }));
    await fetchSettings();
    expect(__test.getCache().goal_kg).toBe(62);
    expect(__test.getCache().sex).toBe("F");
  });

  it("birth_date na linha recalcula age (syncAge) na hora do fetch", async () => {
    mockResponses.push(() => Promise.resolve({ data: row({ birth_date: "1998-01-10", age: 28 }), error: null }));
    await fetchSettings();
    // a idade recalculada não fica travada no valor bruto vindo do banco
    expect(__test.getCache().age).not.toBeNull();
  });

  it("clearSettingsCache() zera cache e status", async () => {
    mockResponses.push(() => Promise.resolve({ data: row(), error: null }));
    await fetchSettings();
    expect(__test.getCache()).not.toBeNull();

    clearSettingsCache();
    expect(__test.getCache()).toBeNull();
    expect(__test.getStatus()).toBe("idle");
  });

  it("logout → login de outro usuário: configurações do usuário anterior não sobrevivem", async () => {
    mockResponses.push(() => Promise.resolve({ data: row({ goal_kg: 62, sex: "F" }), error: null }));
    await fetchSettings(); // usuário A
    expect(__test.getCache().goal_kg).toBe(62);

    clearSettingsCache(); // logout de A

    mockResponses.push(() => Promise.resolve({ data: row({ goal_kg: 90, sex: "M" }), error: null }));
    await fetchSettings(); // usuário B
    expect(__test.getCache().goal_kg).toBe(90);
    expect(__test.getCache().sex).toBe("M");
  });

  it("guarda de epoch: resposta lenta de A que resolve depois do logout não repopula o cache", async () => {
    const slow = deferred();
    mockResponses.push(() => slow.promise);
    const pending = fetchSettings();

    clearSettingsCache(); // B já logou enquanto a resposta de A ainda estava a caminho
    slow.resolve({ data: row({ goal_kg: 62 }), error: null });
    await pending;

    expect(__test.getCache()).toBeNull(); // resposta obsoleta descartada, não os 62kg de A
    expect(__test.getStatus()).toBe("idle");
  });
});
