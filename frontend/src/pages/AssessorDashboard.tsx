import { useState, useEffect } from 'react'
import api from '../lib/api'
import { CheckCircle, Clock, AlertCircle, FileText, ArrowLeftRight } from 'lucide-react'
import { DataTable } from '../components/common/DataTable'

export function AssessorDashboard() {
  const [assignments, setAssignments] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])

  useEffect(() => {
    api.get('/assessments/assignments/my').then(res => setAssignments(res.data)).catch(console.error)
    api.get('/assessments/requests').then(res => setRequests(res.data)).catch(console.error)
  }, [])

  const getStatusBadge = (status: string) => {
    const s = String(status).toUpperCase();
    const style = s === 'APPROVED' ? 'bg-green-100 text-green-800' 
                : s === 'ASSIGNED' ? 'bg-green-100 text-green-800' 
                : s === 'IN_PROGRESS' ? 'bg-green-100 text-green-800' 
                : s === 'PENDING' || s === 'SUBMITTED' ? 'bg-green-100 text-green-800'
                : s === 'RETURNED' ? 'bg-green-100 text-green-800'
                : s === 'REJECTED' || s === 'CANCELLED' ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>{status}</span>;
  };

  const assignmentCols = [
    { key: 'target_id_str', label: 'PROPERTY ID' },
    { key: 'property_type', label: 'TYPE', render: (v: string) => v.toUpperCase() },
    { key: 'due_date', label: 'DUE DATE', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'assignment_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) }
  ];

  const requestCols = [
    { key: 'target_id_str', label: 'PROPERTY ID' },
    { key: 'property_type', label: 'TYPE', render: (v: string) => v.toUpperCase() },
    { key: 'reason', label: 'REASON' },
    { key: 'request_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) }
  ];

  const activeAssignments = assignments.filter(a => ['assigned', 'in_progress', 'submitted'].includes(a.assignment_status));
  const returnedAssignments = assignments.filter(a => a.assignment_status === 'returned');
  const completedAssignments = assignments.filter(a => a.assignment_status === 'approved');

  const pendingRequests = requests.filter(r => r.request_status === 'pending');

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">Assessor Dashboard</h1>
        <p className="text-gray-500 mt-2">Manage your assigned properties, requests, and pending assessments.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric title="Active Assignments" value={activeAssignments.length} icon={<Clock/>} color="blue" />
        <Metric title="Corrections Needed" value={returnedAssignments.length} icon={<AlertCircle/>} color="orange" />
        <Metric title="Pending Requests" value={pendingRequests.length} icon={<ArrowLeftRight/>} color="purple" />
        <Metric title="Completed Assessments" value={completedAssignments.length} icon={<CheckCircle/>} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-800 dark:text-green-400">
            <FileText className="w-5 h-5"/> My Active Assignments
          </h2>
          <DataTable columns={assignmentCols} data={activeAssignments.slice(0, 5)} showActions={false} />
          {activeAssignments.length === 0 && <p className="text-sm text-gray-500 mt-4">No active assignments.</p>}
        </div>
        
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-800 dark:text-green-400">
            <AlertCircle className="w-5 h-5"/> My Corrections
          </h2>
          <DataTable columns={assignmentCols} data={returnedAssignments.slice(0, 5)} showActions={false} />
          {returnedAssignments.length === 0 && <p className="text-sm text-gray-500 mt-4">No corrections needed at this time.</p>}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-800 dark:text-green-400">
            <ArrowLeftRight className="w-5 h-5"/> My Requests
          </h2>
          <DataTable columns={requestCols} data={requests.slice(0, 5)} showActions={false} />
          {requests.length === 0 && <p className="text-sm text-gray-500 mt-4">No permission requests.</p>}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-800 dark:text-green-400">
            <CheckCircle className="w-5 h-5"/> Completed
          </h2>
          <DataTable columns={assignmentCols} data={completedAssignments.slice(0, 5)} showActions={false} />
          {completedAssignments.length === 0 && <p className="text-sm text-gray-500 mt-4">No completed assessments yet.</p>}
        </div>
      </div>
    </div>
  )
}

function Metric({ title, value, icon, color }: any) {
  const colors: Record<string, string> = { 
    blue: 'text-green-500 bg-green-50 dark:bg-green-900/20 dark:text-green-400', 
    green: 'text-green-500 bg-green-50 dark:bg-green-900/20 dark:text-green-400', 
    orange: 'text-green-500 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    purple: 'text-green-500 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
  }
  return (
    <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 hover:scale-[1.02] transition-transform">
      <div className={`p-4 rounded-xl ${colors[color]}`}>{icon}</div>
      <div>
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      </div>
    </div>
  )
}
