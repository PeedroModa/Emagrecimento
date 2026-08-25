import { useMemo, useState, useRef } from "react";
import { Weight, Target, Ruler, Upload } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useWeighIns } from "../hooks/useWeighIns.js";
import { useSettings } from "../hooks/useSettings.js";
import {
  computeSignalRead, computeLastChange, computeTrend, navyBodyFat, bmi, bmiCategory, fmtDateBR,
} from "../lib/calculations.js";
import { parseImportJSON } from "../lib/backup.js";
import WeighForm from "../components/weigh/WeighForm.jsx";
import SignalCard from "../components/weigh/SignalCard.jsx";
import LastChangeCard from "../components/weigh/LastChangeCard.jsx";
import SectionHeader from "../components/layout/SectionHeader.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useToast, Toast } from "../components/ui/Toast.jsx";

function StatChip({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--t2)", fontSize: ".82rem" }}>
      {icon}
      <span className="num" style={{ color: "var(--t1)", fontWeight: 600 }}>{value}</span>
      <span style={{ fontFamily: "var(--font-condensed)" }}>{label}</span>
    </div>
  );
}

export default function Hoje() {
  const { user } = useAuth();
  const { weighIns, loading, error, retry, addOrReplace, importMerge } = useWeighIns();
  const { settings, save } = useSettings();
  const { toast, show } = useToast();
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const sorted = weighIns; // já vem ordenado por data
  const hasWeights = sorted.length > 0;
  const goal = settings.goal_kg;
  const startWeight = sorted[0]?.weight ?? null;
  const last = sorted[sorted.length - 1];
  const currentWeight = last?.weight ?? null;
  const totalLost = hasWeights ? +(startWeight - currentWeight).toFixed(1) : null;
  const totalToLose = hasWeights ? startWeight - goal : null;
  const progressPct = hasWeights && totalToLose > 0 ? Math.max(0, Math.min(100, (totalLost / totalToLose) * 100)) : 0;

  const bfNow = last ? navyBodyFat(last.waist, last.neck, settings.height_cm) : null;
  const bmiNow = hasWeights ? bmi(currentWeight, settings.height_cm) : null;
  const bmiCat = bmiCategory(bmiNow);

  const signalRead = useMemo(() => computeSignalRead(sorted), [sorted]);
  const lastChange = useMemo(() => computeLastChange(sorted), [sorted]);
  const trend = useMemo(() => computeTrend(sorted, goal, settings.height_cm), [sorted, goal, settings.height_cm]);

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
      setConfirm({
        title: "Importar dados do painel antigo?",
        message: `Encontrei ${result.logs.length} pesagens válidas no arquivo${result.goal ? `, meta ${result.goal}kg` : ""}${result.bfTarget ? ` e alvo de ${result.bfTarget}% de gordura` : ""}. Importar tudo agora?`,
        onConfirm: async () => {
          setConfirm(null);
          setImporting(true);
          const { error: err } = await importMerge(result.logs, user.id);
          if (!err && (result.goal || result.bfTarget)) {
            save({
              ...(result.goal ? { goal_kg: result.goal } : {}),
              ...(result.bfTarget ? { bf_target: result.bfTarget } : {}),
            }, user.id);
          }
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
        <div className="skeleton" style={{ height: 180, marginBottom: 16 }} />
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
          {hasWeights
            ? <>{startWeight} kg → <span className="num">{goal} kg</span> · {settings.bf_target}% gordura</>
            : "registre sua primeira pesagem para começar"}
        </p>
      </div>

      {/* Hero: medidor + progresso */}
      <div className="flex-row" style={{ gap: 28, marginBottom: 24 }}>
        <div className="gauge">
          <div className="hero-num">{hasWeights ? currentWeight : "--"}</div>
          <div style={{ fontSize: ".72rem", color: "var(--t2)", marginTop: 4, letterSpacing: ".08em", fontFamily: "var(--font-condensed)" }}>KG ATUAL</div>
          {bfNow != null && <div className="num" style={{ fontSize: ".72rem", color: "var(--good)", marginTop: 6 }}>~{bfNow}% gordura</div>}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".82rem", color: "var(--t2)", marginBottom: 6 }}>
            <span>{!hasWeights ? "--" : totalLost >= 0 ? `${totalLost} kg perdidos` : `${Math.abs(totalLost)} kg acima do início`}</span>
            <span>{!hasWeights ? "--" : totalToLose > 0 ? `${Math.max(0, +(currentWeight - goal).toFixed(1))} kg até a meta` : "meta atingida"}</span>
          </div>
          <div className="goal-track">
            <div className="goal-fill" style={{ width: `${hasWeights ? progressPct : 0}%` }} />
          </div>
          <div className="flex-row" style={{ gap: 18, marginTop: 16 }}>
            <StatChip icon={<Weight size={14} />} label="pesagens" value={sorted.length} />
            {trend && <StatChip icon={<Target size={14} />} label="kg/sem" value={trend.lossPerWeek > 0 ? `-${trend.lossPerWeek}` : `+${Math.abs(trend.lossPerWeek)}`} />}
            {bmiNow != null && <StatChip icon={<Ruler size={14} />} label={`IMC · ${bmiCat.label}`} value={bmiNow} />}
          </div>
        </div>
      </div>

      {/* Onboarding de migração: primeiro acesso com banco vazio */}
      {!hasWeights && (
        <div className="card" style={{ borderLeft: "3px solid var(--good)" }}>
          <div className="card-label">Vindo do painel antigo?</div>
          <p style={{ fontSize: ".87rem", color: "var(--t2)", lineHeight: 1.55, marginBottom: 12 }}>
            Se você exportou o JSON do painel no Claude, importe aqui e todo o histórico, a meta e o alvo de gordura entram de uma vez.
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
        <SectionHeader title="Registrar pesagem" subtitle="uma pesagem por data — sábado é o ritual" />
        <WeighForm onSubmit={handleSubmit} saving={saving} />
      </div>

      <SignalCard signalRead={signalRead} />
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
