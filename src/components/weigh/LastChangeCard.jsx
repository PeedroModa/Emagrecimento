import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export default function LastChangeCard({ lastChange }) {
  if (!lastChange) return null;
  const { diff, gapDays, note, prevWeight } = lastChange;
  const color = diff < 0 ? "var(--good)" : diff > 0 ? "var(--accent)" : "var(--t2)";
  const Icon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;

  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex-row" style={{ gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={26} color={color} />
          <span className="hero-num" style={{ fontSize: "2.1rem", color }}>
            {diff > 0 ? "+" : ""}{diff === 0 ? "0" : diff}
          </span>
          <span style={{ fontSize: ".85rem", color: "var(--t2)" }}>kg</span>
        </div>
        <div style={{ fontSize: ".85rem", color: "var(--t2)", lineHeight: 1.5, flex: 1, minWidth: 200 }}>
          {diff < 0 ? "abaixo" : diff > 0 ? "acima" : "igual"} da pesagem anterior{" "}
          (<span className="num">{prevWeight}kg</span>, há {gapDays} {gapDays === 1 ? "dia" : "dias"}).
          {note && <span style={{ display: "block", fontStyle: "italic", marginTop: 2 }}>nota: "{note}"</span>}
        </div>
      </div>
    </div>
  );
}
