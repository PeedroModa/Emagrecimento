import { useState, useEffect, useMemo, useRef } from "react";
import {
  TrendingDown, TrendingUp, Minus, Plus, X,
  Scale, Ruler, Target, AlertTriangle, Info, Pencil, Check, Download, Upload
} from "lucide-react";

const STORAGE_KEY = "recomposicao-data";
const DEFAULT_GOAL = 90;
const DEFAULT_BF = 15;
const HEIGHT_CM = 175;
const RATE_HEALTHY = [0.4, 1.0]; // kg/semana
const AVG_WINDOW_DAYS = 27; // janela da média móvel (~4 semanas, adequado a pesagem semanal)


// Alimentos por macro dominante. Valores aproximados por 100g (TACO/USDA de memória).
// p = proteína (g), c = carbo (g), f = gordura (g), kcal por 100g.
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) { const p = iso.split("-"); return `${p[2]}/${p[1]}`; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

// Navy method (homens, medidas em cm)
function navyBodyFat(waist, neck) {
  if (!waist || !neck || waist <= neck) return null;
  const bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(HEIGHT_CM)) - 450;
  return bf > 2 && bf < 70 ? +bf.toFixed(1) : null;
}

// Regressão linear simples -> kg/dia
function linearSlope(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den === 0 ? null : num / den;
}

function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return { label: "abaixo do peso", color: "#C9A24B" };
  if (bmi < 25) return { label: "peso normal", color: "#5B7B8C" };
  if (bmi < 30) return { label: "sobrepeso", color: "#C9A24B" };
  if (bmi < 35) return { label: "obesidade grau I", color: "#E8552E" };
  if (bmi < 40) return { label: "obesidade grau II", color: "#E8552E" };
  return { label: "obesidade grau III", color: "#E8552E" };
}

// Recordes: menor/maior peso e maior queda numa janela de ~7 dias
function computeRecords(sortedWeights) {
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

const card = { background: "#212426", borderRadius: 10, padding: 16, marginBottom: 16 };
const sectionLabel = { fontSize: 12.5, color: "#8B8F92", letterSpacing: "0.08em", marginBottom: 12 };
const smallLabel = { fontSize: 11.5, color: "#8B8F92", marginBottom: 2 };
const bigStat = { fontSize: 20, fontWeight: 700 };

export default function App() {
  const [data, setData] = useState({ weightLogs: [], goal: DEFAULT_GOAL, bfTarget: DEFAULT_BF, foodLogs: [] });
  const [ready, setReady] = useState(false);

  const [newWeight, setNewWeight] = useState("");
  const [newWeightDate, setNewWeightDate] = useState(todayISO());
  const [showMeasures, setShowMeasures] = useState(false);
  const [newWaist, setNewWaist] = useState("");
  const [newNeck, setNewNeck] = useState("");
  const [newNote, setNewNote] = useState("");
  const [simRate, setSimRate] = useState(0.6);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [bfInput, setBfInput] = useState("");
  const [calAge, setCalAge] = useState(28);
  const [calHeight, setCalHeight] = useState(HEIGHT_CM);
  const [calSex, setCalSex] = useState("M");
  const [calTrainDays, setCalTrainDays] = useState(3);
  const [calDeficit, setCalDeficit] = useState(15);
  const [macroProtPct, setMacroProtPct] = useState(30);
  const [macroFatPct, setMacroFatPct] = useState(30);
  const [macroProtPerKg, setMacroProtPerKg] = useState(2);
  const [macroFatPerKg, setMacroFatPerKg] = useState(0.9);
  const [macroMode, setMacroMode] = useState("pct");
  const [importMsg, setImportMsg] = useState("");
  const [showExportText, setShowExportText] = useState(false);
  const fileInputRef = useRef(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setData({ weightLogs: parsed.weightLogs || [], goal: parsed.goal ?? DEFAULT_GOAL, bfTarget: parsed.bfTarget ?? DEFAULT_BF, foodLogs: parsed.foodLogs || [] });
        } else {
          const seed = [{ id: uid(), date: todayISO(), weight: 110 }];
          setData({ weightLogs: seed, goal: DEFAULT_GOAL, bfTarget: DEFAULT_BF, foodLogs: [] });
          await window.storage.set(STORAGE_KEY, JSON.stringify({ weightLogs: seed, goal: DEFAULT_GOAL, bfTarget: DEFAULT_BF, foodLogs: [] }), false);
        }
      } catch (e) {
        setData({ weightLogs: [], goal: DEFAULT_GOAL, bfTarget: DEFAULT_BF, foodLogs: [] });
      } finally { setReady(true); }
    })();
  }, []);

  async function persist(weightLogs, goal, bfTarget, foodLogs) {
    const next = {
      weightLogs,
      goal: goal ?? data.goal ?? DEFAULT_GOAL,
      bfTarget: bfTarget ?? data.bfTarget ?? DEFAULT_BF,
      foodLogs: foodLogs ?? data.foodLogs ?? [],
    };
    setData(next);
    try {
      const res = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      setSaveError(res ? "" : "Não consegui salvar. Tente de novo.");
    } catch (e) { setSaveError("Não consegui salvar. Tente de novo."); }
  }

  const sortedWeights = useMemo(() => [...data.weightLogs].sort((a, b) => a.date.localeCompare(b.date)), [data.weightLogs]);
  const goal = data.goal ?? DEFAULT_GOAL;
  const bfTarget = data.bfTarget ?? DEFAULT_BF;

  const hasWeights = sortedWeights.length > 0;
  const firstWeightDisplay = hasWeights ? `${sortedWeights[0].weight} kg` : "--";
  const startWeight = sortedWeights[0]?.weight ?? 110;
  const last = sortedWeights[sortedWeights.length - 1];
  const currentWeight = last?.weight ?? startWeight;
  const totalLost = +(startWeight - currentWeight).toFixed(1);
  const totalToLose = startWeight - goal;
  const progressPct = totalToLose > 0 ? Math.max(0, Math.min(100, (totalLost / totalToLose) * 100)) : 0;

  // Série enriquecida: média móvel + BF% + massa magra/gorda
  const series = useMemo(() => {
    return sortedWeights.map((w, i) => {
      const win = sortedWeights.filter((o) => {
        const d = daysBetween(o.date, w.date);
        return d >= 0 && d <= AVG_WINDOW_DAYS;
      });
      const media = win.length >= 2
        ? +(win.reduce((s, o) => s + o.weight, 0) / win.length).toFixed(2)
        : null;
      const bf = navyBodyFat(w.waist, w.neck);
      const gordura = bf != null ? +(w.weight * bf / 100).toFixed(1) : null;
      const magra = bf != null ? +(w.weight - gordura).toFixed(1) : null;
      return { ...w, idx: i, label: fmtDate(w.date), peso: w.weight, media, bf, gordura, magra };
    });
  }, [sortedWeights]);

  // Tendência via regressão dos últimos 28 dias
  const trend = useMemo(() => {
    if (sortedWeights.length < 2) return null;
    const endDate = sortedWeights[sortedWeights.length - 1].date;
    const pts = sortedWeights
      .filter((w) => daysBetween(w.date, endDate) <= 28)
      .map((w) => ({ x: daysBetween(sortedWeights[0].date, w.date), y: w.weight }));
    if (pts.length < 2) return null;
    const slope = linearSlope(pts);
    if (slope == null) return null;
    const perWeek = +(slope * 7).toFixed(2);
    const lossPerWeek = -perWeek;
    const remaining = currentWeight - goal;
    const weeksToGoal = lossPerWeek > 0.05 && remaining > 0 ? Math.ceil(remaining / lossPerWeek) : null;

    // --- Projeção de composição na meta ---
    // Usa pesagens COM cintura/pescoço (que dão massa magra/gorda via Navy).
    // Precisa de >= 2 pra ter tendência de gordura projetável.
    const comp = sortedWeights
      .map((w) => {
        const bf = navyBodyFat(w.waist, w.neck);
        if (bf == null) return null;
        const gordura = w.weight * bf / 100;
        return { x: daysBetween(sortedWeights[0].date, w.date), weight: w.weight, fat: gordura, lean: w.weight - gordura, bf };
      })
      .filter(Boolean);

    let projection = null;
    if (comp.length >= 2 && weeksToGoal) {
      // regressão de massa gorda e massa magra ao longo do tempo (kg/dia)
      const fatSlope = linearSlope(comp.map((c) => ({ x: c.x, y: c.fat })));
      const leanSlope = linearSlope(comp.map((c) => ({ x: c.x, y: c.lean })));
      const lastComp = comp[comp.length - 1];
      const daysToGoal = weeksToGoal * 7;
      if (fatSlope != null && leanSlope != null) {
        const projFat = Math.max(0, lastComp.fat + fatSlope * daysToGoal);
        const projLean = Math.max(0, lastComp.lean + leanSlope * daysToGoal);
        const projTotal = projFat + projLean;
        // reescala pro peso-meta exato (o total projetado pode não bater 100% com goal)
        const scale = projTotal > 0 ? goal / projTotal : 1;
        const fatAtGoalRaw = projFat * scale;
        let bfAtGoal = goal > 0 ? fatAtGoalRaw / goal * 100 : null;
        // trava fisiológica: extrapolação linear de poucos pontos tende ao otimismo
        // irreal (BF despencando). Homens raramente <8% fora de preparação de palco.
        let capped = false;
        if (bfAtGoal != null && bfAtGoal < 10) { bfAtGoal = 10; capped = true; }
        bfAtGoal = bfAtGoal != null ? +bfAtGoal.toFixed(1) : null;
        const fatAtGoal = bfAtGoal != null ? goal * bfAtGoal / 100 : fatAtGoalRaw;
        // qualidade da perda: quanto da perda projetada é gordura vs magra
        const totalLossProj = lastComp.weight - goal;
        const fatLoss = lastComp.fat - fatAtGoal;
        const fatShare = totalLossProj > 0 ? Math.max(0, Math.min(100, Math.round(fatLoss / totalLossProj * 100))) : null;
        projection = { bfAtGoal, fatShare, sample: comp.length, currentBf: lastComp.bf, capped };
      }
    }
    const compAvailable = comp.length;

    return { perWeek, lossPerWeek, weeksToGoal, sample: pts.length, projection, compAvailable };
  }, [sortedWeights, currentWeight, goal]);

  const bfNow = last ? navyBodyFat(last.waist, last.neck) : null;
  const bfEntries = series.filter((s) => s.bf != null);
  const bfFirst = bfEntries[0];
  const bfLast = bfEntries[bfEntries.length - 1];
  const leanDelta = bfFirst && bfLast && bfEntries.length >= 2 ? +(bfLast.magra - bfFirst.magra).toFixed(1) : null;
  const fatDelta = bfFirst && bfLast && bfEntries.length >= 2 ? +(bfLast.gordura - bfFirst.gordura).toFixed(1) : null;
  const waistDelta = (() => {
    const ws = sortedWeights.filter((w) => w.waist);
    return ws.length >= 2 ? +(ws[ws.length - 1].waist - ws[0].waist).toFixed(1) : null;
  })();

  const rateStatus = (() => {
    if (!trend) return null;
    const l = trend.lossPerWeek;
    if (l < 0) return { color: "#C9A24B", icon: <TrendingUp size={14} />, text: "Peso subindo na média das últimas 4 semanas." };
    if (l < RATE_HEALTHY[0]) return { color: "#C9A24B", icon: <Minus size={14} />, text: "Ritmo abaixo do esperado. Se persistir 2-3 semanas, vale ajustar as calorias." };
    if (l > RATE_HEALTHY[1]) return { color: "#E8552E", icon: <AlertTriangle size={14} />, text: "Ritmo acelerado demais. Perda muito rápida costuma vir com massa magra junto." };
    return { color: "#5B7B8C", icon: <TrendingDown size={14} />, text: "Ritmo dentro da faixa saudável para recomposição." };
  })();

  const records = useMemo(() => computeRecords(sortedWeights), [sortedWeights]);
  const bmiNow = last ? +(currentWeight / ((HEIGHT_CM / 100) ** 2)).toFixed(1) : null;
  const bmiCat = bmiCategory(bmiNow);

  const remainingToGoal = +(currentWeight - goal).toFixed(1);
  const simWeeks = remainingToGoal > 0 && simRate > 0 ? Math.ceil(remainingToGoal / simRate) : 0;
  const simDateLabel = useMemo(() => {
    const d = new Date(Date.now() + simWeeks * 7 * 86400000);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }, [simWeeks]);

  // Variação da última pesagem vs. a anterior
  const lastChange = useMemo(() => {
    if (sortedWeights.length < 2) return null;
    const curr = sortedWeights[sortedWeights.length - 1];
    const prev = sortedWeights[sortedWeights.length - 2];
    const diff = +(curr.weight - prev.weight).toFixed(1);
    const gapDays = daysBetween(prev.date, curr.date);
    return { diff, gapDays, note: curr.note, prevWeight: prev.weight, date: curr.date };
  }, [sortedWeights]);

  // "É real ou ruído?" — compara a variação desta semana contra a variabilidade
  // histórica DO PRÓPRIO usuário (desvio-padrão das variações entre pesagens).
  const signalRead = useMemo(() => {
    if (sortedWeights.length < 4) {
      return { status: "insufficient", need: 4 - sortedWeights.length, count: sortedWeights.length };
    }
    // variações entre pesagens consecutivas
    const deltas = [];
    for (let i = 1; i < sortedWeights.length; i++) {
      deltas.push(sortedWeights[i].weight - sortedWeights[i - 1].weight);
    }
    const lastDelta = deltas[deltas.length - 1];
    // desvio-padrão das variações ANTERIORES (exclui a última, que é a que estamos julgando)
    const prior = deltas.slice(0, -1);
    const mean = prior.reduce((s, d) => s + d, 0) / prior.length;
    const variance = prior.reduce((s, d) => s + (d - mean) ** 2, 0) / prior.length;
    const sd = Math.sqrt(variance);
    // média móvel curta (tendência) das últimas 3 variações
    const recentTrend = deltas.slice(-3).reduce((s, d) => s + d, 0) / Math.min(3, deltas.length);
    // z-score: quantos desvios-padrão a variação desta semana está além do ruído
    const noiseBand = +(sd || 0.2).toFixed(2); // piso de 0.2kg pra evitar divisão por ~0
    const z = lastDelta / noiseBand;
    const absZ = Math.abs(z);

    let verdict, detail, color;
    if (absZ < 1) {
      verdict = "Provavelmente ruído";
      color = "#8B8F92";
      detail = `Você variou ${Math.abs(lastDelta).toFixed(1)}kg, e seu peso costuma oscilar ±${noiseBand}kg de uma pesagem pra outra só por água, sal e intestino. Ou seja: esse número sozinho não quer dizer que você progrediu ou regrediu. Não comemore nem se preocupe — olhe a tendência das últimas semanas, não este ponto.`;
    } else if (absZ < 2) {
      verdict = lastDelta < 0 ? "Talvez tenha emagrecido" : "Talvez tenha engordado";
      color = lastDelta < 0 ? "#5B7B8C" : "#C9A24B";
      detail = `Você ${lastDelta < 0 ? "perdeu" : "ganhou"} ${Math.abs(lastDelta).toFixed(1)}kg — um pouco mais do que sua oscilação normal (±${noiseBand}kg), mas não o bastante pra ter certeza. Pode ser mudança de verdade, pode ser um dia de água a mais ou a menos. A próxima pesagem confirma: se seguir na mesma direção, é real.`;
    } else {
      verdict = lastDelta < 0 ? "Emagreceu de verdade" : "Engordou de verdade";
      color = lastDelta < 0 ? "#5B7B8C" : "#E8552E";
      detail = `Você ${lastDelta < 0 ? "perdeu" : "ganhou"} ${Math.abs(lastDelta).toFixed(1)}kg, bem além da sua oscilação normal (±${noiseBand}kg). Isso é mudança real de massa, não flutuação de balança. ${lastDelta < 0 ? "Seu plano está funcionando." : "Se não era o esperado, vale revisar a semana."}`;
    }

    return {
      status: "ok", lastDelta: +lastDelta.toFixed(1), noiseBand, z: +z.toFixed(1), absZ,
      verdict, detail, color, recentTrend: +recentTrend.toFixed(2),
      samplePrior: prior.length,
    };
  }, [sortedWeights]);

  // Calorias: Mifflin-St Jeor -> TDEE -> alvo com déficit
  const calories = useMemo(() => {
    const factor = calTrainDays <= 0 ? 1.2 : calTrainDays <= 3 ? 1.375 : calTrainDays <= 5 ? 1.55 : 1.725;
    const factorLabel = calTrainDays <= 0 ? "sedentário" : calTrainDays <= 3 ? "leve" : calTrainDays <= 5 ? "moderado" : "intenso";
    if (!hasWeights) return { bmr: null, tdee: null, target: null, factor, factorLabel };
    const w = currentWeight, h = +calHeight || HEIGHT_CM, a = +calAge || 28;
    const bmr = 10 * w + 6.25 * h - 5 * a + (calSex === "M" ? 5 : -161);
    const tdee = bmr * factor;
    const target = tdee * (1 - calDeficit / 100);
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), target: Math.round(target), factor, factorLabel };
  }, [hasWeights, currentWeight, calHeight, calAge, calSex, calTrainDays, calDeficit]);

  // Macros: 4 kcal/g proteína, 4 kcal/g carbo, 9 kcal/g gordura
  const macros = useMemo(() => {
    if (!hasWeights || calories.target == null) return null;
    const kcal = calories.target;

    // --- Modo por % (proteína e gordura ajustáveis, carbo = resto) ---
    const protPct = Math.max(0, Math.min(100, +macroProtPct || 0));
    const fatPct = Math.max(0, Math.min(100 - protPct, +macroFatPct || 0));
    const carbPct = Math.max(0, 100 - protPct - fatPct);
    const byPct = {
      prot: { pct: protPct, kcal: Math.round(kcal * protPct / 100), g: Math.round(kcal * protPct / 100 / 4) },
      carb: { pct: carbPct, kcal: Math.round(kcal * carbPct / 100), g: Math.round(kcal * carbPct / 100 / 4) },
      fat: { pct: fatPct, kcal: Math.round(kcal * fatPct / 100), g: Math.round(kcal * fatPct / 100 / 9) },
    };

    // --- Modo por peso (proteína/gordura por g/kg, carbo = resto das kcal) ---
    const w = currentWeight;
    const protG = Math.round((+macroProtPerKg || 0) * w);
    const fatG = Math.round((+macroFatPerKg || 0) * w);
    const protKcal = protG * 4;
    const fatKcal = fatG * 9;
    const carbKcal = Math.max(0, kcal - protKcal - fatKcal);
    const carbG = Math.round(carbKcal / 4);
    const byWeight = {
      prot: { perKg: +macroProtPerKg || 0, g: protG, kcal: protKcal, pct: Math.round(protKcal / kcal * 100) },
      carb: { g: carbG, kcal: Math.round(carbKcal), pct: Math.round(carbKcal / kcal * 100) },
      fat: { perKg: +macroFatPerKg || 0, g: fatG, kcal: fatKcal, pct: Math.round(fatKcal / kcal * 100) },
      overflow: protKcal + fatKcal > kcal, // proteína+gordura já estouram o alvo
    };

    return { kcal, byPct, byWeight };
  }, [hasWeights, calories.target, currentWeight, macroProtPct, macroFatPct, macroProtPerKg, macroFatPerKg]);

  function addWeight() {
    const val = parseFloat(String(newWeight).replace(",", "."));
    if (!val || val <= 0 || val > 400) return;
    const existing = data.weightLogs.find((x) => x.date === newWeightDate);
    if (existing && !window.confirm(`Já existe uma pesagem em ${fmtDate(newWeightDate)} (${existing.weight}kg). Substituir?`)) return;
    const entry = { id: uid(), date: newWeightDate, weight: val };
    const w = parseFloat(String(newWaist).replace(",", "."));
    const n = parseFloat(String(newNeck).replace(",", "."));
    if (w > 0) entry.waist = w;
    if (n > 0) entry.neck = n;
    if (newNote.trim()) entry.note = newNote.trim().slice(0, 60);
    const others = data.weightLogs.filter((x) => x.date !== newWeightDate);
    persist([...others, entry]);
    setNewWeight(""); setNewWaist(""); setNewNeck(""); setNewNote("");
  }
  function removeWeight(id) { persist(data.weightLogs.filter((w) => w.id !== id)); }

  function saveGoal() {
    const g = parseFloat(String(goalInput).replace(",", "."));
    const b = parseFloat(String(bfInput).replace(",", "."));
    const validGoal = g > 0 && g <= 400 ? +g.toFixed(1) : data.goal;
    const validBf = b > 0 && b <= 60 ? +b.toFixed(1) : data.bfTarget;
    persist(data.weightLogs, validGoal, validBf);
    setEditingGoal(false);
  }

  function buildExportJSON() {
    const payload = { version: 1, exportedAt: new Date().toISOString(), goal: data.goal ?? DEFAULT_GOAL, bfTarget: data.bfTarget ?? DEFAULT_BF, weightLogs: data.weightLogs, foodLogs: data.foodLogs || [] };
    return JSON.stringify(payload, null, 2);
  }

  async function copyExport() {
    const json = buildExportJSON();
    try {
      await navigator.clipboard.writeText(json);
      setImportMsg("JSON copiado! Cole num arquivo .json e guarde.");
    } catch (e) {
      // fallback: seleção manual via textarea temporária
      try {
        const ta = document.createElement("textarea");
        ta.value = json; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setImportMsg("JSON copiado! Cole num arquivo .json e guarde.");
      } catch (e2) {
        setShowExportText(true);
        setImportMsg("");
      }
    }
    setTimeout(() => setImportMsg(""), 5000);
  }

  function exportData() {
    const json = buildExportJSON();
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pesagens-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      // download bloqueado no sandbox — mostra o texto pra copiar manualmente
      setShowExportText(true);
    }
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const logs = Array.isArray(parsed) ? parsed : parsed.weightLogs;
        if (!Array.isArray(logs)) throw new Error("formato");
        // valida e normaliza cada registro
        const clean = logs
          .filter((w) => w && typeof w.weight === "number" && /^\d{4}-\d{2}-\d{2}$/.test(w.date))
          .map((w) => ({ id: w.id || uid(), date: w.date, weight: w.weight, ...(w.waist ? { waist: w.waist } : {}), ...(w.neck ? { neck: w.neck } : {}), ...(w.note ? { note: String(w.note).slice(0, 60) } : {}) }));
        if (clean.length === 0) throw new Error("vazio");
        // mescla com o que já existe, sem duplicar datas (importado ganha)
        const existingDates = new Set(clean.map((w) => w.date));
        const merged = [...data.weightLogs.filter((w) => !existingDates.has(w.date)), ...clean];
        const newGoal = typeof parsed.goal === "number" ? parsed.goal : data.goal;
        const newBf = typeof parsed.bfTarget === "number" ? parsed.bfTarget : data.bfTarget;
        const importedFood = Array.isArray(parsed.foodLogs) ? parsed.foodLogs.filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.kcal === "number") : [];
        const existingFood = data.foodLogs || [];
        const foodIds = new Set(existingFood.map((e) => e.id));
        const mergedFood = [...existingFood, ...importedFood.filter((e) => !foodIds.has(e.id))];
        if (!window.confirm(`Importar ${clean.length} pesagens? Elas serão mescladas com as ${data.weightLogs.length} atuais (datas repetidas usam a versão do arquivo).`)) return;
        persist(merged, newGoal, newBf, mergedFood);
        setImportMsg(`${clean.length} pesagens importadas.`);
        setTimeout(() => setImportMsg(""), 4000);
      } catch (e) {
        setImportMsg("Arquivo inválido. Use um .json exportado por este painel.");
        setTimeout(() => setImportMsg(""), 5000);
      }
    };
    reader.readAsText(file);
  }

  if (!ready) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#17191A", color: "#8B8F92", fontFamily: "Inter, sans-serif" }}>Carregando painel...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#17191A", color: "#EDEAE2", fontFamily: "'Inter', sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .display { font-family: 'Oswald', 'Arial Narrow', sans-serif; }
        input[type="number"], input[type="date"], input[type="text"], select {
          background: #17191A; border: 1px solid #34383B; color: #EDEAE2;
          border-radius: 6px; padding: 8px 10px; font-family: 'Inter', sans-serif;
          font-size: 14px; width: 100%;
        }
        input:focus, select:focus { outline: 2px solid #5B7B8C; outline-offset: 1px; border-color: #5B7B8C; }
        button { font-family: 'Inter', sans-serif; cursor: pointer; }
        button:focus-visible { outline: 2px solid #E8552E; outline-offset: 2px; }
        button:disabled { cursor: default; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #34383B; border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      <div style={{ padding: "36px 20px 24px", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
          <div>
            <div className="display" style={{ fontSize: 13, letterSpacing: "0.12em", color: "#8B8F92", textTransform: "uppercase" }}>Acompanhamento de peso</div>
            {editingGoal ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <span className="display" style={{ fontSize: 22, fontWeight: 600 }}>{firstWeightDisplay} →</span>
                <input
                  type="number" step="0.5" autoFocus value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false); }}
                  style={{ width: 80, fontSize: 18 }}
                />
                <span className="display" style={{ fontSize: 22, fontWeight: 600 }}>kg ·</span>
                <input
                  type="number" step="0.5" value={bfInput}
                  onChange={(e) => setBfInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false); }}
                  style={{ width: 64, fontSize: 18 }}
                />
                <span className="display" style={{ fontSize: 22, fontWeight: 600 }}>% gordura</span>
                <button onClick={saveGoal} style={{ display: "flex", alignItems: "center", background: "#E8552E", color: "#fff", border: "none", borderRadius: 6, padding: "7px 9px" }}><Check size={16} /></button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div className="display" style={{ fontSize: 22, fontWeight: 600 }}>{hasWeights ? `${firstWeightDisplay} → ${goal} kg · ${bfTarget}% gordura` : "-- → -- · --"}</div>
                <button onClick={() => { setGoalInput(String(goal)); setBfInput(String(bfTarget)); setEditingGoal(true); }} title="Ajustar meta e % de gordura" style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #34383B", borderRadius: 6, padding: "5px 10px", color: "#8B8F92", fontSize: 12.5 }}><Pencil size={13} /> editar</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
          <div style={{ width: 168, height: 168, borderRadius: "50%", border: "10px solid #2A2E30", background: "radial-gradient(circle at 35% 30%, #24272A, #1B1D1F 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 2px #34383B, 0 0 0 1px #0F1011", flexShrink: 0 }}>
            <div className="display" style={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>{hasWeights ? currentWeight : "--"}</div>
            <div style={{ fontSize: 12, color: "#8B8F92", marginTop: 4, letterSpacing: "0.08em" }}>KG ATUAL</div>
            {bfNow != null && <div style={{ fontSize: 11.5, color: "#5B7B8C", marginTop: 6 }}>~{bfNow}% gordura</div>}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#8B8F92", marginBottom: 6 }}>
              <span>{!hasWeights ? "--" : totalLost >= 0 ? `${totalLost} kg perdidos` : `${Math.abs(totalLost)} kg acima do início`}</span>
              <span>{!hasWeights ? "--" : totalToLose > 0 ? `${Math.max(0, +(currentWeight - goal).toFixed(1))} kg até a meta` : "meta atingida"}</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: "#212426", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${hasWeights ? progressPct : 0}%`, borderRadius: 6, background: "linear-gradient(90deg, #5B7B8C, #E8552E)", transition: "width 0.5s ease" }} />
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
              <StatChip icon={<Scale size={14} />} label="pesagens" value={data.weightLogs.length} />
              {trend && <StatChip icon={<Target size={14} />} label="kg/sem" value={trend.lossPerWeek > 0 ? `-${trend.lossPerWeek}` : `+${Math.abs(trend.lossPerWeek)}`} />}
              {bmiNow != null && <StatChip icon={<Ruler size={14} />} label={`IMC · ${bmiCat.label}`} value={bmiNow} />}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "20px auto 0", padding: "0 20px" }}>

        {/* Variação da última pesagem */}
        {lastChange && (
          <div style={{
            ...card,
            borderLeft: `3px solid ${lastChange.diff < 0 ? "#5B7B8C" : lastChange.diff > 0 ? "#E8552E" : "#8B8F92"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {lastChange.diff < 0 ? <TrendingDown size={28} color="#5B7B8C" /> : lastChange.diff > 0 ? <TrendingUp size={28} color="#E8552E" /> : <Minus size={28} color="#8B8F92" />}
                <span className="display" style={{ fontSize: 34, fontWeight: 700, color: lastChange.diff < 0 ? "#5B7B8C" : lastChange.diff > 0 ? "#E8552E" : "#8B8F92" }}>
                  {lastChange.diff > 0 ? "+" : ""}{lastChange.diff === 0 ? "0" : lastChange.diff}
                </span>
                <span style={{ fontSize: 14, color: "#8B8F92" }}>kg</span>
              </div>
              <div style={{ fontSize: 13, color: "#8B8F92", lineHeight: 1.5 }}>
                {lastChange.diff < 0 ? "abaixo" : lastChange.diff > 0 ? "acima" : "igual"} da pesagem anterior
                {" "}({lastChange.prevWeight}kg, há {lastChange.gapDays} {lastChange.gapDays === 1 ? "dia" : "dias"}).
                {lastChange.note && <span style={{ display: "block", fontStyle: "italic", color: "#8B8F92", marginTop: 2 }}>nota: "{lastChange.note}"</span>}
              </div>
            </div>
          </div>
        )}

        {/* É real ou ruído? — leitura estatística da semana */}
        {signalRead && signalRead.status === "ok" && (
          <div style={{ ...card, borderLeft: `3px solid ${signalRead.color}` }}>
            <div className="display" style={sectionLabel}>ESTA SEMANA · É REAL OU RUÍDO?</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <span className="display" style={{ fontSize: 26, fontWeight: 700, color: signalRead.color }}>{signalRead.verdict}</span>
              <span style={{ fontSize: 12.5, color: "#5A5E60" }}>
                {signalRead.lastDelta > 0 ? "+" : ""}{signalRead.lastDelta}kg esta semana · sua oscilação típica é ±{signalRead.noiseBand}kg
              </span>
            </div>

            {/* régua de ruído: mostra onde a variação da semana cai */}
            <div style={{ position: "relative", height: 30, marginBottom: 6 }}>
              <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 6, borderRadius: 3, background: "linear-gradient(90deg, #E8552E 0%, #5B7B8C 22%, #2A2E30 40%, #2A2E30 60%, #5B7B8C 78%, #E8552E 100%)", opacity: 0.5 }} />
              {/* zona de ruído central (±1 desvio) */}
              <div style={{ position: "absolute", top: 12, left: "40%", width: "20%", height: 6, borderRadius: 3, background: "#3A3E40" }} />
              {/* marcador da semana atual, clampado a ±3 desvios -> 0..100% */}
              <div style={{ position: "absolute", top: 4, left: `${Math.max(2, Math.min(98, 50 + (signalRead.z / 3) * 50))}%`, transform: "translateX(-50%)" }}>
                <div style={{ width: 3, height: 22, borderRadius: 2, background: signalRead.color }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5A5E60", marginBottom: 12 }}>
              <span>alta real</span><span>ruído (±{signalRead.noiseBand}kg)</span><span>queda real</span>
            </div>

            <div style={{ fontSize: 13, color: "#8B8F92", lineHeight: 1.5 }}>{signalRead.detail}</div>

            {signalRead.samplePrior < 5 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 11.5, color: "#5A5E60", lineHeight: 1.45 }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Baseado em {signalRead.samplePrior} variações anteriores. Quanto mais você pesar, mais afiada fica a leitura da sua oscilação real.</span>
              </div>
            )}
          </div>
        )}
        {signalRead && signalRead.status === "insufficient" && sortedWeights.length >= 1 && (
          <div style={card}>
            <div className="display" style={sectionLabel}>ESTA SEMANA · É REAL OU RUÍDO?</div>
            <div style={{ fontSize: 13, color: "#8B8F92", lineHeight: 1.5 }}>
              Preciso de {signalRead.need} {signalRead.need === 1 ? "pesagem" : "pesagens"} a mais para aprender qual é a sua oscilação normal. A partir daí, digo a cada sábado se a mudança da semana é real ou só flutuação da balança.
            </div>
          </div>
        )}

        {/* Cartão de tendência */}
        {trend && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div className="display" style={sectionLabel}>TENDÊNCIA · ÚLTIMAS 4 SEMANAS</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                  <span className="display" style={{ fontSize: 30, fontWeight: 700, color: rateStatus.color }}>
                    {trend.lossPerWeek > 0 ? "−" : "+"}{Math.abs(trend.lossPerWeek)}
                  </span>
                  <span style={{ fontSize: 13, color: "#8B8F92" }}>kg / semana</span>
                </div>
              </div>
              {trend.weeksToGoal && (
                <div style={{ textAlign: "right" }}>
                  <div className="display" style={sectionLabel}>NESTE RITMO</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>~{trend.weeksToGoal} semanas até {goal} kg</div>
                </div>
              )}
            </div>
            {/* Faixa de ritmo */}
            <div style={{ marginTop: 14 }}>
              <div style={{ position: "relative", height: 8, borderRadius: 4, background: "#2A2E30", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: "26%", width: "40%", height: "100%", background: "rgba(91,123,140,0.45)" }} />
              </div>
              <div style={{ position: "relative", height: 14 }}>
                <div style={{ position: "absolute", left: `${Math.max(0, Math.min(100, ((trend.lossPerWeek + 0.4) / 1.9) * 100))}%`, transform: "translateX(-50%)", marginTop: 2 }}>
                  <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `6px solid ${rateStatus.color}` }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#5A5E60" }}>
                <span>ganhando</span><span>faixa saudável (0,4–1,0)</span><span>rápido demais</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 12, fontSize: 12.5, color: rateStatus.color }}>
              {rateStatus.icon}<span style={{ lineHeight: 1.4 }}>{rateStatus.text}</span>
            </div>
            {trend.sample < 3 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, fontSize: 11.5, color: "#5A5E60" }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Só {trend.sample} pesagens nesse período — a tendência fica confiável a partir de 4.</span>
              </div>
            )}

            {/* Projeção de composição na meta */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #2A2E30" }}>
              <div className="display" style={{ ...sectionLabel, marginBottom: 8 }}>PROJEÇÃO DE COMPOSIÇÃO NA META</div>
              {trend.projection ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#8B8F92" }}>Ao chegar em {goal}kg, projeção de</span>
                    <span className="display" style={{ fontSize: 26, fontWeight: 700, color: "#5B7B8C" }}>~{trend.projection.bfAtGoal}%</span>
                    <span style={{ fontSize: 13, color: "#8B8F92" }}>de gordura</span>
                  </div>
                  {trend.projection.fatShare != null && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#8B8F92", marginBottom: 4 }}>
                        <span>qualidade da perda projetada</span>
                        <span><strong style={{ color: trend.projection.fatShare >= 75 ? "#5B7B8C" : "#C9A24B" }}>{trend.projection.fatShare}%</strong> gordura · {100 - trend.projection.fatShare}% massa magra</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "#C9A24B", overflow: "hidden", display: "flex" }}>
                        <div style={{ width: `${trend.projection.fatShare}%`, background: "#5B7B8C", height: "100%" }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 11.5, color: "#5A5E60", lineHeight: 1.45 }}>
                    <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      {trend.projection.capped
                        ? "A extrapolação linear dava um valor irrealista (abaixo de 10%), então limitei — no ritmo atual você chegaria bem magro, mas a perda desacelera perto da meta e o número real será mais alto. "
                        : trend.projection.fatShare != null && trend.projection.fatShare >= 75
                        ? "A maior parte do que você está perdendo é gordura — é o cenário ideal da recomposição. "
                        : trend.projection.fatShare != null
                        ? "Uma fatia relevante da perda projetada é massa magra. Mais proteína e treino de força ajudam a preservar músculo. "
                        : ""}
                      Baseado em {trend.projection.sample} medidas de cintura. Projeção grosseira — quanto mais você medir a cintura, mais precisa fica.
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#5A5E60", lineHeight: 1.5 }}>
                  <Ruler size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {trend.compAvailable === 1
                      ? "Você já tem 1 pesagem com cintura registrada. Registre a cintura em mais uma pesagem e esta projeção liga sozinha — vai estimar com quantos % de gordura você chega na meta."
                      : "Registre a cintura (e pescoço) em pelo menos 2 pesagens e esta seção acende: vou projetar com quantos % de gordura você chega na meta, e quanto da perda é gordura vs. músculo."}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Simulador de ritmo */}
        <div style={card}>
          <div className="display" style={sectionLabel}>SIMULADOR · E SE EU PERDESSE...</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="display" style={{ fontSize: 28, fontWeight: 700, color: "#E8552E" }}>{simRate.toFixed(2)}</span>
            <span style={{ fontSize: 13, color: "#8B8F92" }}>kg / semana</span>
          </div>
          <input
            type="range" min="0.1" max="1.5" step="0.05" value={simRate}
            onChange={(e) => setSimRate(parseFloat(e.target.value))}
            style={{ width: "100%", marginTop: 12, accentColor: "#E8552E" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#5A5E60", marginTop: 2 }}>
            <span>0,1</span><span>0,8</span><span>1,5 kg/sem</span>
          </div>
          {!hasWeights ? (
            <div style={{ marginTop: 14, fontSize: 13.5, color: "#5A5E60", lineHeight: 1.5 }}>
              Registre uma pesagem para simular. O cálculo parte do seu peso atual, que ainda não existe.
            </div>
          ) : remainingToGoal > 0 ? (
            <div style={{ marginTop: 14, fontSize: 13.5, color: "#8B8F92", lineHeight: 1.5 }}>
              Faltam <strong style={{ color: "#EDEAE2" }}>{remainingToGoal}kg</strong> até {goal}kg. Nesse ritmo: <strong style={{ color: "#EDEAE2" }}>{simWeeks} semanas</strong> (~{Math.round(simWeeks / 4.345)} meses), chegando por volta de <strong style={{ color: "#EDEAE2" }}>{simDateLabel}</strong>.
            </div>
          ) : (
            <div style={{ marginTop: 14, fontSize: 13.5, color: "#5B7B8C" }}>Meta já atingida.</div>
          )}
        </div>

        {/* Calculadora de calorias */}
        <div style={card}>
          <div className="display" style={sectionLabel}>CALORIAS · MIFFLIN-ST JEOR</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <div style={smallLabel}>peso atual</div>
              <div style={{ padding: "8px 10px", background: "#1D2022", borderRadius: 6, fontSize: 14, color: "#8B8F92" }}>{hasWeights ? `${currentWeight} kg` : "--"}</div>
            </div>
            <div>
              <div style={smallLabel}>altura (cm)</div>
              <input type="number" value={calHeight} onChange={(e) => setCalHeight(e.target.value)} />
            </div>
            <div>
              <div style={smallLabel}>idade</div>
              <input type="number" value={calAge} onChange={(e) => setCalAge(e.target.value)} />
            </div>
            <div>
              <div style={smallLabel}>sexo</div>
              <div style={{ display: "flex", gap: 4 }}>
                <MiniToggle active={calSex === "M"} onClick={() => setCalSex("M")}>Masc</MiniToggle>
                <MiniToggle active={calSex === "F"} onClick={() => setCalSex("F")}>Fem</MiniToggle>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={smallLabel}>treinos por semana · <span style={{ color: "#5B7B8C" }}>{calories.factorLabel} (×{calories.factor})</span></div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                <MiniToggle key={d} active={calTrainDays === d} onClick={() => setCalTrainDays(d)}>{d}×</MiniToggle>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={smallLabel}>déficit para recomposição</div>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {[10, 15, 20].map((d) => (
                <MiniToggle key={d} active={calDeficit === d} onClick={() => setCalDeficit(d)}>{d}%</MiniToggle>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", borderTop: "1px solid #2A2E30", paddingTop: 14 }}>
            <div style={{ flex: "1 1 90px" }}>
              <div style={smallLabel}>BMR</div>
              <div className="display" style={{ fontSize: 20, fontWeight: 700, color: "#8B8F92" }}>{calories.bmr ?? "--"}</div>
              <div style={{ fontSize: 10, color: "#5A5E60" }}>kcal em repouso</div>
            </div>
            <div style={{ flex: "1 1 90px" }}>
              <div style={smallLabel}>gasto total (TDEE)</div>
              <div className="display" style={{ fontSize: 24, fontWeight: 700 }}>{calories.tdee ?? "--"}</div>
              <div style={{ fontSize: 10, color: "#5A5E60" }}>kcal para manter</div>
            </div>
            <div style={{ flex: "1 1 90px" }}>
              <div style={smallLabel}>alvo · déficit {calDeficit}%</div>
              <div className="display" style={{ fontSize: 24, fontWeight: 700, color: "#E8552E" }}>{calories.target ?? "--"}</div>
              <div style={{ fontSize: 10, color: "#5A5E60" }}>kcal por dia</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12, fontSize: 11.5, color: "#5A5E60", lineHeight: 1.45 }}>
            <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{hasWeights
              ? "Estimativa. Recalcula sozinho conforme seu peso cai. Déficit de 15-20% preserva massa magra melhor que cortes agressivos — o valor absoluto importa menos que a consistência semana a semana."
              : "Registre uma pesagem para calcular. As calorias usam seu peso atual, que ainda não existe."}</span>
          </div>
        </div>

        {/* Macronutrientes */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div className="display" style={sectionLabel}>MACRONUTRIENTES{macros ? ` · ${macros.kcal} kcal` : ""}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <MiniToggle active={macroMode === "pct"} onClick={() => setMacroMode("pct")}>Por %</MiniToggle>
              <MiniToggle active={macroMode === "weight"} onClick={() => setMacroMode("weight")}>Por peso</MiniToggle>
            </div>
          </div>

          {!macros ? (
            <div style={{ fontSize: 13, color: "#5A5E60", lineHeight: 1.5 }}>Registre uma pesagem para distribuir os macros sobre a caloria alvo.</div>
          ) : macroMode === "pct" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                <MacroBlock
                  label="PROTEÍNA" color="#5B7B8C" editable
                  pct={macros.byPct.prot.pct} onPct={setMacroProtPct}
                  grams={macros.byPct.prot.g} kcal={macros.byPct.prot.kcal}
                />
                <MacroBlock
                  label="CARBOIDRATO" color="#E8552E"
                  pct={macros.byPct.carb.pct} lockedNote="resto automático"
                  grams={macros.byPct.carb.g} kcal={macros.byPct.carb.kcal}
                />
                <MacroBlock
                  label="GORDURA" color="#C9A24B" editable
                  pct={macros.byPct.fat.pct} onPct={setMacroFatPct}
                  grams={macros.byPct.fat.g} kcal={macros.byPct.fat.kcal}
                />
              </div>
              <MacroBar p={macros.byPct.prot.pct} f={macros.byPct.fat.pct} c={macros.byPct.carb.pct} />
              <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 11.5, color: "#5A5E60", lineHeight: 1.45 }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Você ajusta proteína e gordura; o carboidrato preenche o resto para fechar 100%. Proteína e carbo = 4 kcal/g, gordura = 9 kcal/g.</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                <MacroBlock
                  label="PROTEÍNA" color="#5B7B8C" editablePerKg
                  perKg={macros.byWeight.prot.perKg} onPerKg={setMacroProtPerKg}
                  grams={macros.byWeight.prot.g} kcal={macros.byWeight.prot.kcal} pct={macros.byWeight.prot.pct}
                />
                <MacroBlock
                  label="CARBOIDRATO" color="#E8552E" lockedNote="resto das kcal"
                  grams={macros.byWeight.carb.g} kcal={macros.byWeight.carb.kcal} pct={macros.byWeight.carb.pct}
                />
                <MacroBlock
                  label="GORDURA" color="#C9A24B" editablePerKg
                  perKg={macros.byWeight.fat.perKg} onPerKg={setMacroFatPerKg}
                  grams={macros.byWeight.fat.g} kcal={macros.byWeight.fat.kcal} pct={macros.byWeight.fat.pct}
                />
              </div>
              <MacroBar p={macros.byWeight.prot.pct} f={macros.byWeight.fat.pct} c={macros.byWeight.carb.pct} />
              {macros.byWeight.overflow && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 11.5, color: "#E8552E", lineHeight: 1.45 }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>Proteína + gordura já ultrapassam a caloria alvo. Reduza g/kg ou o carboidrato fica zerado.</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 11.5, color: "#5A5E60", lineHeight: 1.45 }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Proteína e gordura ancoradas no seu peso ({currentWeight}kg); o carboidrato leva as calorias que sobram. Para recomposição: proteína ~1,8–2,2 g/kg, gordura ~0,8–1 g/kg.</span>
              </div>
            </>
          )}
        </div>


        {/* Recordes */}
        {records && (
          <div style={card}>
            <div className="display" style={sectionLabel}>RECORDES</div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={smallLabel}>menor peso</div>
                <div className="display" style={bigStat}>{records.min.weight}<span style={{ fontSize: 12, fontWeight: 400, color: "#5A5E60" }}> kg · {fmtDate(records.min.date)}</span></div>
              </div>
              <div>
                <div style={smallLabel}>maior peso</div>
                <div className="display" style={bigStat}>{records.max.weight}<span style={{ fontSize: 12, fontWeight: 400, color: "#5A5E60" }}> kg · {fmtDate(records.max.date)}</span></div>
              </div>
              {records.biggestDrop && (
                <div>
                  <div style={smallLabel}>maior queda em ~7 dias</div>
                  <div className="display" style={{ ...bigStat, color: "#5B7B8C" }}>{records.biggestDrop.diff} kg</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progressão de pesagens (barras CSS, sem biblioteca de gráfico) */}
        {series.length >= 1 && (
          <div style={card}>
            <div className="display" style={sectionLabel}>PROGRESSÃO</div>
            {(() => {
              const vals = series.map((s) => s.peso);
              const lo = Math.min(...vals, goal);
              const hi = Math.max(...vals);
              const span = hi - lo || 1;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[...series].reverse().map((s, i, arr) => {
                    const prev = arr[i + 1];
                    const diff = prev ? +(s.peso - prev.peso).toFixed(1) : null;
                    const pct = ((s.peso - lo) / span) * 100; // 0 = mais próximo da meta
                    const barColor = diff == null ? "#5B7B8C" : diff < 0 ? "#5B7B8C" : diff > 0 ? "#E8552E" : "#8B8F92";
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11.5, color: "#8B8F92", width: 42, flexShrink: 0 }}>{s.label}</span>
                        <div style={{ flex: 1, height: 22, background: "#1D2022", borderRadius: 5, position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.max(6, pct)}%`, background: barColor, opacity: 0.35, borderRadius: 5, transition: "width 0.4s ease" }} />
                          <span className="display" style={{ position: "absolute", left: 8, top: 0, height: "100%", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600 }}>{s.peso} kg</span>
                        </div>
                        <span style={{ fontSize: 12, color: barColor, width: 46, textAlign: "right", flexShrink: 0 }}>
                          {diff == null ? "—" : diff === 0 ? "=" : `${diff > 0 ? "+" : ""}${diff}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 10.5, color: "#5A5E60" }}>
              <span>← mais perto da meta ({goal}kg)</span>
              <span>mais longe →</span>
            </div>
          </div>
        )}

        {/* Sinais de recomposição */}
        {(leanDelta !== null || waistDelta !== null) && (
          <div style={card}>
            <div className="display" style={sectionLabel}>SINAIS DE RECOMPOSIÇÃO</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {fatDelta !== null && <DeltaBox label="massa gorda" value={fatDelta} unit="kg" good={fatDelta < 0} />}
              {leanDelta !== null && <DeltaBox label="massa magra" value={leanDelta} unit="kg" good={leanDelta >= -0.5} />}
              {waistDelta !== null && <DeltaBox label="cintura" value={waistDelta} unit="cm" good={waistDelta < 0} />}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, fontSize: 11.5, color: "#5A5E60", lineHeight: 1.45 }}>
              <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Estimativa pelo método Navy (cintura e pescoço). O valor absoluto tem erro de ±3-4%, mas a direção da mudança é confiável — é ela que importa aqui.</span>
            </div>
          </div>
        )}

        {/* Registro */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div className="display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, letterSpacing: "0.04em" }}>REGISTRAR PESAGEM</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="date" value={newWeightDate} onChange={(e) => setNewWeightDate(e.target.value)} style={{ flex: "1 1 140px" }} />
            <input type="number" placeholder="peso (kg)" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} style={{ flex: "1 1 100px" }} />
            <button onClick={addWeight} style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8552E", color: "#fff", border: "none", borderRadius: 6, padding: "0 16px", fontWeight: 600, fontSize: 14 }}><Plus size={16} /> Salvar</button>
          </div>

          <input type="text" placeholder="nota (opcional): viagem, resfriado, TPM, ressaca..." value={newNote} onChange={(e) => setNewNote(e.target.value)} maxLength={60} style={{ marginTop: 8 }} />

          {!showMeasures ? (
            <button onClick={() => setShowMeasures(true)} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed #34383B", borderRadius: 6, padding: "8px 12px", color: "#8B8F92", fontSize: 13 }}>
              <Ruler size={14} /> Adicionar medidas (estimar % de gordura)
            </button>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 28px", gap: 8, alignItems: "center" }}>
                <input type="number" placeholder="cintura (cm)" step="0.5" value={newWaist} onChange={(e) => setNewWaist(e.target.value)} />
                <input type="number" placeholder="pescoço (cm)" step="0.5" value={newNeck} onChange={(e) => setNewNeck(e.target.value)} />
                <button onClick={() => { setShowMeasures(false); setNewWaist(""); setNewNeck(""); }} style={{ background: "none", border: "none", color: "#5A5E60", padding: 4 }}><X size={16} /></button>
              </div>
              <div style={{ fontSize: 11.5, color: "#5A5E60", marginTop: 6, lineHeight: 1.45 }}>
                Cintura na altura do umbigo, fita justa sem apertar, expirando normalmente. Pescoço logo abaixo do pomo de adão. Meça sempre no mesmo ponto.
              </div>
            </div>
          )}
        </div>

        <div className="display" style={{ fontSize: 13, color: "#8B8F92", marginBottom: 8, letterSpacing: "0.08em" }}>HISTÓRICO</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...series].reverse().map((w, i, arr) => {
            const prev = arr[i + 1];
            const diff = prev ? +(w.weight - prev.weight).toFixed(1) : null;
            return (
              <div key={w.id} style={{ background: "#1D2022", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#8B8F92", fontSize: 13 }}>{fmtDate(w.date)}</span>
                  <span className="display" style={{ fontWeight: 600, fontSize: 16 }}>{w.weight} kg</span>
                  {diff !== null && <span style={{ fontSize: 12, color: diff < 0 ? "#5B7B8C" : diff > 0 ? "#E8552E" : "#8B8F92", minWidth: 46, textAlign: "right" }}>{diff === 0 ? "=" : `${diff > 0 ? "+" : ""}${diff}`}</span>}
                  <button onClick={() => removeWeight(w.id)} style={{ background: "none", border: "none", color: "#5A5E60", fontSize: 12, padding: "4px 8px" }}>remover</button>
                </div>
                {(w.bf != null || w.waist) && (
                  <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 11.5, color: "#5A5E60" }}>
                    {w.waist && <span>cintura {w.waist}cm</span>}
                    {w.bf != null && <span>~{w.bf}% gordura</span>}
                    {w.magra != null && <span>{w.magra}kg magra</span>}
                  </div>
                )}
                {w.note && <div style={{ marginTop: 4, fontSize: 11.5, color: "#8B8F92", fontStyle: "italic" }}>"{w.note}"</div>}
              </div>
            );
          })}
          {series.length === 0 && <EmptyState text="Nenhuma pesagem registrada ainda." />}
        </div>

        {/* Backup: exportar / importar */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #2A2E30" }}>
          <div className="display" style={{ fontSize: 12.5, color: "#8B8F92", letterSpacing: "0.08em", marginBottom: 4 }}>BACKUP DOS DADOS</div>
          <div style={{ fontSize: 12, color: "#5A5E60", marginBottom: 12, lineHeight: 1.45 }}>
            Guarde uma cópia dos seus dados de tempos em tempos. É a sua garantia caso queira migrar depois — o arquivo é seu. Copiar é o mais confiável aqui dentro; o download pode ser bloqueado pelo ambiente.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={copyExport} style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8552E", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              <Download size={15} /> Copiar dados
            </button>
            <button onClick={exportData} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1D2022", border: "1px solid #34383B", borderRadius: 8, padding: "8px 14px", color: "#EDEAE2", fontSize: 13 }}>
              <Download size={15} /> Baixar .json
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1D2022", border: "1px solid #34383B", borderRadius: 8, padding: "8px 14px", color: "#EDEAE2", fontSize: 13 }}>
              <Upload size={15} /> Importar
            </button>
            <input
              ref={fileInputRef} type="file" accept="application/json,.json"
              onChange={(e) => { importData(e.target.files?.[0]); e.target.value = ""; }}
              style={{ display: "none" }}
            />
          </div>
          {importMsg && <div style={{ marginTop: 10, fontSize: 12.5, color: importMsg.includes("inválido") ? "#E8552E" : "#5B7B8C" }}>{importMsg}</div>}
          {showExportText && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, color: "#5A5E60", marginBottom: 6 }}>Download bloqueado pelo ambiente. Selecione tudo abaixo, copie e cole num arquivo .json:</div>
              <textarea
                readOnly value={buildExportJSON()}
                onFocus={(e) => e.target.select()}
                style={{ width: "100%", height: 120, background: "#17191A", border: "1px solid #34383B", borderRadius: 6, color: "#EDEAE2", fontSize: 11, fontFamily: "monospace", padding: 8, resize: "vertical" }}
              />
              <button onClick={() => setShowExportText(false)} style={{ marginTop: 6, background: "none", border: "none", color: "#8B8F92", fontSize: 12, cursor: "pointer" }}>fechar</button>
            </div>
          )}
        </div>
      </div>

      {saveError && <div style={{ maxWidth: 760, margin: "16px auto 0", padding: "0 20px", color: "#E8552E", fontSize: 13 }}>{saveError}</div>}
    </div>
  );
}

function StatChip({ icon, label, value }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8B8F92", fontSize: 13 }}>{icon}<span className="display" style={{ color: "#EDEAE2", fontWeight: 600 }}>{value}</span><span>{label}</span></div>;
}
function MiniToggle({ active, onClick, disabled, children }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11.5, border: "1px solid " + (active ? "#E8552E" : "#34383B"), background: active ? "rgba(232,85,46,0.12)" : "transparent", color: disabled ? "#3F4245" : active ? "#E8552E" : "#8B8F92" }}>{children}</button>;
}
function DeltaBox({ label, value, unit, good }) {
  const color = good ? "#5B7B8C" : "#C9A24B";
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "#8B8F92", marginBottom: 2 }}>{label}</div>
      <div className="display" style={{ fontSize: 20, fontWeight: 700, color }}>{value > 0 ? "+" : ""}{value}{unit}</div>
    </div>
  );
}
function EmptyState({ text }) {
  return <div style={{ textAlign: "center", padding: "24px 0", color: "#5A5E60", fontSize: 13 }}>{text}</div>;
}
function MacroBlock({ label, color, editable, editablePerKg, pct, onPct, perKg, onPerKg, grams, kcal, lockedNote }) {
  return (
    <div style={{ background: "#1D2022", borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${color}` }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", color, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {editable && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <input
              type="number" value={pct} min="0" max="100"
              onChange={(e) => onPct(e.target.value === "" ? "" : Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              style={{ width: 64, fontSize: 18, padding: "5px 8px" }}
            />
            <span style={{ fontSize: 13, color: "#8B8F92" }}>%</span>
          </div>
        </div>
      )}
      {editablePerKg && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <input
              type="number" value={perKg} min="0" step="0.1"
              onChange={(e) => onPerKg(e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0))}
              style={{ width: 64, fontSize: 18, padding: "5px 8px" }}
            />
            <span style={{ fontSize: 13, color: "#8B8F92" }}>g/kg</span>
          </div>
          <div style={{ fontSize: 10.5, color: "#5A5E60", marginTop: 3 }}>{pct}% das kcal</div>
        </div>
      )}
      {lockedNote && (
        <div style={{ marginBottom: 8 }}>
          <div className="display" style={{ fontSize: 18, fontWeight: 700, color: "#EDEAE2" }}>{pct}%</div>
          <div style={{ fontSize: 10.5, color: "#5A5E60" }}>{lockedNote}</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderTop: "1px solid #2A2E30", paddingTop: 8 }}>
        <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{grams}<span style={{ fontSize: 12, fontWeight: 400, color: "#8B8F92" }}> g</span></div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#8B8F92" }}>{kcal} kcal</div>
      </div>
    </div>
  );
}
function MacroBar({ p, f, c }) {
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 12, background: "#1D2022" }}>
      <div style={{ width: `${p}%`, background: "#5B7B8C" }} title={`proteína ${p}%`} />
      <div style={{ width: `${f}%`, background: "#C9A24B" }} title={`gordura ${f}%`} />
      <div style={{ width: `${c}%`, background: "#E8552E" }} title={`carboidrato ${c}%`} />
    </div>
  );
}
