import { useState, useEffect } from 'react'
import type { GeneratedCertificate } from '../types/Certificate'
import { format } from 'date-fns'

export default function CertificateRecords() {
  const token = localStorage.getItem('accessor_token')
  const [records, setRecords] = useState<GeneratedCertificate[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/generator/certificates`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setRecords(data)
        }
      } catch (err) {
        console.error('Failed to fetch certificate records:', err)
      }
    }
    fetchRecords()
  }, [token])

  const filteredRecords = records.filter(r => 
    r.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.certificate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requestor_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Certificate Records</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Generated Certificates</h2>
            <input 
              type="text" 
              placeholder="Search by owner, requestor, or ID..."
              className="w-64 h-9 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Cert ID</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Owner</th>
                  <th className="px-6 py-3 font-medium">Requestor</th>
                  <th className="px-6 py-3 font-medium">Purpose</th>
                  <th className="px-6 py-3 font-medium">Date Issued</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map(record => (
                    <tr key={record.certificate_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{record.certificate_number}</td>
                      <td className="px-6 py-4 truncate max-w-[150px]">{record.certificate_type}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{record.owner_name}</td>
                      <td className="px-6 py-4">{record.requestor_name}</td>
                      <td className="px-6 py-4 truncate max-w-[150px]">{record.purpose}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{format(new Date(record.issued_at), 'MMM dd, yyyy')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.status === 'Generated' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
