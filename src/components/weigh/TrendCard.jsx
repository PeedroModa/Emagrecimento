import { TrendingDown, TrendingUp, Minus, AlertTriangle, Info, Ruler } from "lucide-react";
import { rateStatus, regressionWeeksFor, AVG_WINDOW_DAYS, COMP_CONFIDENT_SAMPLE, RATE_HEALTHY, trendGaugePercent } from "../../lib/calculations.js";
import ContextTagPrompt from "./ContextTagPrompt.jsx";
import { TREND_TAG_IDS } from "../../lib/contextTags.js";

const RATE_ICONS = { rising: TrendingUp, below: Minus, fast: AlertTriangle, healthy: TrendingDown };
// Rótulos curtos para o banner de mudança de categoria — mesma taxonomia de rateStatus().key,
// só que resumida, já que o .text de cada categoria é uma frase completa (não encadeia bem).
const RATE_LABELS = { rising: "ganho de peso", below: "ritmo abaixo do esperado", fast: "ritmo acelerado demais", healthy: "ritmo saudável" };

export default function TrendCard({ trend, goal, windowDays = AVG_WINDOW_DAYS, rateChange, showTagPrompt, onSaveContext, onSkipContext }) {
  if (!trend) return null;
  const semanas = regressionWeeksFor(windowDays);
  const status = rateStatus(trend);
  const Icon = RATE_ICONS[status.key];
  const markerLeft = trendGaugePercent(trend.lossPerWeek);
  const zoneLeft = trendGaugePercent(RATE_HEALTHY[0]);
  const zoneRight = trendGaugePercent(RATE_HEALTHY[1]);

  return (
    <div className="card">
      {rateChange && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(201,162,75,.08)", borderLeft: "3px solid var(--warn)", borderRadius: 6, padding: "12px 14px", marginBottom: 16 }}>
          <AlertTriangle size={15} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: ".84rem", color: "var(--t1)", lineHeight: 1.5, margin: 0 }}>
              Sua tendência das últimas {semanas} semanas virou de {RATE_LABELS[rateChange.from.key]} para {RATE_LABELS[rateChange.to.key]}.
            </p>
            {showTagPrompt && (
              <ContextTagPrompt
                tagIds={TREND_TAG_IDS}
                question="Quer registrar o que mudou no período?"
                showNoteButton={false}
                onSubmit={onSaveContext}
                onSkip={onSkipContext}
              />
            )}
          </div>
        </div>
      )}
      <div className="flex-between">
        <div>
          <div className="card-label" style={{ marginBottom: 4 }}>Tendência · últimas {semanas} semanas</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="hero-num" style={{ fontSize: "2rem", color: status.color }}>
              {trend.lossPerWeek > 0 ? "−" : "+"}{Math.abs(trend.lossPerWeek)}
            </span>
            <span style={{ fontSize: ".85rem", color: "var(--t2)" }}>kg / semana</span>
          </div>
        </div>
        {trend.weeksToGoal && (
          <div style={{ textAlign: "right" }}>
            <div className="card-label" style={{ marginBottom: 4 }}>Neste ritmo</div>
            <div style={{ fontSize: ".9rem" }}>
              ~<span className="num" style={{ fontWeight: 700 }}>{trend.weeksToGoal}</span> semanas até <span className="num">{goal} kg</span>
            </div>
          </div>
        )}
      </div>

      {/* faixa de ritmo saudável */}
      <div style={{ marginTop: 14 }}>
        <div className="band-track">
          <div className="band-zone" style={{ left: `${zoneLeft}%`, width: `${zoneRight - zoneLeft}%`, background: "rgba(91,123,140,0.45)" }} />
        </div>
        <div className="band-marker-row">
          <div style={{ position: "absolute", left: `${markerLeft}%`, transform: "translateX(-50%)", marginTop: 2 }}>
            <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `6px solid ${status.color}` }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: "var(--t3)", fontFamily: "var(--font-condensed)", letterSpacing: ".04em" }}>
          <span>ganhando</span><span>faixa saudável (0,4–1,0)</span><span>rápido demais</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 12, fontSize: ".82rem", color: status.color }}>
        <Icon size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ lineHeight: 1.4 }}>{status.text}</span>
      </div>

      {trend.sample < 3 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, fontSize: ".76rem", color: "var(--t3)" }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Só {trend.sample} pesagens nesse período — a tendência fica confiável a partir de 4.</span>
        </div>
      )}

      {/* Projeção de composição na meta */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--bdr-soft)" }}>
        <div className="card-label" style={{ marginBottom: 8 }}>Projeção de composição na meta</div>
        {trend.projection ? (
          trend.projection.sample < COMP_CONFIDENT_SAMPLE ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--t2)", fontSize: ".85rem", lineHeight: 1.55 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 3 }} />
              <span>
                Com só {trend.projection.sample} medidas de cintura, a extrapolação ainda oscila muito pra
                afirmar um percentual. O que dá pra dizer:{" "}
                <strong style={{ color: "var(--t1)" }}>
                  {trend.projection.fatShare != null && trend.projection.fatShare >= 50
                    ? "os dados sugerem que a maior parte da perda é gordura"
                    : "os dados sugerem uma fatia relevante de massa magra na perda"}
                </strong>{" "}
                — a partir de {COMP_CONFIDENT_SAMPLE} medidas o app arrisca um número.
              </span>
            </div>
          ) : (
          <>
            <div className="flex-row" style={{ alignItems: "baseline" }}>
              <span style={{ fontSize: ".85rem", color: "var(--t2)" }}>Ao chegar em <span className="num">{goal}kg</span>, projeção de</span>
              <span className="hero-num" style={{ fontSize: "1.7rem", color: "var(--good)" }}>~{trend.projection.bfAtGoal}%</span>
              <span style={{ fontSize: ".85rem", color: "var(--t2)" }}>de gordura</span>
            </div>
            {trend.projection.fatShare != null && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".76rem", color: "var(--t2)", marginBottom: 4 }}>
                  <span>qualidade da perda projetada</span>
                  <span>
                    <strong className="num" style={{ color: trend.projection.fatShare >= 75 ? "var(--good)" : "var(--warn)" }}>
                      {trend.projection.fatShare}%
                    </strong>{" "}
                    gordura · <span className="num">{100 - trend.projection.fatShare}%</span> massa magra
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--warn)", overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${trend.projection.fatShare}%`, background: "var(--good)", height: "100%" }} />
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: ".76rem", color: "var(--t3)", lineHeight: 1.45 }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {trend.projection.capped
                  ? "A extrapolação linear dava um valor irrealista (abaixo de 10%), então limitei — no ritmo atual você chegaria bem magro, mas a perda desacelera perto da meta e o número real será mais alto. "
                  : trend.projection.fatShare != null && trend.projection.fatShare >= 75
                  ? "A maior parte do que você está perdendo é gordura — é o cenário ideal da recomposição. "
                  : trend.projection.fatShare != null
                  ? "Uma fatia relevante da perda projetada é massa magra. Mais proteína e treino de força ajudam a preservar músculo. "
                  : ""}
                Estimativa baseada em {trend.projection.sample} medidas de cintura — quanto mais você medir, mais precisa fica. Trate o número como direção, não como meta exata.
              </span>
            </div>
          </>
          )
        ) : (
          <div style={{ display: "flex", gap: 6, fontSize: ".8rem", color: "var(--t3)", lineHeight: 1.5 }}>
            <Ruler size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              {trend.compAvailable === 1
                ? "Você já tem 1 pesagem com cintura registrada. Registre a cintura em mais uma pesagem e esta projeção liga sozinha — vai estimar com quantos % de gordura você chega na meta."
                : "Registre a cintura (e pescoço) em pelo menos 2 pesagens e esta seção acende: vou projetar com quantos % de gordura você chega na meta, e quanto da perda é gordura vs. músculo."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
