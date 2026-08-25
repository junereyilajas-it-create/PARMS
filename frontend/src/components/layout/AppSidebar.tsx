import { Bot, Building2, FileText, Home, LayoutDashboard, Map, Settings, Users, Printer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const nav: [string, LucideIcon][] = [
  ['Dashboard', LayoutDashboard], ['GIS Map', Map], ['Properties', Building2], 
  ['Owners', Users], ['Assessments', Bot], ['Documents', Printer], ['Reports', FileText]
]
export function AppSidebar({ active, onNavigate }: { active: string; onNavigate: (page: string) => void }) {
  return <aside className="sidebar"><button className="brand text-left" onClick={() => onNavigate('Landing')}><img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} /><div><strong>Accessor Office</strong><span>Lagonglong, Misamis Oriental</span></div></button><nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(label)}><Icon size={18} /><span>{label}</span></button>)}</nav><div className="sidebar-footer"><button className="nav-item secondary"><Settings size={18} /><span>Settings</span></button><button className="nav-item secondary" onClick={() => onNavigate('Landing')}><Home size={18} /><span>Back to home</span></button></div></aside>
}
