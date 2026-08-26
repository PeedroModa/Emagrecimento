import { describe, it, expect, vi, beforeEach } from "vitest";

// Fila de respostas controladas pelo teste — cada fetchAll() consome a
// próxima. Prefixo "mock" é exigido pelo Vitest para referenciar a variável
// de dentro do factory hoisted de vi.mock.
const mockResponses = [];

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => mockResponses.shift()(),
      }),
    }),
  },
}));

const { fetchAll, clearWeighInsCache, __test } = await import("./useWeighIns.js");

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function row(id, date, weightKg) {
  return { id, date, weight_kg: weightKg, waist_cm: null, neck_cm: null, note: null };
}

beforeEach(() => {
  mockResponses.length = 0;
  clearWeighInsCache();
});

describe("useWeighIns — cache em memória", () => {
  it("fetchAll() popula o cache com a resposta (RLS já filtrada no servidor)", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("a1", "2026-01-01", 80)], error: null }));
    await fetchAll();
    expect(__test.getStatus()).toBe("ready");
    expect(__test.getCache()).toEqual([{ id: "a1", date: "2026-01-01", weight: 80 }]);
  });

  it("erro na resposta vira status 'error' e cache continua vazio", async () => {
    mockResponses.push(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    await fetchAll();
    expect(__test.getStatus()).toBe("error");
    expect(__test.getCache()).toBeNull();
  });

  it("clearWeighInsCache() zera cache e status, mesmo com dados carregados", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("a1", "2026-01-01", 80)], error: null }));
    await fetchAll();
    expect(__test.getCache()).not.toBeNull();

    clearWeighInsCache();
    expect(__test.getCache()).toBeNull();
    expect(__test.getStatus()).toBe("idle");
  });

  it("logout → login de outro usuário: nenhum dado do usuário anterior sobrevive", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("a1", "2026-01-01", 80)], error: null }));
    await fetchAll(); // "usuário A" loga
    expect(__test.getCache()).toEqual([{ id: "a1", date: "2026-01-01", weight: 80 }]);

    clearWeighInsCache(); // logout de A (é exatamente o que o SIGNED_OUT do useAuth.js dispara)

    mockResponses.push(() => Promise.resolve({ data: [row("b1", "2026-02-01", 65)], error: null }));
    await fetchAll(); // "usuário B" loga
    expect(__test.getCache()).toEqual([{ id: "b1", date: "2026-02-01", weight: 65 }]);
  });

  it("guarda de epoch: uma resposta lenta de A que resolve DEPOIS do logout não repopula o cache", async () => {
    const slow = deferred();
    mockResponses.push(() => slow.promise); // fetchAll de A, ainda não resolvido
    const pending = fetchAll(); // dispara mas não espera ainda

    clearWeighInsCache(); // B já logou na mesma aba enquanto a resposta de A ainda estava a caminho
    expect(__test.getCache()).toBeNull();

    // agora a resposta tardia de A chega
    slow.resolve({ data: [row("a1", "2026-01-01", 80)], error: null });
    await pending;

    // se não fosse pela guarda de epoch, este cache teria voltado a ter os dados de A
    expect(__test.getCache()).toBeNull();
    expect(__test.getStatus()).toBe("idle");
  });

  it("guarda de epoch também descarta um erro tardio pós-logout", async () => {
    const slow = deferred();
    mockResponses.push(() => slow.promise);
    const pending = fetchAll();

    clearWeighInsCache();
    slow.resolve({ data: null, error: { message: "boom, tarde demais" } });
    await pending;

    expect(__test.getStatus()).toBe("idle"); // não vira "error" por causa de uma resposta obsoleta
  });

  it("uma resposta que chega ANTES de qualquer troca de sessão popula o cache normalmente", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("a1", "2026-01-01", 80)], error: null }));
    await fetchAll();
    expect(__test.getCache()).toHaveLength(1); // confirma que a guarda não bloqueia o caso normal
  });
});
