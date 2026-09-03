import { todayISO, CONTEXT_TAG_MAX, isValidBirthDate } from "./calculations.js";
import { CONTEXT_TAG_IDS } from "./contextTags.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// v2: exporta o perfil inteiro (13 campos de user_settings, menos `age` —
// que é só um espelho de birth_date, recalculado no próximo carregamento).
// Até a v1 só levava goal/bfTarget: um restore em conta nova perdia altura,
// data de nascimento, sexo, treinos, déficit e macros silenciosamente.
export function buildExportJSON(weighIns, settings) {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: {
      goal_kg: settings.goal_kg,
      bf_target: settings.bf_target,
      height_cm: settings.height_cm,
      birth_date: settings.birth_date ?? null,
      sex: settings.sex,
      train_days: settings.train_days,
      deficit_pct: settings.deficit_pct,
      macro_mode: settings.macro_mode,
      macro_prot_pct: settings.macro_prot_pct,
      macro_fat_pct: settings.macro_fat_pct,
      macro_prot_per_kg: settings.macro_prot_per_kg,
      macro_fat_per_kg: settings.macro_fat_per_kg,
    },
    weightLogs: weighIns.map((w) => ({
      id: w.id,
      date: w.date,
      weight: w.weight,
      ...(w.waist ? { waist: w.waist } : {}),
      ...(w.neck ? { neck: w.neck } : {}),
      ...(w.note ? { note: w.note } : {}),
      ...(w.context_tags?.length ? { context_tags: w.context_tags } : {}),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadJSON(json) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pesagens-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Mesmas restrições do banco (supabase/schema.sql) — um arquivo editado à
// mão não pode chegar ao upsert e estourar um check violation genérico.
const SETTINGS_VALIDATORS = {
  goal_kg: (v) => (typeof v === "number" && v > 0 && v <= 400 ? v : undefined),
  bf_target: (v) => (typeof v === "number" && v > 0 && v <= 60 ? v : undefined),
  height_cm: (v) => (Number.isInteger(v) && v >= 100 && v <= 250 ? v : undefined),
  birth_date: (v) => (typeof v === "string" && isValidBirthDate(v) ? v : undefined),
  sex: (v) => (v === "M" || v === "F" ? v : undefined),
  train_days: (v) => (Number.isInteger(v) && v >= 0 && v <= 7 ? v : undefined),
  deficit_pct: (v) => ([10, 15, 20].includes(v) ? v : undefined),
  macro_mode: (v) => (v === "pct" || v === "weight" ? v : undefined),
  macro_prot_pct: (v) => (typeof v === "number" && v >= 0 && v <= 100 ? v : undefined),
  macro_fat_pct: (v) => (typeof v === "number" && v >= 0 && v <= 100 ? v : undefined),
  macro_prot_per_kg: (v) => (typeof v === "number" && v >= 0 && v <= 10 ? v : undefined),
  macro_fat_per_kg: (v) => (typeof v === "number" && v >= 0 && v <= 10 ? v : undefined),
};

// Devolve só os campos presentes E válidos — nunca preenche com default,
// para um patch parcial nunca sobrescrever configuração já existente com lixo.
function parseSettings(parsed) {
  const src = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {};
  const out = {};
  for (const [key, validate] of Object.entries(SETTINGS_VALIDATORS)) {
    if (src[key] === undefined) continue;
    const v = validate(src[key]);
    if (v !== undefined) out[key] = v;
  }
  // Compatibilidade com o formato v1 (goal/bfTarget soltos na raiz do arquivo)
  if (out.goal_kg === undefined && typeof parsed.goal === "number") {
    const v = SETTINGS_VALIDATORS.goal_kg(parsed.goal);
    if (v !== undefined) out.goal_kg = v;
  }
  if (out.bf_target === undefined && typeof parsed.bfTarget === "number") {
    const v = SETTINGS_VALIDATORS.bf_target(parsed.bfTarget);
    if (v !== undefined) out.bf_target = v;
  }
  return out;
}

// Valida o JSON importado. Retorna { logs, settings } ou { error }.
// Aceita v1 (array cru, ou {weightLogs, goal, bfTarget}) e v2 ({weightLogs, settings}).
// foodLogs é ignorado silenciosamente (decisão aprovada: não migra).
export function parseImportJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "Arquivo inválido. Use um .json exportado pelo painel." };
  }
  const rawLogs = Array.isArray(parsed) ? parsed : parsed.weightLogs;
  if (!Array.isArray(rawLogs)) {
    return { error: "Arquivo inválido. Use um .json exportado pelo painel." };
  }
  const logs = rawLogs
    .filter((w) => w && typeof w.weight === "number" && w.weight > 0 && w.weight <= 400 && DATE_RE.test(w.date))
    .map((w) => ({
      date: w.date,
      weight: w.weight,
      ...(typeof w.waist === "number" && w.waist > 0 ? { waist: w.waist } : {}),
      ...(typeof w.neck === "number" && w.neck > 0 ? { neck: w.neck } : {}),
      ...(w.note ? { note: String(w.note).slice(0, 80) } : {}),
      ...(() => {
        const tags = Array.isArray(w.context_tags)
          ? w.context_tags.filter((id) => CONTEXT_TAG_IDS.includes(id)).slice(0, CONTEXT_TAG_MAX)
          : [];
        return tags.length ? { context_tags: tags } : {};
      })(),
    }));
  // datas repetidas dentro do próprio arquivo: a última vence
  const byDate = new Map();
  for (const l of logs) byDate.set(l.date, l);
  const clean = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (clean.length === 0) {
    return { error: "Nenhuma pesagem válida encontrada no arquivo." };
  }
  return { logs: clean, settings: parseSettings(parsed) };
}
