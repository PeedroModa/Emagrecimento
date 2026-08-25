import { useState } from "react";
import { Plus, Ruler, X } from "lucide-react";
import { todayISO, parseDecimal } from "../../lib/calculations.js";

export default function WeighForm({ onSubmit, saving }) {
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [showMeasures, setShowMeasures] = useState(false);
  const [waist, setWaist] = useState("");
  const [neck, setNeck] = useState("");
  const [fieldError, setFieldError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldError("");
    const val = parseDecimal(weight);
    if (!val || val <= 0 || val > 400) {
      setFieldError("Informe um peso válido entre 0 e 400 kg.");
      return;
    }
    if (!date) {
      setFieldError("Informe a data da pesagem.");
      return;
    }
    const entry = { date, weight: val };
    const w = parseDecimal(waist);
    const n = parseDecimal(neck);
    if (w > 0) entry.waist = w;
    if (n > 0) entry.neck = n;
    if (note.trim()) entry.note = note.trim().slice(0, 80);
    const ok = await onSubmit(entry);
    if (ok) {
      setWeight(""); setWaist(""); setNeck(""); setNote("");
      setDate(todayISO());
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex-row">
        <label style={{ flex: "1 1 150px" }}>
          <span className="small-label">data</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label style={{ flex: "1 1 110px" }}>
          <span className="small-label">peso (kg)</span>
          <input
            type="text" inputMode="decimal" placeholder="ex: 104,5"
            value={weight} onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: "flex-end" }}>
          <Plus size={16} /> {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <label style={{ marginTop: ".6rem" }}>
        <span className="small-label">nota (opcional)</span>
        <input
          type="text" placeholder="viagem, resfriado, ressaca..."
          value={note} maxLength={80} onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {!showMeasures ? (
        <button
          type="button" onClick={() => setShowMeasures(true)}
          className="btn-ghost"
          style={{ marginTop: ".7rem", display: "flex", alignItems: "center", gap: 6, border: "1px dashed var(--bdr)", borderRadius: 8, padding: ".5rem .8rem", color: "var(--t2)", fontSize: ".85rem" }}
        >
          <Ruler size={14} /> Adicionar medidas (estimar % de gordura)
        </button>
      ) : (
        <div style={{ marginTop: ".7rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 8, alignItems: "end" }}>
            <label>
              <span className="small-label">cintura (cm)</span>
              <input type="text" inputMode="decimal" placeholder="ex: 100" value={waist} onChange={(e) => setWaist(e.target.value)} />
            </label>
            <label>
              <span className="small-label">pescoço (cm)</span>
              <input type="text" inputMode="decimal" placeholder="ex: 40" value={neck} onChange={(e) => setNeck(e.target.value)} />
            </label>
            <button
              type="button" className="btn-ghost" aria-label="Fechar medidas"
              onClick={() => { setShowMeasures(false); setWaist(""); setNeck(""); }}
            >
              <X size={16} />
            </button>
          </div>
          <p style={{ fontSize: ".75rem", color: "var(--t3)", marginTop: 6, lineHeight: 1.45 }}>
            Cintura na altura do umbigo, fita justa sem apertar, expirando normalmente. Pescoço logo abaixo do pomo de adão. Meça sempre no mesmo ponto.
          </p>
        </div>
      )}

      {fieldError && <p className="msg-error" style={{ marginTop: 8 }}>{fieldError}</p>}
    </form>
  );
}
