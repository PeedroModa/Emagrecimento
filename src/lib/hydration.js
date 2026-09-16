// Hidratação — funções puras. A meta deriva do peso oficial (weigh_ins);
// nada aqui persiste ou recalcula peso. Datas: o "dia" da hidratação é o
// dia LOCAL (um copo às 22h pertence ao dia em que foi bebido), diferente
// de todayISO() (UTC), que serve à pesagem matinal.

export const ML_PER_KG = 50;
export const QUICK_AMOUNTS_ML = [650, 1000, 1500, 2000];
export const REMINDER_GAP_HOURS = 3;

const pad = (n) => String(n).padStart(2, "0");

export function localDateISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTimeHM(isoTimestamp) {
  const d = new Date(isoTimestamp);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Timestamp para um registro no dia `dateISO`: hoje = agora; dia passado =
// aquele dia, na hora atual do relógio (mantém a ordem de quem registra
// depois, sem inventar horário).
export function timestampForDay(dateISO, now = new Date()) {
  if (dateISO === localDateISO(now)) return now.toISOString();
  return new Date(`${dateISO}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`).toISOString();
}

export function hydrationGoalMl(weightKg) {
  return weightKg > 0 ? Math.round(weightKg * ML_PER_KG) : null;
}

// Peso "oficial" para um dia: última pesagem até aquela data; se o dia é
// anterior à primeira pesagem, usa a primeira. `sorted` = weigh_ins asc.
export function weightForDay(sorted, dateISO) {
  if (!sorted?.length) return null;
  let pick = null;
  for (const w of sorted) {
    if (w.date <= dateISO) pick = w;
    else break;
  }
  return (pick ?? sorted[0]).weight;
}

export function logsForDay(logs, dateISO) {
  return (logs || []).filter((l) => localDateISO(new Date(l.logged_at)) === dateISO);
}

export function dayTotalMl(logs, dateISO) {
  return logsForDay(logs, dateISO).reduce((s, l) => s + l.amount_ml, 0);
}

export function fmtLiters(ml) {
  if (ml == null || Number.isNaN(ml)) return "—";
  if (ml < 1000) return `${Math.round(ml)} ml`;
  const l = Math.round(ml / 100) / 10;
  return `${String(l).replace(".", ",")} L`;
}

// Estágio visual. `over` só quando passa de fato da meta (em ml), para que
// bater exatamente 100% seja "goal", não "excedente".
export function hydrationStatus({ totalMl = 0, goalMl }) {
  if (!goalMl) return { pct: null, stage: null, remainingMl: null, excessMl: 0, level: 0 };
  const pct = Math.round((totalMl / goalMl) * 100);
  const stage =
    totalMl > goalMl ? "over"
    : totalMl >= goalMl ? "goal"
    : pct >= 75 ? "near"
    : pct >= 50 ? "half"
    : pct >= 25 ? "low"
    : "start";
  return {
    pct,
    stage,
    remainingMl: Math.max(0, goalMl - totalMl),
    excessMl: Math.max(0, totalMl - goalMl),
    level: Math.min(1, totalMl / goalMl), // fração de preenchimento do corpo
  };
}

export const STAGE_MESSAGES = {
  start: "Ingestão bem abaixo da meta até agora.",
  low: "Há progresso, mas ainda falta uma parte significativa da meta.",
  half: "Metade do caminho. O restante do dia decide.",
  near: "Perto da meta. Falta pouco.",
  goal: "Meta do dia atingida.",
  over: "Meta ultrapassada. A meta é uma referência, não uma competição: acima dela, mais não é melhor.",
};

// Lembrete contextual, sem culpa. Só para o dia de hoje.
export function reminderMessage({ logsToday, status, now = new Date() }) {
  if (!status?.stage) return null;
  if (!logsToday.length) return "Nenhum registro ainda hoje.";
  const last = new Date(logsToday[0].logged_at);
  const hours = (now - last) / 36e5;
  if (hours >= REMINDER_GAP_HOURS && status.stage !== "goal" && status.stage !== "over") {
    return `Já faz cerca de ${Math.floor(hours)}h desde seu último registro.`;
  }
  if (status.stage === "goal" || status.stage === "over") return null;
  return `Ainda faltam ${fmtLiters(status.remainingMl)} para sua meta de hoje.`;
}

// Percentual da meta por dia, para o motor de insights: usa o peso oficial
// de cada dia (weightForDay). Só dias com registro E meta calculável.
export function hydrationByDay(logs, sortedWeights) {
  const totals = new Map();
  for (const l of logs || []) {
    const d = localDateISO(new Date(l.logged_at));
    totals.set(d, (totals.get(d) || 0) + l.amount_ml);
  }
  const out = [];
  for (const [date, totalMl] of totals) {
    const goalMl = hydrationGoalMl(weightForDay(sortedWeights, date));
    if (goalMl) out.push({ date, totalMl, pct: Math.round((totalMl / goalMl) * 100) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
