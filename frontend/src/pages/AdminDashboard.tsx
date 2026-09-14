import { useState, useEffect } from 'react'
import api from '../lib/api'
import { Users, UserPlus, Shield, Activity, FileText } from 'lucide-react'

export function AdminDashboard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    api.get('/stats/admin').then(res => setStats(res.data)).catch(console.error)
  }, [])

  if (!stats) return <div className="p-8">Loading dashboard...</div>

  const countByRole = (role: string) => stats.users.find((u: any) => u.role === role)?.count || 0
  const totalUsers = stats.users.reduce((acc: number, u: any) => acc + Number(u.count), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-white">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric title="Total Users" value={totalUsers} icon={<Users />} color="blue" />
        <Metric title="Admins" value={countByRole('admin')} icon={<Shield />} color="red" />
        <Metric title="Assessors" value={countByRole('assessor')} icon={<Activity />} color="orange" />
        <Metric title="Staff" value={countByRole('staff')} icon={<FileText />} color="green" />
        <Metric title="Property Owners" value={countByRole('client')} icon={<Users />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Recent Activities</h2>
          <div className="space-y-3">
            {stats.activities.map((act: any) => (
              <div key={act.log_id} className="text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="font-medium">{act.role}</span> - {act.activity}
                <div className="text-xs text-gray-500">{new Date(act.activity_date).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Recent User Registrations</h2>
          <div className="space-y-3">
            {stats.registrations.map((u: any) => (
              <div key={u.user_id} className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                <span>{u.first_name} {u.last_name}</span>
                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 uppercase">{u.role}</span>
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
