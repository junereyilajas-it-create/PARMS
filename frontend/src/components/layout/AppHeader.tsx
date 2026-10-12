import { Bell, ChevronDown, Menu, Settings, LogOut, Moon, Sun, User, Check, CheckCircle2, HelpCircle } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import api from '../../lib/api'

const descriptions: Record<string, string> = { Dashboard: 'Overview of property records and assessment activity', Properties: 'Manage registered property lots and records', Owners: 'Manage ownership transfers and supporting records', Assessments: 'Review property valuation and assessment information', 'GIS Map': 'Locate and inspect registered properties on the map', Documents: 'Find and print official property certifications', Reports: 'Review operational intelligence and reports' }

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

function formatRelativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AppHeader({ active, onNavigate, theme, onThemeToggle, onMenu }: { active: string; onNavigate?: (page: string) => void; theme: 'light' | 'dark'; onThemeToggle: () => void; onMenu: () => void }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<any>(null);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Fetch profile dynamically
    if (localStorage.getItem('accessor_token')) {
      api.get('/profile').then(res => setProfile(res.data)).catch(console.error);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!localStorage.getItem('accessor_token')) return;
    try {
      const [notifsRes, countRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/unread-count')
      ]);
      setNotifications(notifsRes.data);
      setUnreadCount(countRes.data.count);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id: number, type: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      setIsNotifOpen(false);
      if (type.includes('PERMISSION') && onNavigate) onNavigate('Permission Requests');
      else if (type === 'ASSESSMENT' && onNavigate) onNavigate('Assessments');
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleLogout = async () => {
    try {
      if (localStorage.getItem('accessor_token')) {
        await api.post('/logout');
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('accessor_token');
      localStorage.removeItem('accessor_role');
      localStorage.removeItem('active_page');
      if (onNavigate) onNavigate('Login');
    }
  };

  return (
    <header className="w-full h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-colors z-30 sticky top-0">
      <div className="flex items-center gap-4 flex-1">
        <button className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white md:hidden rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Open menu" onClick={onMenu}>
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">{active === 'Dashboard' ? 'Dashboard' : active}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{descriptions[active] || 'Assessor’s Office Management System'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
        <div className="relative" ref={notifRef}>
          <button 
            className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hidden sm:flex" 
            aria-label="Notifications"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 z-50 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium flex items-center gap-1 transition-colors">
                    <Check size={14} /> Mark all as read
                  </button>
                )}
              </div>
              <div className="overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-700" />
                    <p className="text-sm">You have no notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {notifications.map(notif => (
                      <button
                        key={notif.id}
                        onClick={() => markAsRead(notif.id, notif.type)}
                        className={`w-full text-left p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                          !notif.is_read ? 'bg-green-50/40 dark:bg-green-900/10' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-green-500' : 'bg-transparent'}`} />
                          <div>
                            <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {notif.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 font-medium">{formatRelativeTime(notif.created_at)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button id="theme-toggle-btn" className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={onThemeToggle}>
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
              {profile?.first_name ? profile.first_name[0].toUpperCase() : 'U'}
            </div>
            <div className="flex-col text-left hidden lg:flex pr-1">
              <strong className="text-sm font-semibold leading-tight text-gray-900 dark:text-white">
                {profile ? `${profile.first_name} ${profile.last_name || ''}`.trim() : 'Loading...'}
              </strong>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{profile?.role === 'client' ? 'Property Owner' : (profile?.role?.replace('_', ' ') || 'User')}</span>
            </div>
            <ChevronDown size={14} className="text-gray-400 hidden lg:block" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 z-50 overflow-hidden py-1">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{profile ? `${profile.first_name} ${profile.last_name || ''}`.trim() : 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{profile?.email || profile?.username || 'No email'}</p>
                <p className="text-[10px] text-gray-400 mt-1 uppercase border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 inline-block">{profile?.role === 'client' ? 'Property Owner' : (profile?.role?.replace('_', ' ') || 'User')}</p>
              </div>
              <div className="p-1">
                <button onClick={() => { setIsProfileOpen(false); if (onNavigate) onNavigate('My Profile'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md flex items-center gap-2 transition-colors">
                  <User size={16} /> My Profile
                </button>
                <button onClick={() => { setIsProfileOpen(false); if (onNavigate) onNavigate('Account Settings'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md flex items-center gap-2 transition-colors">
                  <Settings size={16} /> Account Settings
                </button>
                <button onClick={() => { setIsProfileOpen(false); if (onNavigate) onNavigate('Help & Support'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md flex items-center gap-2 transition-colors">
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
