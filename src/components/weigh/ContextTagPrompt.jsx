import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { tagById } from "../../lib/contextTags.js";
import { CONTEXT_TAG_MAX } from "../../lib/calculations.js";

export default function ContextTagPrompt({ tagIds, question, showNoteButton, onSubmit, onSkip }) {
  const [selected, setSelected] = useState([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(tags) {
    setSaving(true);
    await onSubmit(tags, noteText);
    setSaving(false);
  }

  function toggle(id) {
    if (id === "nada") {
      submit(["nada"]);
      return;
    }
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= CONTEXT_TAG_MAX) return prev;
      return [...prev, id];
    });
  }

  async function skip() {
    setSaving(true);
    await onSkip();
    setSaving(false);
  }

  return (
    <div style={{ borderTop: "1px solid var(--bdr-soft)", paddingTop: 14, marginTop: 14 }}>
      <p style={{ fontSize: ".82rem", color: "var(--t2)", lineHeight: 1.5, marginBottom: 10 }}>
        {question} <span style={{ color: "var(--t3)" }}>(opcional, até {CONTEXT_TAG_MAX})</span>
      </p>
      <div className="flex-row" style={{ gap: 8, marginBottom: 12 }}>
        {tagIds.map((id) => {
          const tag = tagById(id);
          if (!tag) return null;
          const isSelected = selected.includes(id);
          const disabled = saving || (!isSelected && selected.length >= CONTEXT_TAG_MAX);
          return (
            <button
              key={id}
              type="button"
              className={`toggle-pill${isSelected ? " active" : ""}`}
              disabled={disabled}
              onClick={() => toggle(id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <tag.Icon size={13} />
              {tag.label}
            </button>
          );
        })}
      </div>

      {showNoteButton && (
        noteOpen ? (
          <label style={{ display: "block", marginBottom: 10 }}>
            <span className="small-label">nota</span>
            <input
              type="text" value={noteText} maxLength={80}
              placeholder="o que aconteceu?"
              onChange={(e) => setNoteText(e.target.value)}
            />
          </label>
        ) : (
          <button type="button" className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }} onClick={() => setNoteOpen(true)}>
            <Plus size={13} /> adicionar nota
          </button>
        )
      )}

      <div className="flex-between">
        {selected.length > 0 ? (
          <button type="button" className="btn-secondary" disabled={saving} onClick={() => submit(selected)}>
            <Check size={14} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        ) : <span />}
        <button type="button" className="btn-ghost" disabled={saving} onClick={skip} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          pular <X size={13} />
        </button>
      </div>
    </div>
  );
}
