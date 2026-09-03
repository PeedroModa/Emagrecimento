import { useMemo, useState, useRef, useCallback } from "react";
import { Weight, Upload } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useWeighIns } from "../hooks/useWeighIns.js";
import { useSettings } from "../hooks/useSettings.js";
import { useAppState } from "../hooks/useAppState.js";
import { useInsightState } from "../hooks/useInsightState.js";
import { computeSignalRead, computeLastChange, fmtDateBR, todayISO } from "../lib/calculations.js";
import { buildInsightContext, runInsights, rankInsights, computeInvestigations } from "../lib/insights/index.js";
import { parseImportJSON } from "../lib/backup.js";
import WeighForm from "../components/weigh/WeighForm.jsx";
import SignalCard from "../components/weigh/SignalCard.jsx";
import LastChangeCard from "../components/weigh/LastChangeCard.jsx";
import SectionHeader from "../components/layout/SectionHeader.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useToast, Toast } from "../components/ui/Toast.jsx";
import InsightFeed from "../components/insights/InsightFeed.jsx";
import InvestigationsList from "../components/insights/InvestigationsList.jsx";
import SinceLastVisit from "../components/insights/SinceLastVisit.jsx";
import OscillationBand from "../components/insights/OscillationBand.jsx";

const WEEKDAY_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function todayLongLabel() {
  const iso = todayISO();
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAY_LONG[d.getUTCDay()]}, ${fmtDateBR(iso)}`;
}

export default function Hoje() {
  const { user } = useAuth();
  const { weighIns, loading, error, retry, addOrReplace, importMerge, setContextTags, update } = useWeighIns();
  const { settings, save } = useSettings();
  const { toast, show } = useToast();
  const { previousVisitAt } = useAppState(user?.id);
  const { statesByKey, markSeen, dismiss } = useInsightState(user?.id);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const sorted = weighIns; // já vem ordenado por data
  const hasWeights = sorted.length > 0;
  const last = sorted[sorted.length - 1];

  const signalRead = useMemo(() => computeSignalRead(sorted), [sorted]);
  const lastChange = useMemo(() => computeLastChange(sorted), [sorted]);

  const insightCtx = useMemo(
    () => buildInsightContext({ weighIns: sorted, settings, today: todayISO() }),
    [sorted, settings]
  );
  const investigations = useMemo(() => computeInvestigations(insightCtx), [insightCtx]);
  const rankedInsights = useMemo(() => {
    const fired = runInsights(insightCtx);
    return rankInsights(fired, statesByKey, { limit: 5 });
  }, [insightCtx, statesByKey]);

  const handleSeen = useCallback((insights) => markSeen(insights), [markSeen]);
  const handleDismiss = useCallback(async (insight) => {
    const { error: err } = await dismiss(insight);
    if (err) show(err, "error");
  }, [dismiss, show]);

  const showTagPrompt = signalRead.status === "ok" && signalRead.absZ >= 1 && last?.context_tags === null;

  async function handleSaveContext(tags, note) {
    const { error: err } = await setContextTags(last.id, tags);
    if (err) { show(err, "error"); return; }
    if (note?.trim()) await update(last.id, { ...last, note: note.trim().slice(0, 80) }, user.id);
    show("Contexto salvo.");
  }

  async function handleSkipContext() {
    await setContextTags(last.id, []);
  }

  async function doSave(entry) {
    setSaving(true);
    const { error: err } = await addOrReplace(entry, user.id);
    setSaving(false);
    if (err) { show(err, "error"); return false; }
    show("Pesagem registrada.");
    return true;
  }

  async function handleSubmit(entry) {
    const existing = sorted.find((w) => w.date === entry.date);
    if (existing) {
      return new Promise((resolve) => {
        setConfirm({
          title: "Substituir pesagem?",
          message: `Já existe uma pesagem em ${fmtDateBR(entry.date)} (${existing.weight}kg). Substituir pelo novo registro?`,
          onConfirm: async () => {
            setConfirm(null);
            resolve(await doSave(entry));
          },
          onCancel: () => { setConfirm(null); resolve(false); },
        });
      });
    }
    return doSave(entry);
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = parseImportJSON(reader.result);
      if (result.error) { show(result.error, "error"); return; }
      const s = result.settings;
      const parts = [];
      if (s.goal_kg) parts.push(`meta ${s.goal_kg}kg`);
      if (s.bf_target) parts.push(`alvo de ${s.bf_target}% de gordura`);
      const hasMoreProfile = Object.keys(s).some((k) => k !== "goal_kg" && k !== "bf_target");
      setConfirm({
        title: "Importar dados do painel antigo?",
        message: `Encontrei ${result.logs.length} pesagens válidas no arquivo${parts.length ? `, ${parts.join(" e ")}` : ""}${hasMoreProfile ? " e outras configurações de perfil" : ""}. Importar tudo agora?`,
        onConfirm: async () => {
          setConfirm(null);
          setImporting(true);
          const { error: err } = await importMerge(result.logs, user.id);
          if (!err && Object.keys(s).length) save(s, user.id);
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
          <h1 className="page-title">Hoje</h1>
          <p className="page-sub">carregando suas pesagens...</p>
        </div>
        <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-hdr">
          <h1 className="page-title">Hoje</h1>
        </div>
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
        <h1 className="page-title">Hoje</h1>
        <p className="page-sub">
          {hasWeights ? todayLongLabel() : "registre sua primeira pesagem para começar"}
        </p>
      </div>

      {hasWeights && (
        <div className="declaration">
          <div className="decl-glow" aria-hidden="true" />
          <div className="decl-row">
            <span className="decl-num num">{last.weight}</span>
            <span className="decl-unit">kg</span>
            {lastChange && (
              <span className="decl-delta" style={{ color: signalRead.status === "ok" ? signalRead.color : "var(--t2)" }}>
                {lastChange.diff > 0 ? "+" : ""}{lastChange.diff}kg desde a pesagem anterior
              </span>
            )}
          </div>

          {signalRead.status === "ok" && (
            <>
              <p className="decl-sentence">{signalRead.detail}</p>
              <div className="band-wrap">
                <div className="band-label-row">
                  <span className="band-title">Sua faixa de oscilação pessoal</span>
                  <span className="band-value">±{signalRead.noiseBand}kg</span>
                </div>
                <OscillationBand z={signalRead.z} noiseBand={signalRead.noiseBand} size="large" />
              </div>
            </>
          )}
        </div>
      )}

      <SinceLastVisit previousVisitAt={previousVisitAt} weighIns={sorted} />

      {/* Onboarding de migração: primeiro acesso com banco vazio */}
      {!hasWeights && (
        <div className="card" style={{ borderLeft: "3px solid var(--good)" }}>
          <div className="card-label">Vindo do painel antigo?</div>
          <p style={{ fontSize: ".87rem", color: "var(--t2)", lineHeight: 1.55, marginBottom: 12 }}>
            Se você exportou o JSON do painel no Claude, importe aqui e todo o histórico, a meta e o perfil entram de uma vez.
          </p>
          <button className="btn-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> {importing ? "Importando..." : "Importar dados do painel antigo"}
          </button>
          <input
            ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { handleImportFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>
      )}

      {/* Registrar pesagem */}
      <div className="card">
        <SectionHeader title="Registrar pesagem" subtitle="uma pesagem por dia, de manhã — quanto mais denso, mais preciso" />
        <WeighForm onSubmit={handleSubmit} saving={saving} />
      </div>

      <InsightFeed insights={rankedInsights} onDismiss={handleDismiss} onSeen={handleSeen} />
      <InvestigationsList items={investigations} />

      <SignalCard
        signalRead={signalRead} showTagPrompt={showTagPrompt}
        onSaveContext={handleSaveContext} onSkipContext={handleSkipContext}
      />
      <LastChangeCard lastChange={lastChange} />

      {!hasWeights && (
        <EmptyState
          icon={<Weight size={28} />}
          title="Tudo começa com um número"
          text="Registre o peso de hoje no formulário acima. A cada pesagem o painel aprende sua oscilação e passa a dizer o que é progresso real e o que é só água."
        />
      )}

      {confirm && <ConfirmModal {...confirm} />}
      <Toast toast={toast} />
    </div>
  );
}
