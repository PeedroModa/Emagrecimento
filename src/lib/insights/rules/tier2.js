// Tier 2 — destrava depois de ~3-6 semanas de pesagem densa. Aqui entram as
// primeiras inferências estatísticas de verdade: significância, mudança de
// dia da semana, reversão de retenção hídrica.
import { fmtDateBR } from "../../calculations.js";
import { zScore, oneSampleTTest, holmAdjust } from "../../stats.js";
import { confidenceFrom } from "../confidence.js";
import { payloadHash } from "../hash.js";

export const trendSignificanceRule = {
  id: "trend-significance", version: 1, category: "tendencia", minDaysBetweenShows: 5,
  requires: (ctx) => Boolean(ctx.trends[28] && ctx.trends[28].n >= 14 && ctx.trends[28].fit.df > 0),
  detect: (ctx) => {
    const t = ctx.trends[28];
    const { fit } = t;
    const perWeek = +(fit.slope * 7).toFixed(2);
    const ciLo = +(fit.slopeCi[0] * 7).toFixed(2);
    const ciHi = +(fit.slopeCi[1] * 7).toFixed(2);
    const real = fit.significant;
    const conf = confidenceFrom({ kind: "trend", n: t.n, pAdj: fit.pValue });
    return {
      key: `trend-significance:28:${real ? "real" : "plateau"}`,
      titulo: real
        ? (perWeek < 0 ? "Sua queda nas últimas semanas é estatisticamente real" : "Sua alta nas últimas semanas é estatisticamente real")
        : "Nas últimas semanas, ainda não dá para confirmar mudança",
      corpo: real
        ? `No período analisado (${t.n} pesagens), seu ritmo foi de ${perWeek}kg/semana, com intervalo de confiança de 95% que não cruza zero — não é sorte, é sinal.`
        : `No período analisado (${t.n} pesagens), seu ritmo foi de ${perWeek}kg/semana, mas a incerteza estatística ainda inclui zero. Com os dados de agora, não dá para afirmar que houve mudança real — pode ser um platô, ou pode ser cedo demais para saber.`,
      evidencia: [
        { label: "Ritmo observado", valor: `${perWeek}kg/semana` },
        { label: "Amostra", valor: `${t.n} pesagens, de ${fmtDateBR(t.fromDate)} a ${fmtDateBR(t.toDate)}` },
        { label: "Intervalo de confiança 95%", valor: `${ciLo} a ${ciHi} kg/semana` },
      ],
      confianca: conf, importancia: real ? 85 : 78,
      periodo: { from: t.fromDate, to: t.toDate },
      payloadHash: payloadHash({ real, perWeek }),
    };
  },
};

export const scaleVsTrendRecordRule = {
  id: "scale-vs-trend-record", version: 1, category: "descoberta", minDaysBetweenShows: 3,
  requires: (ctx) => {
    if (!ctx.records?.min || !ctx.last) return false;
    if (ctx.records.min.date !== ctx.last.date) return false; // só quando a balança acabou de bater recorde
    return ctx.lastSeries?.media != null;
  },
  detect: (ctx) => {
    const withMedia = ctx.series.filter((s) => s.media != null);
    if (withMedia.length < 2) return null;
    const minMedia = Math.min(...withMedia.map((s) => s.media));
    const currentMedia = ctx.lastSeries.media;
    if (currentMedia <= minMedia) return null; // a tendência TAMBÉM já confirmou — não é o caso "ainda não confirmou"
    const gap = +(currentMedia - minMedia).toFixed(2);
    return {
      key: `scale-vs-trend-record:${ctx.last.date}`,
      titulo: "Balança bateu recorde — sua tendência ainda não",
      corpo: `${ctx.last.weight}kg é o menor número que a balança já mostrou. Mas sua linha de tendência (${currentMedia}kg) ainda está ${gap}kg acima do menor patamar que ela já alcançou — só confirma o recorde se o ritmo continuar.`,
      evidencia: [
        { label: "Menor peso de balança", valor: `${ctx.last.weight}kg` },
        { label: "Tendência atual", valor: `${currentMedia}kg` },
        { label: "Menor tendência já vista", valor: `${minMedia}kg` },
      ],
      confianca: "fato", importancia: 65,
      periodo: { from: ctx.first.date, to: ctx.last.date },
      payloadHash: payloadHash({ w: ctx.last.weight, media: currentMedia }),
    };
  },
};

export const waterRetentionReversalRule = {
  id: "water-retention-reversal", version: 1, category: "descoberta", minDaysBetweenShows: 1,
  requires: (ctx) => Boolean(ctx.band && !ctx.band.degenerate && ctx.points.length >= 6),
  detect: (ctx) => {
    const { points, band } = ctx;
    const n = points.length;
    const lastPoint = points[n - 1];
    // procura, nos últimos pontos antes do atual, um pico (delta positivo com
    // |z|>=2) cujo nível de origem já foi reencontrado pelo peso mais recente.
    for (let i = n - 2; i >= Math.max(1, n - 5); i--) {
      const gap = points[i].t - points[i - 1].t;
      if (gap <= 0 || gap > 14) continue;
      const raw = points[i].v - points[i - 1].v;
      const scaled = raw / Math.sqrt(gap);
      const z = zScore(scaled, band.band);
      if (z == null || z < 2) continue; // só picos POSITIVOS — retenção sobe o peso
      const baseline = points[i - 1].v;
      const daysSincePeak = lastPoint.t - points[i].t;
      if (daysSincePeak < 1 || daysSincePeak > 4) continue;
      const returnGap = Math.max(1, lastPoint.t - points[i - 1].t);
      const backToBaseline = Math.abs(lastPoint.v - baseline) <= band.band * Math.sqrt(returnGap);
      if (!backToBaseline) continue;
      return {
        key: `water-retention-reversal:${points[i].date}`,
        titulo: "Um pico recente já se desfez",
        corpo: `Em ${fmtDateBR(points[i].date)} seu peso subiu ${raw.toFixed(1)}kg de uma vez — bem acima da sua oscilação normal. Isso já sumiu: seu peso voltou para perto do patamar de antes em ${daysSincePeak} dia${daysSincePeak === 1 ? "" : "s"}. Gordura não vai embora nessa velocidade — foi retenção, não ganho real.`,
        evidencia: [
          { label: "Pico", valor: `+${raw.toFixed(1)}kg em ${fmtDateBR(points[i].date)}` },
          { label: "Tempo até reverter", valor: `${daysSincePeak} dia${daysSincePeak === 1 ? "" : "s"}` },
        ],
        confianca: "estimativa", importancia: 80,
        periodo: { from: points[i - 1].date, to: lastPoint.date },
        payloadHash: payloadHash({ peak: points[i].date, w: lastPoint.v }),
      };
    }
    return null;
  },
};

const WEEKDAY_NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function weekdayOf(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export const weekdayEffectRule = {
  id: "weekday-effect", version: 1, category: "padrao", minDaysBetweenShows: 14,
  requires: (ctx) => Boolean(ctx.trends[90] && ctx.trends[90].n >= 28 && ctx.trends[90].fit.df > 0),
  detect: (ctx) => {
    const t = ctx.trends[90];
    const { fit, points } = t;
    const byWeekday = Array.from({ length: 7 }, () => []);
    points.forEach((p, idx) => byWeekday[weekdayOf(p.date)].push(fit.residuals[idx]));
    const tests = byWeekday.map((vals) => (vals.length >= 3 ? oneSampleTTest(vals) : null));
    const pValues = tests.map((r) => (r ? r.pValue : 1));
    const adjusted = holmAdjust(pValues);
    let best = null;
    adjusted.forEach((a, idx) => {
      if (!tests[idx] || !a.significant) return;
      if (!best || Math.abs(tests[idx].mean) > Math.abs(tests[best.idx].mean)) best = { idx, adj: a };
    });
    if (!best) return null;
    const r = tests[best.idx];
    const dayName = WEEKDAY_NAMES[best.idx];
    const diff = +r.mean.toFixed(2);
    const conf = confidenceFrom({ kind: "weekday", n: r.n, pAdj: best.adj.pAdj, postHoc: true });
    return {
      key: `weekday-effect:${best.idx}`,
      titulo: `Suas ${dayName}s costumam pesar diferente`,
      corpo: `Em relação à sua tendência, ${dayName}s tendem a marcar ${diff > 0 ? "mais" : "menos"} ${Math.abs(diff)}kg — um padrão que se repetiu em ${r.n} ${dayName}s analisadas, mesmo depois de descontar por estar testando os 7 dias da semana ao mesmo tempo.`,
      evidencia: [
        { label: "Dia", valor: dayName },
        { label: "Diferença média em relação à tendência", valor: `${diff > 0 ? "+" : ""}${diff}kg` },
        { label: "Observações", valor: `${r.n} ${dayName}s` },
        { label: "p ajustado (Holm, 7 comparações)", valor: best.adj.pAdj.toFixed(3) },
      ],
      confianca: conf, importancia: 60,
      periodo: { from: t.fromDate, to: t.toDate },
      payloadHash: payloadHash({ day: best.idx, diff }),
    };
  },
};
