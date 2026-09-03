// "O que mudou desde a última vez que você entrou" — nunca menciona
// ausência como falha, e fica em silêncio quando não há nada a dizer
// (visita recente demais, ou nada novo registrado).
function daysAgo(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

export default function SinceLastVisit({ previousVisitAt, weighIns }) {
  if (!previousVisitAt) return null;
  const since = new Date(previousVisitAt);
  const newCount = weighIns.filter((w) => w.created_at && new Date(w.created_at) > since).length;
  const days = daysAgo(previousVisitAt);
  if (days < 1 && newCount === 0) return null;

  return (
    <p className="since-visit">
      Desde sua última visita{days >= 1 ? ` (${days === 1 ? "1 dia atrás" : `${days} dias atrás`})` : ""}
      {newCount > 0
        ? <>, você registrou <strong>{newCount}</strong> {newCount === 1 ? "pesagem" : "pesagens"}.</>
        : ", nada novo foi registrado."}
    </p>
  );
}
