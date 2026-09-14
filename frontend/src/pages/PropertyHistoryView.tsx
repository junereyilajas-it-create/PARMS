import { useState, useEffect } from 'react'
import api from '../lib/api'
import { History } from 'lucide-react'

export function PropertyHistoryView() {
  const [history, setHistory] = useState<any[]>([])
  
  useEffect(() => {
    // Assuming backend endpoint /property_history can be fetched (Wait, I need to create this in resources.js or stats.js)
    api.get('/stats/assessor').then(res => setHistory(res.data.recentUpdates)).catch(console.error)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History className="text-purple-500" />
        <h1 className="text-2xl font-bold dark:text-white">Property History</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <th className="p-4 text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase">Property ID</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map(h => (
              <tr key={h.history_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                <td className="p-4 text-sm text-gray-500 whitespace-nowrap">{new Date(h.history_date).toLocaleString()}</td>
                <td className="p-4 text-sm text-gray-500">{h.property_id}</td>
                <td className="p-4 text-sm dark:text-white">{h.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
