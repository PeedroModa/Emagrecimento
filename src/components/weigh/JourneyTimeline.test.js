import { describe, it, expect } from "vitest";
import { buildTimeline } from "./JourneyTimeline.jsx";

function w(date, weight) {
  return { id: date, date, weight };
}

describe("buildTimeline", () => {
  it("com menos de 2 pesagens, devolve lista vazia", () => {
    expect(buildTimeline([w("2026-01-01", 100)], null)).toEqual([]);
    expect(buildTimeline([], null)).toEqual([]);
  });

  it("sempre inclui início e 'você está aqui', em ordem cronológica", () => {
    const sorted = [w("2026-01-01", 100), w("2026-01-15", 98)];
    const events = buildTimeline(sorted, null);
    expect(events[0].title).toBe("Jornada começou");
    expect(events[events.length - 1].title).toBe("Você está aqui");
    expect(events[events.length - 1].current).toBe(true);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].date >= events[i - 1].date).toBe(true);
    }
  });

  it("inclui o menor peso como marco, quando diferente do início", () => {
    const sorted = [w("2026-01-01", 100), w("2026-01-08", 95), w("2026-01-15", 97)];
    const records = { min: sorted[1], max: sorted[0], biggestDrop: null };
    const events = buildTimeline(sorted, records);
    expect(events.some((e) => e.title === "Novo menor peso" && e.date === "2026-01-08")).toBe(true);
  });

  it("não duplica o evento de início quando o menor peso É o início", () => {
    const sorted = [w("2026-01-01", 100), w("2026-01-08", 101)];
    const records = { min: sorted[0], max: sorted[1], biggestDrop: null };
    const events = buildTimeline(sorted, records);
    const onStartDate = events.filter((e) => e.date === "2026-01-01");
    expect(onStartDate).toHaveLength(1);
  });

  it("inclui marco de 30 dias quando a jornada já passou disso, com a pesagem mais próxima", () => {
    const sorted = Array.from({ length: 6 }, (_, i) => w(`2026-01-${String(1 + i * 7).padStart(2, "0")}`, 100 - i));
    const events = buildTimeline(sorted, null);
    expect(events.some((e) => e.title === "30 dias de jornada")).toBe(true);
  });

  it("não inclui marco de 90 dias se a jornada ainda não chegou lá", () => {
    const sorted = [w("2026-01-01", 100), w("2026-01-20", 98)];
    const events = buildTimeline(sorted, null);
    expect(events.some((e) => e.title.includes("dias de jornada"))).toBe(false);
  });
});
