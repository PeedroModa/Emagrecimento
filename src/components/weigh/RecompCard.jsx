import { Info } from "lucide-react";
import { COMP_CONFIDENT_SAMPLE } from "../../lib/calculations.js";

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

function QualRow({ label, sub, text, good, value, unit }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span className="small-label">
        {label} <span style={{ color: "var(--t3)", textTransform: "none", fontWeight: 400 }}>· {sub}</span>
      </span>
      <span style={{ fontSize: ".85rem", color: good ? "var(--good)" : "var(--warn)", textAlign: "right" }}>
        {text}{" "}
        <span className="num" style={{ color: "var(--t3)" }}>
          (~{value > 0 ? "+" : ""}{value}{unit})
        </span>
      </span>
    </div>
  );
}

export default function RecompCard({ fatDelta, leanDelta, waistDelta, sample = 0 }) {
  if (fatDelta === null && leanDelta === null && waistDelta === null) return null;

  const confident = sample >= COMP_CONFIDENT_SAMPLE;
  const hasComp = fatDelta !== null && leanDelta !== null;

  if (hasComp && !confident) {
    return (
      <div className="card">
        <div className="card-label">Sinais de recomposição</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--t2)", fontSize: ".85rem", lineHeight: 1.55 }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>
            Ainda cedo pra estimar gordura e massa magra com confiança — só {sample} medidas de cintura até
            agora. A partir de {COMP_CONFIDENT_SAMPLE}, a leitura fica mais sólida.
            {waistDelta !== null && (
              <> A cintura em si já é confiável: <strong style={{ color: "var(--t1)" }}>{waistDelta > 0 ? "+" : ""}{waistDelta}cm</strong>.</>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-label">Sinais de recomposição</div>
      {hasComp ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {waistDelta !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="small-label">
                cintura <span style={{ color: "var(--t3)", textTransform: "none", fontWeight: 400 }}>· medida direta</span>
              </span>
              <span className="num" style={{ fontSize: "1.1rem", fontWeight: 700, color: waistDelta < 0 ? "var(--good)" : "var(--warn)" }}>
                {waistDelta > 0 ? "+" : ""}{waistDelta}cm
              </span>
            </div>
          )}
          <QualRow
            label="gordura" sub="estimativa" value={fatDelta} unit="kg"
            good={fatDelta < 0}
            text={fatDelta < 0 ? "tendência de queda" : "tendência de alta"}
          />
          <QualRow
            label="massa magra" sub="estimativa" value={leanDelta} unit="kg"
            good={leanDelta >= -0.5}
            text={leanDelta >= -0.5 ? "preservada" : "em queda"}
          />
        </div>
      ) : (
        <div className="flex-row" style={{ gap: 20 }}>
          {waistDelta !== null && <DeltaBox label="cintura" value={waistDelta} unit="cm" good={waistDelta < 0} />}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 12, fontSize: ".76rem", color: "var(--t3)", lineHeight: 1.45 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          {hasComp
            ? "Cintura é medida direta. Gordura e massa magra vêm do método Navy (cintura + pescoço), com erro de ±3-4% — a direção da mudança é confiável, o valor exato não."
            : "Estimativa pelo método Navy (cintura e pescoço). O valor absoluto tem erro de ±3-4%, mas a direção da mudança é confiável — é ela que importa aqui."}
        </span>
      </div>
    </div>
  );
}
