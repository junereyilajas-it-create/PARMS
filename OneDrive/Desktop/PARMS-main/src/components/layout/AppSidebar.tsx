import { Bot, Building2, ClipboardCheck, LayoutDashboard, Map, Search, Settings, Users, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
const nav: [string, LucideIcon][] = [
  ['Dashboard', LayoutDashboard],
  ['Owners', Users],
  ['Lots', Building2],
  ['Buildings', ClipboardCheck],
  ['Assessments', Search],
  ['AI Valuation', Bot],
  ['GIS Map', Map],
  ['Reports', FileText],
]
export function AppSidebar({ active, onNavigate }: { active: string; onNavigate: (page: string) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">AP</div>
        <div>
          <strong>Assessor Pro AI</strong>
          <span>City Hall District</span>
        </div>
      </div>
      <nav>
        {nav.map(([label, Icon]) => (
          <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(label)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="nav-item secondary"><Settings size={18} /><span>Settings</span></button>
        <div className="help"><span>Support</span><a href="#support">Contact</a></div>
      </div>
    </aside>
  )
}
