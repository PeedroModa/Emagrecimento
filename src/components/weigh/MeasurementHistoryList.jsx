import { useState } from "react";
import { Pencil, Trash2, Check, X, Ruler } from "lucide-react";
import { fmtDateBR, parseDecimal, todayISO } from "../../lib/calculations.js";
import EmptyState from "../ui/EmptyState.jsx";

const FIELDS = [
  { key: "waist", label: "Cintura (cm)" },
  { key: "neck", label: "Pescoço (cm)" },
  { key: "hip", label: "Quadril (cm)" },
  { key: "chest", label: "Peito (cm)" },
  { key: "arm", label: "Braço (cm)" },
  { key: "thigh", label: "Coxa (cm)" },
];

function EditRow({ entry, onSave, onCancel, saving }) {
  const [date, setDate] = useState(entry.date);
  const [values, setValues] = useState(() => {
    const v = {};
    for (const f of FIELDS) v[f.key] = entry[f.key] != null ? String(entry[f.key]) : "";
    return v;
  });
  const [note, setNote] = useState(entry.note || "");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!date) { setErr("Informe a data."); return; }
    const next = { date };
    let any = false;
    for (const f of FIELDS) {
      const v = parseDecimal(values[f.key]);
      if (values[f.key] && !isNaN(v) && v > 0) { next[f.key] = v; any = true; }
    }
    if (!any) { setErr("Preencha ao menos uma medida."); return; }
    if (note.trim()) next.note = note.trim().slice(0, 120);
    await onSave(next);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
      <label>
        <span className="small-label">data</span>
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="grid-auto">
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span className="small-label">{f.label}</span>
            <input
              type="text" inputMode="decimal" placeholder="—"
              value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <label>
        <span className="small-label">nota</span>
        <input type="text" value={note} maxLength={120} placeholder="—" onChange={(e) => setNote(e.target.value)} />
      </label>
      {err && <p className="msg-error">{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn-secondary" onClick={onCancel}><X size={14} /> Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}><Check size={14} /> {saving ? "Salvando..." : "Salvar"}</button>
      </div>
    </form>
  );
}

export default function MeasurementHistoryList({ measurements, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const reversed = [...measurements].reverse();

  if (measurements.length === 0) {
    return (
      <EmptyState
        icon={<Ruler size={28} />}
        title="Nenhuma medição ainda"
        text="Registre sua primeira sessão de medidas acima — o histórico completo aparece aqui, com edição e exclusão."
      />
    );
  }

  return (
    <div>
      {reversed.map((m) => {
        const isEditing = editingId === m.id;
        const summary = FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label.split(" ")[0]} ${m[f.key]}cm`);
        return (
          <div key={m.id} className="history-item">
            {isEditing ? (
              <EditRow
                entry={m}
                saving={savingId === m.id}
                onCancel={() => setEditingId(null)}
                onSave={async (next) => {
                  setSavingId(m.id);
                  const ok = await onEdit(m.id, next);
                  setSavingId(null);
                  if (ok) setEditingId(null);
                }}
              />
            ) : (
              <>
                <div className="history-row">
                  <span className="history-date">{fmtDateBR(m.date)}</span>
                  <div className="history-actions" style={{ marginLeft: "auto" }}>
                    <button className="btn-ghost" aria-label={`Editar medidas de ${fmtDateBR(m.date)}`} onClick={() => setEditingId(m.id)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost btn-danger-ghost" aria-label={`Remover medidas de ${fmtDateBR(m.date)}`} onClick={() => onDelete(m)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {summary.length > 0 && <div className="history-meta">{summary.map((s) => <span key={s}>{s}</span>)}</div>}
                {m.note && <div className="history-note">"{m.note}"</div>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
