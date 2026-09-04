import { useState } from "react";
import { Ruler } from "lucide-react";
import { todayISO, parseDecimal } from "../../lib/calculations.js";

const FIELDS = [
  { key: "waist", label: "Cintura (cm)" },
  { key: "neck", label: "Pescoço (cm)" },
  { key: "hip", label: "Quadril (cm)" },
  { key: "chest", label: "Peito (cm)" },
  { key: "arm", label: "Braço (cm)" },
  { key: "thigh", label: "Coxa (cm)" },
];

// Sessão completa de medidas — mensal, sem pressa. Todas as seis são
// opcionais (só é preciso preencher ao menos uma), sem afetar o registro
// diário de peso em nada.
export default function MeasurementForm({ onSubmit, saving }) {
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState({});
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldError("");
    if (!date) { setFieldError("Informe a data da medição."); return; }
    const entry = { date };
    let any = false;
    for (const f of FIELDS) {
      const raw = values[f.key];
      if (!raw) continue;
      const v = parseDecimal(raw);
      if (!isNaN(v) && v > 0) { entry[f.key] = v; any = true; }
    }
    if (!any) { setFieldError("Preencha ao menos uma medida."); return; }
    if (note.trim()) entry.note = note.trim().slice(0, 120);
    const ok = await onSubmit(entry);
    if (ok) { setValues({}); setNote(""); setDate(todayISO()); }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label style={{ display: "block", marginBottom: ".7rem", maxWidth: 160 }}>
        <span className="small-label">data</span>
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <div className="grid-auto" style={{ marginBottom: ".7rem" }}>
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span className="small-label">{f.label}</span>
            <input
              type="text" inputMode="decimal" placeholder="—"
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <label style={{ display: "block", marginBottom: ".7rem" }}>
        <span className="small-label">nota (opcional)</span>
        <input type="text" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
      </label>
      {fieldError && <p className="msg-error" style={{ marginBottom: 8 }}>{fieldError}</p>}
      <button type="submit" className="btn-primary" disabled={saving}>
        <Ruler size={16} /> {saving ? "Salvando..." : "Salvar medidas"}
      </button>
    </form>
  );
}
