export function Metric({ icon, title, value, detail, color }: { icon: React.ReactNode; title: string; value: string; detail: string; color: string }) {
  return <section className="metric card"><div className={`metric-icon ${color}`}>{icon}</div><p>{title}</p><h2>{value}</h2><span>{detail}</span></section>
}
