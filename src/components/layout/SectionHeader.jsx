export default function SectionHeader({ title, subtitle }) {
  return (
    <div className="section-hdr">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
