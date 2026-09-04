import { fmtDateBR, daysBetween } from "../../lib/calculations.js";
import { changePoint } from "../../lib/stats.js";
import SectionHeader from "../layout/SectionHeader.jsx";

const MILESTONE_DAYS = [30, 90, 180, 365, 730];

// Transforma o histórico numa lista de eventos ordenados por data — a
// jornada como história, não como tabela. Exportada separada do componente
// para ser testável sem renderizar nada.
export function buildTimeline(sorted, records) {
  if (sorted.length < 2) return [];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const byDate = new Map();
  const add = (date, title, detail, current) => {
    byDate.set(date, { date, title, detail, current, ...(byDate.get(date) || {}) });
  };

  add(first.date, "Jornada começou", `${first.weight}kg`);

  if (records?.min && records.min.date !== first.date) {
    add(records.min.date, "Novo menor peso", `${records.min.weight}kg`);
  }

  for (const d of MILESTONE_DAYS) {
    if (daysBetween(first.date, last.date) < d) continue;
    let closest = null, bestDiff = Infinity;
    for (const w of sorted) {
      const diff = Math.abs(daysBetween(first.date, w.date) - d);
      if (diff < bestDiff) { bestDiff = diff; closest = w; }
    }
    if (closest && bestDiff <= 5 && closest.date !== first.date) {
      add(closest.date, `${d} dias de jornada`, `${closest.weight}kg`);
    }
  }

  if (sorted.length >= 30) {
    const t0 = first.date;
    const points = sorted.map((w) => ({ x: daysBetween(t0, w.date), y: w.weight }));
    const cp = changePoint(points, { minSegment: 14 });
    if (cp?.significantAdjusted) {
      const splitDate = sorted[cp.index]?.date;
      if (splitDate) {
        const beforeWeek = +(cp.before.slope * 7).toFixed(2);
        const afterWeek = +(cp.after.slope * 7).toFixed(2);
        add(splitDate, "Mudança de ritmo detectada", `${beforeWeek} → ${afterWeek}kg/semana`);
      }
    }
  }

  add(last.date, "Você está aqui", `${last.weight}kg`, true);

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function JourneyTimeline({ sorted, records }) {
  const events = buildTimeline(sorted, records);
  if (events.length < 2) return null;
  return (
    <div className="section">
      <SectionHeader title="Sua jornada" subtitle="os momentos que os dados guardaram" />
      <div className="timeline">
        {events.map((e, i) => (
          <div className="timeline-item" key={`${e.date}-${i}`}>
            <div className={"timeline-dot" + (e.current ? " current" : "")} />
            <div className="timeline-content">
              <div className="timeline-date">{fmtDateBR(e.date)}</div>
              <div className="timeline-title">{e.title}</div>
              <div className="timeline-detail num">{e.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
