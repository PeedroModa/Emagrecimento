import { describe, it, expect, vi, beforeEach } from "vitest";

// Fila de respostas controladas pelo teste — cada fetchAll()/patchContextTags()
// consome a próxima. Prefixo "mock" é exigido pelo Vitest para referenciar a
// variável de dentro do factory hoisted de vi.mock.
const mockResponses = [];

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => mockResponses.shift()(),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => mockResponses.shift()(),
          }),
        }),
      }),
    }),
  },
}));

const { fetchAll, clearWeighInsCache, patchContextTags, __test } = await import("./useWeighIns.js");

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function row(id, date, weightKg, contextTags = null) {
  return { id, date, weight_kg: weightKg, waist_cm: null, neck_cm: null, note: null, context_tags: contextTags };
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
    expect(__test.getCache()).toEqual([{ id: "a1", date: "2026-01-01", weight: 80, context_tags: null }]);
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
    expect(__test.getCache()).toEqual([{ id: "a1", date: "2026-01-01", weight: 80, context_tags: null }]);

    clearWeighInsCache(); // logout de A (é exatamente o que o SIGNED_OUT do useAuth.js dispara)

    mockResponses.push(() => Promise.resolve({ data: [row("b1", "2026-02-01", 65)], error: null }));
    await fetchAll(); // "usuário B" loga
    expect(__test.getCache()).toEqual([{ id: "b1", date: "2026-02-01", weight: 65, context_tags: null }]);
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

  it("fromRow mantém o tri-estado de context_tags: null, [] e preenchido nunca se confundem", async () => {
    mockResponses.push(() => Promise.resolve({
      data: [
        row("a1", "2026-01-01", 80, null),
        row("a2", "2026-01-08", 79, []),
        row("a3", "2026-01-15", 78, ["retencao", "treino"]),
      ],
      error: null,
    }));
    await fetchAll();
    const cache = __test.getCache();
    expect(cache[0].context_tags).toBeNull();
    expect(cache[1].context_tags).toEqual([]);
    expect(cache[2].context_tags).toEqual(["retencao", "treino"]);
  });
});

describe("patchContextTags", () => {
  it("atualiza o cache otimisticamente e reconcilia com a resposta do servidor", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("a1", "2026-01-01", 80, null)], error: null }));
    await fetchAll();

    mockResponses.push(() => Promise.resolve({ data: row("a1", "2026-01-01", 80, ["retencao"]), error: null }));
    const result = await patchContextTags("a1", ["retencao"]);
    expect(result.error).toBeNull();
    expect(__test.getCache()[0].context_tags).toEqual(["retencao"]);
  });

  it("reflete a tag otimisticamente antes da resposta do servidor resolver", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("a1", "2026-01-01", 80, null)], error: null }));
    await fetchAll();

    const slow = deferred();
    mockResponses.push(() => slow.promise);
    const pending = patchContextTags("a1", ["nada"]);
    expect(__test.getCache()[0].context_tags).toEqual(["nada"]); // otimista, antes de resolver

    slow.resolve({ data: row("a1", "2026-01-01", 80, ["nada"]), error: null });
    await pending;
    expect(__test.getCache()[0].context_tags).toEqual(["nada"]);
  });

  it("erro no servidor desfaz a atualização otimista e retorna mensagem de erro", async () => {
    mockResponses.push(() => Promise.resolve({ data: [row("a1", "2026-01-01", 80, null)], error: null }));
    await fetchAll();

    mockResponses.push(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    const result = await patchContextTags("a1", ["retencao"]);
    expect(result.error).toBeTruthy();
    expect(__test.getCache()[0].context_tags).toBeNull(); // volta ao estado anterior
  });
});
