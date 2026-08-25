import { useState } from "react";
import { computeSimulator } from "../../lib/calculations.js";

export default function SimulatorCard({ hasWeights, currentWeight, goal }) {
  const [simRate, setSimRate] = useState(0.6);
  const remaining = hasWeights ? +(currentWeight - goal).toFixed(1) : 0;
  const sim = computeSimulator(remaining, simRate);

  return (
    <div className="card">
      <div className="card-label">Simulador · E se eu perdesse...</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="hero-num" style={{ fontSize: "1.9rem", color: "var(--accent)" }}>{simRate.toFixed(2)}</span>
        <span style={{ fontSize: ".85rem", color: "var(--t2)" }}>kg / semana</span>
      </div>
      <input
        type="range" min="0.1" max="1.5" step="0.05" value={simRate}
        aria-label="Ritmo de perda em kg por semana"
        onChange={(e) => setSimRate(parseFloat(e.target.value))}
        style={{ width: "100%", marginTop: 12 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: "var(--t3)", marginTop: 2, fontFamily: "var(--font-condensed)" }}>
        <span>0,1</span><span>0,8</span><span>1,5 kg/sem</span>
      </div>
      {!hasWeights ? (
        <p style={{ marginTop: 14, fontSize: ".87rem", color: "var(--t3)", lineHeight: 1.5 }}>
          Registre uma pesagem para simular. O cálculo parte do seu peso atual, que ainda não existe.
        </p>
      ) : remaining > 0 ? (
        <p style={{ marginTop: 14, fontSize: ".87rem", color: "var(--t2)", lineHeight: 1.5 }}>
          Faltam <strong className="num" style={{ color: "var(--t1)" }}>{remaining}kg</strong> até <span className="num">{goal}kg</span>.
          Nesse ritmo: <strong className="num" style={{ color: "var(--t1)" }}>{sim.weeks} semanas</strong> (~{sim.months} meses),
          chegando por volta de <strong style={{ color: "var(--t1)" }}>{sim.dateLabel}</strong>.
        </p>
      ) : (
        <p style={{ marginTop: 14, fontSize: ".87rem", color: "var(--good)" }}>Meta já atingida.</p>
      )}
    </div>
  );
}
