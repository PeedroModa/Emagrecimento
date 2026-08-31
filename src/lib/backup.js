import { todayISO, CONTEXT_TAG_MAX } from "./calculations.js";
import { CONTEXT_TAG_IDS } from "./contextTags.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function buildExportJSON(weighIns, settings) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    goal: settings.goal_kg,
    bfTarget: settings.bf_target,
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

// Valida o JSON importado. Retorna { logs, goal, bfTarget } ou { error }.
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
  return {
    logs: clean,
    goal: typeof parsed.goal === "number" && parsed.goal > 0 && parsed.goal <= 400 ? parsed.goal : null,
    bfTarget: typeof parsed.bfTarget === "number" && parsed.bfTarget > 0 && parsed.bfTarget <= 60 ? parsed.bfTarget : null,
  };
}
