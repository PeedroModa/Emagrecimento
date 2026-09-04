// Tier 4 — destrava com medidas corporais ampliadas (Etapa 5, sessão
// mensal). Nunca reaproveita cintura/pescoço do registro diário de peso —
// só o que veio da sessão completa de medidas (ver migration-body-
// -measurements.sql, e o comentário em src/hooks/useMeasurements.js sobre
// por que as duas fontes ficam deliberadamente separadas).
import { payloadHash } from "../hash.js";

export const waistHeightRatioRule = {
  id: "waist-height-ratio", version: 1, category: "corpo", minDaysBetweenShows: 21,
  requires: (ctx) => {
    const last = ctx.measurements[ctx.measurements.length - 1];
    return Boolean(last?.waist && ctx.settings?.height_cm);
  },
  detect: (ctx) => {
    const last = ctx.measurements[ctx.measurements.length - 1];
    const ratio = +(last.waist / ctx.settings.height_cm).toFixed(2);
    const healthy = ratio < 0.5;
    return {
      key: `waist-height-ratio:${last.date}`,
      titulo: healthy ? "Sua razão cintura/altura está numa faixa saudável" : "Sua razão cintura/altura está acima do recomendado",
      corpo: `Cintura de ${last.waist}cm sobre ${ctx.settings.height_cm}cm de altura dá ${ratio}. ${healthy ? "Abaixo de 0,5 é a faixa associada a menor risco metabólico — hoje considerada melhor preditor de risco do que o IMC sozinho." : "Acima de 0,5 é a faixa associada a maior risco metabólico, independente do peso total."}`,
      evidencia: [
        { label: "Cintura", valor: `${last.waist}cm` },
        { label: "Altura", valor: `${ctx.settings.height_cm}cm` },
        { label: "Razão", valor: String(ratio) },
      ],
      confianca: "fato", importancia: 40,
      periodo: { from: last.date, to: last.date },
      payloadHash: payloadHash({ ratio }),
    };
  },
};

export const recompositionRule = {
  id: "recomposition", version: 1, category: "corpo", minDaysBetweenShows: 14,
  requires: (ctx) => {
    if (ctx.measurements.length < 2) return false;
    const t = ctx.trends[90] || ctx.trends[56] || ctx.trends[28];
    return Boolean(t && !t.fit.significant);
  },
  detect: (ctx) => {
    const first = ctx.measurements[0];
    const last = ctx.measurements[ctx.measurements.length - 1];
    if (first.waist == null || last.waist == null) return null;
    const waistDiff = +(last.waist - first.waist).toFixed(1);
    if (waistDiff >= -1) return null; // queda pequena demais para chamar atenção
    return {
      key: `recomposition:${last.date}`,
      titulo: "A balança não mostrou mudança, mas sua cintura caiu",
      corpo: `No período analisado, seu peso não mostrou uma tendência estatisticamente confirmada — mas sua cintura caiu ${Math.abs(waistDiff)}cm, de ${first.waist}cm (${first.date}) para ${last.waist}cm (${last.date}). Não há dado suficiente aqui para provar que isso é gordura saindo e músculo entrando, mas é o padrão compatível com recomposição corporal.`,
      evidencia: [
        { label: "Cintura inicial", valor: `${first.waist}cm em ${first.date}` },
        { label: "Cintura atual", valor: `${last.waist}cm em ${last.date}` },
        { label: "Variação", valor: `${waistDiff}cm` },
      ],
      confianca: "estimativa", importancia: 75,
      periodo: { from: first.date, to: last.date },
      payloadHash: payloadHash({ waistDiff }),
    };
  },
};
