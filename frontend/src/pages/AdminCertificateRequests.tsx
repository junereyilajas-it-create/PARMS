import { useEffect, useState, useMemo } from 'react'
import { 
  FileText, 
  Search, 
  Filter, 
  RotateCcw, 
  Printer, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileCheck, 
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import api from '../lib/api'
import type { CertificateRequest } from '../types/property'
import { useModal } from '../contexts/ModalContext'
import { format } from 'date-fns'

const CERTIFICATE_TYPES = [
  'Certificate of Property Ownership',
  'Certificate of Property Holdings',
  'Certificate of Assessment',
  'Certificate of No Property Holdings',
  'Certified True Copy of Tax Declaration'
]

export function AdminCertificateRequests() {
  const { showSuccess, showError } = useModal()

  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Review & Action Modal
  const [selectedRequest, setSelectedRequest] = useState<CertificateRequest | null>(null)
  const [processingNotes, setProcessingNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [signerName, setSignerName] = useState('MARIE MAE P. UBALDE')
  const [signerTitle, setSignerTitle] = useState('OIC - Municipal Assessor')
  const [orNumber, setOrNumber] = useState('4567695')
  const [actionLoading, setActionLoading] = useState(false)

  // Print Preview Modal
  const [previewDocData, setPreviewDocData] = useState<any | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [loadingDoc, setLoadingDoc] = useState(false)

  const loadData = async () => {
    try {
      const [reqsRes, profileRes] = await Promise.all([
        api.get('/admin/certificate-requests'),
        api.get('/profile').catch(() => ({ data: {} }))
      ])
      setRequests(Array.isArray(reqsRes.data) ? reqsRes.data : [])
      if (profileRes.data?.role) {
        setUserRole(profileRes.data.role.toLowerCase())
        setCurrentUserId(profileRes.data.id || profileRes.data.user_id)
      }
    } catch (e: any) {
      console.error('Failed to load certificate requests:', e)
      showError('Unable to load certificate requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const isAdminOrSuper = ['admin', 'super_admin'].includes(userRole)
  const isStaff = userRole === 'staff'

  // Summary Metrics
  const metrics = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'PENDING').length,
      processing: requests.filter(r => ['PROCESSING', 'UNDER_REVIEW'].includes(r.status)).length,
      approved: requests.filter(r => ['APPROVED', 'COMPLETED'].includes(r.status)).length,
      rejected: requests.filter(r => ['REJECTED', 'RETURNED'].includes(r.status)).length
    }
  }, [requests])

  const handleResetFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchRef = String(req.reference_number || req.request_id).toLowerCase().includes(q)
        const matchClient = String(req.client_name || '').toLowerCase().includes(q)
        const matchOwner = String(req.owner_name || '').toLowerCase().includes(q)
        const matchType = String(req.certificate_type || '').toLowerCase().includes(q)
        const matchProp = String(req.location || req.property_id || '').toLowerCase().includes(q)
        const matchPurp = String(req.purpose || '').toLowerCase().includes(q)
        if (!matchRef && !matchClient && !matchOwner && !matchType && !matchProp && !matchPurp) return false
      }

      if (typeFilter !== 'all' && req.certificate_type !== typeFilter) return false

      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && req.status !== 'PENDING') return false
        if (statusFilter === 'processing' && !['PROCESSING', 'UNDER_REVIEW'].includes(req.status)) return false
        if (statusFilter === 'approved' && !['APPROVED', 'COMPLETED'].includes(req.status)) return false
        if (statusFilter === 'rejected' && !['REJECTED', 'RETURNED'].includes(req.status)) return false
      }

      if (dateFrom) {
        const reqDate = new Date(req.requested_at).toISOString().slice(0, 10)
        if (reqDate < dateFrom) return false
      }
      if (dateTo) {
        const reqDate = new Date(req.requested_at).toISOString().slice(0, 10)
        if (reqDate > dateTo) return false
      }

      return true
    })
  }, [requests, search, typeFilter, statusFilter, dateFrom, dateTo])

  // Open Review Dialog
  const handleOpenReview = (req: CertificateRequest) => {
    setSelectedRequest(req)
    setProcessingNotes(req.processing_notes || '')
    setRejectionReason(req.rejection_reason || '')
  }

  // Update Status Action
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedRequest) return

    if (['REJECTED', 'RETURNED'].includes(newStatus) && !rejectionReason.trim()) {
      showError('Please provide a reason or note for this action.')
      return
    }

    setActionLoading(true)
    try {
      await api.put(`/admin/certificate-requests/${selectedRequest.request_id}`, {
        status: newStatus,
        processing_notes: processingNotes.trim(),
        rejection_reason: rejectionReason.trim(),
        assigned_to: newStatus === 'PROCESSING' && !selectedRequest.assigned_to ? currentUserId : undefined
      })

      showSuccess(`Request #${selectedRequest.reference_number || selectedRequest.request_id} updated to ${newStatus}.`)
      setSelectedRequest(null)
      await loadData()
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update request status.')
    } finally {
      setActionLoading(false)
    }
  }

  // Generate & Issue Certificate (Admin action)
  const handleGenerateAndApprove = async () => {
    if (!selectedRequest) return

    setActionLoading(true)
    try {
      const res = await api.post(`/admin/certificate-requests/${selectedRequest.request_id}/generate`, {
        certificate_type: selectedRequest.certificate_type,
        signer_name: signerName.trim(),
        signer_title: signerTitle.trim(),
        or_number: orNumber.trim()
      })

      showSuccess(`Certificate ${res.data.certificate_number} generated and request completed!`)
      setSelectedRequest(null)
      await loadData()
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to generate certificate.')
    } finally {
      setActionLoading(false)
    }
  }

  // Preview & Print Document
  const handleOpenPrintPreview = async (req: CertificateRequest) => {
    setLoadingDoc(true)
    setIsPreviewOpen(true)
    setSelectedRequest(req)
    try {
      // Use generator details or client document endpoint
      const res = await api.get(`/client/certificate-requests/${req.request_id}/document`)
      setPreviewDocData(res.data)
    } catch (err: any) {
      console.error('Failed to load certificate document for preview:', err)
      // Fallback to property info
      if (req.property_id) {
        try {
          const propRes = await api.get(`/generator/properties/${req.property_id}`)
          setPreviewDocData({
            request: req,
            property: propRes.data?.property,
            ownerProperties: propRes.data?.ownerProperties || [],
            generatedCertificate: propRes.data?.latestCertificate
          })
        } catch (e) {
          showError('Unable to preview the document template.')
          setIsPreviewOpen(false)
        }
      } else {
        showError('Unable to preview document.')
        setIsPreviewOpen(false)
      }
    } finally {
      setLoadingDoc(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 size={12} />
            {status}
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock size={12} />
            Pending
          </span>
        )
      case 'PROCESSING':
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <FileCheck size={12} />
            {status === 'UNDER_REVIEW' ? 'For Admin Review' : 'Processing'}
          </span>
        )
      case 'REJECTED':
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertCircle size={12} />
            {status}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Page Header (Matching Reports Page Pattern) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">
            Certificate Request Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review, verify, generate, and issue official property certifications and certified true copies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 uppercase">
            Role: {userRole.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* 5 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-white dark:bg-gray-800 border-green-500 shadow-md ring-2 ring-green-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">Total Requests</span>
          <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">{metrics.total}</span>
          <span className="text-[11px] text-gray-400 mt-1 block">All submissions</span>
        </div>

        <div 
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-amber-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">Pending Review</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{metrics.pending}</span>
          <span className="text-[11px] text-gray-400 mt-1 block">New applications</span>
        </div>

        <div 
          onClick={() => setStatusFilter('processing')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'processing'
              ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">In Processing</span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 block">{metrics.processing}</span>
          <span className="text-[11px] text-gray-400 mt-1 block">Staff preparing</span>
        </div>

        <div 
          onClick={() => setStatusFilter('approved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-emerald-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Approved & Issued</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{metrics.approved}</span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 block">Completed</span>
        </div>

        <div 
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'rejected'
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 shadow-md ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-rose-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">Rejected / Returned</span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{metrics.rejected}</span>
          <span className="text-[11px] text-gray-400 mt-1 block">Disapproved</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-center gap-3 flex-wrap bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search Reference #, Owner, Client, or Property..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
          <Filter size={14} className="text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
          >
            <option value="all">All Certificate Types</option>
            {CERTIFICATE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">In Processing / Review</option>
            <option value="approved">Approved & Completed</option>
            <option value="rejected">Rejected / Returned</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300"
            title="Date from"
          />
          <span>-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300"
            title="Date to"
          />
        </div>

        {(search || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={handleResetFilters}
            className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Main Request Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/40 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th className="px-6 py-3.5">Reference No.</th>
                <th className="px-6 py-3.5">Applicant / Owner</th>
                <th className="px-6 py-3.5">Certificate Type</th>
                <th className="px-6 py-3.5">Property Location</th>
                <th className="px-6 py-3.5">Date Requested</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Staff Assigned</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredRequests.map((req) => {
                const isReady = ['APPROVED', 'COMPLETED'].includes(req.status)
                return (
                  <tr
                    key={req.request_id}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-xs text-gray-900 dark:text-white">
                      {req.reference_number || `REQ-${String(req.request_id).padStart(5, '0')}`}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">{req.client_name}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Owner: {req.owner_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {req.certificate_type}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      {req.location || 'Lagonglong Property'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      {req.requested_at ? new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                      {req.assigned_staff_name || <span className="italic text-gray-400">Unassigned</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isReady && (
                          <button
                            onClick={() => handleOpenPrintPreview(req)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-800 shadow-sm transition cursor-pointer"
                            title="Preview & Print Official Certificate"
                          >
                            <Printer size={13} />
                            <span>Print</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenReview(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                        >
                          <FileCheck size={13} />
                          <span>{isAdminOrSuper ? 'Review & Issue' : 'Process'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-medium">Loading certificate requests...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
                    <FileText size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="font-semibold text-gray-700 dark:text-gray-300">No certificate requests found</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      There are currently no certificate requests matching the selected filters.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- REVIEW & DECIDE MODAL ---------------- */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {isAdminOrSuper ? 'Official Certificate Review & Approval' : 'Staff Certificate Processing'}
                  </h2>
                  <p className="text-xs font-mono text-gray-500">
                    {selectedRequest.reference_number || `REQ-${String(selectedRequest.request_id).padStart(5, '0')}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg font-bold p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Applicant & Property Record Summary */}
              <div className="bg-gray-50 dark:bg-gray-800/70 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Requesting Applicant:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedRequest.client_name} ({selectedRequest.client_email || 'No email'})
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Registered Owner on File:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedRequest.owner_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Certificate Type Requested:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{selectedRequest.certificate_type}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Linked Property ID:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {selectedRequest.property_id ? `#${selectedRequest.property_id}` : 'General Ownership Request'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Property Location:</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-right max-w-[280px] truncate">
                    {selectedRequest.location || 'Lagonglong'}
                  </span>
                </div>
                <div className="flex justify-between items-start pt-1">
                  <span className="text-gray-400">Purpose of Certificate:</span>
                  <span className="font-bold text-gray-900 dark:text-white text-right max-w-[280px]">
                    {selectedRequest.purpose}
                  </span>
                </div>
                {selectedRequest.remarks && (
                  <div className="flex justify-between items-start pt-1">
                    <span className="text-gray-400">Owner Remarks:</span>
                    <span className="text-gray-700 dark:text-gray-300 text-right max-w-[280px]">
                      {selectedRequest.remarks}
                    </span>
                  </div>
                )}
              </div>

              {/* Staff / Admin Notes */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Internal Processing Notes
                </label>
                <textarea
                  rows={2}
                  value={processingNotes}
                  onChange={(e) => setProcessingNotes(e.target.value)}
                  placeholder="Record verification notes, parcel checks, or cadastral matching details..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Rejection / Correction Reason input if rejecting or returning */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Rejection or Return Reason (if returning for corrections)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this request is incomplete or returned..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Admin Signatory Controls */}
              {isAdminOrSuper && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                  <span className="font-bold text-xs text-emerald-900 dark:text-emerald-300 block">
                    Certificate Issuance Parameters
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Authorized Signer</label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Signer Title</label>
                      <input
                        type="text"
                        value={signerTitle}
                        onChange={(e) => setSignerTitle(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Official Receipt (OR) #</label>
                      <input
                        type="text"
                        value={orNumber}
                        onChange={(e) => setOrNumber(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Staff Actions */}
                {isStaff && (
                  <>
                    {selectedRequest.status === 'PENDING' && (
                      <button
                        onClick={() => handleUpdateStatus('PROCESSING')}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                      >
                        Start Processing
                      </button>
                    )}

                    <button
                      onClick={() => handleUpdateStatus('UNDER_REVIEW')}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      Submit for Admin Review
                    </button>

                    <button
                      onClick={() => handleUpdateStatus('RETURNED')}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      Return for Info
                    </button>
                  </>
                )}

                {/* Admin Actions */}
                {isAdminOrSuper && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus('REJECTED')}
                      disabled={actionLoading}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      Reject
                    </button>

                    <button
                      onClick={() => handleUpdateStatus('RETURNED')}
                      disabled={actionLoading}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      Return for Correction
                    </button>

                    <button
                      onClick={handleGenerateAndApprove}
                      disabled={actionLoading}
                      className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={14} />
                      <span>Approve & Issue Certificate</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- OFFICIAL PRINT / PREVIEW MODAL ---------------- */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col print:shadow-none print:max-w-none print:w-full print:h-auto print:max-h-none print:block overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between print:hidden bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <FileCheck size={20} className="text-emerald-600" />
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  Certificate Document Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 sm:p-12 print:p-0 print:overflow-visible bg-gray-100 dark:bg-gray-950 flex justify-center">
              {loadingDoc ? (
                <div className="p-16 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading certificate records...</span>
                </div>
              ) : (
                <div className="bg-white text-black p-10 sm:p-14 rounded-2xl shadow-xl print:shadow-none print:p-0 max-w-2xl w-full text-xs font-serif leading-relaxed border border-gray-200 print:border-none">
                  <div className="text-center mb-6">
                    <p className="text-[11px] uppercase tracking-wider font-sans text-gray-700">Republic of the Philippines</p>
                    <p className="text-[11px] font-sans text-gray-700">Province of Misamis Oriental</p>
                    <p className="text-sm font-bold uppercase tracking-wider font-sans mt-0.5">Municipality of Lagonglong</p>
                    <div className="my-2 border-b-2 border-black w-full" />
                    <h2 className="text-base font-bold font-sans tracking-wide uppercase mt-3">
                      Office of the Municipal Assessor
                    </h2>
                    <p className="text-[11px] font-sans font-semibold text-right mt-4">
                      {format(new Date(), 'MMMM dd, yyyy')}
                    </p>
                  </div>

                  <h3 className="text-center text-base font-bold underline mb-6 tracking-widest font-sans uppercase">
                    C E R T I F I C A T I O N
                  </h3>

                  <div className="space-y-4 text-justify leading-relaxed">
                    <p className="font-bold">TO WHOM IT MAY CONCERN:</p>
                    
                    <p className="indent-8">
                      THIS IS TO CERTIFY that according to the official records filed in this Office, 
                      a parcel of real property declared in the name of{' '}
                      <strong>
                        {previewDocData?.property?.first_name 
                          ? `${previewDocData.property.first_name} ${previewDocData.property.middle_name ? previewDocData.property.middle_name + ' ' : ''}${previewDocData.property.last_name}`.toUpperCase()
                          : (selectedRequest?.owner_name || selectedRequest?.client_name || 'REGISTERED PROPERTY OWNER').toUpperCase()}
                      </strong>, situated at Barangay <strong>{previewDocData?.property?.barangay_name || 'Lagonglong'}</strong>, 
                      Municipality of Lagonglong, Province of Misamis Oriental, is registered with the following technical and assessment specifications:
                    </p>

                    <div className="my-4 border border-black p-3 bg-gray-50/50 space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span>Property ID:</span>
                        <span className="font-bold">#{previewDocData?.property?.property_id || selectedRequest?.property_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax Declaration No.:</span>
                        <span className="font-bold">{previewDocData?.property?.tax_declaration_no || '23-09000-EXISTING'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lot / Survey No.:</span>
                        <span className="font-bold">{previewDocData?.property?.lot_number || 'LOT ON FILE'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Classification:</span>
                        <span className="font-bold">{previewDocData?.property?.classification_name || 'Agricultural / Residential'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Area:</span>
                        <span className="font-bold">
                          {previewDocData?.property?.area ? `${Number(previewDocData.property.area).toLocaleString()} sq.m.` : 'Recorded in Cadastral Map'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Market Value:</span>
                        <span className="font-bold">
                          ₱{Number(previewDocData?.property?.market_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-black pt-1">
                        <span>Assessed Value:</span>
                        <span className="font-bold text-sm">
                          ₱{Number(previewDocData?.property?.assessed_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <p className="indent-8">
                      THIS IS TO CERTIFY FURTHER that the assessment and records of said property are active and valid as of this date.
                    </p>

                    <p className="indent-8">
                      This certification is issued upon the request of{' '}
                      <strong>{selectedRequest?.client_name || 'the property owner'}</strong> for{' '}
                      <u>{selectedRequest?.purpose || 'whatever legal purpose it may serve'}</u>.
                    </p>

                    <p className="indent-8">
                      Given this {format(new Date(), 'do \'day of\' MMMM, yyyy')} at Lagonglong, Misamis Oriental, Philippines.
                    </p>
                  </div>

                  <div className="mt-14 pt-4 flex justify-between items-end font-sans">
                    <div className="text-[10px] space-y-0.5 text-gray-700">
                      <p>Certificate Ref: <strong>{previewDocData?.generatedCertificate?.certificate_number || selectedRequest?.reference_number}</strong></p>
                      <p>OR Number: <strong>{previewDocData?.generatedCertificate?.or_number || orNumber}</strong></p>
                      <p>Fee Paid: <strong>₱60.50</strong> | Doc Stamp: <strong>₱30.00</strong></p>
                      <p>Issued at: <strong>Lagonglong, Misamis Oriental</strong></p>
                    </div>

                    <div className="text-center">
                      <p className="text-xs italic mb-8">Approved by:</p>
                      <div className="border-b border-black w-56 mx-auto mb-1" />
                      <p className="font-bold uppercase text-xs">
                        {previewDocData?.generatedCertificate?.signer_name || signerName}
                      </p>
                      <p className="text-[11px] italic text-gray-600">
                        {previewDocData?.generatedCertificate?.signer_title || signerTitle}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
