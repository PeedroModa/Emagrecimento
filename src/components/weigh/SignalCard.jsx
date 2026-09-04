import { Info } from "lucide-react";
import ContextTagPrompt from "./ContextTagPrompt.jsx";
import { SIGNAL_TAG_IDS } from "../../lib/contextTags.js";

// A leitura principal ("é real ou ruído?") já aparece inteira na declaração
// do dia, lá em cima — número, frase de interpretação e a régua grande.
// Este card só existe para o que NÃO está lá: o aviso de amostra pequena e
// o convite a registrar contexto quando a variação foge do normal. Sem
// nenhum dos dois, o card não tem nada a acrescentar e não renderiza nada.
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

  const showSampleNote = signalRead.samplePrior < 5;
  if (!showSampleNote && !showTagPrompt) return null;

  return (
    <div className="card">
      {showSampleNote && (
        <div style={{ display: "flex", gap: 6, fontSize: ".8rem", color: "var(--t3)", lineHeight: 1.45, marginBottom: showTagPrompt ? 12 : 0 }}>
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
