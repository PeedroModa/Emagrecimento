import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useWeighIns } from "../hooks/useWeighIns.js";
import { useSettings } from "../hooks/useSettings.js";
import { useMeasurements } from "../hooks/useMeasurements.js";
import {
  computeSeries, computeTrend, computeRecords, computeProjection, fmtDateBR,
  AVG_WINDOW_DAYS, TREND_WINDOW_OPTIONS, regressionWindowFor, trendRateChange,
} from "../lib/calculations.js";
import WeightChart from "../components/weigh/WeightChart.jsx";
import TrendCard from "../components/weigh/TrendCard.jsx";
import RecordsCard from "../components/weigh/RecordsCard.jsx";
import RecompCard from "../components/weigh/RecompCard.jsx";
import ProgressionBars from "../components/weigh/ProgressionBars.jsx";
import HistoryList from "../components/weigh/HistoryList.jsx";
import Comparator from "../components/weigh/Comparator.jsx";
import JourneyTimeline from "../components/weigh/JourneyTimeline.jsx";
import MeasurementForm from "../components/weigh/MeasurementForm.jsx";
import BodyMap from "../components/weigh/BodyMap.jsx";
import MeasurementHistoryList from "../components/weigh/MeasurementHistoryList.jsx";
import SectionHeader from "../components/layout/SectionHeader.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useToast, Toast } from "../components/ui/Toast.jsx";

// Etapa 4 da V2: a antiga "Evolução" vira "Jornada" — o mesmo histórico
// editável de sempre, mais a narrativa que os dados guardam (timeline de
// momentos) e uma forma de comparar você mesmo em dois pontos do tempo.
// Nenhuma funcionalidade foi perdida: editar/excluir pesagem, gráfico,
// tendência, recordes e recomposição continuam aqui, intactos.
export default function Jornada() {
  const { user } = useAuth();
  const { weighIns, loading, error, retry, update, remove, setContextTags } = useWeighIns();
  const { settings } = useSettings();
  const { measurements, addOrReplace: addOrReplaceMeasurement, update: updateMeasurement, remove: removeMeasurement } = useMeasurements();
  const { toast, show } = useToast();
  const [confirm, setConfirm] = useState(null);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  // Preferência de visualização apenas: não persiste e não toca nas pesagens.
  const [windowDays, setWindowDays] = useState(AVG_WINDOW_DAYS);

  const goal = settings.goal_kg;
  const series = useMemo(
    () => computeSeries(weighIns, settings.height_cm, windowDays),
    [weighIns, settings.height_cm, windowDays]
  );
  const trend = useMemo(
    () => computeTrend(weighIns, goal, settings.height_cm, regressionWindowFor(windowDays)),
    [weighIns, goal, settings.height_cm, windowDays]
  );
  const projection = useMemo(
    () => computeProjection(weighIns, goal, regressionWindowFor(windowDays)),
    [weighIns, goal, windowDays]
  );
  const records = useMemo(() => computeRecords(weighIns), [weighIns]);

  const bfEntries = series.filter((s) => s.bf != null);
  const bfFirst = bfEntries[0];
  const bfLast = bfEntries[bfEntries.length - 1];
  const leanDelta = bfFirst && bfLast && bfEntries.length >= 2 ? +(bfLast.magra - bfFirst.magra).toFixed(1) : null;
  const fatDelta = bfFirst && bfLast && bfEntries.length >= 2 ? +(bfLast.gordura - bfFirst.gordura).toFixed(1) : null;
  const waistDelta = (() => {
    const ws = weighIns.filter((w) => w.waist);
    return ws.length >= 2 ? +(ws[ws.length - 1].waist - ws[0].waist).toFixed(1) : null;
  })();
  const sample = bfEntries.length;

  const latest = weighIns[weighIns.length - 1];
  const rateChange = windowDays === AVG_WINDOW_DAYS ? trendRateChange(weighIns, goal, settings.height_cm) : null;
  const showTrendPrompt = !!rateChange && latest?.context_tags === null;

  async function handleSaveMeasurement(entry) {
    setSavingMeasurement(true);
    const { error: err } = await addOrReplaceMeasurement(entry, user.id);
    setSavingMeasurement(false);
    if (err) { show(err, "error"); return false; }
    show("Medidas salvas.");
    return true;
  }

  async function handleEditMeasurement(id, next) {
    const other = measurements.find((m) => m.date === next.date && m.id !== id);
    if (other) {
      show("Já existe outra medição nessa data. Edite ou remova a outra primeiro.", "error");
      return false;
    }
    const { error: err } = await updateMeasurement(id, next, user.id);
    if (err) { show(err, "error"); return false; }
    show("Medidas atualizadas.");
    return true;
  }

  function handleDeleteMeasurement(m) {
    setConfirm({
      title: "Remover medidas?",
      message: `Remover a medição de ${fmtDateBR(m.date)}? Essa ação não tem desfazer.`,
      confirmLabel: "Remover",
      onConfirm: async () => {
        setConfirm(null);
        const { error: err } = await removeMeasurement(m.id);
        if (err) show(err, "error");
        else show("Medição removida.");
      },
      onCancel: () => setConfirm(null),
    });
  }

  async function handleSaveContext(tags, note) {
    const { error: err } = await setContextTags(latest.id, tags);
    if (err) { show(err, "error"); return; }
    if (note?.trim()) await update(latest.id, { ...latest, note: note.trim().slice(0, 80) }, user.id);
    show("Contexto salvo.");
  }

  async function handleSkipContext() {
    await setContextTags(latest.id, []);
  }

  async function handleEdit(id, next) {
    const other = weighIns.find((w) => w.date === next.date && w.id !== id);
    if (other) {
      show("Já existe outra pesagem nessa data. Edite ou remova a outra primeiro.", "error");
      return false;
    }
    const { error: err } = await update(id, next, user.id);
    if (err) { show(err, "error"); return false; }
    show("Pesagem atualizada.");
    return true;
  }

  function handleDelete(w) {
    setConfirm({
      title: "Remover pesagem?",
      message: `Remover a pesagem de ${fmtDateBR(w.date)} (${w.weight}kg)? Essa ação não tem desfazer.`,
      confirmLabel: "Remover",
      onConfirm: async () => {
        setConfirm(null);
        const { error: err } = await remove(w.id);
        if (err) show(err, "error");
        else show("Pesagem removida.");
      },
      onCancel: () => setConfirm(null),
    });
  }

  if (loading) {
    return (
      <div>
        <div className="page-hdr">
          <h1 className="page-title">Jornada</h1>
          <p className="page-sub">carregando histórico...</p>
        </div>
        <div className="skeleton" style={{ height: 300, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-hdr"><h1 className="page-title">Jornada</h1></div>
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
        <h1 className="page-title">Jornada</h1>
        <p className="page-sub">{weighIns.length} {weighIns.length === 1 ? "pesagem registrada" : "pesagens registradas"}</p>
      </div>

      <JourneyTimeline sorted={weighIns} records={records} />

      {/* Gráfico de linha */}
      <div className="card">
        <div className="flex-between" style={{ gap: 12, flexWrap: "wrap" }}>
          <SectionHeader title="Curva de peso" subtitle={`peso · tendência de ${windowDays} dias${projection ? " · projeção" : ""} · linha da meta`} />
          <label className="trend-window">
            <span>Tendência:</span>
            <select
              value={windowDays}
              aria-label="Janela de análise da tendência"
              onChange={(e) => setWindowDays(+e.target.value)}
            >
              {TREND_WINDOW_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} dias</option>
              ))}
            </select>
          </label>
        </div>
        {series.length >= 2 ? (
          <WeightChart series={series} goal={goal} windowDays={windowDays} projection={projection} />
        ) : (
          <EmptyState
            icon={<LineChart size={28} />}
            title="O gráfico acende com 2 pesagens"
            text={series.length === 1
              ? "Você tem 1 pesagem. Registre a próxima e a curva de evolução aparece aqui, com a linha de tendência e a linha da meta."
              : "Registre pesagens na página Hoje e a curva de evolução aparece aqui, com a linha de tendência e a linha da meta."}
          />
        )}
      </div>

      <Comparator weighIns={weighIns} />

      <TrendCard
        trend={trend} goal={goal} windowDays={windowDays}
        rateChange={rateChange} showTagPrompt={showTrendPrompt}
        onSaveContext={handleSaveContext} onSkipContext={handleSkipContext}
      />
      <RecordsCard records={records} />
      <RecompCard fatDelta={fatDelta} leanDelta={leanDelta} waistDelta={waistDelta} sample={sample} />
      <ProgressionBars series={series} goal={goal} />

      <BodyMap measurements={measurements} heightCm={settings.height_cm} />

      <div className="card">
        <SectionHeader title="Medidas corporais" subtitle="sessão mensal — cintura, pescoço, quadril, peito, braço, coxa" />
        <MeasurementForm onSubmit={handleSaveMeasurement} saving={savingMeasurement} />
        {measurements.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--bdr-soft)" }}>
            <div className="small-label" style={{ marginBottom: 10 }}>histórico de medições</div>
            <MeasurementHistoryList measurements={measurements} onEdit={handleEditMeasurement} onDelete={handleDeleteMeasurement} />
          </div>
        )}
      </div>

      <div className="card">
        <SectionHeader title="Histórico" subtitle="edite ou remova qualquer registro" />
        <HistoryList series={series} onEdit={handleEdit} onDelete={handleDelete} />
      </div>

      {confirm && <ConfirmModal {...confirm} />}
      <Toast toast={toast} />
    </div>
  );
}
