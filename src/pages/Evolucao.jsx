import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useWeighIns } from "../hooks/useWeighIns.js";
import { useSettings } from "../hooks/useSettings.js";
import {
  computeSeries, computeTrend, computeRecords, fmtDateBR,
  AVG_WINDOW_DAYS, TREND_WINDOW_OPTIONS, trendWindowDaysFor,
} from "../lib/calculations.js";
import WeightChart from "../components/weigh/WeightChart.jsx";
import TrendCard from "../components/weigh/TrendCard.jsx";
import RecordsCard from "../components/weigh/RecordsCard.jsx";
import RecompCard from "../components/weigh/RecompCard.jsx";
import ProgressionBars from "../components/weigh/ProgressionBars.jsx";
import HistoryList from "../components/weigh/HistoryList.jsx";
import SectionHeader from "../components/layout/SectionHeader.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useToast, Toast } from "../components/ui/Toast.jsx";

export default function Evolucao() {
  const { user } = useAuth();
  const { weighIns, loading, error, retry, update, remove } = useWeighIns();
  const { settings } = useSettings();
  const { toast, show } = useToast();
  const [confirm, setConfirm] = useState(null);
  // Preferência de visualização apenas: não persiste e não toca nas pesagens.
  const [windowDays, setWindowDays] = useState(AVG_WINDOW_DAYS);

  const goal = settings.goal_kg;
  const series = useMemo(
    () => computeSeries(weighIns, settings.height_cm, windowDays),
    [weighIns, settings.height_cm, windowDays]
  );
  const trend = useMemo(
    () => computeTrend(weighIns, goal, settings.height_cm, trendWindowDaysFor(windowDays)),
    [weighIns, goal, settings.height_cm, windowDays]
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
          <h1 className="page-title">Evolução</h1>
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
        <div className="page-hdr"><h1 className="page-title">Evolução</h1></div>
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
        <h1 className="page-title">Evolução</h1>
        <p className="page-sub">{weighIns.length} {weighIns.length === 1 ? "pesagem registrada" : "pesagens registradas"}</p>
      </div>

      {/* Gráfico de linha */}
      <div className="card">
        <div className="flex-between" style={{ gap: 12, flexWrap: "wrap" }}>
          <SectionHeader title="Curva de peso" subtitle={`peso · tendência de ${windowDays} dias · linha da meta`} />
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
          <WeightChart series={series} goal={goal} windowDays={windowDays} />
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

      <TrendCard trend={trend} goal={goal} windowDays={windowDays} />
      <RecordsCard records={records} />
      <RecompCard fatDelta={fatDelta} leanDelta={leanDelta} waistDelta={waistDelta} />
      <ProgressionBars series={series} goal={goal} />

      <div className="card">
        <SectionHeader title="Histórico" subtitle="edite ou remova qualquer registro" />
        <HistoryList series={series} onEdit={handleEdit} onDelete={handleDelete} />
      </div>

      {confirm && <ConfirmModal {...confirm} />}
      <Toast toast={toast} />
    </div>
  );
}
