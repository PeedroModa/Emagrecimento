import { useEffect, useRef } from "react";
import SectionHeader from "../layout/SectionHeader.jsx";
import InsightCard from "./InsightCard.jsx";

// Feed de descobertas: a primeira (mais relevante) ganha destaque editorial;
// as demais formam uma lista mais compacta. Marca como "visto" (debounced,
// dentro de useInsightState) só depois de renderizado — não a cada tecla.
export default function InsightFeed({ insights, onDismiss, onSeen }) {
  const markedRef = useRef("");
  useEffect(() => {
    if (!insights.length || !onSeen) return;
    const signature = insights.map((i) => `${i.key}:${i.payloadHash}`).join("|");
    if (markedRef.current === signature) return;
    markedRef.current = signature;
    onSeen(insights);
  }, [insights, onSeen]);

  if (!insights.length) return null;

  const [first, ...rest] = insights;

  return (
    <div className="insight-feed">
      <SectionHeader title="Descobertas" subtitle="derivadas dos seus próprios dados, nunca do que seria bom acontecer" />
      <InsightCard insight={first} onDismiss={onDismiss} highlight />
      {rest.map((i) => (
        <InsightCard key={i.key} insight={i} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
