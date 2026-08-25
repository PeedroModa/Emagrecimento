import { describe, it, expect } from "vitest";
import {
  navyBodyFat, linearSlope, bmi, bmiCategory, computeRecords, computeSeries,
  computeTrend, computeSignalRead, computeLastChange, computeCalories, computeMacros,
  computeSimulator, rateStatus, activityFactor,
} from "./calculations.js";

function w(date, weight, extra = {}) {
  return { id: date, date, weight, ...extra };
}

describe("navyBodyFat", () => {
  it("retorna null sem cintura/pescoço", () => {
    expect(navyBodyFat(null, null, 175)).toBeNull();
  });
  it("retorna null quando cintura <= pescoço", () => {
    expect(navyBodyFat(35, 40, 175)).toBeNull();
  });
  it("calcula BF válido dentro da faixa 2-70", () => {
    const bf = navyBodyFat(90, 38, 175);
    expect(bf).not.toBeNull();
    expect(bf).toBeGreaterThan(2);
    expect(bf).toBeLessThan(70);
  });
});

describe("linearSlope", () => {
  it("retorna null com menos de 2 pontos", () => {
    expect(linearSlope([{ x: 0, y: 1 }])).toBeNull();
  });
  it("calcula inclinação de reta perfeita", () => {
    const slope = linearSlope([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
    expect(slope).toBeCloseTo(2, 5);
  });
});

describe("bmi / bmiCategory", () => {
  it("calcula IMC", () => {
    expect(bmi(90, 175)).toBeCloseTo(29.4, 1);
  });
  it("classifica corretamente", () => {
    expect(bmiCategory(17).label).toBe("abaixo do peso");
    expect(bmiCategory(22).label).toBe("peso normal");
    expect(bmiCategory(27).label).toBe("sobrepeso");
    expect(bmiCategory(32).label).toBe("obesidade grau I");
    expect(bmiCategory(37).label).toBe("obesidade grau II");
    expect(bmiCategory(42).label).toBe("obesidade grau III");
  });
});

describe("computeRecords", () => {
  it("encontra menor, maior peso e maior queda em janela de ~7 dias", () => {
    const logs = [
      w("2026-01-01", 100),
      w("2026-01-08", 98),
      w("2026-01-15", 95),
      w("2026-01-22", 96),
    ];
    const rec = computeRecords(logs);
    expect(rec.min.weight).toBe(95);
    expect(rec.max.weight).toBe(100);
    expect(rec.biggestDrop.diff).toBe(-3); // 98 -> 95 em 7 dias
  });
});

describe("computeSeries — média móvel 27 dias", () => {
  it("não fica nula com pesagens semanais (bug do 7 dias corrigido)", () => {
    const logs = [
      w("2026-01-01", 100),
      w("2026-01-08", 99),
      w("2026-01-15", 98),
    ];
    const series = computeSeries(logs, 175);
    // a última pesagem deve ter média calculada (janela de 27 dias inclui as 3)
    expect(series[series.length - 1].media).not.toBeNull();
  });
});

describe("computeSignalRead — sinal vs. ruído", () => {
  it("exige >= 4 pesagens", () => {
    const logs = [w("2026-01-01", 100), w("2026-01-08", 99.5)];
    const res = computeSignalRead(logs);
    expect(res.status).toBe("insufficient");
    expect(res.need).toBe(2);
  });

  it("peso estável + queda pequena => ruído", () => {
    const logs = [
      w("2026-01-01", 100.0),
      w("2026-01-08", 100.1),
      w("2026-01-15", 99.9),
      w("2026-01-22", 100.0),
      w("2026-01-29", 99.95), // queda de 0.05kg, bem dentro da oscilação histórica
    ];
    const res = computeSignalRead(logs);
    expect(res.status).toBe("ok");
    expect(res.absZ).toBeLessThan(1);
    expect(res.verdict).toBe("Provavelmente ruído");
  });

  it("peso estável + queda grande => sinal real", () => {
    const logs = [
      w("2026-01-01", 100.0),
      w("2026-01-08", 100.05),
      w("2026-01-15", 99.95),
      w("2026-01-22", 100.0),
      w("2026-01-29", 97.5), // queda grande e destoante do ruído histórico
    ];
    const res = computeSignalRead(logs);
    expect(res.status).toBe("ok");
    expect(res.absZ).toBeGreaterThanOrEqual(2);
    expect(res.verdict).toBe("Emagreceu de verdade");
  });

  it("histórico volátil + queda média => ainda lido como ruído (banda larga)", () => {
    const logs = [
      w("2026-01-01", 100.0),
      w("2026-01-08", 101.5),
      w("2026-01-15", 99.0),
      w("2026-01-22", 101.0),
      w("2026-01-29", 100.0), // queda de 1kg, mas histórico já oscila >1kg
    ];
    const res = computeSignalRead(logs);
    expect(res.status).toBe("ok");
    expect(res.absZ).toBeLessThan(1);
    expect(res.verdict).toBe("Provavelmente ruído");
  });

  it("piso de 0.2kg na banda de ruído evita divisão por quase-zero", () => {
    const logs = [
      w("2026-01-01", 100.0),
      w("2026-01-08", 100.0),
      w("2026-01-15", 100.0),
      w("2026-01-22", 100.0),
      w("2026-01-29", 100.05),
    ];
    const res = computeSignalRead(logs);
    expect(res.noiseBand).toBe(0.2);
  });
});

describe("computeLastChange", () => {
  it("retorna null com menos de 2 pesagens", () => {
    expect(computeLastChange([w("2026-01-01", 100)])).toBeNull();
  });
  it("calcula diferença e dias entre pesagens", () => {
    const res = computeLastChange([w("2026-01-01", 100), w("2026-01-08", 98.5)]);
    expect(res.diff).toBe(-1.5);
    expect(res.gapDays).toBe(7);
  });
});

describe("computeTrend — projeção de composição", () => {
  it("trava BF mínimo em 10% quando extrapolação é otimista demais", () => {
    // perda de gordura muito rápida projetada -> deve travar em 10
    const logs = [
      w("2026-01-01", 110, { waist: 100, neck: 38 }),
      w("2026-01-08", 105, { waist: 90, neck: 38 }),
    ];
    const trend = computeTrend(logs, 90, 175);
    expect(trend.projection).not.toBeNull();
    if (trend.projection.bfAtGoal != null) {
      expect(trend.projection.bfAtGoal).toBeGreaterThanOrEqual(10);
    }
  });

  it("sem cintura/pescoço suficientes, projeção fica nula", () => {
    const logs = [w("2026-01-01", 110), w("2026-01-08", 108)];
    const trend = computeTrend(logs, 90, 175);
    expect(trend.projection).toBeNull();
    expect(trend.compAvailable).toBe(0);
  });
});

describe("computeCalories — Mifflin-St Jeor (valores de referência)", () => {
  it("110kg/175cm/28/M/3x/déficit 15% => BMR 2059, TDEE 2831, alvo 2406", () => {
    const res = computeCalories({
      hasWeights: true, currentWeight: 110, height: 175, age: 28, sex: "M", trainDays: 3, deficitPct: 15,
    });
    expect(res.bmr).toBe(2059);
    expect(res.tdee).toBe(2831);
    expect(res.target).toBe(2406);
  });

  it("sem pesagens, retorna nulls", () => {
    const res = computeCalories({ hasWeights: false, currentWeight: 0, height: 175, age: 28, sex: "M", trainDays: 3, deficitPct: 15 });
    expect(res.bmr).toBeNull();
    expect(res.target).toBeNull();
  });
});

describe("activityFactor", () => {
  it("mapeia treinos/semana para fator e label", () => {
    expect(activityFactor(0)).toEqual({ factor: 1.2, label: "sedentário" });
    expect(activityFactor(2)).toEqual({ factor: 1.375, label: "leve" });
    expect(activityFactor(5)).toEqual({ factor: 1.55, label: "moderado" });
    expect(activityFactor(7)).toEqual({ factor: 1.725, label: "intenso" });
  });
});

describe("computeMacros — modo % soma exatamente o alvo", () => {
  it("proteína + carbo + gordura em kcal fecham no alvo (dentro de arredondamento)", () => {
    const kcal = 2406;
    const macros = computeMacros({ hasWeights: true, kcal, currentWeight: 110, protPct: 30, fatPct: 30, protPerKg: 2, fatPerKg: 0.9 });
    const sum = macros.byPct.prot.kcal + macros.byPct.carb.kcal + macros.byPct.fat.kcal;
    expect(sum).toBeGreaterThanOrEqual(kcal - 5);
    expect(sum).toBeLessThanOrEqual(kcal + 5);
    expect(macros.byPct.carb.pct).toBe(40);
  });

  it("carbo nunca fica negativo mesmo com prot+fat somando >100%", () => {
    const macros = computeMacros({ hasWeights: true, kcal: 2000, currentWeight: 90, protPct: 70, fatPct: 50, protPerKg: 2, fatPerKg: 0.9 });
    expect(macros.byPct.carb.pct).toBeGreaterThanOrEqual(0);
    expect(macros.byPct.fat.pct).toBe(30); // clampado a 100 - prot
  });
});

describe("computeMacros — modo peso (g/kg) soma o alvo e sinaliza overflow", () => {
  it("carbo absorve o restante das kcal", () => {
    const kcal = 2406;
    const macros = computeMacros({ hasWeights: true, kcal, currentWeight: 110, protPct: 30, fatPct: 30, protPerKg: 2, fatPerKg: 0.9 });
    const sum = macros.byWeight.prot.kcal + macros.byWeight.carb.kcal + macros.byWeight.fat.kcal;
    expect(sum).toBeGreaterThanOrEqual(kcal - 5);
    expect(sum).toBeLessThanOrEqual(kcal + 5);
    expect(macros.byWeight.overflow).toBe(false);
  });

  it("sinaliza overflow e zera carbo quando proteína+gordura estouram o alvo", () => {
    const macros = computeMacros({ hasWeights: true, kcal: 1500, currentWeight: 110, protPct: 30, fatPct: 30, protPerKg: 3, fatPerKg: 2 });
    expect(macros.byWeight.overflow).toBe(true);
    expect(macros.byWeight.carb.g).toBe(0);
  });
});

describe("computeSimulator", () => {
  it("calcula semanas e data projetada", () => {
    const res = computeSimulator(10, 0.5);
    expect(res.weeks).toBe(20);
  });
  it("meta já atingida => 0 semanas", () => {
    expect(computeSimulator(0, 0.5).weeks).toBe(0);
    expect(computeSimulator(-1, 0.5).weeks).toBe(0);
  });
});

describe("rateStatus", () => {
  it("classifica ritmo saudável, lento, rápido e subindo", () => {
    expect(rateStatus({ lossPerWeek: 0.6 }).key).toBe("healthy");
    expect(rateStatus({ lossPerWeek: 0.1 }).key).toBe("below");
    expect(rateStatus({ lossPerWeek: 1.5 }).key).toBe("fast");
    expect(rateStatus({ lossPerWeek: -0.2 }).key).toBe("rising");
    expect(rateStatus(null)).toBeNull();
  });
});
