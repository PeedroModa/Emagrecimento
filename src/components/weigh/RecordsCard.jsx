import { fmtDateBR } from "../../lib/calculations.js";

export default function RecordsCard({ records }) {
  if (!records) return null;
  return (
    <div className="card">
      <div className="card-label">Recordes</div>
      <div className="flex-row" style={{ gap: 24 }}>
        <div>
          <div className="small-label">menor peso</div>
          <div className="big-num">
            {records.min.weight}
            <span style={{ fontSize: ".72rem", fontWeight: 400, color: "var(--t3)" }}> kg · {fmtDateBR(records.min.date)}</span>
          </div>
        </div>
        <div>
          <div className="small-label">maior peso</div>
          <div className="big-num">
            {records.max.weight}
            <span style={{ fontSize: ".72rem", fontWeight: 400, color: "var(--t3)" }}> kg · {fmtDateBR(records.max.date)}</span>
          </div>
        </div>
        {records.biggestDrop && (
          <div>
            <div className="small-label">maior queda em ~7 dias</div>
            <div className="big-num" style={{ color: "var(--good)" }}>{records.biggestDrop.diff} kg</div>
          </div>
        )}
      </div>
    </div>
  );
}
