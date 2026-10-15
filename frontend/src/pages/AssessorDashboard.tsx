import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { CheckCircle, Clock, AlertCircle, FileText, ArrowLeftRight, SquareDashed } from 'lucide-react'
import { DataTable } from '../components/common/DataTable'

export function AssessorDashboard() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [assessments, setAssessments] = useState<any[]>([])
  const [stats, setStats] = useState({
    unassessed_properties: 0,
    assigned_properties: 0,
    pending_assessments: 0,
    completed_assessments: 0,
    pending_permission_requests: 0,
    corrections_needed: 0
  })

  useEffect(() => {
    // Fetch assessor stats from backend
    api.get('/stats/assessor')
      .then(res => {
        if (res.data?.stats) {
          setStats(res.data.stats);
        }
      })
      .catch(console.error);

    // Fetch active assignments for the tables
    api.get('/assessments/assignments/my')
      .then(res => setAssignments(Array.isArray(res.data) ? res.data : []))
      .catch(console.error);

    // Fetch requests submitted by this assessor
    api.get('/assessments/requests?scope=my')
      .then(res => setRequests(Array.isArray(res.data) ? res.data : []))
      .catch(console.error);

    // Fetch assessments list
    api.get('/assessments')
      .then(res => setAssessments(Array.isArray(res.data) ? res.data : []))
      .catch(console.error);
  }, []);

  const getStatusBadge = (status: string) => {
    const s = String(status).toUpperCase();
    let style = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    if (s === 'APPROVED') {
      style = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-semibold';
    } else if (s === 'ASSIGNED' || s === 'IN_PROGRESS') {
      style = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-semibold';
    } else if (s === 'PENDING' || s === 'SUBMITTED') {
      style = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold';
    } else if (s === 'RETURNED' || s === 'RETURNED_FOR_CORRECTION') {
      style = 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-semibold';
    } else if (s === 'REJECTED' || s === 'CANCELLED') {
      style = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-semibold';
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs uppercase tracking-wide ${style}`}>{status}</span>;
  };

  const assignmentCols = [
    { key: 'target_id_str', label: 'PROPERTY ID', render: (v: string) => <span className="font-semibold text-gray-900 dark:text-white font-mono">{v}</span> },
    { key: 'property_type', label: 'TYPE', render: (v: string) => <span className="uppercase text-xs font-medium text-gray-700 dark:text-gray-300">{v}</span> },
    { key: 'due_date', label: 'DUE DATE', render: (v: string) => <span className="text-xs text-gray-500">{v ? new Date(v).toLocaleDateString() : '-'}</span> },
    { key: 'assignment_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) }
  ];

  const requestCols = [
    { key: 'target_id_str', label: 'PROPERTY ID', render: (v: string) => <span className="font-semibold text-gray-900 dark:text-white font-mono">{v}</span> },
    { key: 'property_type', label: 'TYPE', render: (v: string) => <span className="uppercase text-xs font-medium text-gray-700 dark:text-gray-300">{v}</span> },
    { key: 'reason', label: 'REASON', render: (v: string) => <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[150px] inline-block">{v || '-'}</span> },
    { key: 'request_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) }
  ];

  const assessmentCols = [
    { key: 'target_id', label: 'PROPERTY ID', render: (v: string) => <span className="font-semibold text-gray-900 dark:text-white font-mono">{v}</span> },
    { key: 'type', label: 'TYPE', render: (v: string) => <span className="uppercase text-xs font-medium text-gray-700 dark:text-gray-300">{v}</span> },
    { key: 'assessed_value', label: 'ASSESSED VALUE', render: (v: number) => Number(v) > 0 ? `₱${Number(v).toLocaleString()}` : '-' },
    { key: 'assessment_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) }
  ];

  const activeAssignments = assignments.filter(a => ['assigned', 'in_progress', 'submitted'].includes(a.assignment_status));
  const returnedAssessments = assessments.filter(a => ['returned', 'returned_for_correction'].includes(a.assessment_status));
  const completedAssessments = assessments.filter(a => a.assessment_status === 'approved');

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
          Assessor Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Manage your assigned properties, requests, and pending assessments. Click any card or row to view filtered records.
        </p>
      </div>
      
      {/* 5 Statistic Metric Cards - All Clickable with Hover and Visual Feedback */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric 
          title="Unassessed Properties" 
          value={stats.unassessed_properties} 
          icon={<SquareDashed className="w-5 h-5" />} 
          color="gray"
          subtitle="Awaiting appraisal"
          onClick={() => navigate('/properties?status=unassessed')} 
        />
        <Metric 
          title="Assigned Properties" 
          value={stats.assigned_properties} 
          icon={<Clock className="w-5 h-5" />} 
          color="blue" 
          subtitle="Assigned to your account"
          onClick={() => navigate('/properties?filter=assigned')} 
        />
        <Metric 
          title="Pending Assessments" 
          value={stats.pending_assessments} 
          icon={<AlertCircle className="w-5 h-5" />} 
          color="orange" 
          subtitle="Awaiting review or draft"
          onClick={() => navigate('/assessments?status=pending')} 
        />
        <Metric 
          title="Completed Assessments" 
          value={stats.completed_assessments} 
          icon={<CheckCircle className="w-5 h-5" />} 
          color="green" 
          subtitle="Approved assessment records"
          onClick={() => navigate('/assessments?status=approved')} 
        />
        <Metric 
          title="Pending Permission Requests" 
          value={stats.pending_permission_requests} 
          icon={<ArrowLeftRight className="w-5 h-5" />} 
          color="purple" 
          subtitle="Submitted permission requests"
          onClick={() => navigate('/my-requests?status=pending&tab=my_requests')} 
        />
      </div>

      {/* Dashboard Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Table 1: Active Assignments */}
        <div className="glass-panel rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-green-800 dark:text-green-400">
              <FileText className="w-5 h-5"/> My Active Assignments
            </h2>
            <span className="text-xs text-gray-500 font-medium">Click row to open property</span>
          </div>
          <DataTable 
            columns={assignmentCols} 
            data={activeAssignments.slice(0, 5)} 
            showActions={false}
            onRowClick={(row: any) => navigate(`/properties?search=${encodeURIComponent(row.target_id_str)}`)}
          />
          {activeAssignments.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">No active assignments at this time.</p>
          )}
        </div>
        
        {/* Table 2: Corrections Needed */}
        <div className="glass-panel rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-5 h-5"/> My Corrections
            </h2>
            <span className="text-xs text-gray-500 font-medium">Click row to correct</span>
          </div>
          <DataTable 
            columns={assessmentCols} 
            data={returnedAssessments.slice(0, 5)} 
            showActions={false}
            onRowClick={() => navigate('/assessments?status=returned')}
          />
          {returnedAssessments.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">No corrections needed at this time.</p>
          )}
        </div>

        {/* Table 3: My Requests */}
        <div className="glass-panel rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-teal-800 dark:text-teal-400">
              <ArrowLeftRight className="w-5 h-5"/> My Requests
            </h2>
            <span className="text-xs text-gray-500 font-medium">Click row to open My Requests</span>
          </div>
          <DataTable 
            columns={requestCols} 
            data={requests.slice(0, 5)} 
            showActions={false}
            onRowClick={(row: any) => navigate(`/my-requests?tab=my_requests&search=${encodeURIComponent(row.target_id_str)}`)}
          />
          {requests.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">No permission requests submitted yet.</p>
          )}
        </div>

        {/* Table 4: Completed Assessments */}
        <div className="glass-panel rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5"/> Completed Assessments
            </h2>
            <span className="text-xs text-gray-500 font-medium">Click row to view records</span>
          </div>
          <DataTable 
            columns={assessmentCols} 
            data={completedAssessments.slice(0, 5)} 
            showActions={false}
            onRowClick={() => navigate('/assessments?status=approved')}
          />
          {completedAssessments.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">No completed assessments yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ title, value, icon, color, subtitle, onClick }: { title: string; value: number; icon: React.ReactNode; color: string; subtitle?: string; onClick: () => void }) {
  const colors: Record<string, string> = { 
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400', 
    green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400', 
    orange: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400',
    gray: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400'
  }

  return (
    <div 
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer border border-gray-200/80 dark:border-gray-800 hover:border-green-500/80 dark:hover:border-green-500/80 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all select-none group"
      title={`Click to view ${title}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl ${colors[color]} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {value}
        </div>
        {subtitle && (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 truncate">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}

