// Tier 5 — destrava com marcadores casuais acumulados (Etapa 6). A regra
// mais arriscada do catálogo: viés de seleção é quase garantido (o check-in
// é opcional, então tende a ser preenchido em dias atípicos — ver plano V2,
// risco #5). Por isso NUNCA passa de "hipótese", qualquer que seja o p.
import { addDaysISO } from "../../calculations.js";
import { welchTTest, holmAdjust } from "../../stats.js";
import { payloadHash } from "../hash.js";

const MARKER_LABELS = {
  trained: "treino", alcohol: "álcool", high_sodium: "sal fora de casa",
  travel: "viagem", slept_badly: "sono ruim",
};
const LAGS = [0, 1, 2];
const MIN_MARKED_DAYS = 8;
const MIN_GROUP_SIZE = 5;

export const markerEffectRule = {
  id: "marker-effect", version: 1, category: "contexto", minDaysBetweenShows: 14,
  requires: (ctx) => {
    const t = ctx.trends[90] || ctx.trends[56];
    if (!t || t.points.length < 20) return false;
    return Boolean(Object.keys(MARKER_LABELS).some(
      (key) => ctx.markers.filter((m) => m[key] === true).length >= MIN_MARKED_DAYS
    ));
  },
  detect: (ctx) => {
    const t = ctx.trends[90] || ctx.trends[56];
    const { fit, points } = t;
    const residualOf = new Map(points.map((p, idx) => [p.date, fit.residuals[idx]]));

    const candidates = [];
    for (const key of Object.keys(MARKER_LABELS)) {
      const markedDates = new Set(ctx.markers.filter((m) => m[key] === true).map((m) => m.date));
      if (markedDates.size < MIN_MARKED_DAYS) continue;
      for (const lag of LAGS) {
        const exposed = [];
        const control = [];
        for (const p of points) {
          const residual = residualOf.get(p.date);
          if (residual == null) continue;
          const markerDate = addDaysISO(p.date, -lag); // marcador `lag` dias antes da leitura de peso
          (markedDates.has(markerDate) ? exposed : control).push(residual);
        }
        if (exposed.length < MIN_GROUP_SIZE || control.length < MIN_GROUP_SIZE) continue;
        const test = welchTTest(exposed, control);
        if (test) candidates.push({ key, lag, test, nExposed: exposed.length, nControl: control.length });
      }
    }
    if (!candidates.length) return null;

    const adjusted = holmAdjust(candidates.map((c) => c.test.pValue));
    let best = null;
    adjusted.forEach((a, idx) => {
      if (!a.significant) return;
      if (!best || Math.abs(candidates[idx].test.diff) > Math.abs(candidates[best.idx].test.diff)) best = { idx, adj: a };
    });
    if (!best) return null;

    const c = candidates[best.idx];
    const label = MARKER_LABELS[c.key];
    const diff = +c.test.diff.toFixed(2);
    const lagLabel = c.lag === 0 ? "no mesmo dia" : c.lag === 1 ? "no dia seguinte" : `${c.lag} dias depois`;
    return {
      key: `marker-effect:${c.key}:${c.lag}`,
      titulo: `Dias com "${label}" parecem pesar diferente ${lagLabel}`,
      corpo: `Em relação à sua tendência, seu peso ${diff > 0 ? "tende a ficar acima" : "tende a ficar abaixo"} da linha em ${Math.abs(diff)}kg ${lagLabel} de um dia marcado com "${label}" — observado em ${c.nExposed} dias marcados contra ${c.nControl} sem marcação. É associação, não causa: o check-in é opcional, então dias marcados podem não ser um recorte aleatório dos seus dias.`,
      evidencia: [
        { label: "Marcador", valor: label },
        { label: "Defasagem", valor: lagLabel },
        { label: "Diferença média", valor: `${diff > 0 ? "+" : ""}${diff}kg` },
        { label: "Dias marcados / sem marcação", valor: `${c.nExposed} / ${c.nControl}` },
        { label: "p ajustado (Holm)", valor: best.adj.pAdj.toFixed(3) },
      ],
      confianca: "hipotese", importancia: 55,
      periodo: { from: points[0].date, to: points[points.length - 1].date },
      payloadHash: payloadHash({ key: c.key, lag: c.lag, diff }),
    };
  },
};
