import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { 
  Home, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Activity, 
  ArrowLeftRight, 
  FileText,
  Users,
  RefreshCw,
  CheckCircle
} from 'lucide-react'

export function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const loadDashboardData = async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const [statsRes, assignRes, reqRes] = await Promise.all([
        api.get('/stats/admin'),
        api.get('/assessments/assignments'),
        api.get('/assessments/requests')
      ])
      setData(statsRes.data)
      setAssignments(assignRes.data)
      setRequests(reqRes.data)
    } catch (err: any) {
      console.error('Failed to load admin dashboard data:', err)
      setError('Unable to load dashboard statistics from the server. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  if (!data && isRefreshing) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-green-600" />
        Loading dashboard statistics...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
        <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
        <button 
          onClick={loadDashboardData}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          Retry
        </button>
      </div>
    )
  }

  const stats = data?.stats || {}
  const overview = data?.assessmentOverview || {}
  const workload = data?.assessorWorkload || []
  const activities = data?.recentActivities || []
  
  const assigned = assignments.filter(a => a.assignment_status === 'assigned').length;
  const inProgress = assignments.filter(a => a.assignment_status === 'in_progress').length;
  const pendingRequests = requests.filter(r => r.request_status === 'pending').length;

  const getActionBadgeColor = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('APPROVE') || act.includes('PASS')) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    if (act.includes('ASSIGN') && !act.includes('REASSIGN')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    if (act.includes('REASSIGN')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300';
    if (act.includes('SUBMIT')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
    if (act.includes('CANCEL') || act.includes('REJECT') || act.includes('DELETE')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    if (act.includes('CREATE')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Existing Header with Refresh Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">Head Assessor Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of municipal property assessments and workflow.</p>
        </div>
        <button
          onClick={loadDashboardData}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition shadow-xs self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-green-600' : 'text-gray-500'} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* EXISTING ADMIN DASHBOARD METRICS (PRESERVED IN FULL)                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Metric title="Total Properties" value={stats.total_properties || 0} icon={<Home />} color="blue" onClick={() => navigate('/assessments')} />
        <Metric title="Unassessed Lots" value={stats.unassessed_lots || 0} icon={<AlertCircle />} color="orange" onClick={() => navigate('/building-properties')} />
        <Metric title="Unassessed Buildings" value={stats.unassessed_buildings || 0} icon={<Building2 />} color="orange" onClick={() => navigate('/building-properties')} />
        <Metric title="Assigned Assessments" value={assigned} icon={<FileText />} color="blue" onClick={() => navigate('/assessment-assignments')} />
        <Metric title="In Progress" value={inProgress} icon={<Activity />} color="purple" onClick={() => navigate('/assessment-assignments')} />
        
        <Metric title="Pending Approval" value={stats.pending_assessments || 0} icon={<Clock />} color="orange" onClick={() => navigate('/assessments?status=submitted')} />
        <Metric title="Returned" value={stats.returned_assessments || 0} icon={<AlertCircle />} color="red" onClick={() => navigate('/assessments?status=returned')} />
        <Metric title="Approved" value={stats.approved_assessments || 0} icon={<CheckCircle2 />} color="green" onClick={() => navigate('/assessments?status=approved')} />
        <Metric title="Permission Requests" value={pendingRequests} icon={<ArrowLeftRight />} color="purple" onClick={() => navigate('/permission-requests')} />
      </div>

      {/* ========================================================================= */}
      {/* NEW SECTION: OPERATIONAL OVERVIEW, WORKLOAD & SYSTEM ACTIVITIES           */}
      {/* ========================================================================= */}
      <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity size={20} className="text-green-600" />
            Operational Assessment Overview
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Database-backed statistics, workload distribution, and real-time municipal assessment activities.
          </p>
        </div>

        {/* A. ASSESSMENT OVERVIEW GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Total Properties</span>
              <Home size={15} className="text-blue-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{overview.total_properties || 0}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{overview.total_lots || 0} Lots • {overview.total_buildings || 0} Buildings</div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Total Assignments</span>
              <FileText size={15} className="text-purple-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{overview.total_assignments || 0}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{overview.active_assignments || 0} Active • {overview.cancelled_assignments || 0} Cancelled</div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Pending Review</span>
              <Clock size={15} className="text-amber-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{overview.pending_assessments || 0}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Awaiting Head Assessor approval</div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Completed Assessments</span>
              <CheckCircle size={15} className="text-green-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{overview.completed_assessments || 0}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Official approved records</div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between hover:scale-[1.01] transition-transform col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Unassigned Properties</span>
              <AlertCircle size={15} className="text-orange-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{overview.unassigned_properties || 0}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">No active task or assessment</div>
            </div>
          </div>
        </div>

        {/* B & C. TWO-COLUMN OPERATIONAL SECTION (Matching Staff Dashboard's lower architecture) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* B. ASSESSOR WORKLOAD SECTION */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users size={18} className="text-green-600" />
                  Field Assessor Workload Distribution
                </h3>
                <span className="text-xs text-gray-400 font-medium">
                  {workload.length} Active Assessor{workload.length !== 1 ? 's' : ''}
                </span>
              </div>

              {workload.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No active assessors found in the database.
                </div>
              ) : (
                <div className="space-y-3">
                  {workload.map((assessor: any) => (
                    <div 
                      key={assessor.user_id}
                      className="p-3 bg-gray-50/70 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/60 hover:border-green-200 dark:hover:border-green-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center font-bold text-xs">
                            {assessor.first_name?.[0] || 'A'}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-gray-900 dark:text-white">
                              {assessor.first_name} {assessor.last_name}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              Assessor ID #{assessor.user_id} • @{assessor.username}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                          {assessor.pending_assignments} Pending
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 text-center text-xs">
                        <div className="bg-white dark:bg-gray-800/80 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700/50">
                          <span className="text-gray-400 text-[10px] block">Total Assigned</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{assessor.total_assigned || 0}</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800/80 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700/50">
                          <span className="text-gray-400 text-[10px] block">Awaiting Review</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">{assessor.awaiting_review || 0}</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800/80 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700/50">
                          <span className="text-gray-400 text-[10px] block">Completed</span>
                          <span className="font-bold text-green-600 dark:text-green-400">{assessor.completed || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => navigate('/assessment-assignments')}
                className="text-xs font-semibold text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1"
              >
                <span>Manage Assignments</span>
                <ArrowLeftRight size={13} />
              </button>
            </div>
          </div>

          {/* C. RECENT SYSTEM ACTIVITIES SECTION */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity size={18} className="text-green-600" />
                  Recent System & Assessment Activities
                </h3>
                <span className="text-xs text-gray-400 font-medium">Real-time audit log</span>
              </div>

              {activities.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No system activity logs recorded yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {activities.map((act: any) => (
                    <div 
                      key={act.log_id}
                      className="p-3 bg-gray-50/70 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/60 text-xs hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getActionBadgeColor(act.action)}`}>
                            {act.action || 'ACTIVITY'}
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {act.module_name || 'System'}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {act.activity_date ? new Date(act.activity_date).toLocaleString() : ''}
                        </span>
                      </div>

                      <p className="mt-1.5 text-gray-700 dark:text-gray-300 font-normal">
                        {act.activity}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 pt-1.5 border-t border-gray-100 dark:border-gray-700/50">
                        <span>Target: <strong>{act.record_affected || 'General'}</strong></span>
                        <span>By: <strong>{act.user_name || 'System'}</strong> ({act.role || 'user'})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-400">
              <span>Automatic persistent database audit log</span>
              <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> Active Auditing
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ title, value, icon, color, onClick }: any) {
  const colors: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    red: 'text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    orange: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400',
    green: 'text-green-500 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    purple: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400'
  }
  return (
    <div onClick={onClick} className="glass-panel p-6 rounded-2xl flex items-center gap-5 hover:scale-[1.02] transition-transform cursor-pointer">
      <div className={`p-4 rounded-xl ${colors[color]}`}>{icon}</div>
      <div>
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      </div>
    </div>
  )
}
