const LABELS = { fato: "Fato", tendencia: "Tendência", estimativa: "Estimativa", hipotese: "Hipótese" };

// Cada nível de confiança tem tratamento visual PRÓPRIO — não só cor — para
// que "isso é medido" e "isso é hipótese" se distingam batendo o olho, não
// só lendo o rótulo. Ícones desenhados (sem emoji), stroke-based.
function Icon({ confianca }) {
  if (confianca === "fato") {
    return (
      <span className="badge-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (confianca === "tendencia") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
        <polyline points="16 17 22 17 22 11" />
      </svg>
    );
  }
  if (confianca === "estimativa") {
    return (
      <span className="badge-icon">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return null; // hipótese usa "?" tipográfico, não ícone
}

export default function ConfidenceBadge({ confianca }) {
  return (
    <span className={`badge badge-${confianca}`}>
      {confianca === "hipotese" ? "?" : <Icon confianca={confianca} />}
      {LABELS[confianca]}
    </span>
  );
}
