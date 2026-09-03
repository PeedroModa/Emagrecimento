// Ordena o feed por relevância = importância × confiança × novidade
// (multiplicativo, com piso em cada fator — nunca aditivo, para que um
// insight novo e de baixa confiança não consiga superar um antigo de alta
// importância só por ser novo).
const CONFIDENCE_WEIGHT = { fato: 1.0, tendencia: 0.85, estimativa: 0.6, hipotese: 0.35 };

// state: { status: "seen"|"dismissed"|"pinned", payload_hash, last_seen_at, dismissed_at } | undefined
export function noveltyFor(insight, state) {
  if (!state) return 1;
  if (state.status === "dismissed") {
    if (state.payload_hash !== insight.payloadHash) {
      const days = state.dismissed_at ? (Date.now() - new Date(state.dismissed_at).getTime()) / 86400000 : Infinity;
      return days > 14 ? 0.7 : 0; // conteúdo mudou o bastante para voltar, mas só depois de um tempo
    }
    return 0; // dispensado e nada mudou: não volta
  }
  if (state.payload_hash !== insight.payloadHash) return 1; // mesmo insight, número novo: é novidade de novo
  const days = state.last_seen_at ? (Date.now() - new Date(state.last_seen_at).getTime()) / 86400000 : 0;
  return Math.exp(-days / 7);
}

export function scoreInsight(insight, state) {
  const conf = CONFIDENCE_WEIGHT[insight.confianca] ?? 0.35;
  const novelty = noveltyFor(insight, state);
  return (insight.importancia / 100) * (0.5 + 0.5 * conf) * (0.35 + 0.65 * novelty);
}

// statesByKey: { [insight.key]: state }
export function rankInsights(insights, statesByKey = {}, { limit = 5 } = {}) {
  return insights
    .map((i) => {
      const state = statesByKey[i.key];
      return { ...i, novelty: noveltyFor(i, state), score: scoreInsight(i, state) };
    })
    // novelty===0 é o caso exato "dispensado e nada mudou" — exclusão dura,
    // separada do score (que nunca chega a exatamente 0 por causa dos pisos
    // da fórmula multiplicativa).
    .filter((i) => i.novelty > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
