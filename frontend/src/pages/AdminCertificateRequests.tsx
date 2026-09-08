import { useEffect, useState } from 'react'
import { FileText, Search, X } from 'lucide-react'
import api from '../lib/api'
import type { CertificateRequest } from '../types/property'

export function AdminCertificateRequests() {
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [selected, setSelected] = useState<CertificateRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusInput, setStatusInput] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    try {
      const { data } = await api.get('/admin/certificate-requests')
      setRequests(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !statusInput) return
    try {
      await api.put(`/admin/certificate-requests/${selected.request_id}`, {
        status: statusInput,
        rejection_reason: statusInput === 'REJECTED' ? rejectionReason : null
      })
      setSelected(null)
      load()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to update request status')
    }
  }

  const filteredRequests = requests.filter(r => 
    String(r.request_id).includes(search) || 
    r.client_name?.toLowerCase().includes(search.toLowerCase()) || 
    r.certificate_type.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="p-8 text-center text-gray-500">Loading requests...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Certificate Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Review and manage client certificate requests.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search requests..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm w-64"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 font-medium">Req No.</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Property</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRequests.map(req => (
                <tr key={req.request_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">REQ-{String(req.request_id).padStart(5, '0')}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{req.client_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{req.certificate_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 truncate max-w-[200px]">{req.location || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                      ${req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 
                      req.status === 'UNDER_REVIEW' ? 'bg-purple-100 text-purple-800' :
                      req.status === 'APPROVED' || req.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                      req.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
                      'bg-blue-100 text-blue-800'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => { setSelected(req); setStatusInput(req.status); setRejectionReason(req.rejection_reason || ''); }} 
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText size={20} className="text-gray-500"/>
                Review Request REQ-{String(selected.request_id).padStart(5, '0')}
              </h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="text-gray-500 dark:text-gray-400">Client</div><div className="col-span-2 font-medium text-gray-900 dark:text-white">{selected.client_name}</div>
                <div className="text-gray-500 dark:text-gray-400">Type</div><div className="col-span-2 text-gray-900 dark:text-white">{selected.certificate_type}</div>
                <div className="text-gray-500 dark:text-gray-400">Property</div><div className="col-span-2 text-gray-900 dark:text-white">{selected.location || 'N/A'}</div>
                <div className="text-gray-500 dark:text-gray-400">Purpose</div><div className="col-span-2 text-gray-900 dark:text-white">{selected.purpose}</div>
                {selected.remarks && <><div className="text-gray-500 dark:text-gray-400">Remarks</div><div className="col-span-2 text-gray-900 dark:text-white">{selected.remarks}</div></>}
              </div>

              <form onSubmit={updateStatus} className="pt-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Update Status</label>
                  <select 
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
                    value={statusInput}
                    onChange={e => setStatusInput(e.target.value)}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="READY_FOR_CLAIMING">READY FOR CLAIMING</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                
                {statusInput === 'REJECTED' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rejection Reason</label>
                    <textarea 
                      required 
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Please provide a reason for rejection..."
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setSelected(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-300 dark:border-gray-700">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Save Status</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
