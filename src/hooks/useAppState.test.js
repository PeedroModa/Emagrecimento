import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResponses = [];

// Builder genérico thenable: cada método de encadeamento devolve o próprio
// builder; só o await final consome a próxima resposta da fila. Reflete como
// o query builder real do supabase-js funciona (thenable, chain arbitrária).
function makeBuilder() {
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    eq: () => builder,
    maybeSingle: () => builder,
    single: () => builder,
    then: (resolve, reject) => mockResponses.shift()().then(resolve, reject),
  };
  return builder;
}

vi.mock("../lib/supabase.js", () => ({ supabase: { from: () => makeBuilder() } }));

const { fetchAndRotateVisit, clearAppStateCache, __test } = await import("./useAppState.js");

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  mockResponses.length = 0;
  clearAppStateCache();
});

describe("useAppState — primeira visita, sem linha no banco", () => {
  it("cria a linha com last_visit_at agora e previous_visit_at null", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: null })); // select
    mockResponses.push(() => Promise.resolve({ data: { user_id: "u1", last_visit_at: "2026-09-03T10:00:00.000Z", previous_visit_at: null }, error: null })); // insert
    await fetchAndRotateVisit("u1");
    expect(__test.getStatus()).toBe("ready");
    expect(__test.getCache().previous_visit_at).toBeNull();
  });
});

describe("useAppState — visita dentro da janela de 30min", () => {
  it("não gira: previous_visit_at continua o mesmo", async () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5min atrás
    mockResponses.push(() => Promise.resolve({
      data: { user_id: "u1", last_visit_at: recent, previous_visit_at: "2026-08-01T00:00:00.000Z" }, error: null,
    }));
    await fetchAndRotateVisit("u1");
    expect(__test.getCache().previous_visit_at).toBe("2026-08-01T00:00:00.000Z");
    expect(__test.getCache().last_visit_at).toBe(recent);
  });
});

describe("useAppState — visita depois da janela de 30min", () => {
  it("gira: previous_visit_at vira o last_visit_at antigo, last_visit_at vira agora", async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h atrás
    mockResponses.push(() => Promise.resolve({
      data: { user_id: "u1", last_visit_at: old, previous_visit_at: "2026-07-01T00:00:00.000Z" }, error: null,
    }));
    mockResponses.push(() => Promise.resolve({
      data: { user_id: "u1", last_visit_at: "2026-09-03T12:00:00.000Z", previous_visit_at: old }, error: null,
    }));
    await fetchAndRotateVisit("u1");
    expect(__test.getCache().previous_visit_at).toBe(old);
  });
});

describe("useAppState — cache e epoch", () => {
  it("clearAppStateCache() zera cache e status", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: null }));
    mockResponses.push(() => Promise.resolve({ data: { last_visit_at: "x", previous_visit_at: null }, error: null }));
    await fetchAndRotateVisit("u1");
    expect(__test.getCache()).not.toBeNull();

    clearAppStateCache();
    expect(__test.getCache()).toBeNull();
    expect(__test.getStatus()).toBe("idle");
  });

  it("guarda de epoch: resposta lenta que resolve depois do logout não repopula o cache", async () => {
    const slow = deferred();
    mockResponses.push(() => slow.promise);
    const pending = fetchAndRotateVisit("u1");

    clearAppStateCache();
    slow.resolve({ data: null, error: null });
    await pending;

    expect(__test.getCache()).toBeNull();
    expect(__test.getStatus()).toBe("idle");
  });

  it("erro na resposta vira status 'error'", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    await fetchAndRotateVisit("u1");
    expect(__test.getStatus()).toBe("error");
  });
});
