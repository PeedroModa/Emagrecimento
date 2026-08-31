import { describe, it, expect } from "vitest";
import {
  navyBodyFat, linearSlope, bmi, bmiCategory, computeRecords, computeSeries, daysBetween,
  computeTrend, computeSignalRead, computeLastChange, computeCalories, computeMacros,
  computeSimulator, rateStatus, activityFactor, ageFromBirthDate, isValidBirthDate, trendRateChange,
  AVG_WINDOW_DAYS, TREND_WINDOW_DAYS, TREND_WINDOW_OPTIONS, regressionWindowFor, regressionWeeksFor,
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

describe("trendRateChange — detecta virada de categoria sem estado persistido", () => {
  it("com menos de 3 pesagens, não há comparação possível", () => {
    const logs = [w("2026-01-01", 100), w("2026-01-08", 99)];
    expect(trendRateChange(logs, 90, 175)).toBeNull();
  });

  it("categoria igual antes e depois da pesagem mais recente => null", () => {
    const logs = [
      w("2026-01-01", 100), w("2026-01-08", 99.4), w("2026-01-15", 98.8),
      w("2026-01-22", 98.2), w("2026-01-29", 97.6),
    ];
    expect(trendRateChange(logs, 90, 175)).toBeNull();
  });

  it("categoria muda de 'healthy' para 'below' => retorna from/to", () => {
    const logs = [
      w("2026-01-01", 100), w("2026-01-08", 99.3), w("2026-01-15", 98.6),
      w("2026-01-22", 97.9), w("2026-01-29", 99.5),
    ];
    const change = trendRateChange(logs, 90, 175);
    expect(change).not.toBeNull();
    expect(change.from.key).toBe("healthy");
    expect(change.to.key).toBe("below");
  });

  it("se a tendência 'anterior' não tem pontos suficientes na janela, não é tratado como mudança", () => {
    // 3 pesagens espaçadas de forma que, ao remover a última, sobra só 1 ponto
    // dentro da janela padrão (28 dias) contada a partir do novo "fim" da série.
    const logs = [w("2026-01-01", 100), w("2026-02-10", 97), w("2026-02-11", 96.8)];
    expect(trendRateChange(logs, 90, 175)).toBeNull();
  });

  it("usa o mesmo windowDays customizado para a comparação atual e a anterior", () => {
    const logs = [
      w("2026-01-01", 100), w("2026-01-08", 99.4), w("2026-01-15", 98.8),
      w("2026-01-22", 98.2), w("2026-01-29", 97.6),
    ];
    expect(trendRateChange(logs, 90, 175, 60)).toBeNull();
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

describe("computeCalories — Mifflin-St Jeor específico por sexo", () => {
  // Mesma altura/idade/peso/treino/déficit para os dois sexos: a única
  // variável é o termo final da fórmula (+5 para homens, -161 para
  // mulheres) — isolando exatamente a diferença de 166 kcal que a fórmula
  // exige (5 - (-161) = 166), e provando que ela se propaga por TDEE e alvo.
  const base = { hasWeights: true, currentWeight: 70, height: 165, age: 30, trainDays: 3, deficitPct: 15 };

  it("BMR masculino: 10×70 + 6.25×165 - 5×30 + 5 = 1586", () => {
    const res = computeCalories({ ...base, sex: "M" });
    expect(res.bmr).toBe(1586);
  });

  it("BMR feminino: 10×70 + 6.25×165 - 5×30 - 161 = 1420", () => {
    const res = computeCalories({ ...base, sex: "F" });
    expect(res.bmr).toBe(1420);
  });

  it("a diferença de BMR entre M e F é exatamente 166 kcal (5 - (-161))", () => {
    const resM = computeCalories({ ...base, sex: "M" });
    const resF = computeCalories({ ...base, sex: "F" });
    expect(resM.bmr - resF.bmr).toBe(166);
  });

  it("TDEE herda a diferença via o mesmo fator de atividade", () => {
    const resM = computeCalories({ ...base, sex: "M" });
    const resF = computeCalories({ ...base, sex: "F" });
    expect(resM.factor).toBe(resF.factor); // fator de atividade não depende do sexo
    expect(resM.tdee).toBe(2181);
    expect(resF.tdee).toBe(1953);
  });

  it("alvo com déficit herda a diferença", () => {
    const resM = computeCalories({ ...base, sex: "M" });
    const resF = computeCalories({ ...base, sex: "F" });
    expect(resM.target).toBe(1854);
    expect(resF.target).toBe(1660);
  });

  it("qualquer valor de sexo diferente de 'M' usa a fórmula feminina (não há terceiro caso)", () => {
    const resF = computeCalories({ ...base, sex: "F" });
    const resOther = computeCalories({ ...base, sex: "outro" });
    expect(resOther.bmr).toBe(resF.bmr);
  });

  it("macros herdam a diferença de sexo através do alvo de calorias", () => {
    const resM = computeCalories({ ...base, sex: "M" });
    const resF = computeCalories({ ...base, sex: "F" });
    const macrosM = computeMacros({ hasWeights: true, kcal: resM.target, currentWeight: 70, protPct: 30, fatPct: 30, protPerKg: 2, fatPerKg: 0.9 });
    const macrosF = computeMacros({ hasWeights: true, kcal: resF.target, currentWeight: 70, protPct: 30, fatPct: 30, protPerKg: 2, fatPerKg: 0.9 });
    expect(macrosM.kcal).toBe(1854);
    expect(macrosF.kcal).toBe(1660);
    expect(macrosM.byPct.prot.g).toBeGreaterThan(macrosF.byPct.prot.g);
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

describe("ageFromBirthDate", () => {
  it("calcula a idade na data de referência", () => {
    expect(ageFromBirthDate("1990-05-10", "2026-08-25")).toBe(36);
  });
  it("ainda não fez aniversário no ano => um a menos", () => {
    expect(ageFromBirthDate("1990-12-01", "2026-08-25")).toBe(35);
  });
  it("no próprio dia do aniversário já conta o ano", () => {
    expect(ageFromBirthDate("1990-08-25", "2026-08-25")).toBe(36);
  });
  it("um dia antes do aniversário ainda não conta", () => {
    expect(ageFromBirthDate("1990-08-26", "2026-08-25")).toBe(35);
  });
  it("aceita timestamp do Postgres (corta em 10 chars)", () => {
    expect(ageFromBirthDate("1990-05-10T00:00:00Z", "2026-08-25")).toBe(36);
  });
  it("retorna null para vazio, formato inválido, futuro e idade absurda", () => {
    expect(ageFromBirthDate(null)).toBeNull();
    expect(ageFromBirthDate("")).toBeNull();
    expect(ageFromBirthDate("10/05/1990")).toBeNull();
    expect(ageFromBirthDate("2030-01-01", "2026-08-25")).toBeNull();
    expect(ageFromBirthDate("1800-01-01", "2026-08-25")).toBeNull();
  });
});

describe("isValidBirthDate", () => {
  it("aceita data real", () => {
    expect(isValidBirthDate("1990-02-28", "2026-08-25")).toBe(true);
    expect(isValidBirthDate("1992-02-29", "2026-08-25")).toBe(true); // bissexto
  });
  it("rejeita data inexistente", () => {
    expect(isValidBirthDate("1990-02-31", "2026-08-25")).toBe(false);
    expect(isValidBirthDate("1990-13-01", "2026-08-25")).toBe(false);
  });
  it("rejeita futuro e vazio", () => {
    expect(isValidBirthDate("2030-01-01", "2026-08-25")).toBe(false);
    expect(isValidBirthDate("")).toBe(false);
  });
});

describe("computeCalories com idade derivada", () => {
  it("idade vinda da data de nascimento dá o mesmo BMR da idade digitada", () => {
    const age = ageFromBirthDate("1998-01-10", "2026-08-25"); // 28
    const res = computeCalories({
      hasWeights: true, currentWeight: 110, height: 175, age, sex: "M", trainDays: 3, deficitPct: 15,
    });
    expect(age).toBe(28);
    expect(res.bmr).toBe(2059);
    expect(res.tdee).toBe(2831);
    expect(res.target).toBe(2406);
  });
});

// ── Janela de análise selecionável (27 / 60 / 90 / 180 / 365) ────────────────

// Pesagens SEMANAIS, como as reais: 1 ponto a cada 7 dias, nada entre eles.
function weeklyLogs(n, startISO, weightAt) {
  const start = new Date(`${startISO}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start.getTime() + i * 7 * 86400000);
    return w(d.toISOString().slice(0, 10), weightAt(i));
  });
}

// Média esperada = só as pesagens reais dentro da janela, sem interpolar nada.
function expectedAvg(logs, endIdx, windowDays) {
  const end = logs[endIdx].date;
  const inWindow = logs.filter((o, i) => i <= endIdx && daysBetween(o.date, end) <= windowDays);
  return +(inWindow.reduce((sum, o) => sum + o.weight, 0) / inWindow.length).toFixed(2);
}

describe("regressionWindowFor — janela da regressão estendida ao múltiplo de 7", () => {
  it("o par histórico do painel é o caso particular da regra", () => {
    expect(regressionWindowFor(AVG_WINDOW_DAYS)).toBe(TREND_WINDOW_DAYS);
    expect(regressionWindowFor(27)).toBe(28);
  });
  it("generaliza para todas as janelas", () => {
    expect(TREND_WINDOW_OPTIONS.map(regressionWindowFor)).toEqual([28, 63, 91, 182, 371]);
  });
  it("é idempotente: janela já múltipla de 7 não muda", () => {
    for (const d of [7, 28, 63, 91, 182, 371]) expect(regressionWindowFor(d)).toBe(d);
  });
  it("sempre cobre semanas cheias, e o padrão são 4 semanas", () => {
    expect(regressionWeeksFor(AVG_WINDOW_DAYS)).toBe(4);
    expect(TREND_WINDOW_OPTIONS.map(regressionWeeksFor)).toEqual([4, 9, 13, 26, 53]);
  });
  it("expõe exatamente as cinco opções, com 27 primeiro", () => {
    expect(TREND_WINDOW_OPTIONS).toEqual([27, 60, 90, 180, 365]);
    expect(TREND_WINDOW_OPTIONS[0]).toBe(AVG_WINDOW_DAYS);
  });
});

describe("computeSeries — janelas selecionáveis", () => {
  // 60 semanas de queda constante: cobre até a janela de 365 dias
  const logs = weeklyLogs(60, "2025-06-01", (i) => 110 - i * 0.3);

  it("a média usa só as pesagens reais dentro da janela, nas 5 opções", () => {
    for (const win of TREND_WINDOW_OPTIONS) {
      const series = computeSeries(logs, 175, win);
      const last = series[series.length - 1];
      expect(last.media).toBe(expectedAvg(logs, logs.length - 1, win));
    }
  });

  it("a contagem de pesagens na janela bate com a frequência semanal (sem inventar dias)", () => {
    const end = logs[logs.length - 1].date;
    const dentro = (win) => logs.filter((o) => daysBetween(o.date, end) <= win).length;
    expect(dentro(27)).toBe(4);    // ~3-4 pesagens, como no enunciado
    expect(dentro(60)).toBe(9);
    expect(dentro(90)).toBe(13);
    expect(dentro(180)).toBe(26);
    expect(dentro(365)).toBe(53);
  });

  it("janela maior => linha mais suave (mais longe do peso bruto)", () => {
    const dist = (win) => {
      const series = computeSeries(logs, 175, win);
      const last = series[series.length - 1];
      return Math.abs(last.media - last.peso);
    };
    const distancias = TREND_WINDOW_OPTIONS.map(dist);
    for (let i = 1; i < distancias.length; i++) {
      expect(distancias[i]).toBeGreaterThan(distancias[i - 1]);
    }
  });

  it("sem janela explícita, continua em 27 dias (padrão do painel)", () => {
    const series = computeSeries(logs, 175);
    const explicito = computeSeries(logs, 175, AVG_WINDOW_DAYS);
    expect(series.map((s) => s.media)).toEqual(explicito.map((s) => s.media));
  });

  it("peso bruto não muda com a janela", () => {
    const base = computeSeries(logs, 175, 27).map((s) => s.peso);
    for (const win of TREND_WINDOW_OPTIONS) {
      expect(computeSeries(logs, 175, win).map((s) => s.peso)).toEqual(base);
    }
  });
});

describe("computeTrend — kg/semana acompanha a janela selecionada", () => {
  // Perda rápida no ano todo, mas quase estagnada no último mês:
  // a janela curta enxerga a estagnação, a longa enxerga a queda.
  const logs = weeklyLogs(60, "2025-06-01", (i) => (i < 54 ? 110 - i * 0.5 : 83 - (i - 54) * 0.05));

  it("cada janela usa só as pesagens reais do período", () => {
    expect(computeTrend(logs, 90, 175, 27).sample).toBe(4);
    expect(computeTrend(logs, 90, 175, 60).sample).toBe(9);
    expect(computeTrend(logs, 90, 175, 90).sample).toBe(13);
    expect(computeTrend(logs, 90, 175, 180).sample).toBe(26);
    expect(computeTrend(logs, 90, 175, 365).sample).toBe(53);
  });

  it("a extensão recupera exatamente a pesagem de maior alavanca (1 a mais)", () => {
    for (const d of TREND_WINDOW_OPTIONS) {
      const cru = computeTrend(logs, 90, 175, d).sample;
      const estendido = computeTrend(logs, 90, 175, regressionWindowFor(d)).sample;
      expect(estendido).toBe(cru + 1);
    }
  });

  it("a extensão dobra a alavanca no padrão (variância do kg/semana cai à metade)", () => {
    // Σ(x-x̄)² dos pontos usados: 4 pontos semanais = 245, 5 pontos = 490.
    const alavanca = (win) => {
      const end = logs[logs.length - 1].date;
      const xs = logs.filter((o) => daysBetween(o.date, end) <= win).map((o) => daysBetween(logs[0].date, o.date));
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return xs.reduce((a, x) => a + (x - m) ** 2, 0);
    };
    expect(alavanca(AVG_WINDOW_DAYS)).toBe(245);
    expect(alavanca(regressionWindowFor(AVG_WINDOW_DAYS))).toBe(490);
  });

  it("as 5 janelas devolvem um ritmo válido e a janela longa vê a queda maior", () => {
    const ritmos = TREND_WINDOW_OPTIONS.map((d) => computeTrend(logs, 90, 175, regressionWindowFor(d)).lossPerWeek);
    for (const r of ritmos) expect(Number.isFinite(r)).toBe(true);
    expect(ritmos[0]).toBeLessThan(0.1);          // 27d: estagnado
    expect(ritmos[ritmos.length - 1]).toBeGreaterThan(0.3); // 365d: queda do ano
  });

  it("sem janela explícita, continua idêntico ao comportamento antigo (28 dias)", () => {
    const padrao = computeTrend(logs, 90, 175);
    expect(padrao).toEqual(computeTrend(logs, 90, 175, TREND_WINDOW_DAYS));
    expect(padrao).toEqual(computeTrend(logs, 90, 175, regressionWindowFor(AVG_WINDOW_DAYS)));
  });
});
