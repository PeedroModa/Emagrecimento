import { useAuth } from "../hooks/useAuth.js";
import { useWeighIns } from "../hooks/useWeighIns.js";
import { useSettings } from "../hooks/useSettings.js";
import CaloriesCard from "../components/nutrition/CaloriesCard.jsx";
import MacrosCard from "../components/nutrition/MacrosCard.jsx";
import SimulatorCard from "../components/nutrition/SimulatorCard.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

export default function Nutricao() {
  const { user } = useAuth();
  const { weighIns, loading: loadingW } = useWeighIns();
  const { settings, loading: loadingS, error, retry, save, saveState, dismissSaveError } = useSettings();

  const hasWeights = weighIns.length > 0;
  const currentWeight = hasWeights ? weighIns[weighIns.length - 1].weight : null;

  if (loadingW || loadingS) {
    return (
      <div>
        <div className="page-hdr">
          <h1 className="page-title">Nutrição</h1>
          <p className="page-sub">carregando...</p>
        </div>
        <div className="skeleton" style={{ height: 260, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-hdr"><h1 className="page-title">Nutrição</h1></div>
        <EmptyState title="Não consegui carregar" text={error} />
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="btn-secondary" onClick={retry}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  const onChange = (patch) => save(patch, user.id);

  return (
    <div>
      <div className="page-hdr">
        <h1 className="page-title">Nutrição</h1>
        <p className="page-sub">calorias, macros e ritmo — tudo ancorado no seu peso atual</p>
      </div>

      {saveState === "error" && (
        <div className="card" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="msg-error">Não consegui salvar a última alteração — ela foi revertida. Verifique a conexão e ajuste de novo.</p>
          <button className="btn-ghost" onClick={dismissSaveError}>ok</button>
        </div>
      )}

      <CaloriesCard settings={settings} onChange={onChange} currentWeight={currentWeight} hasWeights={hasWeights} />
      <MacrosCard settings={settings} onChange={onChange} currentWeight={currentWeight} hasWeights={hasWeights} />
      <SimulatorCard hasWeights={hasWeights} currentWeight={currentWeight} goal={settings.goal_kg} />
    </div>
  );
}
