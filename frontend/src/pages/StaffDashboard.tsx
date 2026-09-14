import { useState, useEffect } from 'react'
import api from '../lib/api'
import { Home, Users, Map, Building, FileText, CheckCircle, XCircle } from 'lucide-react'

export function StaffDashboard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    api.get('/stats/staff').then(res => setData(res.data)).catch(console.error)
  }, [])

  if (!data) return <div className="p-8">Loading dashboard...</div>
  const { stats, recentProperties, recentDocs } = data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-white">Staff Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric title="Total Properties" value={stats.total_properties} icon={<Home/>} color="blue" />
        <Metric title="Total Owners" value={stats.total_owners} icon={<Users/>} color="orange" />
        <Metric title="Total Lots" value={stats.total_lots} icon={<Map/>} color="green" />
        <Metric title="Total Buildings" value={stats.total_buildings} icon={<Building/>} color="purple" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400"><CheckCircle size={18} className="text-green-500"/> Assessed Properties</div>
          <div className="text-xl font-bold dark:text-white">{stats.assessed_properties}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400"><XCircle size={18} className="text-red-500"/> Unassessed Properties</div>
          <div className="text-xl font-bold dark:text-white">{stats.unassessed_properties}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Recently Added Properties</h2>
          <div className="space-y-3">
            {recentProperties.map((p: any) => (
              <div key={p.property_id} className="text-sm border-b border-gray-100 dark:border-gray-800 pb-2 flex justify-between">
                <span>Property {p.property_id}</span>
                <span className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 dark:text-white flex items-center gap-2"><FileText size={18}/> Recently Issued Documents</h2>
          <div className="space-y-3">
            {recentDocs.map((d: any) => (
              <div key={d.issuance_id} className="text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="font-medium">{d.certification_number}</span> - {d.document_type}
                <div className="text-xs text-gray-500">Issued to {d.requestor_name} on {new Date(d.issued_at).toLocaleDateString()}</div>
              </div>
            ))}
            {recentDocs.length === 0 && <div className="text-sm text-gray-500">No recent documents.</div>}
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
