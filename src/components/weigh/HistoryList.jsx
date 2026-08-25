import { useState } from "react";
import { Pencil, Trash2, Check, X, Weight } from "lucide-react";
import { fmtDateBR, parseDecimal, todayISO } from "../../lib/calculations.js";
import EmptyState from "../ui/EmptyState.jsx";

function EditRow({ entry, onSave, onCancel, saving }) {
  const [date, setDate] = useState(entry.date);
  const [weight, setWeight] = useState(String(entry.weight));
  const [waist, setWaist] = useState(entry.waist != null ? String(entry.waist) : "");
  const [neck, setNeck] = useState(entry.neck != null ? String(entry.neck) : "");
  const [note, setNote] = useState(entry.note || "");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const val = parseDecimal(weight);
    if (!val || val <= 0 || val > 400) { setErr("Peso inválido (0–400 kg)."); return; }
    if (!date) { setErr("Informe a data."); return; }
    const next = { date, weight: val };
    const w = parseDecimal(waist);
    const n = parseDecimal(neck);
    if (w > 0) next.waist = w;
    if (n > 0) next.neck = n;
    if (note.trim()) next.note = note.trim().slice(0, 80);
    await onSave(next);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label>
          <span className="small-label">data</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <span className="small-label">peso (kg)</span>
          <input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label>
          <span className="small-label">cintura (cm)</span>
          <input type="text" inputMode="decimal" value={waist} placeholder="—" onChange={(e) => setWaist(e.target.value)} />
        </label>
        <label>
          <span className="small-label">pescoço (cm)</span>
          <input type="text" inputMode="decimal" value={neck} placeholder="—" onChange={(e) => setNeck(e.target.value)} />
        </label>
      </div>
      <label>
        <span className="small-label">nota</span>
        <input type="text" value={note} maxLength={80} placeholder="—" onChange={(e) => setNote(e.target.value)} />
      </label>
      {err && <p className="msg-error">{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn-secondary" onClick={onCancel}><X size={14} /> Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}><Check size={14} /> {saving ? "Salvando..." : "Salvar"}</button>
      </div>
    </form>
  );
}

export default function HistoryList({ series, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const reversed = [...series].reverse();

  if (series.length === 0) {
    return (
      <EmptyState
        icon={<Weight size={28} />}
        title="Nenhuma pesagem ainda"
        text="Registre a primeira pesagem na página Hoje — o histórico completo aparece aqui, com edição e exclusão."
      />
    );
  }

  return (
    <div>
      {reversed.map((w, i) => {
        const prev = reversed[i + 1];
        const diff = prev ? +(w.weight - prev.weight).toFixed(1) : null;
        const diffColor = diff == null ? "var(--t2)" : diff < 0 ? "var(--good)" : diff > 0 ? "var(--accent)" : "var(--t2)";
        const isEditing = editingId === w.id;
        return (
          <div key={w.id} className="history-item">
            {isEditing ? (
              <EditRow
                entry={w}
                saving={savingId === w.id}
                onCancel={() => setEditingId(null)}
                onSave={async (next) => {
                  setSavingId(w.id);
                  const ok = await onEdit(w.id, next);
                  setSavingId(null);
                  if (ok) setEditingId(null);
                }}
              />
            ) : (
              <>
                <div className="history-row">
                  <span className="history-date">{fmtDateBR(w.date)}</span>
                  <span className="history-weight">{w.weight} kg</span>
                  {diff !== null && (
                    <span className="history-diff" style={{ color: diffColor }}>
                      {diff === 0 ? "=" : `${diff > 0 ? "+" : ""}${diff}`}
                    </span>
                  )}
                  <div className="history-actions" style={{ marginLeft: diff === null ? "auto" : 0 }}>
                    <button className="btn-ghost" aria-label={`Editar pesagem de ${fmtDateBR(w.date)}`} onClick={() => setEditingId(w.id)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost btn-danger-ghost" aria-label={`Remover pesagem de ${fmtDateBR(w.date)}`} onClick={() => onDelete(w)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {(w.bf != null || w.waist) && (
                  <div className="history-meta">
                    {w.waist && <span>cintura {w.waist}cm</span>}
                    {w.bf != null && <span>~{w.bf}% gordura</span>}
                    {w.magra != null && <span>{w.magra}kg magra</span>}
                  </div>
                )}
                {w.note && <div className="history-note">"{w.note}"</div>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
