import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Shield,
  SquareDashed,
  Building2,
  ClipboardCheck,
  FileText,
  ArrowUpRight,
  Activity,
  Layers,
  CheckCircle,
  Clock
} from 'lucide-react'
import api from '../lib/api'

export function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    Promise.all([
      api.get('/stats/super_admin'),
      api.get('/stats/health').catch(e => ({ data: { status: 'OFFLINE', error: e.message } }))
    ])
      .then(([statsRes, healthRes]) => {
        if (!isMounted) return
        setStats(statsRes.data)
        setHealth(healthRes.data)
      })
      .catch(err => {
        if (!isMounted) return
        console.error('Failed to load Super Admin dashboard stats:', err)
        setError('Unable to load dashboard statistics from server.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [])

  const handleCardClick = (path: string) => {
    navigate(path)
  }

  const handleKeyDown = (e: React.KeyboardEvent, path: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(path)
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">
            Super Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            System overview, user management statistics, real-time health, and operational records.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* System Health Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border border-gray-200/80 dark:border-gray-800 shadow-xs">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Frontend</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">ONLINE</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-100 dark:ring-green-950" />
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border border-gray-200/80 dark:border-gray-800 shadow-xs">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Backend API</p>
            <p className={`text-lg font-bold ${health?.status === 'ONLINE' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {health ? health.status : 'CHECKING...'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${health?.status === 'ONLINE' ? 'bg-green-500 ring-4 ring-green-100 dark:ring-green-950' : 'bg-red-500 ring-4 ring-red-100'}`} />
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border border-gray-200/80 dark:border-gray-800 shadow-xs">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Database</p>
            <p className={`text-lg font-bold ${health?.status === 'ONLINE' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {health ? (health.status === 'ONLINE' ? 'CONNECTED' : 'OFFLINE') : 'CHECKING...'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${health?.status === 'ONLINE' ? 'bg-green-500 ring-4 ring-green-100 dark:ring-green-950' : 'bg-red-500 ring-4 ring-red-100'}`} />
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border border-gray-200/80 dark:border-gray-800 shadow-xs">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Authentication</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">ONLINE</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-100 dark:ring-green-950" />
        </div>
      </div>

      {/* Section 1: User & Role Overview Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Users size={16} className="text-green-600 dark:text-green-400" />
            User Management & Role Statistics
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">Click any card to inspect records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/users')}
            onKeyDown={(e) => handleKeyDown(e, '/users')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border border-gray-200/80 dark:border-gray-800 hover:border-green-500/80 dark:hover:border-green-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open User Management (All Users)"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Users</span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            </div>
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.totalUsers || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              Manage all user accounts →
            </span>
          </div>

          {/* Active Users */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/users?status=active')}
            onKeyDown={(e) => handleKeyDown(e, '/users?status=active')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border border-gray-200/80 dark:border-gray-800 hover:border-green-500/80 dark:hover:border-green-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open User Management (Active Users)"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Active Users</span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            </div>
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.activeUsers || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              Filter by active status →
            </span>
          </div>

          {/* Inactive Users */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/users?status=inactive')}
            onKeyDown={(e) => handleKeyDown(e, '/users?status=inactive')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border border-gray-200/80 dark:border-gray-800 hover:border-red-500/80 dark:hover:border-red-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open User Management (Inactive Users)"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider">Inactive Users</span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-red-500 transition-colors" />
            </div>
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.inactiveUsers || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-red-500 transition-colors">
              Inspect inactive accounts →
            </span>
          </div>

          {/* Roles & Permissions Navigation Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/roles')}
            onKeyDown={(e) => handleKeyDown(e, '/roles')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/20 hover:border-purple-500/80 dark:hover:border-purple-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Roles & Permissions Management"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={14} /> Roles & Permissions
              </span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-purple-700 dark:text-purple-300">
              Manage Access
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Configure role capabilities →
            </span>
          </div>

          {/* Role specific counts: Super Admin, Admin, Assessor, Staff, Client */}
          {[
            { role: 'super_admin', label: 'Super Admins', color: 'text-purple-600 dark:text-purple-400' },
            { role: 'admin', label: 'Admins', color: 'text-rose-600 dark:text-rose-400' },
            { role: 'assessor', label: 'Assessors', color: 'text-amber-600 dark:text-amber-400' },
            { role: 'staff', label: 'Staff', color: 'text-blue-600 dark:text-blue-400' },
            { role: 'client', label: 'Clients / Owners', color: 'text-teal-600 dark:text-teal-400' }
          ].map(({ role, label, color }) => {
            const roleStat = stats?.users?.find((u: any) => u.role === role)
            return (
              <div
                key={role}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(`/users?role=${role}`)}
                onKeyDown={(e) => handleKeyDown(e, `/users?role=${role}`)}
                className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border border-gray-200/80 dark:border-gray-800 hover:border-green-500/80 dark:hover:border-green-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
                title={`Open User Management filtered by ${label}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>
                    {label}
                  </span>
                  <ArrowUpRight size={16} className="text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
                </div>
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {loading ? '...' : (roleStat?.count || 0)}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  View {label.toLowerCase()} →
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 2: Property & Operations Overview Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Layers size={16} className="text-green-600 dark:text-green-400" />
            Property, Assessment & Document Records
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">Click any card to inspect operational records</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Properties */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/properties')}
            onKeyDown={(e) => handleKeyDown(e, '/properties')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border-t-4 border-t-green-600 border border-gray-200/80 dark:border-gray-800 hover:border-green-500/80 dark:hover:border-green-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Properties Management"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Properties</span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.total_properties || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              Manage properties →
            </span>
          </div>

          {/* Lots */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/lots')}
            onKeyDown={(e) => handleKeyDown(e, '/lots')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border-t-4 border-t-green-600 border border-gray-200/80 dark:border-gray-800 hover:border-green-500/80 dark:hover:border-green-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Property Lot Management"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <SquareDashed size={13} /> Lots
              </span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.total_lots || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              Manage lots →
            </span>
          </div>

          {/* Buildings */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/buildings')}
            onKeyDown={(e) => handleKeyDown(e, '/buildings')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border-t-4 border-t-green-600 border border-gray-200/80 dark:border-gray-800 hover:border-green-500/80 dark:hover:border-green-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Building Directory"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Building2 size={13} /> Buildings
              </span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.total_buildings || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              Manage buildings →
            </span>
          </div>

          {/* Total Assessments */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/assessments')}
            onKeyDown={(e) => handleKeyDown(e, '/assessments')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border-t-4 border-t-green-600 border border-gray-200/80 dark:border-gray-800 hover:border-green-500/80 dark:hover:border-green-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Property Assessments Management"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <ClipboardCheck size={13} /> Assessments
              </span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.total_assessments || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              Review assessments →
            </span>
          </div>

          {/* Assessed Properties */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/assessments')}
            onKeyDown={(e) => handleKeyDown(e, '/assessments')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border-t-4 border-t-emerald-600 border border-gray-200/80 dark:border-gray-800 hover:border-emerald-500/80 dark:hover:border-emerald-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Assessments (Assessed Properties)"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle size={13} className="text-emerald-500" /> Assessed Prop.
              </span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.assessed_properties || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-emerald-600 transition-colors">
              Inspect valuation records →
            </span>
          </div>

          {/* Unassessed Properties */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/assessments')}
            onKeyDown={(e) => handleKeyDown(e, '/assessments')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border-t-4 border-t-amber-500 border border-gray-200/80 dark:border-gray-800 hover:border-amber-500/80 dark:hover:border-amber-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Assessments (Pending Unassessed Properties)"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Clock size={13} className="text-amber-500" /> Unassessed Prop.
              </span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.unassessed_properties || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-amber-500 transition-colors">
              Prioritize assessments →
            </span>
          </div>

          {/* Pending Certificates */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/admin/certificate-requests')}
            onKeyDown={(e) => handleKeyDown(e, '/admin/certificate-requests')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border-t-4 border-t-blue-500 border border-gray-200/80 dark:border-gray-800 hover:border-blue-500/80 dark:hover:border-blue-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Certificate Requests"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <FileText size={13} className="text-blue-500" /> Pending Certs
              </span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {loading ? '...' : (stats?.pending_certificate_requests || 0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-blue-500 transition-colors">
              Process certificate requests →
            </span>
          </div>

          {/* Activity Logs Quick Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('/logs')}
            onKeyDown={(e) => handleKeyDown(e, '/logs')}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border-t-4 border-t-indigo-500 border border-gray-200/80 dark:border-gray-800 hover:border-indigo-500/80 dark:hover:border-indigo-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all select-none group"
            title="Open Activity Logs Audit Trail"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Activity size={13} className="text-indigo-500" /> Activity Logs
              </span>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              Audit Trail
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1 group-hover:text-indigo-500 transition-colors">
              View system activity logs →
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Recent System Activity Table */}
      <div className="glass-panel rounded-2xl p-6 border border-gray-200/80 dark:border-gray-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity size={20} className="text-green-600 dark:text-green-400" />
              Recent System Activity
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Real-time audit log of user actions and automated system events.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleCardClick('/logs')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200/80 dark:border-green-800/80 transition-colors cursor-pointer w-fit"
            title="View Full Audit Logs"
          >
            <span>View All Activity Logs</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Module</th>
                <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Loading activity logs...
                  </td>
                </tr>
              ) : stats?.activities?.map((act: any) => (
                <tr
                  key={act.log_id}
                  onClick={() => handleCardClick('/logs')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, '/logs')}
                  className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group"
                  title="Click to view in Activity Logs"
                >
                  <td className="p-3 text-sm font-medium text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                    {act.first_name ? `${act.first_name} ${act.last_name || ''}`.trim() : (act.username || 'System')}
                  </td>
                  <td className="p-3 text-sm">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs uppercase font-medium">
                      {act.role ? act.role.replace('_', ' ') : 'system'}
                    </span>
                  </td>
                  <td className="p-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                    {act.action}
                  </td>
                  <td className="p-3 text-sm">
                    <span className="px-2.5 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 rounded-md text-xs font-medium border border-green-200/50 dark:border-green-800/50">
                      {act.module_name}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(act.activity_date).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!loading && !stats?.activities?.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No recent activity logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
