import { useRef, useEffect } from "react";
import {
  Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend, Filler,
} from "chart.js";
import { daysBetween, addDaysISO, fmtDateBR } from "../../lib/calculations.js";

// V2: eixo X trocou de CategoryScale (pontos igualmente espaçados,
// independente da data real) para LinearScale com offsets numéricos de dia.
// Antes, 3 semanas de intervalo ocupavam o mesmo espaço horizontal que 1
// dia — a inclinação visual da curva contradizia o kg/semana anunciado ao
// lado, e com pesagem diária as lacunas do regime antigo ficariam invisíveis
// em vez de aparecerem como o que são. `spanGaps:false` na série de peso
// torna um buraco real um buraco visível.
Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);

export default function WeightChart({ series, goal, windowDays = 27, projection = null }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !series.length) return;
    const t0 = series[0].date;
    const toX = (date) => daysBetween(t0, date);
    const pesos = series.map((s) => ({ x: toX(s.date), y: s.peso }));
    const medias = series.filter((s) => s.media != null).map((s) => ({ x: toX(s.date), y: s.media }));
    const lastX = toX(series[series.length - 1].date);

    // Projeção: a linha continua da última pesagem real, com a faixa de
    // confiança da reta atrás dela. Datasets internos da faixa levam prefixo
    // "__" e são filtrados da legenda e do tooltip.
    const proj = projection && projection.line?.length >= 2 ? projection : null;
    const projEndX = proj ? proj.line[proj.line.length - 1].x : lastX;
    const maxX = Math.max(lastX, projEndX);
    const metaLine = [{ x: 0, y: goal }, { x: maxX, y: goal }];

    // Escala Y ancorada nos dados reais + meta + centro da projeção — NÃO na
    // faixa de confiança, que abre muito longe no tempo e, se entrasse na
    // conta, achataria a curva. A faixa simplesmente corta na borda.
    const yValues = [
      ...pesos.map((p) => p.y),
      ...medias.map((m) => m.y),
      ...(proj ? proj.line.map((p) => p.y) : []),
      goal,
    ];
    const yMin = Math.floor(Math.min(...yValues) - 1);
    const yMax = Math.ceil(Math.max(...yValues) + 1);

    const projDatasets = proj
      ? [
          {
            label: "__projLo",
            data: proj.line.map((p) => ({ x: p.x, y: p.lo })),
            parsing: false,
            borderColor: "transparent",
            pointRadius: 0,
            borderWidth: 0,
          },
          {
            label: "__projHi",
            data: proj.line.map((p) => ({ x: p.x, y: p.hi })),
            parsing: false,
            borderColor: "transparent",
            backgroundColor: "rgba(91,123,140,0.10)",
            pointRadius: 0,
            borderWidth: 0,
            fill: "-1",
          },
          {
            label: "Projeção",
            data: proj.line.map((p) => ({ x: p.x, y: p.y })),
            parsing: false,
            borderColor: "#8AA6B3",
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [3, 3],
            tension: 0,
          },
          ...(proj.reachesGoal && proj.goalCrossX != null
            ? [
                {
                  label: "Meta prevista",
                  data: [{ x: proj.goalCrossX, y: goal }],
                  parsing: false,
                  showLine: false,
                  borderColor: "#C9A24B",
                  pointBackgroundColor: "#C9A24B",
                  pointBorderColor: "#C9A24B",
                  pointRadius: 6,
                  pointHoverRadius: 8,
                  pointStyle: "rectRot",
                },
              ]
            : []),
        ]
      : [];

    const data = {
      datasets: [
        ...projDatasets,
        {
          label: "Peso",
          data: pesos,
          parsing: false,
          borderColor: "#E8552E",
          backgroundColor: "rgba(232,85,46,0.08)",
          pointBackgroundColor: "#E8552E",
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.25,
          fill: true,
          spanGaps: false,
        },
        {
          label: `Tendência (${windowDays}d)`,
          data: medias,
          parsing: false,
          borderColor: "#5B7B8C",
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: "Meta",
          data: metaLine,
          parsing: false,
          borderColor: "#C9A24B",
          pointRadius: 0,
          borderWidth: 1.5,
          borderDash: [2, 4],
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#8B8F92",
            font: { family: "'Barlow Condensed', sans-serif", size: 12 },
            boxWidth: 18, boxHeight: 2, padding: 14,
            filter: (item) => !item.text?.startsWith("__"),
          },
        },
        tooltip: {
          backgroundColor: "#212426",
          borderColor: "#34383B",
          borderWidth: 1,
          titleColor: "#EDEAE2",
          bodyColor: "#8B8F92",
          bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
          titleFont: { family: "'Barlow Condensed', sans-serif", size: 13 },
          filter: (item) => !item.dataset?.label?.startsWith("__"),
          callbacks: {
            title: (items) => (items.length ? fmtDateBR(addDaysISO(t0, items[0].parsed.x)) : ""),
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : "--"} kg`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          grid: { color: "rgba(255,255,255,0.03)" },
          ticks: {
            color: "#5A5E60", font: { family: "'JetBrains Mono', monospace", size: 10 },
            maxRotation: 0, autoSkip: true, maxTicksLimit: 10,
            callback: (v) => fmtDateBR(addDaysISO(t0, v)),
          },
        },
        y: {
          min: yMin,
          max: yMax,
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#5A5E60", font: { family: "'JetBrains Mono', monospace", size: 10 }, callback: (v) => `${v} kg` },
        },
      },
    };

    if (chartRef.current) {
      chartRef.current.data = data;
      chartRef.current.options = options;
      chartRef.current.update();
    } else {
      chartRef.current = new Chart(canvasRef.current, { type: "line", data, options });
    }
  }, [series, goal, windowDays, projection]);

  useEffect(() => () => { chartRef.current?.destroy(); chartRef.current = null; }, []);

  const ariaLabel =
    `Gráfico de evolução do peso com linha de tendência de ${windowDays} dias e linha da meta, eixo temporal proporcional` +
    (projection?.line?.length
      ? projection.reachesGoal
        ? `. Projeção da tendência à frente cruza a meta em cerca de ${projection.weeksToGoal} semanas.`
        : `. Projeção da tendência à frente não alcança a meta dentro do horizonte exibido.`
      : "");

  return (
    <div className="chart-wrap">
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}
