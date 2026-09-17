import { Dumbbell } from "lucide-react";

const MARKERS = [
  { key: "trained", label: "Treino" },
  { key: "alcohol", label: "Álcool" },
  { key: "high_sodium", label: "Sal / fora de casa" },
  { key: "slept_badly", label: "Dormi mal" },
  { key: "travel", label: "Viagem" },
];

// Um toque, sem confirmação, sem obrigação — pular é o padrão silencioso.
// Nunca vira formulário: cada chip alterna sozinho, direto no banco.
// `lockedKeys`: marcadores que vêm de outra fonte (ex.: "trained" de um
// treino sincronizado do Gravl). Ficam acesos e não alternam — antes, tocar
// neles gravava um marcador manual que a tela nunca refletia.
export default function DayMarkerChips({ date, marker, onToggle, lockedKeys = [] }) {
  return (
    <div>
      <span className="small-label" style={{ display: "block", marginBottom: 6 }}>algo sobre hoje? (opcional)</span>
      <div className="marker-chips">
        {MARKERS.map((m) => {
          const locked = lockedKeys.includes(m.key);
          const active = locked || marker?.[m.key] === true;
          return (
            <button
              key={m.key} type="button"
              className={"marker-chip" + (active ? " active" : "")}
              onClick={() => !locked && onToggle(date, m.key)}
              aria-pressed={active}
              disabled={locked}
              title={locked ? "registrado pelo seu app de treino" : undefined}
              style={locked ? { opacity: 1, cursor: "default", display: "inline-flex", alignItems: "center", gap: 6 } : undefined}
            >
              {locked && <Dumbbell size={12} aria-hidden="true" />}
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
