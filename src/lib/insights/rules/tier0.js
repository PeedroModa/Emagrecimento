// Tier 0 — funcionam desde a 1ª pesagem. Sempre "fato": leitura direta dos
// dados, nunca inferência. É o que preenche o feed enquanto o resto das
// regras ainda está calibrando (ver src/lib/insights/investigations.js).
import { fmtDateBR } from "../../calculations.js";
import { payloadHash } from "../hash.js";

export const startingPointRule = {
  id: "starting-point", version: 1, category: "fato", minDaysBetweenShows: 3650,
  requires: (ctx) => ctx.n >= 1,
  detect: (ctx) => {
    const { first } = ctx;
    return {
      key: `starting-point:${first.date}`,
      titulo: "Seu ponto de partida",
      corpo: `Sua jornada começou em ${fmtDateBR(first.date)}, com ${first.weight}kg.`,
      evidencia: [
        { label: "Data", valor: fmtDateBR(first.date) },
        { label: "Peso inicial", valor: `${first.weight}kg` },
      ],
      confianca: "fato", importancia: 20,
      periodo: { from: first.date, to: first.date },
      payloadHash: payloadHash({ date: first.date, weight: first.weight }),
    };
  },
};

export const distanceToGoalRule = {
  id: "distance-to-goal", version: 1, category: "progresso", minDaysBetweenShows: 3,
  requires: (ctx) => ctx.n >= 1,
  detect: (ctx) => {
    const { last, first, goal, totalToLose, totalLost, progressPct } = ctx;
    if (last.weight <= goal) {
      return {
        key: `distance-to-goal:reached:${last.date}`,
        titulo: "Você já está na meta",
        corpo: `Seu peso atual (${last.weight}kg) já alcançou a meta de ${goal}kg.`,
        evidencia: [
          { label: "Peso atual", valor: `${last.weight}kg` },
          { label: "Meta", valor: `${goal}kg` },
        ],
        confianca: "fato", importancia: 60,
        periodo: { from: last.date, to: last.date },
        payloadHash: payloadHash({ w: last.weight, g: goal }),
      };
    }
    // totalToLose<=0 é degenerado (a jornada começou já na/abaixo da meta) —
    // não há "caminho percorrido" para medir em %, então a regra fica muda.
    if (totalToLose == null || totalToLose <= 0 || progressPct == null) return null;
    const remaining = +(last.weight - goal).toFixed(1);
    const pct = Math.round(progressPct);
    return {
      key: `distance-to-goal:${pct}`,
      titulo: `Você já andou ${pct}% do caminho até a meta`,
      corpo: `De ${first.weight}kg até ${goal}kg, você já perdeu ${totalLost}kg — faltam ${remaining}kg.`,
      evidencia: [
        { label: "Perdido até agora", valor: `${totalLost}kg` },
        { label: "Restante", valor: `${remaining}kg` },
        { label: "Progresso", valor: `${pct}%` },
      ],
      confianca: "fato", importancia: 30,
      periodo: { from: first.date, to: last.date },
      payloadHash: payloadHash({ w: last.weight, g: goal, p: pct }),
    };
  },
};

export const bmiBandRule = {
  id: "bmi-band", version: 1, category: "fato", minDaysBetweenShows: 14,
  requires: (ctx) => ctx.bmiNow != null,
  detect: (ctx) => ({
    key: `bmi-band:${ctx.bmiCat.label}`,
    titulo: `Seu IMC está na faixa "${ctx.bmiCat.label}"`,
    corpo: `Com ${ctx.last.weight}kg e ${ctx.settings.height_cm}cm, seu IMC atual é ${ctx.bmiNow}.`,
    evidencia: [
      { label: "IMC", valor: String(ctx.bmiNow) },
      { label: "Faixa", valor: ctx.bmiCat.label },
    ],
    confianca: "fato", importancia: 15,
    periodo: { from: ctx.last.date, to: ctx.last.date },
    payloadHash: payloadHash({ bmi: ctx.bmiNow }),
  }),
};

const JOURNEY_MILESTONES = [7, 30, 90, 180, 365, 730];

export const journeyDurationRule = {
  id: "journey-duration", version: 1, category: "fato", minDaysBetweenShows: 1,
  requires: (ctx) => ctx.n >= 2 && JOURNEY_MILESTONES.includes(ctx.journeyDays),
  detect: (ctx) => {
    const hit = ctx.journeyDays;
    return {
      key: `journey-duration:${hit}`,
      titulo: `${hit} dias de jornada`,
      corpo: `Hoje faz exatamente ${hit} dias desde sua primeira pesagem, em ${fmtDateBR(ctx.first.date)}.`,
      evidencia: [
        { label: "Início", valor: fmtDateBR(ctx.first.date) },
        { label: "Dias de jornada", valor: String(hit) },
      ],
      confianca: "fato", importancia: 35,
      periodo: { from: ctx.first.date, to: ctx.last.date },
      payloadHash: payloadHash({ hit }),
    };
  },
};

export const newRecordRule = {
  id: "new-record", version: 1, category: "fato", minDaysBetweenShows: 1,
  requires: (ctx) => Boolean(ctx.records?.min && ctx.last && ctx.records.min.date === ctx.last.date && ctx.n >= 2),
  detect: (ctx) => ({
    key: `new-record:${ctx.last.date}`,
    titulo: "Novo menor peso da jornada",
    corpo: `${ctx.last.weight}kg é o menor número que sua balança já mostrou desde que você começou, em ${fmtDateBR(ctx.first.date)}.`,
    evidencia: [
      { label: "Novo recorde", valor: `${ctx.last.weight}kg` },
      { label: "Jornada até aqui", valor: `${ctx.journeyDays} dias` },
    ],
    confianca: "fato", importancia: 55,
    periodo: { from: ctx.first.date, to: ctx.last.date },
    payloadHash: payloadHash({ w: ctx.last.weight }),
  }),
};
