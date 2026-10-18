import { useEffect, useState } from 'react'
import { 
  Building2, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  MapPin, 
  Plus, 
  ShieldCheck, 
  AlertCircle,
  FileCheck,
  ChevronRight,
  Map,
  BadgeCheck
} from 'lucide-react'
import api from '../lib/api'

interface ClientDashboardProps {
  onNavigate: (page: string) => void
}

export function ClientDashboard({ onNavigate }: ClientDashboardProps) {
  const [stats, setStats] = useState({
    total_properties: 0,
    total_lots: 0,
    total_buildings: 0,
    assessed_properties: 0,
    pending_assessments: 0,
    total_requests: 0,
    pending_requests: 0,
    processing_requests: 0,
    approved_requests: 0,
    rejected_requests: 0
  })
  const [properties, setProperties] = useState<any[]>([])
  const [recentRequests, setRecentRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Property Owner')

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setError(null)
      try {
        const [profileRes, statsRes, propsRes, reqsRes] = await Promise.all([
          api.get('/profile').catch(() => ({ data: {} })),
          api.get('/client/stats').catch(() => ({ data: {} })),
          api.get('/client/my-properties').catch(() => ({ data: [] })),
          api.get('/client/certificate-requests').catch(() => ({ data: [] }))
        ])

        if (profileRes.data?.first_name) {
          setUserName(`${profileRes.data.first_name} ${profileRes.data.last_name || ''}`.trim())
        }

        const statData = statsRes.data || {}
        const propsData = Array.isArray(propsRes.data) ? propsRes.data : []
        const reqsData = Array.isArray(reqsRes.data) ? reqsRes.data : []

        setStats({
          total_properties: statData.total_properties ?? propsData.length,
          total_lots: statData.total_lots ?? propsData.filter((p: any) => p.property_type === 'LOT').length,
          total_buildings: statData.total_buildings ?? propsData.filter((p: any) => p.property_type === 'BUILDING').length,
          assessed_properties: statData.assessed_properties ?? propsData.filter((p: any) => p.assessment_status === 'ASSESSED').length,
          pending_assessments: statData.pending_assessments ?? propsData.filter((p: any) => p.assessment_status === 'UNASSESSED').length,
          total_requests: statData.total_requests ?? reqsData.length,
          pending_requests: statData.pending_requests ?? reqsData.filter((r: any) => r.status === 'PENDING').length,
          processing_requests: statData.processing_requests ?? reqsData.filter((r: any) => ['PROCESSING', 'UNDER_REVIEW'].includes(r.status)).length,
          approved_requests: statData.approved_requests ?? reqsData.filter((r: any) => ['APPROVED', 'COMPLETED'].includes(r.status)).length,
          rejected_requests: statData.rejected_requests ?? reqsData.filter((r: any) => ['REJECTED', 'RETURNED'].includes(r.status)).length
        })

        setProperties(propsData.slice(0, 4))
        setRecentRequests(reqsData.slice(0, 5))
      } catch (err: any) {
        console.error('Error loading client dashboard data:', err)
        setError('Unable to load dashboard records. Please check network connection.')
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 size={12} />
            {status}
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock size={12} />
            Pending
          </span>
        )
      case 'PROCESSING':
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <FileCheck size={12} />
            {status === 'UNDER_REVIEW' ? 'For Review' : 'Processing'}
          </span>
        )
      case 'REJECTED':
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertCircle size={12} />
            {status}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {status}
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-700 via-emerald-700 to-teal-800 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
          <Building2 size={260} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium text-emerald-100 mb-3 border border-white/20">
            <ShieldCheck size={14} /> Property Owner Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {userName}!
          </h1>
          <p className="text-emerald-100/90 text-sm sm:text-base mt-2 leading-relaxed">
            Manage your registered real estate properties, verify assessment values, track certificates, and submit official certification requests to the Municipal Assessor's Office.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={() => onNavigate('Certificate Requests')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-green-800 font-bold text-sm shadow-md hover:bg-emerald-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus size={16} className="text-green-700" />
              Request Certificate
            </button>
            <button
              onClick={() => onNavigate('My Properties')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-sm border border-white/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Building2 size={16} />
              View Properties ({stats.total_properties})
            </button>
            <button
              onClick={() => onNavigate('My GIS Property')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-sm border border-white/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Map size={16} />
              GIS Property Map
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Interactive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: My Properties */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('My Properties')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigate('My Properties')}
          className="group relative bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-green-500/50 dark:hover:border-green-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Building2 size={24} />
            </div>
            <span className="p-1.5 rounded-lg text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 transition-colors">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              My Properties
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                {stats.total_properties}
              </h3>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                ({stats.total_lots} lots, {stats.total_buildings} bldgs)
              </span>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1">
              <span>View full property inventory</span>
              <ChevronRight size={12} />
            </p>
          </div>
        </div>

        {/* Card 2: Assessed Properties */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('My Properties')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigate('My Properties')}
          className="group relative bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-teal-500/50 dark:hover:border-teal-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <BadgeCheck size={24} />
            </div>
            <span className="p-1.5 rounded-lg text-gray-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:bg-teal-50 dark:group-hover:bg-teal-950/40 transition-colors">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Assessed Properties
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                {stats.assessed_properties}
              </h3>
              <span className="text-xs font-medium text-teal-600 dark:text-teal-400">
                {stats.total_properties > 0 ? `${Math.round((stats.assessed_properties / stats.total_properties) * 100)}% evaluated` : 'Evaluated'}
              </span>
            </div>
            <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-2 flex items-center gap-1">
              <span>With market & assessed values</span>
              <ChevronRight size={12} />
            </p>
          </div>
        </div>

        {/* Card 3: Pending Assessments */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('My Properties')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigate('My Properties')}
          className="group relative bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <span className="p-1.5 rounded-lg text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:bg-amber-50 dark:group-hover:bg-amber-950/40 transition-colors">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Pending Assessments
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                {stats.pending_assessments}
              </h3>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Awaiting evaluation
              </span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2 flex items-center gap-1">
              <span>View properties to assess</span>
              <ChevronRight size={12} />
            </p>
          </div>
        </div>

        {/* Card 4: Certificate Requests */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('Certificate Requests')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigate('Certificate Requests')}
          className="group relative bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <span className="p-1.5 rounded-lg text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 transition-colors">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Certificate Requests
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                {stats.total_requests}
              </h3>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {stats.approved_requests} Approved
              </span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-2 flex items-center gap-1">
              <span>{stats.pending_requests} pending / in process</span>
              <ChevronRight size={12} />
            </p>
          </div>
        </div>
      </div>

      {/* Property Showcase Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Registered Properties Overview</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Quick preview of your declared land and building records.</p>
          </div>
          <button
            onClick={() => onNavigate('My Properties')}
            className="text-xs font-bold text-green-700 dark:text-green-400 hover:underline flex items-center gap-1"
          >
            <span>View All ({stats.total_properties})</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {properties.map((prop) => (
            <div
              key={prop.property_id}
              onClick={() => onNavigate('My Properties')}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md hover:border-green-500/40 dark:hover:border-green-500/40 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    #{prop.property_id}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                    prop.assessment_status === 'ASSESSED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {prop.assessment_status}
                  </span>
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  {prop.property_type || 'Property'} {prop.lot_number || prop.building_name || ''}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-start gap-1 line-clamp-2">
                  <MapPin size={13} className="shrink-0 mt-0.5 text-gray-400" />
                  <span>{prop.location || 'Lagonglong, Misamis Oriental'}</span>
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Assessed Value</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {Number(prop.assessed_value) > 0 ? `₱${Number(prop.assessed_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Unassessed'}
                  </span>
                </div>
                {prop.has_gis && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <Map size={11} /> GIS Mapped
                  </span>
                )}
              </div>
            </div>
          ))}

          {properties.length === 0 && (
            <div className="col-span-full p-8 text-center bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
              <Building2 size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No properties registered yet</h3>
              <p className="text-xs text-gray-500 mt-1">Properties registered under your name in the Assessor's office will automatically appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Certificate Requests Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Recent Certificate Requests</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Track the status of your submitted certificate applications.</p>
          </div>
          <button
            onClick={() => onNavigate('Certificate Requests')}
            className="text-xs font-bold text-green-700 dark:text-green-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({stats.total_requests})</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-gray-800/40 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-3.5">Reference No.</th>
                <th className="px-6 py-3.5">Certificate Type</th>
                <th className="px-6 py-3.5">Property Location</th>
                <th className="px-6 py-3.5">Date Requested</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {recentRequests.map(req => (
                <tr 
                  key={req.request_id}
                  onClick={() => onNavigate('Certificate Requests')}
                  className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono font-bold text-xs text-gray-800 dark:text-gray-200">
                    {req.reference_number || `REQ-${String(req.request_id).padStart(5, '0')}`}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                    {req.certificate_type}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
                    {req.location || 'Lagonglong Property'}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                    {req.requested_at ? new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(req.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onNavigate('Certificate Requests')
                      }}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 inline-flex items-center gap-1"
                    >
                      <span>Track Details</span>
                      <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {recentRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    <FileText size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="font-semibold text-gray-700 dark:text-gray-300">No certificate requests submitted yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Need a certified copy or ownership certification? Click "Request Certificate" above.</p>
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
