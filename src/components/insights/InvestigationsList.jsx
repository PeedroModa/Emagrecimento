import SectionHeader from "../layout/SectionHeader.jsx";

// "O que estou descobrindo": preenche o app quando ainda não há descoberta
// nova para mostrar — nunca uma tela vazia, sempre uma barra que andou.
// Segmentos em vez de barra contínua: lê mais como instrumento (contador),
// menos como progress bar genérica de formulário.
const SEGMENTS = 14;

export default function InvestigationsList({ items }) {
  if (!items.length) return null;
  return (
    <div className="investigations">
      <SectionHeader title="O que estou descobrindo" subtitle="quanto mais você registra, mais isso avança sozinho" />
      {items.map((item) => {
        const frac = item.meta ? Math.max(0, Math.min(1, item.atual / item.meta)) : 0;
        const filled = Math.round(frac * SEGMENTS);
        return (
          <div className="investigation" key={item.id}>
            <div className="inv-head">
              <span className="inv-title">{item.titulo}</span>
              <span className="inv-count">{item.atual}/{item.meta}</span>
            </div>
            <p className="inv-desc">{item.descricao}</p>
            <div className="dots">
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <div key={i} className={`dot${i < filled ? " filled" : ""}`} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
