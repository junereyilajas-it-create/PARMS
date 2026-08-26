import { Bot, Building2, FileText, Home, LayoutDashboard, Map, PanelLeftClose, Settings, Users, Printer } from 'lucide-react'

const navGroups = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard },
      { label: 'GIS Map', icon: Map }
    ]
  },
  {
    title: 'Management',
    items: [
      { label: 'Properties', icon: Building2 },
      { label: 'Owners', icon: Users },
      { label: 'Assessments', icon: Bot },
      { label: 'Documents', icon: Printer },
      { label: 'Reports', icon: FileText }
    ]
  }
];

export function AppSidebar({ active, onNavigate, isOpen, collapsed, onCollapse }: { active: string; onNavigate: (page: string) => void; isOpen: boolean; collapsed: boolean; onCollapse: () => void }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <img src="/logo.png" alt="Assessor's Office logo" className="w-8 h-8 shrink-0 object-contain" />
          {!collapsed && (
            <div className="flex flex-col whitespace-nowrap">
              <strong className="text-gray-900 dark:text-white text-sm font-semibold">Assessor's Office</strong>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Lagonglong, Mis. Or.</span>
            </div>
          )}
        </div>
        <button className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0 hidden md:block" onClick={onCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <PanelLeftClose size={18} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6 custom-scrollbar">
        {navGroups.map((group, idx) => (
          <div key={idx} className="px-3">
            {!collapsed && <h3 className="mb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.title}</h3>}
            <nav className="flex flex-col gap-1">
              {group.items.map(({label, icon: Icon}) => (
                <button 
                  key={label} 
                  title={label} 
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left
                    ${active === label 
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                    } ${collapsed ? 'justify-center' : ''}`}
                  onClick={() => onNavigate(label)}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
                </button>
              ))}
            </nav>
          </div>
        ))}

        <div className="mt-auto px-3">
          {!collapsed && <h3 className="mb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</h3>}
          <nav className="flex flex-col gap-1">
            <button 
              className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white ${collapsed ? 'justify-center' : ''}`}
              title="Settings"
            >
              <Settings size={18} className="shrink-0" />
              {!collapsed && <span className="text-sm font-medium truncate">Settings</span>}
            </button>
            <button 
              className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white ${collapsed ? 'justify-center' : ''}`}
              title="Back to home" 
              onClick={() => onNavigate('Landing')}
            >
              <Home size={18} className="shrink-0" />
              {!collapsed && <span className="text-sm font-medium truncate">Back to Home</span>}
            </button>
          </nav>
        </div>
      </div>
    </aside>
  )
}
