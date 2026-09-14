import { useState, useEffect, useMemo } from 'react'
import api from '../lib/api'
import { Activity, Search, Filter } from 'lucide-react'

export function ActivityLogsView() {
  const [logs, setLogs] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('All')
  
  useEffect(() => {
    api.get('/activity-logs-detailed').then(res => setLogs(res.data)).catch(console.error)
  }, [])

  const modules = useMemo(() => ['All', ...new Set(logs.map(l => l.module_name))], [logs])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = `${log.first_name || ''} ${log.last_name || ''} ${log.activity} ${log.module_name}`.toLowerCase().includes(search.toLowerCase())
      const matchModule = moduleFilter === 'All' || log.module_name === moduleFilter
      return matchSearch && matchModule
    })
  }, [logs, search, moduleFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-500" />
          <h1 className="text-2xl font-bold dark:text-white">Activity Logs</h1>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search logs..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm appearance-none"
            >
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <th className="p-4 text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase">Module</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase">Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredLogs.length > 0 ? filteredLogs.map(log => (
              <tr key={log.log_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                <td className="p-4 text-sm text-gray-500 whitespace-nowrap">{new Date(log.activity_date).toLocaleString()}</td>
                <td className="p-4 text-sm text-gray-900 dark:text-white">
                  <div className="font-medium">{log.first_name} {log.last_name}</div>
                  <div className="text-xs text-gray-500 capitalize">{log.role}</div>
                </td>
                <td className="p-4 text-sm text-gray-500">{log.module_name}</td>
                <td className="p-4 text-sm dark:text-white">{log.activity}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">No activity logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
