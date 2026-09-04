// Limitado às pesagens mais recentes — com pesagem diária ao longo de
// meses/anos, uma barra por pesagem cresceria sem limite (e o gráfico
// acima já mostra a curva inteira; isto aqui é só um relance rápido do
// que aconteceu por perto).
const RECENT_LIMIT = 20;

export default function ProgressionBars({ series, goal }) {
  if (series.length < 1) return null;
  const recent = series.slice(-RECENT_LIMIT);
  const vals = recent.map((s) => s.peso);
  const lo = Math.min(...vals, goal);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const reversed = [...recent].reverse();
  const truncated = series.length > RECENT_LIMIT;

  return (
    <div className="card">
      <div className="card-label">Progressão{truncated ? ` · últimas ${RECENT_LIMIT}` : ""}</div>
      <div>
        {reversed.map((s, i) => {
          const prev = reversed[i + 1];
          const diff = prev ? +(s.peso - prev.peso).toFixed(1) : null;
          const pct = ((s.peso - lo) / span) * 100;
          const barColor = diff == null ? "var(--good)" : diff < 0 ? "var(--good)" : diff > 0 ? "var(--accent)" : "var(--t2)";
          return (
            <div key={s.id} className="prog-row">
              <span className="prog-label">{s.label}</span>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: `${Math.max(6, pct)}%`, background: barColor }} />
                <span className="prog-value">{s.peso} kg</span>
              </div>
              <span className="prog-diff" style={{ color: barColor }}>
                {diff == null ? "—" : diff === 0 ? "=" : `${diff > 0 ? "+" : ""}${diff}`}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: ".68rem", color: "var(--t3)", fontFamily: "var(--font-condensed)", letterSpacing: ".04em" }}>
        <span>← mais perto da meta ({goal}kg)</span>
        <span>mais longe →</span>
      </div>
    </div>
  );
}
