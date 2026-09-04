import SectionHeader from "../layout/SectionHeader.jsx";

const PARTS = [
  { key: "waist", label: "Cintura" },
  { key: "neck", label: "Pescoço" },
  { key: "hip", label: "Quadril" },
  { key: "chest", label: "Peito" },
  { key: "arm", label: "Braço" },
  { key: "thigh", label: "Coxa" },
];

// Onde o seu corpo mudou primeiro — comparação simples primeira vs. última
// medição, ordenada pela maior redução percentual. Só aparece com >=2
// sessões de medida; com 1, mostra só as razões cintura/altura e
// cintura/quadril (que já dizem algo sozinhas).
export default function BodyMap({ measurements, heightCm }) {
  if (!measurements.length) return null;
  const last = measurements[measurements.length - 1];
  const first = measurements[0];

  const waistHeight = last.waist && heightCm ? +(last.waist / heightCm).toFixed(2) : null;
  const waistHip = last.waist && last.hip ? +(last.waist / last.hip).toFixed(2) : null;

  const changes = measurements.length >= 2
    ? PARTS.map((p) => {
        const a = first[p.key], b = last[p.key];
        if (a == null || b == null) return null;
        const diff = +(b - a).toFixed(1);
        const pct = a !== 0 ? +((diff / a) * 100).toFixed(1) : null;
        return { ...p, diff, pct };
      }).filter(Boolean).sort((x, y) => (x.pct ?? 0) - (y.pct ?? 0))
    : [];

  if (waistHeight == null && waistHip == null && changes.length === 0) return null;

  return (
    <div className="card">
      <SectionHeader
        title="Seu corpo"
        subtitle={`${measurements.length} ${measurements.length === 1 ? "medição registrada" : "medições registradas"}`}
      />

      {(waistHeight != null || waistHip != null) && (
        <div className="flex-row" style={{ gap: 28, marginBottom: changes.length ? 20 : 0 }}>
          {waistHeight != null && (
            <div>
              <div className="small-label">cintura / altura</div>
              <div className="num" style={{ fontSize: "1.3rem", color: waistHeight < 0.5 ? "var(--good)" : "var(--warn)" }}>{waistHeight}</div>
            </div>
          )}
          {waistHip != null && (
            <div>
              <div className="small-label">cintura / quadril</div>
              <div className="num" style={{ fontSize: "1.3rem" }}>{waistHip}</div>
            </div>
          )}
        </div>
      )}

      {changes.length > 0 && (
        <div>
          <div className="small-label" style={{ marginBottom: 8 }}>onde mudou primeiro</div>
          {changes.map((c) => (
            <div key={c.key} className="flex-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: ".85rem", color: "var(--t2)" }}>{c.label}</span>
              <span
                className="num"
                style={{ fontSize: ".85rem", color: c.diff < 0 ? "var(--good)" : c.diff > 0 ? "var(--accent)" : "var(--t3)" }}
              >
                {c.diff > 0 ? "+" : ""}{c.diff}cm ({c.pct > 0 ? "+" : ""}{c.pct}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
