import { Bell, ChevronDown, Menu, Search, Settings, HelpCircle, LogOut } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export function AppHeader({ active, searchValue, onSearchChange, onNavigate }: { active: string; searchValue: string; onSearchChange: (value: string) => void; onNavigate?: (page: string) => void }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessor_token');
    localStorage.removeItem('active_page');
    if (onNavigate) onNavigate('Login');
  };

  return (
    <header className="topbar relative">
      <div className="header-left">
        <button className="mobile-menu" aria-label="Open menu"><Menu /></button>
        <div>
          <div className="header-brand">Accessor Office</div>
          <div className="header-subtitle">{active === 'Dashboard' ? 'Dashboard' : active}</div>
        </div>
      </div>
      <div className="header-search">
        <Search size={18} />
        <input value={searchValue} onChange={e => onSearchChange(e.target.value)} placeholder="Search parcels, owners, or IDs..." />
      </div>
      <div className="header-actions">
        <button className="icon-btn" aria-label="Notifications"><Bell size={18} /></button>
        <div className="relative" ref={profileRef}>
          <div className="profile-pill cursor-pointer hover:bg-gray-100 transition" onClick={() => setIsProfileOpen(!isProfileOpen)}>
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-full object-cover border border-gray-300" style={{ width: '32px', height: '32px' }} />
            <div>
              <strong>Assessor Admin</strong>
              <span>Chief Official</span>
            </div>
            <ChevronDown size={16} />
          </div>
          
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <p className="font-semibold text-gray-900">Admin User</p>
                <p className="text-sm text-gray-500">admin@municipality.gov</p>
              </div>
              <div className="p-1">
                <button onClick={() => { setIsProfileOpen(false); window.alert('Settings are currently in development.'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
                  <Settings size={16} /> Account Settings
                </button>
                <button onClick={() => { setIsProfileOpen(false); window.alert('Support module is currently in development.'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
                  <HelpCircle size={16} /> Help & Support
                </button>
              </div>
              <div className="p-1 border-t border-gray-100">
                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2">
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
