import { Info } from "lucide-react";
import ContextTagPrompt from "./ContextTagPrompt.jsx";
import { SIGNAL_TAG_IDS } from "../../lib/contextTags.js";

export default function SignalCard({ signalRead, showTagPrompt, onSaveContext, onSkipContext }) {
  if (!signalRead) return null;

  if (signalRead.status === "insufficient") {
    if (signalRead.count < 1) return null;
    return (
      <div className="card">
        <div className="card-label">É real ou ruído?</div>
        <p style={{ fontSize: ".88rem", color: "var(--t2)", lineHeight: 1.55 }}>
          Preciso de {signalRead.need} {signalRead.need === 1 ? "pesagem" : "pesagens"} a mais para aprender qual é a sua
          oscilação normal. A partir daí, digo a cada pesagem se a mudança é real ou só flutuação da balança.
        </p>
      </div>
    );
  }

  const markerLeft = Math.max(2, Math.min(98, 50 + (signalRead.z / 3) * 50));

  return (
    <div className="card" style={{ borderLeft: `3px solid ${signalRead.color}` }}>
      <div className="card-label">É real ou ruído?</div>
      <div className="flex-row" style={{ alignItems: "baseline", marginBottom: 10 }}>
        <span className="hero-num" style={{ fontSize: "1.7rem", color: signalRead.color }}>{signalRead.verdict}</span>
        <span className="num" style={{ fontSize: ".78rem", color: "var(--t3)" }}>
          {signalRead.lastDelta > 0 ? "+" : ""}{signalRead.lastDelta}kg esta semana · oscilação típica ±{signalRead.noiseBand}kg
        </span>
      </div>

      {/* régua de ruído */}
      <div style={{ position: "relative", height: 30, marginBottom: 4 }}>
        <div style={{
          position: "absolute", top: 12, left: 0, right: 0, height: 6, borderRadius: 3, opacity: .5,
          background: "linear-gradient(90deg, var(--accent) 0%, var(--good) 22%, var(--hover) 40%, var(--hover) 60%, var(--good) 78%, var(--accent) 100%)",
        }} />
        <div style={{ position: "absolute", top: 12, left: "40%", width: "20%", height: 6, borderRadius: 3, background: "#3A3E40" }} />
        <div style={{ position: "absolute", top: 4, left: `${markerLeft}%`, transform: "translateX(-50%)" }}>
          <div style={{ width: 3, height: 22, borderRadius: 2, background: signalRead.color }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".65rem", color: "var(--t3)", marginBottom: 12, fontFamily: "var(--font-condensed)", letterSpacing: ".04em" }}>
        <span>alta real</span><span>ruído (±{signalRead.noiseBand}kg)</span><span>queda real</span>
      </div>

      <p style={{ fontSize: ".86rem", color: "var(--t2)", lineHeight: 1.55 }}>{signalRead.detail}</p>

      {signalRead.samplePrior < 5 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: ".76rem", color: "var(--t3)", lineHeight: 1.45 }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>Baseado em {signalRead.samplePrior} variações anteriores. Quanto mais você pesar, mais afiada fica a leitura da sua oscilação real.</span>
        </div>
      )}

      {showTagPrompt && (
        <ContextTagPrompt
          tagIds={SIGNAL_TAG_IDS}
          question="Essa variação passou do seu ruído típico. Quer registrar o que pode ter influenciado?"
          showNoteButton
          onSubmit={onSaveContext}
          onSkip={onSkipContext}
        />
      )}
    </div>
  );
}
