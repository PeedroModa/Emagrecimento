import { describe, it, expect } from "vitest";
import {
  mean, sd, median, mad, pFromT, tCritical, ols, slopePerWeek,
  normalizedDeltas, noiseBand, zScore, movingAverageTrailing, movingAverageCentered,
  oneSampleTTest, holmAdjust,
} from "./stats.js";

describe("mean / sd / median / mad", () => {
  it("mean e sd (amostral) de um conjunto simples", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9], { sample: true })).toBeCloseTo(2.1381, 3);
  });

  it("sd amostral exige n>=2; populacional aceita n=1 (retorna 0)", () => {
    expect(sd([5], { sample: true })).toBeNull();
    expect(sd([5], { sample: false })).toBe(0);
  });

  it("median par e ímpar", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("mad é resistente a outlier (diferente de sd)", () => {
    const withOutlier = [1, 2, 2, 3, 2, 1, 2, 50];
    const m = mad(withOutlier);
    const s = sd(withOutlier, { sample: false });
    expect(m.madSd).toBeLessThan(s); // o outlier infla sd muito mais que mad
  });

  it("listas vazias devolvem null, nunca NaN", () => {
    expect(mean([])).toBeNull();
    expect(sd([], { sample: false })).toBeNull();
    expect(median([])).toBeNull();
    expect(mad([])).toBeNull();
  });
});

describe("pFromT / tCritical — validados contra tabela t publicada", () => {
  it("tCritical bilateral bate com a tabela clássica (df, 95%)", () => {
    expect(tCritical(1, 0.95)).toBeCloseTo(12.706, 2);
    expect(tCritical(5, 0.95)).toBeCloseTo(2.571, 2);
    expect(tCritical(10, 0.95)).toBeCloseTo(2.228, 2);
    expect(tCritical(20, 0.95)).toBeCloseTo(2.086, 2);
    expect(tCritical(30, 0.95)).toBeCloseTo(2.042, 2);
  });

  it("tCritical converge para z quando df é grande", () => {
    expect(tCritical(10000, 0.95)).toBeCloseTo(1.960, 2);
  });

  it("tCritical noutras confianças (df=10)", () => {
    expect(tCritical(10, 0.90)).toBeCloseTo(1.812, 2);
    expect(tCritical(10, 0.99)).toBeCloseTo(3.169, 2);
  });

  it("pFromT e tCritical são mutuamente consistentes (mesma fonte de verdade)", () => {
    const df = 14;
    const tc = tCritical(df, 0.95);
    expect(pFromT(tc, df)).toBeCloseTo(0.05, 3);
  });

  it("pFromT(0, df) = 1; pFromT(±Infinity, df) = 0", () => {
    expect(pFromT(0, 10)).toBeCloseTo(1, 6);
    expect(pFromT(Infinity, 10)).toBe(0);
  });

  it("null com df inválido", () => {
    expect(tCritical(0, 0.95)).toBeNull();
    expect(pFromT(2, 0)).toBeNull();
  });
});

describe("ols — validado contra o dataset Anscombe I", () => {
  const anscombeI = [
    { x: 10, y: 8.04 }, { x: 8, y: 6.95 }, { x: 13, y: 7.58 }, { x: 9, y: 8.81 },
    { x: 11, y: 8.33 }, { x: 14, y: 9.96 }, { x: 6, y: 7.24 }, { x: 4, y: 4.26 },
    { x: 12, y: 10.84 }, { x: 7, y: 4.82 }, { x: 5, y: 5.68 },
  ];

  it("slope, intercept e r² batem com os valores publicados (~0.500, ~3.000, ~0.667)", () => {
    const r = ols(anscombeI);
    expect(r.slope).toBeCloseTo(0.5001, 3);
    expect(r.intercept).toBeCloseTo(3.0001, 3);
    expect(r.r2).toBeCloseTo(0.6665, 3);
    expect(r.n).toBe(11);
    expect(r.df).toBe(9);
  });

  it("slopeCi contém o slope verdadeiro conhecido (0.5)", () => {
    const r = ols(anscombeI);
    expect(r.slopeCi[0]).toBeLessThan(0.5);
    expect(r.slopeCi[1]).toBeGreaterThan(0.5);
  });

  it("predict/predictCi/predictPi: PI é sempre mais largo que CI no mesmo x", () => {
    const r = ols(anscombeI);
    const ci = r.predictCi(9);
    const pi = r.predictPi(9);
    expect(pi[1] - pi[0]).toBeGreaterThan(ci[1] - ci[0]);
  });

  it("n<2 devolve null", () => {
    expect(ols([{ x: 1, y: 1 }])).toBeNull();
    expect(ols([])).toBeNull();
  });

  it("todos os x iguais (sxx=0) devolve null — não há reta a ajustar", () => {
    expect(ols([{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }])).toBeNull();
  });

  it("n=2: reta exata, mas SEM estatística de incerteza — tudo null, nunca NaN/Infinity", () => {
    const r = ols([{ x: 0, y: 10 }, { x: 7, y: 9 }]);
    expect(r.df).toBe(0);
    expect(r.slope).toBeCloseTo(-1 / 7, 6);
    expect(r.residualSd).toBeNull();
    expect(r.slopeSe).toBeNull();
    expect(r.pValue).toBeNull();
    expect(r.slopeCi).toBeNull();
    expect(r.significant).toBe(false);
  });

  it("resíduo zero com slope não-nulo e df>0 (pontos perfeitamente alinhados): p=0, nunca NaN", () => {
    const perfect = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    const r = ols(perfect);
    expect(r.tStat).toBe(Infinity);
    expect(r.pValue).toBe(0);
    expect(r.significant).toBe(true);
    expect(Number.isNaN(r.pValue)).toBe(false);
  });

  it("linha perfeitamente horizontal (slope=0, resíduo=0): p=1, nunca NaN — o caso 0/0 do tStat", () => {
    const flat = [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }];
    const r = ols(flat);
    expect(r.slope).toBe(0);
    expect(r.tStat).toBe(0);
    expect(r.pValue).toBeCloseTo(1, 6);
    expect(r.significant).toBe(false);
    expect(Number.isNaN(r.tStat)).toBe(false);
  });

  it("slopePerWeek multiplica por 7; null com fit null", () => {
    expect(slopePerWeek(ols(anscombeI))).toBeCloseTo(0.5001 * 7, 2);
    expect(slopePerWeek(null)).toBeNull();
  });
});

describe("normalizedDeltas — escala √gap", () => {
  it("delta de 7 dias e delta de 1 dia do mesmo tamanho bruto viram diferentes na escala normalizada", () => {
    const { deltas } = normalizedDeltas([
      { t: 0, v: 80 }, { t: 1, v: 80.7 }, { t: 8, v: 81.4 },
    ]);
    expect(deltas[0].gap).toBe(1);
    expect(deltas[1].gap).toBe(7);
    expect(deltas[0].raw).toBeCloseTo(0.7, 6);
    expect(deltas[1].raw).toBeCloseTo(0.7, 6);
    // mesmo delta bruto, mas o de 7 dias representa MENOS variação por dia
    expect(deltas[0].scaled).toBeGreaterThan(deltas[1].scaled);
    expect(deltas[0].perDay).toBeGreaterThan(deltas[1].perDay);
  });

  it("gaps maiores que maxGap são descartados de `deltas` e aparecem em `dropped`", () => {
    const { deltas, dropped } = normalizedDeltas(
      [{ t: 0, v: 80 }, { t: 30, v: 78 }],
      { maxGap: 14 }
    );
    expect(deltas).toHaveLength(0);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].gap).toBe(30);
  });

  it("pontos com t não-crescente são ignorados (sem gap<=0)", () => {
    const { deltas } = normalizedDeltas([{ t: 5, v: 80 }, { t: 5, v: 81 }, { t: 6, v: 81.5 }]);
    expect(deltas).toHaveLength(1);
  });
});

describe("noiseBand / zScore — nunca produz Infinity/NaN, mesmo com sd quase-zero", () => {
  it("desvio minúsculo (não exatamente 0) ainda respeita o piso — o bug do `||` da V1", () => {
    // deltas quase idênticos: sd populacional é ~0.0047, bem abaixo do piso de 0.2
    const band = noiseBand([0.10, 0.10, 0.11], { floor: 0.2 });
    expect(band.band).toBe(0.2);
    expect(band.method).toBe("floor");
    const z = zScore(0.5, band.band);
    expect(Number.isFinite(z)).toBe(true);
  });

  it("com dispersão real acima do piso, usa MAD (robusto) por padrão", () => {
    const band = noiseBand([-0.3, 0.2, -0.4, 0.3, -0.2, 0.4, -0.3]);
    expect(band.method).toBe("mad");
    expect(band.band).toBeGreaterThan(0.2);
  });

  it("lista vazia: banda cai no piso, degenerate=true", () => {
    const band = noiseBand([]);
    expect(band.band).toBe(0.2);
    expect(band.degenerate).toBe(true);
  });

  it("zScore com banda inválida devolve null, nunca divide por zero", () => {
    expect(zScore(1, 0)).toBeNull();
    expect(zScore(1, -1)).toBeNull();
  });

  it("um outlier isolado não infla a MAD o bastante para mascarar a si mesmo", () => {
    const values = [0.1, -0.1, 0.15, -0.05, 0.1, 3.0]; // 3.0 é o pico de retenção
    const band = noiseBand(values);
    const z = zScore(3.0, band.band);
    expect(Math.abs(z)).toBeGreaterThan(2); // o próprio pico ainda se destaca
  });
});

describe("movingAverageTrailing — janela deslizante O(n)", () => {
  it("replica a semântica [t-window, t] inclusiva usada hoje em calculations.js", () => {
    const series = [{ t: 0, v: 10 }, { t: 10, v: 20 }, { t: 20, v: 30 }, { t: 30, v: 40 }];
    const out = movingAverageTrailing(series, 20, { inclusive: true, minPoints: 2 });
    // no t=30, janela [10,30] pega t=10,20,30 (3 pontos)
    expect(out[3].count).toBe(3);
    expect(out[3].avg).toBeCloseTo((20 + 30 + 40) / 3, 2);
    // no t=0, só 1 ponto na janela -> null (minPoints=2)
    expect(out[0].avg).toBeNull();
  });

  it("é O(n): não recalcula a soma do zero a cada ponto (checagem indireta via resultado correto em série grande)", () => {
    const series = Array.from({ length: 500 }, (_, i) => ({ t: i, v: i % 7 }));
    const out = movingAverageTrailing(series, 6, { minPoints: 1 });
    expect(out[499].count).toBe(7); // janela de 7 dias inclusiva
    expect(out.length).toBe(500);
  });
});

describe("movingAverageCentered — sem viés de borda quando requireFull", () => {
  it("nas bordas da série, avg é null (não meia-janela enviesada)", () => {
    const series = Array.from({ length: 21 }, (_, i) => ({ t: i, v: 10 }));
    const out = movingAverageCentered(series, 20, { requireFull: true, minPoints: 1 });
    expect(out[0].avg).toBeNull(); // não há 10 dias antes de t=0
    expect(out[20].avg).toBeNull(); // não há 10 dias depois de t=20
    expect(out[10].avg).not.toBeNull(); // t=10 tem folga completa dos dois lados
  });
});

describe("oneSampleTTest", () => {
  it("detecta média diferente de zero com significância", () => {
    const values = [0.5, 0.6, 0.4, 0.55, 0.45, 0.5, 0.6, 0.5];
    const r = oneSampleTTest(values);
    expect(r.mean).toBeCloseTo(0.5125, 3);
    expect(r.significant).toBe(true);
    expect(r.pValue).toBeLessThan(0.05);
  });

  it("valores idênticos a mu0: fato, não inferência — p=1, não significativo", () => {
    const r = oneSampleTTest([0, 0, 0, 0]);
    expect(r.sd).toBe(0);
    expect(r.pValue).toBe(1);
    expect(r.significant).toBe(false);
  });

  it("valores idênticos DIFERENTES de mu0: t=Infinity mas sem NaN, p=0", () => {
    const r = oneSampleTTest([2, 2, 2, 2], { mu0: 0 });
    expect(r.t).toBe(Infinity);
    expect(r.pValue).toBe(0);
    expect(r.significant).toBe(true);
  });

  it("n<2 devolve null", () => {
    expect(oneSampleTTest([1])).toBeNull();
    expect(oneSampleTTest([])).toBeNull();
  });
});

describe("holmAdjust — correção de múltiplos testes (ex.: 7 dias da semana)", () => {
  it("p-valores ajustados nunca diminuem em relação ao bruto, e são monotônicos por rank", () => {
    const pValues = [0.01, 0.20, 0.03, 0.50, 0.001, 0.04, 0.30];
    const res = holmAdjust(pValues);
    res.forEach((r) => expect(r.pAdj).toBeGreaterThanOrEqual(r.p));
    const sorted = [...res].sort((a, b) => a.p - b.p);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].pAdj).toBeGreaterThanOrEqual(sorted[i - 1].pAdj);
    }
  });

  it("com todos os p muito baixos, ainda podem ser significativos após a correção", () => {
    const res = holmAdjust([0.001, 0.002, 0.0005]);
    expect(res.every((r) => r.significant)).toBe(true);
  });

  it("um único p 'quase significativo' sozinho não sobrevive a testes adicionais não-significativos ao redor", () => {
    const res = holmAdjust([0.04, 0.6, 0.7, 0.8, 0.5, 0.9, 0.3]);
    const first = res.find((r) => r.p === 0.04);
    expect(first.pAdj).toBeGreaterThan(0.04); // penalizado pelos outros 6 testes
  });
});
