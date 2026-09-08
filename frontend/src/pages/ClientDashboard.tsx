import { useEffect, useState } from 'react'
import { Building2, FileText, Activity } from 'lucide-react'
import api from '../lib/api'

export function ClientDashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [stats, setStats] = useState({ properties: 0, pendingRequests: 0, completedRequests: 0 })
  const [recentRequests, setRecentRequests] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [propsRes, reqsRes] = await Promise.all([
          api.get('/client/my-properties'),
          api.get('/client/certificate-requests')
        ])
        const requests = reqsRes.data || []
        setStats({
          properties: propsRes.data?.length || 0,
          pendingRequests: requests.filter((r: any) => ['PENDING', 'UNDER_REVIEW'].includes(r.status)).length,
          completedRequests: requests.filter((r: any) => ['COMPLETED', 'READY_FOR_CLAIMING'].includes(r.status)).length
        })
        setRecentRequests(requests.slice(0, 5))
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center"><Building2 /></div>
          <div><p className="text-sm text-gray-500 dark:text-gray-400">My Properties</p><h3 className="text-2xl font-bold">{stats.properties}</h3></div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center"><Activity /></div>
          <div><p className="text-sm text-gray-500 dark:text-gray-400">Pending Requests</p><h3 className="text-2xl font-bold">{stats.pendingRequests}</h3></div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center"><FileText /></div>
          <div><p className="text-sm text-gray-500 dark:text-gray-400">Completed Requests</p><h3 className="text-2xl font-bold">{stats.completedRequests}</h3></div>
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => onNavigate('My Properties')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">View My Properties</button>
        <button onClick={() => onNavigate('My Property Map')} className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">View My Property Map</button>
        <button onClick={() => onNavigate('Request Certificate')} className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">Request Certificate</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700"><h3 className="font-semibold text-lg text-gray-900 dark:text-white">Recent Certificate Requests</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400">
                <th className="px-6 py-3 font-medium">Request No.</th>
                <th className="px-6 py-3 font-medium">Certificate Type</th>
                <th className="px-6 py-3 font-medium">Property</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentRequests.map(req => (
                <tr key={req.request_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => onNavigate('My Requests')}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">REQ-{String(req.request_id).padStart(5, '0')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{req.certificate_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{req.location || 'N/A'}</td>
                  <td className="px-6 py-4"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : req.status === 'APPROVED' ? 'bg-green-100 text-green-800' : req.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{req.status}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(req.requested_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentRequests.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No recent certificate requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
