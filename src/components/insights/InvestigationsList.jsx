import SectionHeader from "../layout/SectionHeader.jsx";

// "O que estou descobrindo": preenche o app quando ainda não há descoberta
// nova para mostrar — nunca uma tela vazia, sempre uma barra que andou.
export default function InvestigationsList({ items }) {
  if (!items.length) return null;
  return (
    <div className="investigations">
      <SectionHeader title="O que estou descobrindo" subtitle="quanto mais você registra, mais isso avança sozinho" />
      {items.map((item) => {
        const pct = item.meta ? Math.max(2, Math.min(100, (item.atual / item.meta) * 100)) : 0;
        return (
          <div className="investigation-item" key={item.id}>
            <div className="investigation-title">{item.titulo}</div>
            <p className="investigation-desc">{item.descricao}</p>
            <div className="investigation-track">
              <div className="investigation-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="investigation-progress">
              {item.atual}/{item.meta} {item.unidade}
            </div>
          </div>
        );
      })}
    </div>
  );
}
