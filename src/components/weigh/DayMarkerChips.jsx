const MARKERS = [
  { key: "trained", label: "Treino" },
  { key: "alcohol", label: "Álcool" },
  { key: "high_sodium", label: "Sal / fora de casa" },
  { key: "slept_badly", label: "Dormi mal" },
  { key: "travel", label: "Viagem" },
];

// Um toque, sem confirmação, sem obrigação — pular é o padrão silencioso.
// Nunca vira formulário: cada chip alterna sozinho, direto no banco.
export default function DayMarkerChips({ date, marker, onToggle }) {
  return (
    <div>
      <span className="small-label" style={{ display: "block", marginBottom: 6 }}>algo sobre hoje? (opcional)</span>
      <div className="marker-chips">
        {MARKERS.map((m) => (
          <button
            key={m.key} type="button"
            className={"marker-chip" + (marker?.[m.key] === true ? " active" : "")}
            onClick={() => onToggle(date, m.key)}
            aria-pressed={marker?.[m.key] === true}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
