import { RULES } from "./rules/index.js";

// Roda todas as regras sobre um contexto já construído. `requires` é
// checado ANTES de `detect` — uma regra que esquecer sua própria guarda
// simplesmente não roda, em vez de arriscar produzir um insight com
// amostra insuficiente. Uma regra que lança exceção não derruba o feed
// inteiro: é logada e ignorada.
export function runInsights(ctx) {
  const results = [];
  for (const rule of RULES) {
    try {
      if (!rule.requires(ctx)) continue;
      const insight = rule.detect(ctx);
      if (!insight) continue;
      // insight.key já vem no formato "<regra>:<escopo>" (cada regra embute
      // o próprio id) — é isso que faz "plateau:2026-08-05..2026-09-02" não
      // colidir com um platô de outra janela, sem precisar prefixar de novo.
      results.push({ ...insight, ruleId: rule.id, ruleVersion: rule.version, category: rule.category });
    } catch (e) {
      if (typeof console !== "undefined") console.error(`[insights] regra "${rule.id}" falhou:`, e);
    }
  }
  return results;
}

export { RULES };
