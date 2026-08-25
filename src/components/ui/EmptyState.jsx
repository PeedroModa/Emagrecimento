export default function EmptyState({ icon, title, text }) {
  return (
    <div className="empty-state" role="status">
      {icon && <div className="es-icon">{icon}</div>}
      {title && <div className="es-title">{title}</div>}
      <div className="es-text">{text}</div>
    </div>
  );
}
