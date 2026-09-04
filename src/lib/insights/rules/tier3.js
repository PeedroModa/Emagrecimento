// Tier 3 — destrava depois de 3+ meses de histórico. Aqui entra a narrativa
// de mais longo prazo: fases da jornada, comparação com meses atrás.
import { fmtDateBR } from "../../calculations.js";
import { changePoint } from "../../stats.js";
import { payloadHash } from "../hash.js";

// AVISO (ver stats.changePoint): o ponto de quebra é ESCOLHIDO minimizando
// RSS entre ~n candidatos — mesmo com Bonferroni, essa regra nunca sobe
// além de "hipótese". É uma pista para investigar, não uma prova.
export const journeyPhasesRule = {
  id: "journey-phases", version: 1, category: "narrativa", minDaysBetweenShows: 21,
  requires: (ctx) => ctx.n >= 30 && ctx.journeyDays >= 60,
  detect: (ctx) => {
    const points = ctx.points.map((p) => ({ x: p.t, y: p.v }));
    const cp = changePoint(points, { minSegment: 14 });
    if (!cp || !cp.significantAdjusted) return null;
    const beforeWeek = +(cp.before.slope * 7).toFixed(2);
    const afterWeek = +(cp.after.slope * 7).toFixed(2);
    const splitDate = ctx.sorted[cp.index]?.date ?? ctx.sorted[ctx.sorted.length - 1].date;
    const faster = Math.abs(afterWeek) > Math.abs(beforeWeek);
    return {
      key: `journey-phases:${splitDate}`,
      titulo: "Sua jornada parece ter duas fases",
      corpo: `Até ${fmtDateBR(splitDate)}, seu ritmo era de ${beforeWeek}kg/semana. Desde então, ${afterWeek}kg/semana — ${faster ? "mais rápido" : "mais devagar"} do que no início. É um padrão que aparece nos dados, não uma certeza: vale olhar o que mudou perto dessa data.`,
      evidencia: [
        { label: "Ritmo até a virada", valor: `${beforeWeek}kg/semana` },
        { label: "Ritmo depois da virada", valor: `${afterWeek}kg/semana` },
        { label: "Data da virada (estimada)", valor: fmtDateBR(splitDate) },
        { label: "p ajustado (Bonferroni)", valor: cp.pAdj.toFixed(3) },
      ],
      confianca: "hipotese", importancia: 70,
      periodo: { from: ctx.first.date, to: ctx.last.date },
      payloadHash: payloadHash({ split: splitDate, before: beforeWeek, after: afterWeek }),
    };
  },
};

// Comparação simples e sempre disponível a partir de 90 dias de jornada:
// hoje vs. o peso mais próximo de 90 dias atrás. Fato direto — não é
// tendência nem extrapolação, só uma leitura de dois pontos reais.
export const milestoneComparisonRule = {
  id: "milestone-90d", version: 1, category: "narrativa", minDaysBetweenShows: 14,
  requires: (ctx) => ctx.journeyDays >= 100 && ctx.n >= 8,
  detect: (ctx) => {
    const targetT = ctx.points[ctx.points.length - 1].t - 90;
    let closest = ctx.points[0];
    for (const p of ctx.points) {
      if (Math.abs(p.t - targetT) < Math.abs(closest.t - targetT)) closest = p;
    }
    if (Math.abs(closest.t - targetT) > 10) return null; // não há pesagem perto o bastante de 90d atrás
    const diff = +(ctx.last.weight - closest.v).toFixed(1);
    if (closest.date === ctx.last.date) return null;
    return {
      key: `milestone-90d:${ctx.last.date}`,
      titulo: diff < 0 ? "Você hoje vs. você há 90 dias" : "Comparando com 90 dias atrás",
      corpo: `Em ${fmtDateBR(closest.date)} você pesava ${closest.v}kg. Hoje, ${ctx.last.weight}kg — ${diff <= 0 ? `${Math.abs(diff)}kg a menos` : `${diff}kg a mais`}.`,
      evidencia: [
        { label: "Há 90 dias", valor: `${closest.v}kg em ${fmtDateBR(closest.date)}` },
        { label: "Hoje", valor: `${ctx.last.weight}kg` },
        { label: "Diferença", valor: `${diff > 0 ? "+" : ""}${diff}kg` },
      ],
      confianca: "fato", importancia: 45,
      periodo: { from: closest.date, to: ctx.last.date },
      payloadHash: payloadHash({ from: closest.v, to: ctx.last.weight }),
    };
  },
};
