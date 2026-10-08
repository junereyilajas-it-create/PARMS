import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Home, Building2, CheckCircle2, AlertCircle, Clock, Activity, ArrowLeftRight, FileText } from 'lucide-react'

export function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/stats/admin').then(res => setData(res.data)).catch(console.error)
    api.get('/assessments/assignments').then(res => setAssignments(res.data)).catch(console.error)
    api.get('/assessments/requests').then(res => setRequests(res.data)).catch(console.error)
  }, [])

  if (!data) return <div className="p-8">Loading dashboard...</div>

  const stats = data.stats || {}
  
  const assigned = assignments.filter(a => a.assignment_status === 'assigned').length;
  const inProgress = assignments.filter(a => a.assignment_status === 'in_progress').length;
  const pendingRequests = requests.filter(r => r.request_status === 'pending').length;

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">Head Assessor Dashboard</h1>
        <p className="text-gray-500 mt-2">Overview of municipal property assessments and workflow.</p>
      </div>

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
