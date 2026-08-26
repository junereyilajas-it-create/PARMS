import { Bell, ChevronDown, Menu, Search, Settings, HelpCircle, LogOut, Moon, Sun } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const descriptions: Record<string, string> = { Dashboard: 'Overview of property records and assessment activity', Properties: 'Manage registered property lots and records', Owners: 'Manage ownership transfers and supporting records', Assessments: 'Review property valuation and assessment information', 'GIS Map': 'Locate and inspect registered properties on the map', Documents: 'Find and print official property certifications', Reports: 'Review operational intelligence and reports' }

export function AppHeader({ active, searchValue, onSearchChange, onNavigate, theme, onThemeToggle, onMenu }: { active: string; searchValue: string; onSearchChange: (value: string) => void; onNavigate?: (page: string) => void; theme: 'light' | 'dark'; onThemeToggle: () => void; onMenu: () => void }) {
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
    <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-colors z-30 sticky top-0">
      <div className="flex items-center gap-4 flex-1">
        <button className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white md:hidden rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Open menu" onClick={onMenu}>
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">{active === 'Dashboard' ? 'Dashboard' : active}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{descriptions[active] || 'Assessor’s Office Management System'}</p>
        </div>
      </div>
      
      <div className="flex-1 max-w-md mx-4 hidden md:flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 dark:focus-within:border-green-500 transition-all">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input 
          value={searchValue} 
          onChange={e => onSearchChange(e.target.value)} 
          placeholder="Search parcels, owners, or IDs..." 
          className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
        <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hidden sm:flex" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={onThemeToggle}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        
        <div className="relative pl-2 sm:pl-4 border-l border-gray-200 dark:border-gray-800" ref={profileRef}>
          <button 
            type="button" 
            className="flex items-center gap-2.5 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-green-500" 
            aria-haspopup="menu" 
            aria-expanded={isProfileOpen} 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 flex items-center justify-center font-bold text-sm shrink-0 border border-green-200 dark:border-green-800/50" aria-hidden="true">
              A
            </div>
            <div className="flex-col text-left hidden lg:flex pr-1">
              <strong className="text-sm font-semibold leading-tight text-gray-900 dark:text-white">Assessor Admin</strong>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Municipal Assessor</span>
            </div>
            <ChevronDown size={14} className="text-gray-400 hidden lg:block" />
          </button>
          
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 z-50 overflow-hidden py-1">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">Assessor Admin</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">admin@municipality.gov.ph</p>
              </div>
              <div className="p-1">
                <button onClick={() => { setIsProfileOpen(false); window.alert('Settings are currently in development.'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md flex items-center gap-2 transition-colors">
                  <Settings size={16} /> Account Settings
                </button>
                <button onClick={() => { setIsProfileOpen(false); window.alert('Support module is currently in development.'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md flex items-center gap-2 transition-colors">
                  <HelpCircle size={16} /> Help & Support
                </button>
              </div>
              <div className="p-1 border-t border-gray-100 dark:border-gray-800">
                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md flex items-center gap-2 transition-colors">
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
