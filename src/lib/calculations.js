// Funções puras de negócio, extraídas de painel-peso_2.jsx SEM alteração de fórmulas ou constantes.
// Único desvio estrutural: HEIGHT_CM deixa de ser constante fixa e passa a ser parâmetro
// (agora vem de user_settings), pois a Fase 2 tornou altura/idade/sexo configuráveis.
//
// V2: computeSeries e computeSignalRead passaram a delegar a matemática de
// regressão/dispersão para src/lib/stats.js — ver comentários nas próprias
// funções para o que mudou (janela adaptativa, banda normalizada por gap).

import { ols, normalizedDeltas, noiseBand as robustNoiseBand, zScore } from "./stats.js";

export const DEFAULT_GOAL = 90;
export const DEFAULT_BF = 15;
export const DEFAULT_HEIGHT_CM = 175;
export const RATE_HEALTHY = [0.4, 1.0]; // kg/semana
// Domínio do medidor visual de ritmo (TrendCard): de "ganhando peso" a "rápido
// demais". A seta e a faixa saudável precisam ser calculadas na MESMA escala,
// senão a seta pode cair visualmente dentro da faixa saudável mesmo quando o
// ritmo real está fora dela (foi exatamente o bug reportado e corrigido aqui).
export const TREND_GAUGE_MIN = -0.4;
export const TREND_GAUGE_MAX = 1.5;
export const AVG_WINDOW_DAYS = 27; // janela da média móvel quando os dados ainda são esparsos (regime semanal)
export const DENSE_WINDOW_DAYS = 7; // janela quando a pesagem já é ~diária
export const DENSE_MIN_COUNT_IN_WEEK = 5; // nº de pesagens nos últimos 7 dias que caracteriza "regime diário"
export const NOISE_ROBUST_MIN_N = 5; // nº mínimo de variações anteriores para usar MAD em vez de desvio-padrão
export const NOISE_MAX_GAP_DAYS = 14; // gaps maiores que isso não entram na banda de ruído (mudança de regime, não oscilação)
export const TREND_WINDOW_DAYS = 28; // janela da regressão na opção padrão (= 4 semanas cheias)

// Janelas de análise oferecidas ao usuário na Evolução. 27 dias é o padrão e
// continua sendo o comportamento inicial do painel.
export const TREND_WINDOW_OPTIONS = [27, 60, 90, 180, 365];

// A regressão usa uma janela ligeiramente maior que a média móvel: o múltiplo
// de 7 seguinte. 27→28, 60→63, 90→91, 180→182, 365→371.
//
// Motivo: medir N semanas de tendência exige N+1 pesagens (N intervalos). Com
// pesagem semanal, uma janela que termina logo ANTES de um múltiplo de 7
// descarta exatamente a pesagem mais antiga — e numa regressão o peso de cada
// ponto é proporcional à distância dele do centro, então essa é justamente a de
// maior alavanca. No padrão, cortá-la derruba Σ(x-x̄)² de 490 para 245, ou seja,
// DOBRA a variância do kg/semana (~49% mais ruído, sem ganho de acurácia).
// O 28 histórico do painel é o caso particular desta regra.
//
// A média móvel NÃO usa esta extensão: ali todos os pontos pesam igual, e a
// janela escolhida vale como está.
export function regressionWindowFor(windowDays) {
  return Math.ceil(windowDays / 7) * 7;
}

// Semanas cheias cobertas pela regressão — é isso que o card de tendência
// anuncia, para o rótulo bater com o número exibido.
export function regressionWeeksFor(windowDays) {
  return regressionWindowFor(windowDays) / 7;
}
export const NOISE_FLOOR = 0.2; // piso do desvio-padrão do "é real ou ruído?"
export const BF_FLOOR = 10; // trava fisiológica da projeção de composição
export const COMP_CONFIDENT_SAMPLE = 4; // nº de medidas de cintura a partir do qual gordura/magra viram número, não só direção
export const CONTEXT_TAG_MAX = 2; // limite de tags de contexto por pesagem

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDateBR(iso) {
  const p = iso.split("-");
  return `${p[2]}/${p[1]}`;
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function parseDecimal(input) {
  if (input === "" || input == null) return NaN;
  return parseFloat(String(input).replace(",", "."));
}

// Navy method (homens, medidas em cm) — válido só se cintura>pescoço e resultado entre 2 e 70.
export function navyBodyFat(waist, neck, heightCm) {
  const h = heightCm || DEFAULT_HEIGHT_CM;
  if (!waist || !neck || waist <= neck) return null;
  const bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
  return bf > 2 && bf < 70 ? +bf.toFixed(1) : null;
}

// Regressão linear simples -> inclinação (unidade y por unidade x).
// Delega para stats.ols() (mesma fórmula, mesmo caso-limite den===0 -> null);
// mantida como função separada porque é a única parte do resultado da OLS
// que o restante do arquivo usa.
export function linearSlope(points) {
  const r = ols(points);
  return r ? r.slope : null;
}

export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  return +(weightKg / ((heightCm / 100) ** 2)).toFixed(1);
}

export function bmiCategory(bmiValue) {
  if (bmiValue == null) return null;
  if (bmiValue < 18.5) return { label: "abaixo do peso", color: "#C9A24B" };
  if (bmiValue < 25) return { label: "peso normal", color: "#5B7B8C" };
  if (bmiValue < 30) return { label: "sobrepeso", color: "#C9A24B" };
  if (bmiValue < 35) return { label: "obesidade grau I", color: "#E8552E" };
  if (bmiValue < 40) return { label: "obesidade grau II", color: "#E8552E" };
  return { label: "obesidade grau III", color: "#E8552E" };
}

// Recordes: menor/maior peso e maior queda numa janela de ~7 dias (entre 5 e 9 dias, a mais próxima de 7)
export function computeRecords(sortedWeights) {
  if (sortedWeights.length === 0) return null;
  let min = sortedWeights[0], max = sortedWeights[0];
  for (const w of sortedWeights) {
    if (w.weight < min.weight) min = w;
    if (w.weight > max.weight) max = w;
  }
  let biggestDrop = null;
  for (const w of sortedWeights) {
    const candidates = sortedWeights.filter((o) => {
      const d = daysBetween(o.date, w.date);
      return d >= 5 && d <= 9;
    });
    if (!candidates.length) continue;
    const ref = candidates.reduce((a, b) =>
      Math.abs(daysBetween(b.date, w.date) - 7) < Math.abs(daysBetween(a.date, w.date) - 7) ? b : a
    );
    const diff = +(w.weight - ref.weight).toFixed(1);
    if (diff < 0 && (biggestDrop === null || diff < biggestDrop.diff)) {
      biggestDrop = { diff, from: ref.date, to: w.date };
    }
  }
  return { min, max, biggestDrop };
}

// Janela adequada à densidade real dos dados ao redor de `w`: 7 dias quando
// a pesagem já é quase diária (>=5 pesagens nos últimos 7 dias), 27 quando
// ainda é esparsa (regime semanal, ou histórico antigo). Só entra em ação
// quando o chamador NÃO fixa uma janela explícita — a Evolução, com seu
// seletor manual (27/60/90/180/365), sempre fixa uma, e continua se
// comportando exatamente como antes.
function adaptiveWindowDays(sortedWeights, w) {
  const last7 = sortedWeights.filter((o) => {
    const d = daysBetween(o.date, w.date);
    return d >= 0 && d <= DENSE_WINDOW_DAYS - 1;
  });
  return last7.length >= DENSE_MIN_COUNT_IN_WEEK ? DENSE_WINDOW_DAYS : AVG_WINDOW_DAYS;
}

// Série enriquecida: média móvel + BF% + massa magra/gorda via Navy. A média
// usa SOMENTE as pesagens reais que caem dentro da janela — nada é
// interpolado nem preenchido em dias sem pesagem.
export function computeSeries(sortedWeights, heightCm, avgWindowDays) {
  return sortedWeights.map((w, i) => {
    const windowDays = avgWindowDays ?? adaptiveWindowDays(sortedWeights, w);
    const win = sortedWeights.filter((o) => {
      const d = daysBetween(o.date, w.date);
      return d >= 0 && d <= windowDays;
    });
    const media = win.length >= 2
      ? +(win.reduce((s, o) => s + o.weight, 0) / win.length).toFixed(2)
      : null;
    const bf = navyBodyFat(w.waist, w.neck, heightCm);
    const gordura = bf != null ? +(w.weight * bf / 100).toFixed(1) : null;
    const magra = bf != null ? +(w.weight - gordura).toFixed(1) : null;
    return { ...w, idx: i, label: fmtDateBR(w.date), peso: w.weight, media, bf, gordura, magra, avgWindowDays: windowDays };
  });
}

// Tendência via regressão dentro da janela (padrão 28 dias) + projeção de composição
// na meta. Só entram na regressão as pesagens reais existentes na janela.
export function computeTrend(sortedWeights, goal, heightCm, windowDays = TREND_WINDOW_DAYS) {
  if (sortedWeights.length < 2) return null;
  const endDate = sortedWeights[sortedWeights.length - 1].date;
  const currentWeight = sortedWeights[sortedWeights.length - 1].weight;
  const pts = sortedWeights
    .filter((w) => daysBetween(w.date, endDate) <= windowDays)
    .map((w) => ({ x: daysBetween(sortedWeights[0].date, w.date), y: w.weight }));
  if (pts.length < 2) return null;
  const slope = linearSlope(pts);
  if (slope == null) return null;
  const perWeek = +(slope * 7).toFixed(2);
  const lossPerWeek = -perWeek;
  const remaining = currentWeight - goal;
  const weeksToGoal = lossPerWeek > 0.05 && remaining > 0 ? Math.ceil(remaining / lossPerWeek) : null;

  // --- Projeção de composição na meta ---
  // Usa pesagens COM cintura/pescoço (que dão massa magra/gorda via Navy). Precisa de >= 2.
  const comp = sortedWeights
    .map((w) => {
      const bf = navyBodyFat(w.waist, w.neck, heightCm);
      if (bf == null) return null;
      const gordura = w.weight * bf / 100;
      return { x: daysBetween(sortedWeights[0].date, w.date), weight: w.weight, fat: gordura, lean: w.weight - gordura, bf };
    })
    .filter(Boolean);

  let projection = null;
  if (comp.length >= 2 && weeksToGoal) {
    const fatSlope = linearSlope(comp.map((c) => ({ x: c.x, y: c.fat })));
    const leanSlope = linearSlope(comp.map((c) => ({ x: c.x, y: c.lean })));
    const lastComp = comp[comp.length - 1];
    const daysToGoal = weeksToGoal * 7;
    if (fatSlope != null && leanSlope != null) {
      const projFat = Math.max(0, lastComp.fat + fatSlope * daysToGoal);
      const projLean = Math.max(0, lastComp.lean + leanSlope * daysToGoal);
      const projTotal = projFat + projLean;
      const scale = projTotal > 0 ? goal / projTotal : 1;
      const fatAtGoalRaw = projFat * scale;
      let bfAtGoal = goal > 0 ? fatAtGoalRaw / goal * 100 : null;
      let capped = false;
      if (bfAtGoal != null && bfAtGoal < BF_FLOOR) { bfAtGoal = BF_FLOOR; capped = true; }
      bfAtGoal = bfAtGoal != null ? +bfAtGoal.toFixed(1) : null;
      const fatAtGoal = bfAtGoal != null ? goal * bfAtGoal / 100 : fatAtGoalRaw;
      const totalLossProj = lastComp.weight - goal;
      const fatLoss = lastComp.fat - fatAtGoal;
      const fatShare = totalLossProj > 0 ? Math.max(0, Math.min(100, Math.round(fatLoss / totalLossProj * 100))) : null;
      projection = { bfAtGoal, fatShare, sample: comp.length, currentBf: lastComp.bf, capped };
    }
  }
  const compAvailable = comp.length;

  return { perWeek, lossPerWeek, weeksToGoal, sample: pts.length, projection, compAvailable };
}

// "É real ou ruído?" — compara a variação mais recente contra a variabilidade
// histórica DO PRÓPRIO usuário.
//
// V2: os deltas são normalizados por √intervalo (stats.normalizedDeltas) antes
// de entrar na banda — sem isso, um delta de 7 dias (regime semanal antigo) e
// um de 1 dia (regime diário novo) pesariam o mesmo, inflando ou encolhendo a
// banda dependendo de qual regime domina o histórico no momento. A banda usa
// MAD (stats.noiseBand) só a partir de NOISE_ROBUST_MIN_N variações prévias —
// com menos que isso o desvio-padrão simples é mais estável; e o piso nunca
// passa por `||` (um desvio quase-zero não pode "passar" por ser truthy e
// depois virar 0.00 num arredondamento, produzindo z = Infinity).
export function computeSignalRead(sortedWeights) {
  if (sortedWeights.length < 4) {
    return { status: "insufficient", need: 4 - sortedWeights.length, count: sortedWeights.length };
  }
  const points = sortedWeights.map((w) => ({ t: daysBetween(sortedWeights[0].date, w.date), v: w.weight }));
  const { deltas } = normalizedDeltas(points, { maxGap: NOISE_MAX_GAP_DAYS });
  if (deltas.length < 3) {
    return { status: "insufficient", need: Math.max(1, 4 - sortedWeights.length), count: sortedWeights.length };
  }
  const last = deltas[deltas.length - 1];
  const prior = deltas.slice(0, -1);
  const band = robustNoiseBand(prior.map((d) => d.scaled), { floor: NOISE_FLOOR, robustMinN: NOISE_ROBUST_MIN_N });
  const z = zScore(last.scaled, band.band);
  const absZ = Math.abs(z);
  const lastDelta = +last.raw.toFixed(1);
  // Banda projetada para o intervalo real do último delta — "±0.5kg" só faz
  // sentido lado a lado com um "você variou Xkg" que cobre o mesmo período.
  const noiseBand = +(band.band * Math.sqrt(last.gap)).toFixed(2);
  const recent = deltas.slice(-3);
  const recentTrend = +(recent.reduce((s, d) => s + d.raw, 0) / recent.length).toFixed(2);

  let verdict, detail, color;
  if (absZ < 1) {
    verdict = "Provavelmente ruído";
    color = "#8B8F92";
    detail = `Você variou ${Math.abs(lastDelta).toFixed(1)}kg, e seu peso costuma oscilar ±${noiseBand}kg nesse intervalo só por água, sal e intestino. Ou seja: esse número sozinho não quer dizer que você progrediu ou regrediu. Não comemore nem se preocupe — olhe a tendência, não este ponto.`;
  } else if (absZ < 2) {
    verdict = lastDelta < 0 ? "Talvez tenha emagrecido" : "Talvez tenha engordado";
    color = lastDelta < 0 ? "#5B7B8C" : "#C9A24B";
    detail = `Você ${lastDelta < 0 ? "perdeu" : "ganhou"} ${Math.abs(lastDelta).toFixed(1)}kg — um pouco mais do que sua oscilação normal (±${noiseBand}kg), mas não o bastante pra ter certeza. Pode ser mudança de verdade, pode ser um dia de água a mais ou a menos. A próxima pesagem confirma: se seguir na mesma direção, é real.`;
  } else {
    verdict = lastDelta < 0 ? "Emagreceu de verdade" : "Engordou de verdade";
    color = lastDelta < 0 ? "#5B7B8C" : "#E8552E";
    detail = `Você ${lastDelta < 0 ? "perdeu" : "ganhou"} ${Math.abs(lastDelta).toFixed(1)}kg, bem além da sua oscilação normal (±${noiseBand}kg). Isso é mudança real de massa, não flutuação de balança. ${lastDelta < 0 ? "Seu plano está funcionando." : "Se não era o esperado, vale revisar."}`;
  }

  return {
    status: "ok", lastDelta, noiseBand, z: +z.toFixed(1), absZ,
    verdict, detail, color, recentTrend,
    samplePrior: prior.length,
  };
}

// Variação da última pesagem vs. a anterior
export function computeLastChange(sortedWeights) {
  if (sortedWeights.length < 2) return null;
  const curr = sortedWeights[sortedWeights.length - 1];
  const prev = sortedWeights[sortedWeights.length - 2];
  const diff = +(curr.weight - prev.weight).toFixed(1);
  const gapDays = daysBetween(prev.date, curr.date);
  return { diff, gapDays, note: curr.note, prevWeight: prev.weight, date: curr.date };
}

// Detecta se rateStatus(trend).key mudou entre a pesagem mais recente e a
// anterior a ela — sem nenhum estado persistido, é sempre recomputado a
// partir da série. null = sem comparação válida (pouca amostra de qualquer
// um dos dois lados) ou sem mudança de categoria.
export function trendRateChange(sortedWeights, goal, heightCm, windowDays = TREND_WINDOW_DAYS) {
  if (sortedWeights.length < 3) return null;
  const current = rateStatus(computeTrend(sortedWeights, goal, heightCm, windowDays));
  const prior = rateStatus(computeTrend(sortedWeights.slice(0, -1), goal, heightCm, windowDays));
  if (!current || !prior || current.key === prior.key) return null;
  return { from: prior, to: current };
}

// Posição (%) de um ritmo kg/semana no medidor visual do TrendCard, no
// domínio [TREND_GAUGE_MIN, TREND_GAUGE_MAX], sempre entre 0 e 100.
export function trendGaugePercent(value) {
  const span = TREND_GAUGE_MAX - TREND_GAUGE_MIN;
  return Math.max(0, Math.min(100, ((value - TREND_GAUGE_MIN) / span) * 100));
}

export function rateStatus(trend) {
  if (!trend) return null;
  const l = trend.lossPerWeek;
  if (l < 0) return { key: "rising", color: "#C9A24B", text: "Peso subindo na média das últimas 4 semanas." };
  if (l < RATE_HEALTHY[0]) return { key: "below", color: "#C9A24B", text: "Ritmo abaixo do esperado. Se persistir 2-3 semanas, vale ajustar as calorias." };
  if (l > RATE_HEALTHY[1]) return { key: "fast", color: "#E8552E", text: "Ritmo acelerado demais. Perda muito rápida costuma vir com massa magra junto." };
  return { key: "healthy", color: "#5B7B8C", text: "Ritmo dentro da faixa saudável para recomposição." };
}

// Fatores de atividade por treinos/semana (Mifflin-St Jeor)
export function activityFactor(trainDays) {
  if (trainDays <= 0) return { factor: 1.2, label: "sedentário" };
  if (trainDays <= 3) return { factor: 1.375, label: "leve" };
  if (trainDays <= 5) return { factor: 1.55, label: "moderado" };
  return { factor: 1.725, label: "intenso" };
}

// Mifflin-St Jeor -> TDEE -> alvo com déficit
export function computeCalories({ hasWeights, currentWeight, height, age, sex, trainDays, deficitPct }) {
  const { factor, label: factorLabel } = activityFactor(trainDays);
  if (!hasWeights) return { bmr: null, tdee: null, target: null, factor, factorLabel };
  const w = currentWeight, h = +height || DEFAULT_HEIGHT_CM, a = +age || 28;
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === "M" ? 5 : -161);
  const tdee = bmr * factor;
  const target = tdee * (1 - deficitPct / 100);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), target: Math.round(target), factor, factorLabel };
}

// Macros: 4 kcal/g proteína, 4 kcal/g carbo, 9 kcal/g gordura
export function computeMacros({ hasWeights, kcal, currentWeight, protPct, fatPct, protPerKg, fatPerKg }) {
  if (!hasWeights || kcal == null) return null;

  // --- Modo por % (proteína e gordura ajustáveis, carbo = resto, nunca negativo) ---
  const pPct = Math.max(0, Math.min(100, +protPct || 0));
  const fPct = Math.max(0, Math.min(100 - pPct, +fatPct || 0));
  const cPct = Math.max(0, 100 - pPct - fPct);
  const byPct = {
    prot: { pct: pPct, kcal: Math.round(kcal * pPct / 100), g: Math.round(kcal * pPct / 100 / 4) },
    carb: { pct: cPct, kcal: Math.round(kcal * cPct / 100), g: Math.round(kcal * cPct / 100 / 4) },
    fat: { pct: fPct, kcal: Math.round(kcal * fPct / 100), g: Math.round(kcal * fPct / 100 / 9) },
  };

  // --- Modo por peso (proteína/gordura por g/kg, carbo = resto das kcal, clamp em 0) ---
  const w = currentWeight;
  const protG = Math.round((+protPerKg || 0) * w);
  const fatG = Math.round((+fatPerKg || 0) * w);
  const protKcal = protG * 4;
  const fatKcal = fatG * 9;
  const carbKcal = Math.max(0, kcal - protKcal - fatKcal);
  const carbG = Math.round(carbKcal / 4);
  const byWeight = {
    prot: { perKg: +protPerKg || 0, g: protG, kcal: protKcal, pct: Math.round(protKcal / kcal * 100) },
    carb: { g: carbG, kcal: Math.round(carbKcal), pct: Math.round(carbKcal / kcal * 100) },
    fat: { perKg: +fatPerKg || 0, g: fatG, kcal: fatKcal, pct: Math.round(fatKcal / kcal * 100) },
    overflow: protKcal + fatKcal > kcal,
  };

  return { kcal, byPct, byWeight };
}

// Simulador de ritmo: slider 0.1-1.5 kg/semana (step 0.05)
export function computeSimulator(remainingToGoal, simRate) {
  const weeks = remainingToGoal > 0 && simRate > 0 ? Math.ceil(remainingToGoal / simRate) : 0;
  const date = new Date(Date.now() + weeks * 7 * 86400000);
  const dateLabel = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  return { weeks, dateLabel, months: Math.round(weeks / 4.345) };
}

// ── Idade a partir da data de nascimento ────────────────────────────────────
// A idade deixa de ser um número digitado e passa a ser derivada: o usuário
// informa a data de nascimento uma vez e o Mifflin-St Jeor acompanha sozinho.

export function isValidBirthDate(iso, refISO) {
  if (!iso) return false;
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  // rejeita data inexistente (ex: 31/02) — o Date normaliza, então comparamos de volta
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
  const age = ageFromBirthDate(s, refISO);
  return age != null;
}

export function ageFromBirthDate(iso, refISO) {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [by, bm, bd] = s.split("-").map(Number);
  const [ry, rm, rd] = String(refISO || todayISO()).slice(0, 10).split("-").map(Number);
  if ([by, bm, bd, ry, rm, rd].some((n) => !Number.isFinite(n))) return null;
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) age--;
  if (age < 0 || age > 120) return null;
  return age;
}
