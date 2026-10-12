import { useState, useEffect, useMemo } from 'react'
import api from '../lib/api'
import { Activity, Search, Filter } from 'lucide-react'

export function ActivityLogsView() {
  const [logs, setLogs] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    api.get('/activity-logs-detailed').then(res => setLogs(res.data)).catch(console.error)
  }, [])

  const modules = useMemo(() => ['All', ...new Set(logs.map(l => l.module_name))], [logs])
  const roles = useMemo(() => ['All', 'super_admin', 'admin', 'assessor', 'staff', 'client'], [])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = `${log.first_name || ''} ${log.last_name || ''} ${log.activity} ${log.module_name} ${log.role}`.toLowerCase().includes(search.toLowerCase())
      const matchModule = moduleFilter === 'All' || log.module_name === moduleFilter
      const matchRole = roleFilter === 'All' || log.role === roleFilter

      let matchDate = true
      if (dateFrom || dateTo) {
        const logDate = new Date(log.activity_date)
        if (dateFrom && logDate < new Date(dateFrom)) matchDate = false
        if (dateTo) {
          const to = new Date(dateTo)
          to.setHours(23, 59, 59, 999)
          if (logDate > to) matchDate = false
        }
      }
      return matchSearch && matchModule && matchRole && matchDate
    })
  }, [logs, search, moduleFilter, roleFilter, dateFrom, dateTo])

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredLogs.slice(start, start + itemsPerPage)
  }, [filteredLogs, currentPage])

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-500" />
          <h1 className="text-2xl font-bold dark:text-white">Activity Logs</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={moduleFilter}
              onChange={e => { setModuleFilter(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm appearance-none"
            >
              <option value="All">All Modules</option>
              {modules.filter(m => m !== 'All').map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={roleFilter}
              onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm appearance-none capitalize"
            >
              <option value="All">All Roles</option>
              {roles.filter(r => r !== 'All').map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <button
            onClick={() => { setSearch(''); setModuleFilter('All'); setRoleFilter('All'); setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
            className="px-4 py-2 text-sm text-green-600 hover:text-green-800"
          >
            Reset
          </button>
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
            {paginatedLogs.length > 0 ? paginatedLogs.map(log => (
              <tr key={log.log_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                <td className="p-4 text-sm text-gray-500 whitespace-nowrap">{new Date(log.activity_date).toLocaleString()}</td>
                <td className="p-4 text-sm text-gray-900 dark:text-white">
                  <div className="font-medium">{log.first_name} {log.last_name}</div>
                  <div className="text-xs text-gray-500 capitalize">{log.role}</div>
                </td>
                <td className="p-4 text-sm text-gray-500">{log.module_name}</td>
                <td className="p-4 text-sm dark:text-white font-medium">{log.action || log.activity}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">No activity logs found.</td></tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
            <span className="text-sm text-gray-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
