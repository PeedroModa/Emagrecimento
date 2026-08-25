import { Info } from "lucide-react";

function DeltaBox({ label, value, unit, good }) {
  const color = good ? "var(--good)" : "var(--warn)";
  return (
    <div>
      <div className="small-label">{label}</div>
      <div className="big-num" style={{ color }}>
        {value > 0 ? "+" : ""}{value}{unit}
      </div>
    </div>
  );
}

export default function RecompCard({ fatDelta, leanDelta, waistDelta }) {
  if (fatDelta === null && leanDelta === null && waistDelta === null) return null;
  return (
    <div className="card">
      <div className="card-label">Sinais de recomposição</div>
      <div className="flex-row" style={{ gap: 20 }}>
        {fatDelta !== null && <DeltaBox label="massa gorda" value={fatDelta} unit="kg" good={fatDelta < 0} />}
        {leanDelta !== null && <DeltaBox label="massa magra" value={leanDelta} unit="kg" good={leanDelta >= -0.5} />}
        {waistDelta !== null && <DeltaBox label="cintura" value={waistDelta} unit="cm" good={waistDelta < 0} />}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, fontSize: ".76rem", color: "var(--t3)", lineHeight: 1.45 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Estimativa pelo método Navy (cintura e pescoço). O valor absoluto tem erro de ±3-4%, mas a direção da mudança é confiável — é ela que importa aqui.</span>
      </div>
    </div>
  );
}
