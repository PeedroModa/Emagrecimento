import { describe, it, expect } from "vitest";
import { buildExportJSON, parseImportJSON } from "./backup.js";

describe("parseImportJSON — validação de entrada", () => {
  it("rejeita JSON malformado", () => {
    const res = parseImportJSON("{não é json");
    expect(res.error).toBeTruthy();
    expect(res.logs).toBeUndefined();
  });

  it("rejeita quando não há weightLogs nem array na raiz", () => {
    const res = parseImportJSON(JSON.stringify({ goal: 90 }));
    expect(res.error).toBeTruthy();
  });

  it("aceita um array na raiz (formato antigo) e o formato {weightLogs:[...]}", () => {
    const arr = parseImportJSON(JSON.stringify([{ date: "2026-01-01", weight: 80 }]));
    expect(arr.error).toBeUndefined();
    expect(arr.logs).toHaveLength(1);

    const wrapped = parseImportJSON(JSON.stringify({ weightLogs: [{ date: "2026-01-01", weight: 80 }] }));
    expect(wrapped.error).toBeUndefined();
    expect(wrapped.logs).toHaveLength(1);
  });

  it("descarta entradas com peso fora de faixa ou data mal formatada, mantendo as válidas", () => {
    const res = parseImportJSON(JSON.stringify({
      weightLogs: [
        { date: "2026-01-01", weight: 80 },
        { date: "2026-01-02", weight: 0 }, // inválido: <= 0
        { date: "2026-01-03", weight: 500 }, // inválido: > 400
        { date: "01/01/2026", weight: 70 }, // inválido: formato de data
        { date: "2026-01-05", weight: "70" }, // inválido: peso não é number
      ],
    }));
    expect(res.error).toBeUndefined();
    expect(res.logs).toHaveLength(1);
    expect(res.logs[0].date).toBe("2026-01-01");
  });

  it("data repetida no próprio arquivo: a última entrada vence", () => {
    const res = parseImportJSON(JSON.stringify({
      weightLogs: [
        { date: "2026-01-01", weight: 80 },
        { date: "2026-01-01", weight: 79 },
      ],
    }));
    expect(res.logs).toHaveLength(1);
    expect(res.logs[0].weight).toBe(79);
  });

  it("retorna erro quando nenhuma pesagem válida sobra", () => {
    const res = parseImportJSON(JSON.stringify({ weightLogs: [{ date: "bad", weight: -1 }] }));
    expect(res.error).toBeTruthy();
  });

  it("goal/bfTarget só são aceitos dentro de faixas plausíveis", () => {
    const ok = parseImportJSON(JSON.stringify({ weightLogs: [{ date: "2026-01-01", weight: 80 }], goal: 75, bfTarget: 15 }));
    expect(ok.goal).toBe(75);
    expect(ok.bfTarget).toBe(15);

    const bad = parseImportJSON(JSON.stringify({ weightLogs: [{ date: "2026-01-01", weight: 80 }], goal: -5, bfTarget: 999 }));
    expect(bad.goal).toBeNull();
    expect(bad.bfTarget).toBeNull();
  });

  it("não carrega nenhum campo de identidade de usuário do arquivo — importar nunca pode direcionar dados para outra conta", () => {
    const res = parseImportJSON(JSON.stringify({
      weightLogs: [{ date: "2026-01-01", weight: 80, user_id: "outro-usuario-qualquer" }],
    }));
    expect(res.logs[0]).not.toHaveProperty("user_id");
    expect(res.logs[0]).not.toHaveProperty("userId");
  });

  it("context_tags com ids conhecidas (até 2) passa intacto", () => {
    const res = parseImportJSON(JSON.stringify({
      weightLogs: [{ date: "2026-01-01", weight: 80, context_tags: ["retencao", "treino"] }],
    }));
    expect(res.logs[0].context_tags).toEqual(["retencao", "treino"]);
  });

  it("descarta ids de tag desconhecidas individualmente, sem falhar o import inteiro", () => {
    const res = parseImportJSON(JSON.stringify({
      weightLogs: [{ date: "2026-01-01", weight: 80, context_tags: ["retencao", "tag-inventada"] }],
    }));
    expect(res.error).toBeUndefined();
    expect(res.logs[0].context_tags).toEqual(["retencao"]);
  });

  it("trunca context_tags em mais de 2 ids, mantendo as duas primeiras", () => {
    const res = parseImportJSON(JSON.stringify({
      weightLogs: [{ date: "2026-01-01", weight: 80, context_tags: ["retencao", "treino", "alimentacao"] }],
    }));
    expect(res.logs[0].context_tags).toEqual(["retencao", "treino"]);
  });

  it("context_tags que não é array, ou vazio, não aparece no log resultante", () => {
    const naoArray = parseImportJSON(JSON.stringify({
      weightLogs: [{ date: "2026-01-01", weight: 80, context_tags: "retencao" }],
    }));
    expect(naoArray.logs[0]).not.toHaveProperty("context_tags");

    const vazio = parseImportJSON(JSON.stringify({
      weightLogs: [{ date: "2026-01-02", weight: 80, context_tags: [] }],
    }));
    expect(vazio.logs[0]).not.toHaveProperty("context_tags");
  });
});

describe("buildExportJSON — nada além dos próprios dados entra no arquivo", () => {
  it("exporta só os campos esperados, sem vazar identificadores internos de outro usuário", () => {
    const weighIns = [{ id: "abc", date: "2026-01-01", weight: 80, waist: 90, neck: 38, note: "ok" }];
    const settings = { goal_kg: 75, bf_target: 15 };
    const json = JSON.parse(buildExportJSON(weighIns, settings));
    expect(json.weightLogs).toHaveLength(1);
    expect(json.goal).toBe(75);
    expect(json.bfTarget).toBe(15);
    expect(json.weightLogs[0]).not.toHaveProperty("user_id");
  });

  it("exporta context_tags quando há tags respondidas, mas não o estado 'pulou' ([])", () => {
    const weighIns = [
      { id: "abc", date: "2026-01-01", weight: 80, context_tags: ["retencao"] },
      { id: "def", date: "2026-01-08", weight: 79, context_tags: [] },
      { id: "ghi", date: "2026-01-15", weight: 78, context_tags: null },
    ];
    const json = JSON.parse(buildExportJSON(weighIns, { goal_kg: 75, bf_target: 15 }));
    expect(json.weightLogs[0].context_tags).toEqual(["retencao"]);
    expect(json.weightLogs[1]).not.toHaveProperty("context_tags");
    expect(json.weightLogs[2]).not.toHaveProperty("context_tags");
  });
});
