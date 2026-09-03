// A faixa de oscilação pessoal como elemento gráfico de verdade — a
// assinatura visual do produto (ver plano V2, seção G.2). `size="large"`
// para a declaração do dia; `size="mini"` para o card de apoio "É real ou
// ruído?". Mesma fórmula de posição do marcador que o app já usava
// (z/3 mapeado em ±50%), só que agora desenhada, não descrita em texto.
export default function OscillationBand({ z, noiseBand, size = "large" }) {
  const markerLeft = Math.max(2, Math.min(98, 50 + (z / 3) * 50));
  return (
    <div className={`osc-band osc-band-${size}`}>
      <div className="osc-track">
        {size === "large" && <div className="osc-zone" />}
        <div className="osc-marker" style={{ left: `${markerLeft}%` }}>
          <div className="osc-marker-dot" />
        </div>
      </div>
      <div className="osc-ends">
        <span className="osc-end left">← alta real</span>
        <span className="osc-end mid">{size === "large" ? "oscilação normal" : `ruído (±${noiseBand}kg)`}</span>
        <span className="osc-end right">queda real →</span>
      </div>
    </div>
  );
}
