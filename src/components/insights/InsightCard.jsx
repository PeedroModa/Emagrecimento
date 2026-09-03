import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ConfidenceBadge from "../ui/ConfidenceBadge.jsx";

function Evidence({ items, open, onToggle }) {
  if (!items?.length) return null;
  return (
    <>
      <button type="button" className="evidence-toggle" onClick={onToggle} aria-expanded={open}>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "ocultar prova" : "ver prova"}
      </button>
      {open && (
        <div className="evidence-panel">
          {items.map((e, i) => (
            <div className="evidence-line" key={i}>
              <span className="k">{e.label}</span>
              <span className="v">{e.valor}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// A descoberta mais relevante do feed ganha tratamento editorial — título
// grande, sem moldura, como um "momento" — não mais um card na pilha. As
// demais formam uma lista mais compacta, mas nunca voltam a ser
// pilulazinhas cinzas indistinguíveis: o selo de confiança carrega
// identidade visual própria (ver ConfidenceBadge).
export default function InsightCard({ insight, onDismiss, highlight = false }) {
  const [open, setOpen] = useState(false);

  if (highlight) {
    return (
      <div className="insight-primary">
        <ConfidenceBadge confianca={insight.confianca} />
        <h3>{insight.titulo}</h3>
        <p>{insight.corpo}</p>
        <Evidence items={insight.evidencia} open={open} onToggle={() => setOpen((v) => !v)} />
        {onDismiss && <button type="button" className="insight-dismiss" onClick={() => onDismiss(insight)}>dispensar</button>}
      </div>
    );
  }

  return (
    <div className="insight-row">
      <ConfidenceBadge confianca={insight.confianca} />
      <div className="insight-body">
        <h4>{insight.titulo}</h4>
        <p>{insight.corpo}</p>
        <Evidence items={insight.evidencia} open={open} onToggle={() => setOpen((v) => !v)} />
        {onDismiss && <button type="button" className="insight-dismiss" onClick={() => onDismiss(insight)}>dispensar</button>}
      </div>
    </div>
  );
}
