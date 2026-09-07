import { AlertTriangle } from "lucide-react";
import { fmtDateBR } from "../../lib/calculations.js";

// #6 — Platô nomeado. Não tenta ajustar nada sozinho (isso seria outro
// produto); só reconhece a estagnação e lista as alavancas conhecidas.
const LEVERS = [
  ["Recalcule o déficit", "sua manutenção caiu junto com o peso — veja a adaptação metabólica na Nutrição."],
  ["Meça a cintura", "recomposição (perde gordura, ganha músculo) quase não mexe na balança."],
  ["Semana de manutenção", "1–2 semanas comendo no gasto total e depois retomar o déficit costuma destravar."],
  ["Cheque a consistência", "pesagens espaçadas escondem a tendência real — pese no mesmo horário, de manhã."],
];

export default function PlateauCard({ plateau }) {
  if (!plateau || !plateau.inPlateau) return null;
  const { weeksStalled, sinceISO, aboveMin, ratePerWeek } = plateau;

  return (
    <div className="card" style={{ borderLeft: "3px solid var(--warn)" }}>
      <div className="card-label" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--warn)" }}>
        <AlertTriangle size={14} /> Platô há ~{weeksStalled} {weeksStalled === 1 ? "semana" : "semanas"}
      </div>
      <p style={{ fontSize: ".85rem", color: "var(--t2)", lineHeight: 1.55, margin: "0 0 4px" }}>
        Seu menor peso foi em <strong style={{ color: "var(--t1)" }}>{fmtDateBR(sinceISO)}</strong> e desde então você
        oscila {aboveMin <= 0 ? "no mesmo nível" : `${aboveMin.toFixed(1)} kg acima`}, com tendência de{" "}
        <span className="num">
          {ratePerWeek == null
            ? "--"
            : `${ratePerWeek > 0.005 ? "+" : ratePerWeek < -0.005 ? "−" : "±"}${Math.abs(ratePerWeek).toFixed(2)}`}
        </span> kg/semana.
        Isso é um platô, não um fracasso — é quando o corpo se ajustou ao déficit atual.
      </p>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {LEVERS.map(([title, desc]) => (
          <div key={title} style={{ display: "flex", gap: 8, fontSize: ".82rem", lineHeight: 1.45 }}>
            <span style={{ color: "var(--warn)", flexShrink: 0 }}>→</span>
            <span style={{ color: "var(--t2)" }}>
              <strong style={{ color: "var(--t1)" }}>{title}</strong> — {desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
