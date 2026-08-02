import { Bell, ChevronDown, Menu, Search } from 'lucide-react'
export function AppHeader({ active, searchValue, onSearchChange }: { active: string; searchValue: string; onSearchChange: (value: string) => void }) {
  return (
    <header className="topbar">
      <div className="header-left">
        <button className="mobile-menu" aria-label="Open menu"><Menu /></button>
        <div>
          <div className="header-brand">Assessor Pro AI</div>
          <div className="header-subtitle">{active === 'Dashboard' ? 'Dashboard' : active}</div>
        </div>
      </div>
      <div className="header-search">
        <Search size={18} />
        <input value={searchValue} onChange={e => onSearchChange(e.target.value)} placeholder="Search parcels, owners, or IDs..." />
      </div>
      <div className="header-actions">
        <button className="icon-btn" aria-label="Notifications"><Bell size={18} /></button>
        <div className="profile-pill">
          <span>MA</span>
          <div>
            <strong>Assessor Admin</strong>
            <span>Chief Official</span>
          </div>
          <ChevronDown size={16} />
        </div>
      </div>
    </header>
  )
}
