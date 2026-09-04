// Motor de estatística — puro, sem domínio, sem Date, sem strings.
// Todo "tempo" aqui é um número (x = dias desde uma origem qualquer).
// É essa fronteira que torna tudo testável em ambiente node e reaproveitável
// tanto por calculations.js quanto pelo motor de insights (src/lib/insights/).
//
// Convenção de retorno: nada aqui devolve NaN. Uma amostra insuficiente para
// uma estatística devolve `null` nos campos afetados (nunca 0 nem Infinity
// silenciosos) — é o que impede um `z = Infinity` de vazar para a UI.

export function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

// sample=true (padrão) divide por n-1 — é o estimador não-enviesado correto
// para inferência. sample=false (população, divide por n) existe só para
// replicar contas legadas onde isso importa (ver calculations.js).
export function sd(values, { sample = true } = {}) {
  const n = values.length;
  const minN = sample ? 2 : 1;
  if (n < minN) return null;
  const m = mean(values);
  const ss = values.reduce((s, v) => s + (v - m) ** 2, 0);
  const denom = sample ? n - 1 : n;
  return denom > 0 ? Math.sqrt(ss / denom) : 0;
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Desvio absoluto mediano, escalado para ser comparável a um desvio-padrão
// sob normalidade (fator 1.4826). Resistente a outliers — importante porque
// a própria coisa que se quer detectar (um pico de retenção hídrica) é um
// outlier, e ele não pode inflar a régua usada para julgá-lo.
export function mad(values, { scale = 1.4826 } = {}) {
  if (!values.length) return null;
  const med = median(values);
  const absDev = values.map((v) => Math.abs(v - med));
  const m = median(absDev);
  return { median: med, mad: m, madSd: m * scale };
}

// ── Distribuição t: uma única fonte de verdade ──────────────────────────
// pFromT calcula o p-valor bilateral via a função beta incompleta
// regularizada (identidade padrão: P(|T|>t) = I_{df/(df+t²)}(df/2, 1/2)).
// tCritical inverte a mesma função por bisseção — assim os dois nunca podem
// divergir entre si (o risco que uma tabela hard-coded ao lado de uma fórmula
// separada correria).

function logGamma(x) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(x, a, b) {
  const MAXIT = 200, EPS = 3e-9, FPMIN = 1e-30;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(x, a, b)) / a
    : 1 - (bt * betacf(1 - x, b, a)) / b;
}

// P-valor bilateral de |T| >= |t| numa t de Student com `df` graus de liberdade.
export function pFromT(t, df) {
  if (!(df > 0)) return null;
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

// P-valor de F >= f numa F(df1, df2) — mesma função beta incompleta,
// identidade padrão P(F>f) = I_{df2/(df2+df1·f)}(df2/2, df1/2).
export function pFromF(f, df1, df2) {
  if (!(df1 > 0) || !(df2 > 0) || !(f >= 0)) return null;
  const x = df2 / (df2 + df1 * f);
  return incompleteBeta(x, df2 / 2, df1 / 2);
}

// Valor crítico bilateral t* tal que P(|T| >= t*) = 1 - confidence.
export function tCritical(df, confidence = 0.95) {
  if (!(df > 0)) return null;
  const alpha = 1 - confidence;
  let lo = 0, hi = 10000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const p = pFromT(mid, df);
    if (p > alpha) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Regressão linear (mínimos quadrados) ────────────────────────────────
// points: [{x:number, y:number}]. Retorna null se n<2 ou Σ(x-x̄)²===0
// (todos os x iguais — sem variação no eixo do tempo, não há reta a ajustar).
export function ols(points, { confidence = 0.95 } = {}) {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0;
  for (const p of points) { sx += p.x; sy += p.y; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    const dx = p.x - mx, dy = p.y - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const residuals = points.map((p) => p.y - (intercept + slope * p.x));
  const rss = residuals.reduce((s, r) => s + r * r, 0);
  const df = n - 2;
  const r2 = syy > 0 ? 1 - rss / syy : null;

  let residualSd = null, slopeSe = null, tStat = null, tCrit = null,
    pValue = null, slopeCi = null, significant = false;

  // df===0 (n===2): a reta passa exatamente pelos dois pontos, RSS=0 por
  // construção — não há graus de liberdade para estimar incerteza nenhuma.
  // Fica tudo null, nunca NaN nem Infinity (é justamente o caso do usuário
  // com poucos pontos, e é o cenário mais provável de produzir um bug se
  // isso vazar como número).
  if (df > 0) {
    residualSd = Math.sqrt(rss / df);
    slopeSe = residualSd / Math.sqrt(sxx);
    tStat = slopeSe > 0 ? slope / slopeSe : (slope === 0 ? 0 : Infinity);
    tCrit = tCritical(df, confidence);
    pValue = pFromT(tStat, df);
    slopeCi = [slope - tCrit * slopeSe, slope + tCrit * slopeSe];
    significant = pValue < 1 - confidence;
  }

  function predict(x) { return intercept + slope * x; }
  function predictCi(x) {
    if (df <= 0) return null;
    const se = residualSd * Math.sqrt(1 / n + (x - mx) ** 2 / sxx);
    const y = predict(x);
    return [y - tCrit * se, y + tCrit * se];
  }
  function predictPi(x) {
    if (df <= 0) return null;
    const se = residualSd * Math.sqrt(1 + 1 / n + (x - mx) ** 2 / sxx);
    const y = predict(x);
    return [y - tCrit * se, y + tCrit * se];
  }

  return {
    n, df, slope, intercept, sxx, syy, sxy, r2, rss, residualSd, slopeSe,
    tStat, tCrit, pValue, slopeCi, significant, predict, predictCi, predictPi, residuals,
  };
}

export function slopePerWeek(olsResult) {
  return olsResult ? olsResult.slope * 7 : null;
}

// ── Deltas normalizados por intervalo ───────────────────────────────────
// Sob um passeio aleatório, incrementos diários iid de variância σ² somam
// variância g·σ² em g dias — dividir por √g põe deltas de intervalos
// diferentes na mesma escala. `perDay` (raw/gap) é o certo para TAXA
// (kg/dia), mas subpondera gaps longos e por isso é errado para banda de
// ruído — por isso os dois são devolvidos, para cada uso pegar o seu.
// points: [{t, v}] ordenado por t ascendente.
export function normalizedDeltas(points, { maxGap = 14 } = {}) {
  const deltas = [];
  const dropped = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const gap = b.t - a.t;
    if (!(gap > 0)) continue; // t não estritamente crescente: ponto duplicado/fora de ordem, ignora
    const raw = b.v - a.v;
    if (gap > maxGap) { dropped.push({ fromT: a.t, toT: b.t, gap, raw }); continue; }
    deltas.push({ fromT: a.t, toT: b.t, gap, raw, scaled: raw / Math.sqrt(gap), perDay: raw / gap });
  }
  return { deltas, dropped };
}

// Faixa de oscilação pessoal: robusta (MAD) só a partir de `robustMinN`
// observações — com menos que isso, a mediana de poucos desvios absolutos é
// instável demais e o desvio-padrão simples é a estimativa mais estável.
// Piso absoluto (`floor`) para nunca colapsar a zero com poucos dados
// idênticos por acaso. Usar Math.max, nunca `||` — um desvio de 0.004 não
// pode "passar" por ser truthy e depois virar 0.00 num arredondamento a
// jusante (bug da V1, que produzia z = Infinity).
export function noiseBand(values, { floor = 0.2, robust = true, robustMinN = 5 } = {}) {
  const n = values.length;
  if (n === 0) return { n: 0, sd: null, madSd: null, band: floor, method: "floor", degenerate: true };
  const sdVal = sd(values, { sample: false });
  const useRobust = robust && n >= robustMinN;
  const madVal = useRobust ? mad(values).madSd : null;
  const preferred = useRobust ? madVal : sdVal;
  const raw = preferred != null ? preferred : (sdVal != null ? sdVal : 0);
  const band = Math.max(raw, floor);
  const method = raw >= floor ? (useRobust ? "mad" : "sd") : "floor";
  return { n, sd: sdVal, madSd: madVal, band, method, degenerate: n < 2 };
}

export function zScore(value, band) {
  return band > 0 ? value / band : null;
}

// ── Médias móveis ────────────────────────────────────────────────────────
// Trailing (retroativa): a única possível para o dia de hoje, mas atrasa
// ~metade da largura da janela. series: [{t, v}] ordenado por t ascendente.
// Prefix-sum deslizante — O(n), não o filter-dentro-de-map O(n²) anterior.
export function movingAverageTrailing(series, windowDays, { minPoints = 2, inclusive = true } = {}) {
  const n = series.length;
  const out = new Array(n);
  let lo = 0, sum = 0, count = 0;
  const spanDays = windowDays + (inclusive ? 1 : 0);
  for (let i = 0; i < n; i++) {
    sum += series[i].v; count++;
    const cutoff = inclusive ? series[i].t - windowDays : series[i].t - windowDays + 1;
    while (lo < i && series[lo].t < cutoff) { sum -= series[lo].v; count--; lo++; }
    out[i] = {
      t: series[i].t,
      v: series[i].v,
      avg: count >= minPoints ? +(sum / count).toFixed(2) : null,
      count,
      coverage: +(count / spanDays).toFixed(3),
    };
  }
  return out;
}

// Centrada: sem atraso, é o estimador correto de "qual era o peso de
// verdade no dia X" — mas só existe até windowDays/2 dias atrás de hoje.
// requireFull=true evita meia-janela enviesada nas bordas (avg=null ali).
export function movingAverageCentered(series, windowDays, { minPoints = 2, requireFull = true } = {}) {
  const n = series.length;
  const half = Math.floor(windowDays / 2);
  const out = new Array(n);
  let lo = 0, hi = -1, sum = 0, count = 0;
  for (let i = 0; i < n; i++) {
    const loCut = series[i].t - half, hiCut = series[i].t + half;
    while (lo <= hi && series[lo] && series[lo].t < loCut) { sum -= series[lo].v; count--; lo++; }
    while (hi + 1 < n && series[hi + 1].t <= hiCut) { hi++; sum += series[hi].v; count++; }
    const complete = !requireFull || (loCut >= series[0].t && hiCut <= series[n - 1].t);
    out[i] = {
      t: series[i].t,
      v: series[i].v,
      avg: count >= minPoints && complete ? +(sum / count).toFixed(2) : null,
      count,
    };
  }
  return out;
}

// ── Teste t de uma amostra ──────────────────────────────────────────────
// Usado para testar se o resíduo médio de um subgrupo (ex.: um dia da
// semana) difere de zero. Retorna null com n<2 (nada a inferir).
export function oneSampleTTest(values, { mu0 = 0, confidence = 0.95 } = {}) {
  const n = values.length;
  if (n < 2) return null;
  const m = mean(values);
  const sdVal = sd(values, { sample: true });
  const df = n - 1;
  if (!(sdVal > 0)) {
    // todos os valores idênticos: diferença de mu0 é um fato observado, não uma inferência
    const eq = m === mu0;
    return { n, mean: m, sd: 0, se: 0, t: eq ? 0 : Infinity, df, tCrit: null, pValue: eq ? 1 : 0, ci: [m, m], significant: !eq };
  }
  const se = sdVal / Math.sqrt(n);
  const t = (m - mu0) / se;
  const tCrit = tCritical(df, confidence);
  const pValue = pFromT(t, df);
  return { n, mean: m, sd: sdVal, se, t, df, tCrit, pValue, ci: [m - tCrit * se, m + tCrit * se], significant: pValue < 1 - confidence };
}

// Teste t de Welch: compara as médias de dois grupos SEM assumir variâncias
// iguais (o caso comum aqui — "dias com marcador" vs. "dias sem marcador"
// quase nunca têm a mesma dispersão). Graus de liberdade por
// Welch–Satterthwaite. Retorna null com qualquer grupo tendo n<2.
export function welchTTest(a, b, { confidence = 0.95 } = {}) {
  if (a.length < 2 || b.length < 2) return null;
  const meanA = mean(a), meanB = mean(b);
  const sdA = sd(a, { sample: true }), sdB = sd(b, { sample: true });
  const nA = a.length, nB = b.length;
  const varA = sdA * sdA / nA, varB = sdB * sdB / nB;
  const se = Math.sqrt(varA + varB);
  const diff = meanA - meanB;
  if (!(se > 0)) {
    const eq = diff === 0;
    return { nA, nB, meanA, meanB, diff, sdA, sdB, se: 0, t: eq ? 0 : Infinity, df: nA + nB - 2, tCrit: null, pValue: eq ? 1 : 0, ci: [diff, diff], significant: !eq, cohensD: null };
  }
  const t = diff / se;
  const df = (varA + varB) ** 2 / (varA ** 2 / (nA - 1) + varB ** 2 / (nB - 1));
  const tCrit = tCritical(df, confidence);
  const pValue = pFromT(t, df);
  const pooledSd = Math.sqrt(((nA - 1) * sdA * sdA + (nB - 1) * sdB * sdB) / (nA + nB - 2));
  const cohensD = pooledSd > 0 ? +(diff / pooledSd).toFixed(2) : null;
  return {
    nA, nB, meanA, meanB, diff, sdA, sdB, se, t, df, tCrit, pValue,
    ci: [diff - tCrit * se, diff + tCrit * se], significant: pValue < 1 - confidence, cohensD,
  };
}

// ── Correção de Holm-Bonferroni para múltiplos testes ───────────────────
// Step-down: ordena por p crescente, cada um multiplicado pelo número de
// hipóteses restantes, com monotonicidade forçada (p-ajustado nunca cai
// abaixo do anterior). Necessário sempre que uma regra roda vários testes
// ao mesmo tempo (ex.: efeito por dia da semana = 7 testes) — sem isso, a
// chance de achar "significância" por puro acaso sobe com cada teste extra.
// ── Ponto de mudança (change-point) ─────────────────────────────────────
// Encontra a melhor partição de `points` em duas retas (teste de Chow),
// varrendo candidatos com estatísticas suficientes incrementais — O(n), não
// o refit ingênuo O(n²). AVISO: o ponto é ESCOLHIDO minimizando RSS entre
// ~n candidatos, então o F ingênuo é anticonservador (em ruído puro ele
// sempre acha "a melhor quebra possível"). `pAdj` aplica Bonferroni sobre
// `nCandidates` — use sempre `significantAdjusted`, nunca `significant`.
// O chamador (regra de insight) nunca deve subir a confiança além de
// "hipótese" por causa disso, mesmo com pAdj baixo.
export function changePoint(points, { minSegment = 14, confidence = 0.95, bonferroni = true } = {}) {
  const n = points.length;
  if (n < 2 * minSegment + 2) return null;
  const full = ols(points);
  if (!full) return null;
  const rss0 = full.rss;

  const prefSx = new Array(n + 1).fill(0);
  const prefSy = new Array(n + 1).fill(0);
  const prefSxx = new Array(n + 1).fill(0);
  const prefSxy = new Array(n + 1).fill(0);
  const prefSyy = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    prefSx[i + 1] = prefSx[i] + p.x;
    prefSy[i + 1] = prefSy[i] + p.y;
    prefSxx[i + 1] = prefSxx[i] + p.x * p.x;
    prefSxy[i + 1] = prefSxy[i] + p.x * p.y;
    prefSyy[i + 1] = prefSyy[i] + p.y * p.y;
  }
  function segRss(lo, hi) {
    const m = hi - lo;
    if (m < 2) return null;
    const sx = prefSx[hi] - prefSx[lo], sy = prefSy[hi] - prefSy[lo];
    const sxx = prefSxx[hi] - prefSxx[lo], sxy = prefSxy[hi] - prefSxy[lo], syy = prefSyy[hi] - prefSyy[lo];
    const mx = sx / m, my = sy / m;
    const Sxx = sxx - m * mx * mx;
    if (Sxx === 0) return null;
    const Sxy = sxy - m * mx * my;
    const Syy = syy - m * my * my;
    const slope = Sxy / Sxx;
    // identidade padrão: RSS = Syy - slope·Sxy (equivalente a Syy - Sxy²/Sxx)
    const rss = Math.max(0, Syy - slope * Sxy);
    return { rss, n: m };
  }

  let best = null;
  let nCandidates = 0;
  for (let k = minSegment; k <= n - minSegment; k++) {
    const before = segRss(0, k);
    const after = segRss(k, n);
    if (!before || !after) continue;
    nCandidates++;
    const rssSplit = before.rss + after.rss;
    if (!best || rssSplit < best.rssSplit) best = { index: k, rssSplit };
  }
  if (!best) return null;

  const df2 = n - 4;
  if (df2 <= 0) return null;
  const f = Math.max(0, ((rss0 - best.rssSplit) / 2) / (best.rssSplit / df2));
  const pValue = pFromF(f, 2, df2);
  const pAdj = bonferroni ? Math.min(1, pValue * nCandidates) : pValue;
  const alpha = 1 - confidence;

  const beforeFit = ols(points.slice(0, best.index));
  const afterFit = ols(points.slice(best.index));

  return {
    index: best.index, t: points[best.index].x, nCandidates,
    rss0, rssSplit: best.rssSplit, f, pValue, pAdj,
    significant: pValue < alpha, significantAdjusted: pAdj < alpha,
    before: beforeFit, after: afterFit,
    deltaSlopePerWeek: beforeFit && afterFit ? (afterFit.slope - beforeFit.slope) * 7 : null,
  };
}

export function holmAdjust(pValues, { alpha = 0.05 } = {}) {
  const m = pValues.length;
  const indexed = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p);
  let maxSoFar = 0;
  const result = new Array(m);
  indexed.forEach((item, rank) => {
    const adj = Math.min(1, item.p * (m - rank));
    maxSoFar = Math.max(maxSoFar, adj);
    result[item.index] = { index: item.index, p: item.p, pAdj: maxSoFar, significant: maxSoFar < alpha };
  });
  return result;
}
