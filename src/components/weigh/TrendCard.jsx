import { TrendingDown, TrendingUp, Minus, AlertTriangle, Info, Ruler } from "lucide-react";
import { rateStatus } from "../../lib/calculations.js";

const RATE_ICONS = { rising: TrendingUp, below: Minus, fast: AlertTriangle, healthy: TrendingDown };

export default function TrendCard({ trend, goal, windowDays = 28 }) {
  if (!trend) return null;
  const status = rateStatus(trend);
  const Icon = RATE_ICONS[status.key];
  const markerLeft = Math.max(0, Math.min(100, ((trend.lossPerWeek + 0.4) / 1.9) * 100));

  return (
    <div className="card">
      <div className="flex-between">
        <div>
          <div className="card-label" style={{ marginBottom: 4 }}>Tendência · últimos {windowDays} dias</div>
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
          <div className="band-zone" style={{ left: "26%", width: "40%", background: "rgba(91,123,140,0.45)" }} />
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
                Baseado em {trend.projection.sample} medidas de cintura. Projeção grosseira — quanto mais você medir a cintura, mais precisa fica.
              </span>
            </div>
          </>
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
