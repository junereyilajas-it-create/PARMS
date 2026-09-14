import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import api from '../lib/api'
import type { CertificateRequest } from '../types/property'
import { useModal } from '../contexts/ModalContext'

export function ClientCertificateRequests() {
  const { showSuccess, showError } = useModal()
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    property_id: '',
    certificate_type: 'Certificate of Property Ownership',
    purpose: '',
    remarks: ''
  })

  useEffect(() => {
    async function load() {
      try {
        const [reqs, props] = await Promise.all([
          api.get('/client/certificate-requests'),
          api.get('/client/my-properties')
        ])
        setRequests(reqs.data || [])
        setProperties(props.data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isFormOpen])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/client/certificate-requests', {
        property_id: form.property_id || null,
        certificate_type: form.certificate_type,
        purpose: form.purpose,
        remarks: form.remarks
      })
      setIsFormOpen(false)
      setForm({ property_id: '', certificate_type: 'Certificate of Property Ownership', purpose: '', remarks: '' })
      showSuccess('Certificate request submitted successfully.')
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to submit request')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading requests...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">My Certificate Requests</h2>
        <button onClick={() => setIsFormOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
          <Plus size={18} /> New Request
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400">
                <th className="px-6 py-3 font-medium">Request No.</th>
                <th className="px-6 py-3 font-medium">Certificate Type</th>
                <th className="px-6 py-3 font-medium">Property</th>
                <th className="px-6 py-3 font-medium">Purpose</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {requests.map(req => (
                <tr key={req.request_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">REQ-{String(req.request_id).padStart(5, '0')}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{req.certificate_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{req.location || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 truncate max-w-[200px]">{req.purpose}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                      ${req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 
                      req.status === 'APPROVED' || req.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                      req.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
                      'bg-blue-100 text-blue-800'}`}>
                      {req.status}
                    </span>
                    {req.rejection_reason && <p className="text-xs text-red-500 mt-1">Reason: {req.rejection_reason}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(req.requested_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Request Certificate</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Certificate Type</label>
                <select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.certificate_type} onChange={e => setForm({...form, certificate_type: e.target.value})} required>
                  <option value="Certificate of Property Ownership">Certificate of Property Ownership</option>
                  <option value="Certificate of Property Holdings">Certificate of Property Holdings</option>
                  <option value="Certificate of Assessment">Certificate of Assessment</option>
                  <option value="Certificate of No Property Holdings">Certificate of No Property Holdings</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property (Optional for some certificates)</label>
                <select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.property_id} onChange={e => setForm({...form, property_id: e.target.value})}>
                  <option value="">-- Select a property --</option>
                  {properties.map(p => (
                    <option key={p.property_id} value={p.property_id}>{p.property_type} - {p.location}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purpose</label>
                <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} placeholder="e.g. Bank Loan, Business Permit" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks (Optional)</label>
                <textarea className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm min-h-[100px]" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Any additional information..." />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800 mt-6">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-300 dark:border-gray-700">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-70">{busy ? 'Submitting...' : 'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
