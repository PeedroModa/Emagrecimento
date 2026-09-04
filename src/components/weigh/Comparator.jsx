import { useState, useMemo } from "react";
import { fmtDateBR, daysBetween } from "../../lib/calculations.js";
import SectionHeader from "../layout/SectionHeader.jsx";

const PRESETS = [
  { id: "start", label: "Início" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "180", label: "6 meses" },
];

// Acha a pesagem mais próxima de "N dias antes de hoje" (ou a primeira, no
// preset "início"). Tolerância de ~40% do intervalo: perto demais do alvo
// não força um ponto que na verdade está longe.
export function findReference(sorted, presetId) {
  if (sorted.length < 2) return null;
  const last = sorted[sorted.length - 1];
  if (presetId === "start") return sorted[0].date === last.date ? null : sorted[0];
  const days = +presetId;
  let best = null, bestDiff = Infinity;
  for (const w of sorted) {
    const gap = daysBetween(w.date, last.date);
    const diff = Math.abs(gap - days);
    if (diff < bestDiff) { bestDiff = diff; best = w; }
  }
  if (!best || best.date === last.date) return null;
  if (bestDiff > days * 0.4 + 5) return null;
  return best;
}

export default function Comparator({ weighIns }) {
  const [preset, setPreset] = useState("30");
  const last = weighIns[weighIns.length - 1];
  const ref = useMemo(() => findReference(weighIns, preset), [weighIns, preset]);

  if (!last) return null;

  const diff = ref ? +(last.weight - ref.weight).toFixed(1) : null;
  const diffColor = diff == null || diff === 0 ? "var(--t2)" : diff < 0 ? "#86A2B3" : "var(--accent)";

  return (
    <div className="card">
      <SectionHeader title="Compare dois momentos" subtitle="você hoje, contra você em outro ponto da jornada" />
      <div className="cmp-presets">
        {PRESETS.map((p) => (
          <button
            key={p.id} type="button"
            className={"toggle-pill" + (preset === p.id ? " active" : "")}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {ref ? (
        <div className="cmp-row">
          <div className="cmp-col">
            <span className="cmp-label">{fmtDateBR(ref.date)}</span>
            <span className="cmp-num num">{ref.weight}<span className="cmp-unit">kg</span></span>
          </div>
          <div className="cmp-arrow" aria-hidden="true">→</div>
          <div className="cmp-col">
            <span className="cmp-label">hoje</span>
            <span className="cmp-num num">{last.weight}<span className="cmp-unit">kg</span></span>
          </div>
          <div className="cmp-diff" style={{ color: diffColor }}>
            {diff > 0 ? "+" : ""}{diff}kg
          </div>
        </div>
      ) : (
        <p className="cmp-empty">Ainda não há uma pesagem perto o bastante desse ponto para comparar.</p>
      )}
    </div>
  );
}
