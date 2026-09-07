import { CalendarRange, ArrowRight } from "lucide-react";
import { fmtDateBR } from "../../lib/calculations.js";

const RATE_SHORT = { rising: "ganho de peso", below: "ritmo lento", fast: "rápido demais", healthy: "faixa saudável" };

// #3 — Resumo da semana. Fecha o ritual da pesagem: quantas pesagens, o que
// o peso fez vs. a semana anterior, e para onde a tendência está indo.
export default function WeeklyReviewCard({ review }) {
  if (!review) return null;
  const {
    periodStartISO, periodEndISO, weighCount, weighCountPrev,
    weightDelta, ratePerWeekNow, rateDelta, statusNow, categoryChanged, weeksToGoal,
  } = review;

  const sign = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±");
  const fmt1 = (n) => `${sign(n)}${Math.abs(n).toFixed(1)}`;
  const fmt2 = (n) => `${sign(n)}${Math.abs(n).toFixed(2)}`;
  const deltaColor = weightDelta == null ? "var(--t2)" : weightDelta < -0.05 ? "var(--good)" : weightDelta > 0.05 ? "var(--warn)" : "var(--t2)";

  return (
    <div className="card">
      <div className="card-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CalendarRange size={14} /> Resumo da semana
        <span style={{ color: "var(--t3)", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>
          {fmtDateBR(periodStartISO)} – {fmtDateBR(periodEndISO)}
        </span>
      </div>

      {categoryChanged && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(201,162,75,.08)", borderLeft: "3px solid var(--warn)", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: ".82rem", color: "var(--t1)" }}>
          Ritmo mudou de <strong>{RATE_SHORT[categoryChanged.from.key]}</strong>
          <ArrowRight size={13} style={{ flexShrink: 0, color: "var(--warn)" }} />
          <strong>{RATE_SHORT[categoryChanged.to.key]}</strong>
        </div>
      )}

      <div className="flex-row" style={{ gap: 18 }}>
        <div style={{ flex: "1 1 90px" }}>
          <div className="small-label">peso na semana</div>
          <div className="big-num" style={{ color: deltaColor }}>
            {weightDelta == null ? "--" : `${fmt1(weightDelta)}`}
          </div>
          <div style={{ fontSize: ".65rem", color: "var(--t3)" }}>kg vs. semana anterior</div>
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <div className="small-label">pesagens</div>
          <div className="big-num" style={{ color: weighCount >= 1 ? "var(--t1)" : "var(--t3)" }}>{weighCount}</div>
          <div style={{ fontSize: ".65rem", color: "var(--t3)" }}>
            {weighCountPrev != null ? `${weighCountPrev} na semana anterior` : "—"}
          </div>
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <div className="small-label">tendência</div>
          <div className="big-num" style={{ color: statusNow?.color || "var(--t2)" }}>
            {ratePerWeekNow == null ? "--" : fmt2(ratePerWeekNow)}
          </div>
          <div style={{ fontSize: ".65rem", color: "var(--t3)" }}>
            kg/sem{rateDelta != null && Math.abs(rateDelta) >= 0.03 ? ` · ${fmt2(rateDelta)} vs. antes` : ""}
          </div>
        </div>
      </div>

      {statusNow && (
        <div style={{ fontSize: ".8rem", color: statusNow.color, marginTop: 12, lineHeight: 1.4 }}>
          {statusNow.text}
          {weeksToGoal ? <span style={{ color: "var(--t3)" }}> · ~{weeksToGoal} semanas até a meta neste ritmo.</span> : null}
        </div>
      )}
    </div>
  );
}
