import { Info } from "lucide-react";
import { computeCalories } from "../../lib/calculations.js";

export default function CaloriesCard({ settings, currentWeight, hasWeights }) {
  const calories = computeCalories({
    hasWeights,
    currentWeight,
    height: settings.height_cm,
    age: settings.age,
    sex: settings.sex,
    trainDays: settings.train_days,
    deficitPct: settings.deficit_pct,
  });

  return (
    <div className="card">
      <div className="card-label">Calorias · Mifflin-St Jeor</div>

      <div className="grid-auto" style={{ marginBottom: 14 }}>
        <div>
          <div className="small-label">peso atual</div>
          <div className="num" style={{ padding: ".6rem .75rem", background: "var(--card2)", borderRadius: 8, fontSize: ".9rem", color: "var(--t2)" }}>
            {hasWeights ? `${currentWeight} kg` : "--"}
          </div>
        </div>
        <div>
          <div className="small-label">altura · idade · sexo</div>
          <div className="num" style={{ padding: ".6rem .75rem", background: "var(--card2)", borderRadius: 8, fontSize: ".9rem", color: "var(--t2)" }}>
            {settings.height_cm}cm · {settings.age} · {settings.sex}
          </div>
          <div style={{ fontSize: ".7rem", color: "var(--t3)", marginTop: 3 }}>edita em Ajustes</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="small-label">
          treinos e déficit · <span style={{ color: "var(--good)" }}>{calories.factorLabel} (×{calories.factor})</span>
        </div>
        <div className="num" style={{ padding: ".6rem .75rem", background: "var(--card2)", borderRadius: 8, fontSize: ".9rem", color: "var(--t2)" }}>
          {settings.train_days}× por semana · déficit {settings.deficit_pct}%
        </div>
        <div style={{ fontSize: ".7rem", color: "var(--t3)", marginTop: 3 }}>edita em Ajustes</div>
      </div>

      <div className="flex-row" style={{ gap: 12, borderTop: "1px solid var(--bdr-soft)", paddingTop: 14 }}>
        <div style={{ flex: "1 1 90px" }}>
          <div className="small-label">BMR</div>
          <div className="big-num" style={{ color: "var(--t2)" }}>{calories.bmr ?? "--"}</div>
          <div style={{ fontSize: ".65rem", color: "var(--t3)" }}>kcal em repouso</div>
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <div className="small-label">gasto total (TDEE)</div>
          <div className="big-num" style={{ fontSize: "1.5rem" }}>{calories.tdee ?? "--"}</div>
          <div style={{ fontSize: ".65rem", color: "var(--t3)" }}>kcal para manter</div>
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <div className="small-label">alvo · déficit {settings.deficit_pct}%</div>
          <div className="big-num" style={{ fontSize: "1.5rem", color: "var(--accent)" }}>{calories.target ?? "--"}</div>
          <div style={{ fontSize: ".65rem", color: "var(--t3)" }}>kcal por dia</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12, fontSize: ".76rem", color: "var(--t3)", lineHeight: 1.45 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          {hasWeights
            ? "Estimativa. Recalcula sozinho conforme seu peso cai. Déficit de 15-20% preserva massa magra melhor que cortes agressivos — o valor absoluto importa menos que a consistência semana a semana."
            : "Registre uma pesagem para calcular. As calorias usam seu peso atual, que ainda não existe."}
        </span>
      </div>
    </div>
  );
}
