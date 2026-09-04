import { describe, it, expect } from "vitest";
import { buildInsightContext } from "./context.js";
import { runInsights, RULES } from "./registry.js";
import { rankInsights, noveltyFor } from "./rank.js";
import { computeInvestigations } from "./investigations.js";
import { FIXTURES, makeSeries, withSpike } from "./__fixtures__/series.js";

const settings = { height_cm: 175, goal_kg: 90, sex: "M" };

function ctxFor(weighIns, today) {
  return buildInsightContext({ weighIns, settings, today: today ?? weighIns[weighIns.length - 1]?.date ?? "2026-01-01" });
}

const TIER0_IDS = new Set(["starting-point", "distance-to-goal", "bmi-band", "journey-duration", "new-record"]);

describe("propriedade: silêncio com dados insuficientes", () => {
  it("com histórico vazio, nenhuma regra dispara — nunca é chamado requires() com contexto quebrado", () => {
    const ctx = ctxFor([]);
    for (const rule of RULES) expect(rule.requires(ctx)).toBe(false);
    expect(runInsights(ctx)).toEqual([]);
  });

  it("com o histórico esparso atual do usuário (6 pesagens semanais), nenhuma regra além de Tier 0 dispara", () => {
    const ctx = ctxFor(FIXTURES.sparse6);
    const fired = runInsights(ctx);
    expect(fired.length).toBeGreaterThan(0); // Tier 0 deve ter algo a dizer
    for (const insight of fired) expect(TIER0_IDS.has(insight.ruleId)).toBe(true);
  });

  it("uma regra que lança exceção não derruba o feed inteiro (as outras continuam rodando)", () => {
    const ctx = ctxFor(FIXTURES.sparse6);
    const broken = { id: "broken", version: 1, category: "x", requires: () => true, detect: () => { throw new Error("boom"); } };
    const original = RULES.push(broken);
    try {
      expect(() => runInsights(ctx)).not.toThrow();
      expect(runInsights(ctx).some((i) => i.ruleId === "broken")).toBe(false);
      expect(runInsights(ctx).some((i) => i.ruleId === "starting-point")).toBe(true);
    } finally {
      RULES.pop();
    }
  });
});

describe("Tier 0 — fatos, funcionam desde a 1ª pesagem", () => {
  it("starting-point dispara com 1 única pesagem, sempre como fato", () => {
    const ctx = ctxFor([{ id: "a", date: "2026-01-01", weight: 100 }]);
    const fired = runInsights(ctx);
    expect(fired.some((i) => i.ruleId === "starting-point")).toBe(true);
    expect(fired.every((i) => i.confianca === "fato")).toBe(true);
  });

  it("distance-to-goal reconhece meta já atingida", () => {
    const ctx = ctxFor(
      [{ id: "a", date: "2026-01-01", weight: 100 }, { id: "b", date: "2026-01-08", weight: 85 }],
      "2026-01-08"
    );
    const d = runInsights(ctx).find((i) => i.ruleId === "distance-to-goal");
    expect(d.titulo).toMatch(/já está na meta/);
  });
});

describe("Tier 1 — faixa de oscilação pessoal e linha de verdade", () => {
  it("personal-noise-band não dispara com 6 pesagens semanais (densidade insuficiente)", () => {
    const ctx = ctxFor(FIXTURES.sparse6);
    expect(runInsights(ctx).some((i) => i.ruleId === "personal-noise-band")).toBe(false);
  });

  it("personal-noise-band dispara depois de ~10+ pesagens quase diárias, nunca como 'fato'", () => {
    const series = makeSeries({ days: 20, startKg: 100, noiseSd: 0.3, seed: 1 });
    const ctx = ctxFor(series);
    const band = runInsights(ctx).find((i) => i.ruleId === "personal-noise-band");
    expect(band).toBeTruthy();
    expect(band.confianca).not.toBe("fato");
  });

  it("true-trend-line dispara só quando computeSeries já escolheu a janela de 7 dias", () => {
    const series = makeSeries({ days: 20, startKg: 100, noiseSd: 0.1, seed: 2 });
    const ctx = ctxFor(series);
    expect(ctx.lastSeries.avgWindowDays).toBe(7);
    expect(runInsights(ctx).some((i) => i.ruleId === "true-trend-line")).toBe(true);
  });
});

describe("Tier 2 — tendência real vs. platô honesto", () => {
  it("perda rápida e consistente: dispara como REAL, nunca como platô", () => {
    const ctx = ctxFor(FIXTURES.fastLoss);
    const t = runInsights(ctx).find((i) => i.ruleId === "trend-significance");
    expect(t).toBeTruthy();
    expect(t.key).toContain(":real");
  });

  it("platô real (slope 0): dispara como NÃO confirmado — nunca afirma perda que não houve", () => {
    const ctx = ctxFor(FIXTURES.plateauReal);
    const t = runInsights(ctx).find((i) => i.ruleId === "trend-significance");
    expect(t).toBeTruthy();
    expect(t.key).toContain(":plateau");
  });

  it("série ruidosa com tendência fraca: se ler como platô, nunca sobe a confiança para 'tendencia'", () => {
    const ctx = ctxFor(FIXTURES.noisy);
    const t = runInsights(ctx).find((i) => i.ruleId === "trend-significance");
    expect(t).toBeTruthy();
    if (t.key.includes(":plateau")) expect(t.confianca).not.toBe("tendencia");
  });
});

describe("Tier 2 — retenção hídrica que se desfaz", () => {
  it("um pico isolado que reverte em poucos dias é identificado como retenção, nunca como fato", () => {
    const base = makeSeries({ days: 30, startKg: 90, slopeKgPerDay: 0, noiseSd: 0.15, seed: 5 });
    const series = withSpike(base, { atDay: 26, deltaKg: 2.5 });
    const ctx = ctxFor(series);
    const water = runInsights(ctx).find((i) => i.ruleId === "water-retention-reversal");
    expect(water).toBeTruthy();
    expect(water.confianca).not.toBe("fato");
  });

  it("sem nenhum pico fora do normal, a regra fica em silêncio", () => {
    const series = makeSeries({ days: 30, startKg: 90, slopeKgPerDay: 0, noiseSd: 0.15, seed: 5 });
    const ctx = ctxFor(series);
    expect(runInsights(ctx).some((i) => i.ruleId === "water-retention-reversal")).toBe(false);
  });
});

describe("Tier 2 — efeito do dia da semana", () => {
  it("um efeito real e consistente de segunda-feira é detectado, sempre rotulado hipótese", () => {
    let series = makeSeries({ days: 90, startKg: 90, slopeKgPerDay: 0, noiseSd: 0.2, seed: 11 });
    series = series.map((w) => {
      const wd = new Date(`${w.date}T00:00:00Z`).getUTCDay();
      return wd === 1 ? { ...w, weight: +(w.weight + 0.7).toFixed(2) } : w;
    });
    const ctx = ctxFor(series);
    const effect = runInsights(ctx).find((i) => i.ruleId === "weekday-effect");
    expect(effect).toBeTruthy();
    expect(effect.confianca).toBe("hipotese"); // seleção entre 7 dias é sempre pós-hoc
  });

  it("sem nenhum padrão real por dia da semana, dispara raramente (falso-positivo controlado pelo Holm)", () => {
    let hits = 0;
    const total = 20;
    for (let seed = 1; seed <= total; seed++) {
      const series = makeSeries({ days: 90, startKg: 90, slopeKgPerDay: 0, noiseSd: 0.3, seed: seed * 97 });
      const ctx = ctxFor(series);
      if (runInsights(ctx).some((i) => i.ruleId === "weekday-effect")) hits++;
    }
    expect(hits / total).toBeLessThanOrEqual(0.4);
  });
});

describe("Tier 3 — fases da jornada e comparação de 90 dias", () => {
  it("journey-phases dispara com uma quebra de ritmo clara, sempre como hipótese", () => {
    const fast = makeSeries({ start: "2026-01-01", days: 45, startKg: 100, slopeKgPerDay: -0.14, noiseSd: 0.2, seed: 21 });
    const slow = makeSeries({ start: "2026-02-15", days: 45, startKg: fast[fast.length - 1].weight, slopeKgPerDay: 0, noiseSd: 0.2, seed: 22 });
    const series = [...fast, ...slow];
    const ctx = ctxFor(series);
    const phases = runInsights(ctx).find((i) => i.ruleId === "journey-phases");
    expect(phases).toBeTruthy();
    expect(phases.confianca).toBe("hipotese");
  });

  it("journey-phases não dispara com jornada curta (<60 dias)", () => {
    const series = makeSeries({ days: 40, startKg: 100, slopeKgPerDay: -0.1, noiseSd: 0.2, seed: 5 });
    const ctx = ctxFor(series);
    expect(runInsights(ctx).some((i) => i.ruleId === "journey-phases")).toBe(false);
  });

  it("milestone-90d compara com o ponto mais próximo de 90 dias atrás, como fato", () => {
    const series = makeSeries({ days: 120, startKg: 100, slopeKgPerDay: -0.05, noiseSd: 0.1, seed: 9 });
    const ctx = ctxFor(series);
    const m = runInsights(ctx).find((i) => i.ruleId === "milestone-90d");
    expect(m).toBeTruthy();
    expect(m.confianca).toBe("fato");
  });

  it("milestone-90d não dispara antes de 100 dias de jornada", () => {
    const series = makeSeries({ days: 60, startKg: 100, slopeKgPerDay: -0.05, noiseSd: 0.1, seed: 9 });
    const ctx = ctxFor(series);
    expect(runInsights(ctx).some((i) => i.ruleId === "milestone-90d")).toBe(false);
  });
});

describe("rankInsights", () => {
  it("com a mesma confiança, maior importância vem primeiro; respeita o limite", () => {
    const insights = [
      { key: "a", importancia: 40, confianca: "fato" },
      { key: "b", importancia: 20, confianca: "fato" },
      { key: "c", importancia: 95, confianca: "fato" },
    ];
    const ranked = rankInsights(insights, {}, { limit: 2 });
    expect(ranked).toHaveLength(2);
    expect(ranked.map((i) => i.key)).toEqual(["c", "a"]);
  });

  it("confiança pesa mais que uma pequena diferença de importância", () => {
    const insights = [
      { key: "fato-forte", importancia: 90, confianca: "fato" },
      { key: "tendencia-um-pouco-maior", importancia: 95, confianca: "tendencia" },
    ];
    const ranked = rankInsights(insights, {}, { limit: 2 });
    expect(ranked[0].key).toBe("fato-forte");
  });

  it("insight dispensado com o mesmo payloadHash não reaparece", () => {
    const insight = { key: "a", importancia: 90, confianca: "fato", payloadHash: "x1" };
    const states = { a: { status: "dismissed", payload_hash: "x1" } };
    expect(rankInsights([insight], states)).toHaveLength(0);
  });

  it("insight dispensado cujo conteúdo mudou pode reaparecer depois de um tempo", () => {
    const insight = { key: "a", importancia: 90, confianca: "fato", payloadHash: "x2" };
    const states = {
      a: { status: "dismissed", payload_hash: "x1", dismissed_at: new Date(Date.now() - 20 * 86400000).toISOString() },
    };
    expect(rankInsights([insight], states)).toHaveLength(1);
  });

  it("novidade decai com o tempo desde a última visualização", () => {
    const insight = { key: "a", importancia: 90, confianca: "fato", payloadHash: "x1" };
    const fresh = noveltyFor(insight, { status: "seen", payload_hash: "x1", last_seen_at: new Date().toISOString() });
    const old = noveltyFor(insight, { status: "seen", payload_hash: "x1", last_seen_at: new Date(Date.now() - 30 * 86400000).toISOString() });
    expect(old).toBeLessThan(fresh);
  });
});

describe("computeInvestigations", () => {
  it("com histórico esparso, lista as 3 investigações em aberto com progresso correto", () => {
    const ctx = ctxFor(FIXTURES.sparse6);
    const items = computeInvestigations(ctx);
    expect(items.map((i) => i.id)).toEqual(["personal-noise-band", "trend-significance", "weekday-effect"]);
    expect(items[0].atual).toBe(ctx.denseDeltaCount);
  });

  it("uma vez desbloqueada, a investigação some da lista", () => {
    const series = makeSeries({ days: 20, startKg: 100, noiseSd: 0.2, seed: 3 });
    const ctx = ctxFor(series);
    const items = computeInvestigations(ctx);
    expect(items.some((i) => i.id === "personal-noise-band")).toBe(false);
  });
});
