import { useEffect, useState } from 'react'
import api from '../lib/api'

export function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    api.get('/stats/super_admin').then(res => setStats(res.data)).catch(console.error)
    api.get('/stats/health').then(res => setHealth(res.data)).catch(e => {
      setHealth({ status: 'OFFLINE', error: e.message })
    })
  }, [])

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">Super Admin Dashboard</h1>
        <p className="text-gray-500 mt-2">System overview, user management statistics, and system health.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Frontend</p>
            <p className="text-lg font-bold text-green-600">ONLINE</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Backend API</p>
            <p className={`text-lg font-bold ${health ? (health.status === 'ONLINE' ? 'text-green-600' : 'text-green-600') : 'text-gray-400'}`}>
              {health ? health.status : 'CHECKING...'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${health ? (health.status === 'ONLINE' ? 'bg-green-500' : 'bg-green-500') : 'bg-gray-300 animate-pulse'}`}></div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Database</p>
            <p className={`text-lg font-bold ${health ? (health.status === 'ONLINE' ? 'text-green-600' : 'text-green-600') : 'text-gray-400'}`}>
              {health ? health.status : 'CHECKING...'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${health ? (health.status === 'ONLINE' ? 'bg-green-500' : 'bg-green-500') : 'bg-gray-300 animate-pulse'}`}></div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Authentication</p>
            <p className="text-lg font-bold text-green-600">ONLINE</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Users</span>
          <span className="text-3xl font-bold dark:text-white">{stats?.totalUsers || 0}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center">
          <span className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Active Users</span>
          <span className="text-3xl font-bold dark:text-white">{stats?.activeUsers || 0}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center">
          <span className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Inactive Users</span>
          <span className="text-3xl font-bold dark:text-white">{stats?.inactiveUsers || 0}</span>
        </div>

        {['super_admin', 'admin', 'assessor', 'staff', 'client'].map((role) => {
          const roleStat = stats?.users?.find((u: any) => u.role === role)
          const roleColor = role === 'super_admin' ? 'text-purple-500' :
            role === 'admin' ? 'text-red-500' :
              role === 'assessor' ? 'text-orange-500' :
                role === 'staff' ? 'text-blue-500' : 'text-teal-500';
          return (
            <div key={role} className="glass-panel p-5 rounded-2xl flex flex-col justify-center">
              <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${roleColor}`}>{role.replace('_', ' ')}s</span>
              <span className="text-3xl font-bold dark:text-white">{roleStat?.count || 0}</span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center border-t-4 border-green-500">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Properties</span>
          <span className="text-2xl font-bold dark:text-white">{stats?.total_properties || 0}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center border-t-4 border-green-500">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Lots</span>
          <span className="text-2xl font-bold dark:text-white">{stats?.total_lots || 0}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center border-t-4 border-green-500">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Buildings</span>
          <span className="text-2xl font-bold dark:text-white">{stats?.total_buildings || 0}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center border-t-4 border-green-500">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Assessments</span>
          <span className="text-2xl font-bold dark:text-white">{stats?.total_assessments || 0}</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center border-t-4 border-green-500">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assessed Prop.</span>
          <span className="text-2xl font-bold dark:text-white">{stats?.assessed_properties || 0}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center border-t-4 border-green-500">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Unassessed Prop.</span>
          <span className="text-2xl font-bold dark:text-white">{stats?.unassessed_properties || 0}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center border-t-4 border-green-500">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Pending Certs</span>
          <span className="text-2xl font-bold dark:text-white">{stats?.pending_certificate_requests || 0}</span>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white">Recent System Activity</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Module</th>
                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {stats?.activities?.map((act: any) => (
                <tr key={act.log_id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="p-3 text-sm font-medium dark:text-white">
                    {act.first_name ? `${act.first_name} ${act.last_name}` : (act.username || 'System')}
                  </td>
                  <td className="p-3 text-sm">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs uppercase">{act.role || 'system'}</span>
                  </td>
                  <td className="p-3 text-sm font-medium">{act.action}</td>
                  <td className="p-3 text-sm"><span className="px-2 py-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">{act.module_name}</span></td>
                  <td className="p-3 text-sm text-gray-500">{new Date(act.activity_date).toLocaleString()}</td>
                </tr>
              ))}
              {!stats?.activities?.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No recent activity logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
