import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const CONFIDENCE_LABEL = { fato: "Fato", tendencia: "Tendência", estimativa: "Estimativa", hipotese: "Hipótese" };

export default function InsightCard({ insight, onDismiss, highlight = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="insight-card">
      <div className="insight-head">
        <h3 className="insight-title" style={highlight ? { fontSize: "1.35rem" } : undefined}>{insight.titulo}</h3>
        <span className={`insight-badge insight-badge-${insight.confianca}`}>{CONFIDENCE_LABEL[insight.confianca]}</span>
      </div>
      <p className="insight-body">{insight.corpo}</p>

      {insight.evidencia?.length > 0 && (
        <>
          <button type="button" className="insight-evidence-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? <ChevronUp size={13} style={{ verticalAlign: "-2px" }} /> : <ChevronDown size={13} style={{ verticalAlign: "-2px" }} />}
            {" "}{open ? "ocultar prova" : "ver prova"}
          </button>
          {open && (
            <div className="insight-evidence">
              {insight.evidencia.map((e, i) => (
                <div className="insight-evidence-row" key={i}>
                  <span>{e.label}</span>
                  <span>{e.valor}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {onDismiss && (
        <button type="button" className="insight-dismiss" onClick={() => onDismiss(insight)}>
          dispensar
        </button>
      )}
    </div>
  );
}
