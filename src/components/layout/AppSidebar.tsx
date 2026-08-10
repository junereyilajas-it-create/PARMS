import { Bot, Building2, ClipboardCheck, FileText, Home, LayoutDashboard, Map, Settings, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const nav: [string, LucideIcon][] = [
  ['Dashboard', LayoutDashboard], ['Lot Management', Building2], ['Building Directory', ClipboardCheck],
  ['Ownership Transfer', Users], ['Property Valuation', Bot], ['GIS Map', Map], ['Reports', FileText],
]
export function AppSidebar({ active, onNavigate }: { active: string; onNavigate: (page: string) => void }) {
  return <aside className="sidebar"><button className="brand text-left" onClick={() => onNavigate('Landing')}><div className="brand-mark">AP</div><div><strong>Assessor Pro AI</strong><span>City Hall District</span></div></button><nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(label)}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="sidebar-footer"><button className="nav-item secondary"><Settings size={18}/><span>Settings</span></button><button className="nav-item secondary" onClick={() => onNavigate('Landing')}><Home size={18}/><span>Back to home</span></button></div></aside>
}
