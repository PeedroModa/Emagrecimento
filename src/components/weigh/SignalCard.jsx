import { Info } from "lucide-react";
import ContextTagPrompt from "./ContextTagPrompt.jsx";
import { SIGNAL_TAG_IDS } from "../../lib/contextTags.js";
import OscillationBand from "../insights/OscillationBand.jsx";

// Suporte/evidência da declaração do dia (a leitura principal já aparece
// lá em cima) — por isso o cabeçalho fica enxuto: só o veredito, sem
// repetir o "kg" que a declaração já mostrou.
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

  return (
    <div className="card noise-card">
      <div className="noise-hdr">
        <span className="card-label" style={{ marginBottom: 0 }}>É real ou ruído?</span>
        <span className="verdict" style={{ color: signalRead.color }}>{signalRead.verdict.toLowerCase()}</span>
      </div>

      <OscillationBand z={signalRead.z} noiseBand={signalRead.noiseBand} size="mini" />

      <p style={{ fontSize: ".86rem", color: "var(--t2)", lineHeight: 1.55, marginTop: 14 }}>{signalRead.detail}</p>

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
