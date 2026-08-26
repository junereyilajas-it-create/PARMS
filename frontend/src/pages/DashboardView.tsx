import { Building2, MapPin, Plus, Sparkles, Users } from 'lucide-react'
import { Metric } from '../components/common/Metric'
import { PropertyTable } from '../components/common/PropertyTable'
import { SearchBox } from '../components/common/SearchBox'
import type { Property } from '../types/property'

function Activity({ initials, color, text, name }: { initials: string; color: string; text: string; name: string }) { return <div className="activity-row"><div className={`person ${color}`}>{initials}</div><div><strong>{text}</strong><span>{name}</span></div></div> }
export function DashboardView({ active, query, onQueryChange, rows, onNavigate, onRegister, onDelete }: { active: string; query: string; onQueryChange: (value: string) => void; rows: Property[]; onNavigate: (page: string) => void; onRegister: () => void; onDelete?: (property: Property) => void }) {
  const isDashboard = active === 'Dashboard'
  const propertyCount = new Set(rows.map(row => row.id)).size
  const pendingCount = rows.filter(row => row.status.toLowerCase() === 'pending').length
  const assessedCount = rows.filter(row => Number(row.market.replace(/[^0-9.-]/g, '')) > 0).length
  return <><div className="title-row"><div><p className="eyebrow">WELCOME, ADMIN</p><h1>{isDashboard ? 'Dashboard Overview' : active}</h1><p className="subhead">{isDashboard ? "Here's what's happening with your records today." : `Manage ${active.toLowerCase()} in one place.`}</p></div><button className="btn-save" onClick={onRegister}><Plus size={18}/> Add Property</button></div>
  <div className="metrics">
    <Metric icon={<Building2/>} title="Total Properties" value={propertyCount.toLocaleString()} detail="Registered property records" color="green"/>
    <Metric icon={<MapPin/>} title="Total Lots" value={rows.length.toLocaleString()} detail="Lots linked to properties" color="blue"/>
    <Metric icon={<Users/>} title="Pending Records" value={pendingCount.toLocaleString()} detail="Require review or assessment" color="orange"/>
    <Metric icon={<Sparkles/>} title="Assessed Properties" value={assessedCount.toLocaleString()} detail="Records with market value" color="violet"/>
  </div>
  <div className="dashboard-grid"><section className="card records"><div className="card-head"><div><h2>Assessment Summary</h2><p>Overview of recent property records</p></div><button className="btn-edit" onClick={() => onNavigate('Properties')}>View all properties</button></div><SearchBox value={query} onChange={onQueryChange}/><PropertyTable rows={rows} onDelete={onDelete}/></section><aside className="side-column"><section className="card activity"><div className="card-head"><div><h2>Recent Activities</h2><p>Latest system updates</p></div></div><Activity initials="AI" color="violet" text="AI estimate generated" name="TD-2024-01842 · 12 minutes ago"/><Activity initials="JD" color="blue" text="Assessment updated" name="Jose R. Dela Cruz · 1 hour ago"/><Activity initials="AR" color="purple" text="Tax declaration generated" name="Ana P. Reyes · 3 hours ago"/><button className="btn-edit outline" onClick={() => onNavigate('Reports')}>View logs</button></section></aside></div></>
}
