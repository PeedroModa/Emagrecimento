import { Info } from "lucide-react";
import { fmtDateBR } from "../../lib/calculations.js";

// #5 — Adaptação metabólica. Torna visível o que a fórmula já faz em
// silêncio: conforme o peso cai, a manutenção estimada (Mifflin-St Jeor)
// cai junto. Sparkline em SVG puro, sem outra instância de Chart.js.
function Sparkline({ points }) {
  const W = 260, H = 46, pad = 3;
  const tdees = points.map((p) => p.tdee);
  const min = Math.min(...tdees), max = Math.max(...tdees);
  const span = max - min || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.tdee).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img"
      aria-label={`Manutenção estimada de ${tdees[0]} a ${tdees[tdees.length - 1]} kcal ao longo do período`}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].tdee)} r="3" fill="var(--accent)" />
    </svg>
  );
}

export default function MetabolicAdaptationCard({ adaptation }) {
  if (!adaptation) return null;
  const { points, firstTdee, lastTdee, deltaTdee, deltaPerMonth, weightDelta } = adaptation;

  return (
    <div className="card">
      <div className="card-label">Adaptação metabólica</div>

      <div className="flex-row" style={{ gap: 14, alignItems: "baseline", marginBottom: 10 }}>
        <span className="num" style={{ fontSize: "1.1rem", color: "var(--t2)" }}>{firstTdee}</span>
        <span style={{ color: "var(--t3)" }}>→</span>
        <span className="big-num" style={{ fontSize: "1.6rem" }}>{lastTdee}</span>
        <span style={{ fontSize: ".8rem", color: "var(--t2)" }}>kcal/dia para manter</span>
      </div>

      <Sparkline points={points} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: "var(--t3)", marginTop: 2 }}>
        <span>{fmtDateBR(points[0].dateISO)}</span>
        <span>{fmtDateBR(points[points.length - 1].dateISO)}</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12, fontSize: ".78rem", color: "var(--t3)", lineHeight: 1.5 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          {deltaTdee < 0
            ? <>Você perdeu <span className="num">{Math.abs(weightDelta).toFixed(1)}</span> kg e, com isso, sua manutenção estimada caiu <strong style={{ color: "var(--t1)" }}>{Math.abs(deltaTdee)} kcal</strong>{deltaPerMonth ? <> — cerca de <span className="num">{Math.abs(deltaPerMonth)}</span> kcal/mês</> : null}. É por isso que o mesmo prato que emagrecia no começo pode empatar agora: o alvo precisa acompanhar. </>
            : <>Sua manutenção estimada praticamente não mudou no período. </>}
          Estimativa do Mifflin-St Jeor, não medição — trate como direção.
        </span>
      </div>
    </div>
  );
}
