import { useState, useEffect } from 'react'
import api from '../lib/api'
import { Home, Map, Building, CheckCircle, XCircle, Clock } from 'lucide-react'

export function AssessorDashboard() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    api.get('/stats/assessor').then(res => setData(res.data)).catch(console.error)
  }, [])

  if (!data) return <div className="p-8">Loading dashboard...</div>
  const { stats, recentAssessments, recentUpdates } = data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-white">Assessor Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Metric title="Total Properties" value={stats.total_properties} icon={<Home/>} color="blue" />
        <Metric title="Total Lots" value={stats.total_lots} icon={<Map/>} color="green" />
        <Metric title="Total Buildings" value={stats.total_buildings} icon={<Building/>} color="purple" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <SmallMetric title="Assessed Props" value={stats.assessed_properties} icon={<CheckCircle size={16}/>} />
        <SmallMetric title="Unassessed Props" value={stats.unassessed_properties} icon={<XCircle size={16}/>} />
        <SmallMetric title="Assessed Lots" value={stats.assessed_lots} icon={<CheckCircle size={16}/>} />
        <SmallMetric title="Unassessed Lots" value={stats.unassessed_lots} icon={<XCircle size={16}/>} />
        <SmallMetric title="Assessed Bldgs" value={stats.assessed_buildings} icon={<CheckCircle size={16}/>} />
        <SmallMetric title="Unassessed Bldgs" value={stats.unassessed_buildings} icon={<XCircle size={16}/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 dark:text-white flex items-center gap-2"><Clock size={18}/> Recent Assessments</h2>
          <div className="space-y-3">
            {recentAssessments.map((a: any) => (
              <div key={a.assessment_id} className="text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="font-medium">Prop {a.property_id}</span> - Assessed at ₱{Number(a.assessed_value).toLocaleString()}
                <div className="text-xs text-gray-500">{new Date(a.assessment_date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Recent Property Updates</h2>
          <div className="space-y-3">
            {recentUpdates.map((u: any) => (
              <div key={u.history_id} className="text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="font-medium">Prop {u.property_id}</span> - {u.action}
                <div className="text-xs text-gray-500">{new Date(u.history_date).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ title, value, icon, color }: any) {
  const colors: Record<string, string> = { blue: 'text-blue-500 bg-blue-50', red: 'text-red-500 bg-red-50', orange: 'text-orange-500 bg-orange-50', green: 'text-green-500 bg-green-50', purple: 'text-purple-500 bg-purple-50' }
  const darkColors: Record<string, string> = { blue: 'dark:text-blue-400 dark:bg-blue-900/20', red: 'dark:text-red-400 dark:bg-red-900/20', orange: 'dark:text-orange-400 dark:bg-orange-900/20', green: 'dark:text-green-400 dark:bg-green-900/20', purple: 'dark:text-purple-400 dark:bg-purple-900/20' }
  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors[color]} ${darkColors[color]}`}>{icon}</div>
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
        <div className="text-2xl font-bold dark:text-white">{value}</div>
      </div>
    </div>
  )
}

function SmallMetric({ title, value, icon }: any) {
  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between h-24">
      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">{icon} {title}</div>
      <div className="text-xl font-bold dark:text-white">{value}</div>
    </div>
  )
}
