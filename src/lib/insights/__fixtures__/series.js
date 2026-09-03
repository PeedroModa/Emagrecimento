// Geradores determinísticos de séries sintéticas para testar o motor de
// insights sem depender de dados reais. PRNG próprio (mulberry32, 6 linhas)
// para não adicionar dependência só para os testes.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
}

// Ruído gaussiano via Box-Muller, alimentado pelo PRNG determinístico.
function gaussian(rng) {
  const u = Math.max(rng(), 1e-9), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function makeSeries({
  start = "2026-01-01", days, startKg, slopeKgPerDay = 0, noiseSd = 0,
  seed = 1, gaps = [], stepDays = 1,
}) {
  const rng = mulberry32(seed);
  const gapSet = new Set(gaps);
  const out = [];
  for (let d = 0; d < days; d += stepDays) {
    if (gapSet.has(d)) continue;
    const date = addDaysISO(start, d);
    const weight = +(startKg + slopeKgPerDay * d + gaussian(rng) * noiseSd).toFixed(2);
    out.push({ id: date, date, weight });
  }
  return out;
}

export function withSpike(series, { atDay, deltaKg, start = "2026-01-01" }) {
  const targetDate = addDaysISO(start, atDay);
  return series.map((w) => (w.date === targetDate ? { ...w, weight: +(w.weight + deltaKg).toFixed(2) } : w));
}

export const FIXTURES = {
  // Exatamente o histórico atual do usuário no início da V2: 6 pesagens
  // semanais. NENHUMA regra além do Tier 0 deve disparar sobre isto.
  sparse6: makeSeries({ start: "2026-06-01", days: 36, startKg: 107.4, slopeKgPerDay: -0.05, noiseSd: 0.15, seed: 6, stepDays: 6 }),

  // 60 dias diários, platô real (slope 0): nenhuma regra de perda deve disparar.
  plateauReal: makeSeries({ start: "2026-01-01", days: 60, startKg: 95, slopeKgPerDay: 0, noiseSd: 0.35, seed: 42 }),

  // 60 dias diários, perda rápida e consistente (~1kg/semana): a tendência
  // deve disparar como "real".
  fastLoss: makeSeries({ start: "2026-01-01", days: 60, startKg: 100, slopeKgPerDay: -1 / 7, noiseSd: 0.3, seed: 7 }),

  // 90 dias diários, ruidoso, tendência fraca: o IC deve cruzar zero.
  noisy: makeSeries({ start: "2026-01-01", days: 90, startKg: 90, slopeKgPerDay: -0.03 / 7, noiseSd: 1.1, seed: 99 }),
};

export { addDaysISO };
