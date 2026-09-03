// Tier 1 — destrava depois de ~10-14 dias de pesagem quase diária.
// A primeira virada de chave real: separar a oscilação normal do sinal.
import { payloadHash } from "../hash.js";

export const personalNoiseBandRule = {
  id: "personal-noise-band", version: 1, category: "descoberta", minDaysBetweenShows: 10,
  requires: (ctx) => ctx.denseDeltaCount >= 10 && ctx.band && !ctx.band.degenerate,
  detect: (ctx) => {
    const { band, first, last } = ctx;
    const rounded = +band.band.toFixed(2);
    return {
      key: `personal-noise-band:${Math.round(rounded * 100)}`,
      titulo: "Sua faixa de oscilação pessoal",
      corpo: `Seu peso costuma variar cerca de ±${rounded}kg de um dia para o outro sem que nada tenha realmente mudado — é água, sal e intestino. Metade do que a balança mostra todo dia é isso.`,
      evidencia: [
        { label: "Amostra", valor: `${band.n} variações analisadas` },
        { label: "Método", valor: band.method === "mad" ? "desvio robusto (MAD), resistente a picos isolados" : "desvio-padrão" },
      ],
      confianca: "estimativa", importancia: 90,
      periodo: { from: first.date, to: last.date },
      payloadHash: payloadHash({ band: rounded }),
    };
  },
};

export const trueTrendLineRule = {
  id: "true-trend-line", version: 1, category: "descoberta", minDaysBetweenShows: 7,
  requires: (ctx) => ctx.lastSeries?.avgWindowDays === 7 && ctx.lastSeries?.media != null,
  detect: (ctx) => {
    const { lastSeries, last } = ctx;
    return {
      key: `true-trend-line:${last.date}`,
      titulo: "Sua pesagem já é densa o bastante para uma linha de verdade de 7 dias",
      corpo: `Com pesagens quase diárias, sua média dos últimos 7 dias é ${lastSeries.media}kg. É essa média — não o número isolado de hoje (${last.weight}kg) — que vale a pena acompanhar.`,
      evidencia: [
        { label: "Média 7 dias", valor: `${lastSeries.media}kg` },
        { label: "Leitura de hoje", valor: `${last.weight}kg` },
      ],
      confianca: "estimativa", importancia: 55,
      periodo: { from: last.date, to: last.date },
      payloadHash: payloadHash({ media: lastSeries.media }),
    };
  },
};
