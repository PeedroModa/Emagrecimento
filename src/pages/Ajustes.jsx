import { useState, useRef } from "react";
import { Download, Upload, Copy, LogOut, KeyRound } from "lucide-react";
import { useAuth, signOut } from "../hooks/useAuth.js";
import { useWeighIns } from "../hooks/useWeighIns.js";
import { useSettings } from "../hooks/useSettings.js";
import { parseDecimal, todayISO, isValidBirthDate } from "../lib/calculations.js";
import { buildExportJSON, downloadJSON, parseImportJSON } from "../lib/backup.js";
import SectionHeader from "../components/layout/SectionHeader.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useToast, Toast } from "../components/ui/Toast.jsx";
import TrocarSenha from "./TrocarSenha.jsx";

function NumField({ label, value, onCommit, suffix, width = 110 }) {
  const [draft, setDraft] = useState(null);
  return (
    <label style={{ width }}>
      <span className="small-label">{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <input
          type="text" inputMode="decimal"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft == null) return;
            const v = parseDecimal(draft);
            setDraft(null);
            if (!isNaN(v)) onCommit(v);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
        {suffix && <span style={{ fontSize: ".8rem", color: "var(--t2)" }}>{suffix}</span>}
      </div>
    </label>
  );
}

function Pill({ active, onClick, children }) {
  return <button type="button" className={"toggle-pill" + (active ? " active" : "")} onClick={onClick}>{children}</button>;
}

export default function Ajustes() {
  const { user } = useAuth();
  const { weighIns, importMerge } = useWeighIns();
  const { settings, loading, error, retry, save, saveState, dismissSaveError } = useSettings();
  const { toast, show } = useToast();
  const [confirm, setConfirm] = useState(null);
  const [importing, setImporting] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const fileRef = useRef(null);

  const set = (patch) => save(patch, user.id);

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  async function copyExport() {
    const json = buildExportJSON(weighIns, settings);
    try {
      await navigator.clipboard.writeText(json);
      show("JSON copiado! Cole num arquivo .json e guarde.");
    } catch {
      show("Não consegui copiar. Use o botão Baixar .json.", "warn");
    }
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = parseImportJSON(reader.result);
      if (result.error) { show(result.error, "error"); return; }
      setConfirm({
        title: "Importar pesagens?",
        message: `Importar ${result.logs.length} pesagens? Elas serão mescladas com as ${weighIns.length} atuais (datas repetidas usam a versão do arquivo).`,
        confirmLabel: "Importar",
        onConfirm: async () => {
          setConfirm(null);
          setImporting(true);
          const { error: err } = await importMerge(result.logs, user.id);
          if (!err && Object.keys(result.settings).length) set(result.settings);
          setImporting(false);
          if (err) show(err, "error");
          else show(`${result.logs.length} pesagens importadas.`);
        },
        onCancel: () => setConfirm(null),
      });
    };
    reader.readAsText(file);
  }

  if (loading) {
    return (
      <div>
        <div className="page-hdr">
          <h1 className="page-title">Ajustes</h1>
          <p className="page-sub">carregando configurações...</p>
        </div>
        <div className="skeleton" style={{ height: 160, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-hdr"><h1 className="page-title">Ajustes</h1></div>
        <EmptyState title="Não consegui carregar" text={error} />
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="btn-secondary" onClick={retry}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-hdr">
        <h1 className="page-title">Ajustes</h1>
        <p className="page-sub">{user?.email}</p>
      </div>

      {saveState === "error" && (
        <div className="card" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="msg-error">Não consegui salvar a última alteração — ela foi revertida. Verifique a conexão e ajuste de novo.</p>
          <button className="btn-ghost" onClick={dismissSaveError}>ok</button>
        </div>
      )}

      <div className="card">
        <SectionHeader title="Metas" subtitle="peso alvo e % de gordura desejado" />
        <div className="flex-row" style={{ gap: 16 }}>
          <NumField label="peso meta" value={settings.goal_kg} suffix="kg"
            onCommit={(v) => v > 0 && v <= 400 && set({ goal_kg: +v.toFixed(1) })} />
          <NumField label="% gordura alvo" value={settings.bf_target} suffix="%"
            onCommit={(v) => v > 0 && v <= 60 && set({ bf_target: +v.toFixed(1) })} />
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Perfil físico" subtitle="a idade vem da data de nascimento e se atualiza sozinha" />
        <div className="flex-row" style={{ gap: 16, alignItems: "flex-end" }}>
          <NumField label="altura" value={settings.height_cm} suffix="cm"
            onCommit={(v) => v >= 100 && v <= 250 && set({ height_cm: Math.round(v) })} />
          <label style={{ width: 170 }}>
            <span className="small-label">data de nascimento</span>
            <input
              type="date" value={(settings.birth_date || "").slice(0, 10)}
              min="1906-01-01" max={todayISO()}
              onChange={(e) => { if (isValidBirthDate(e.target.value)) set({ birth_date: e.target.value }); }}
            />
            <span style={{ fontSize: ".76rem", color: "var(--t3)", display: "block", marginTop: 3 }}>
              {settings.age} anos — calculado sozinho
            </span>
          </label>
          <div>
            <span className="small-label">sexo</span>
            <div className="flex-row" style={{ gap: 4 }}>
              <Pill active={settings.sex === "M"} onClick={() => set({ sex: "M" })}>Masc</Pill>
              <Pill active={settings.sex === "F"} onClick={() => set({ sex: "F" })}>Fem</Pill>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Treino e déficit" subtitle="alimentam a calculadora de calorias" />
        <div style={{ marginBottom: 14 }}>
          <span className="small-label">treinos por semana</span>
          <div className="flex-row" style={{ gap: 4, marginTop: 4 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Pill key={d} active={settings.train_days === d} onClick={() => set({ train_days: d })}>{d}×</Pill>
            ))}
          </div>
        </div>
        <div>
          <span className="small-label">déficit calórico</span>
          <div className="flex-row" style={{ gap: 4, marginTop: 4 }}>
            {[10, 15, 20].map((d) => (
              <Pill key={d} active={settings.deficit_pct === d} onClick={() => set({ deficit_pct: d })}>{d}%</Pill>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Backup dos dados" subtitle="o arquivo é seu — guarde uma cópia de tempos em tempos" />
        <div className="flex-row">
          <button className="btn-primary" onClick={() => downloadJSON(buildExportJSON(weighIns, settings))}>
            <Download size={15} /> Baixar .json
          </button>
          <button className="btn-secondary" onClick={copyExport}>
            <Copy size={15} /> Copiar dados
          </button>
          <button className="btn-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> {importing ? "Importando..." : "Importar"}
          </button>
          <input
            ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { handleImportFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>
        <p style={{ fontSize: ".76rem", color: "var(--t3)", marginTop: 10, lineHeight: 1.5 }}>
          O import mescla por data: pesagens do arquivo vencem quando a data se repete. O formato é o mesmo do painel antigo.
        </p>
      </div>

      <div className="card">
        <SectionHeader title="Senha" subtitle="usada no login por e-mail e senha" />
        {trocandoSenha ? (
          <TrocarSenha
            onDone={() => { setTrocandoSenha(false); show("Senha alterada."); }}
            onCancel={() => setTrocandoSenha(false)}
          />
        ) : (
          <button className="btn-secondary" onClick={() => setTrocandoSenha(true)}>
            <KeyRound size={15} /> Trocar senha
          </button>
        )}
      </div>

      <div className="card">
        <SectionHeader title="Sessão" />
        <button
          className="btn-secondary"
          onClick={() => setConfirm({
            title: "Sair da conta?",
            message: "Seus dados ficam guardados no Supabase. Para voltar, entre de novo com seu e-mail e senha.",
            confirmLabel: "Sair",
            onConfirm: async () => { setConfirm(null); await signOut(); },
            onCancel: () => setConfirm(null),
          })}
        >
          <LogOut size={15} /> Sair
        </button>
      </div>

      {confirm && <ConfirmModal {...confirm} />}
      <Toast toast={toast} />
    </div>
  );
}
