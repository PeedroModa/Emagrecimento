import { useRef, useEffect } from "react";
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

export default function WeightChart({ series, goal, windowDays = 27 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const labels = series.map((s) => s.label);
    const pesos = series.map((s) => s.peso);
    const medias = series.map((s) => s.media);

    const data = {
      labels,
      datasets: [
        {
          label: "Peso",
          data: pesos,
          borderColor: "#E8552E",
          backgroundColor: "rgba(232,85,46,0.08)",
          pointBackgroundColor: "#E8552E",
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.25,
          fill: true,
        },
        {
          label: `Tendência (${windowDays}d)`,
          data: medias,
          borderColor: "#5B7B8C",
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: "Meta",
          data: labels.map(() => goal),
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
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : "--"} kg`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.03)" },
          ticks: { color: "#5A5E60", font: { family: "'JetBrains Mono', monospace", size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        },
        y: {
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
  }, [series, goal, windowDays]);

  useEffect(() => () => { chartRef.current?.destroy(); chartRef.current = null; }, []);

  return (
    <div className="chart-wrap">
      <canvas ref={canvasRef} role="img" aria-label={`Gráfico de evolução do peso com linha de tendência de ${windowDays} dias e linha da meta`} />
    </div>
  );
}
