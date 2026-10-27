import { useEffect, useState, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  RotateCcw, 
  Printer, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileCheck, 
  Eye
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

export function ClientCertificateRequests() {
  const { showSuccess, showError } = useModal()
  const location = useLocation()

  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Form State
  const [form, setForm] = useState({
    property_id: '',
    certificate_type: 'Certificate of Property Ownership',
    purpose: '',
    remarks: '',
    contact_number: ''
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Detail & Print Modals
  const [selectedRequest, setSelectedRequest] = useState<CertificateRequest | null>(null)
  const [previewDocData, setPreviewDocData] = useState<any | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [loadingDoc, setLoadingDoc] = useState(false)

  // Load properties and requests
  const loadData = async () => {
    try {
      const [reqsRes, propsRes, profileRes] = await Promise.all([
        api.get('/client/certificate-requests'),
        api.get('/client/my-properties'),
        api.get('/profile').catch(() => ({ data: {} }))
      ])
      setRequests(Array.isArray(reqsRes.data) ? reqsRes.data : [])
      setProperties(Array.isArray(propsRes.data) ? propsRes.data : [])

      if (profileRes.data?.contact_number) {
        setForm(f => ({ ...f, contact_number: profileRes.data.contact_number }))
      }
    } catch (e: any) {
      console.error('Failed to load requests:', e)
      showError('Unable to load certificate requests. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-open request form if navigated from property page
  useEffect(() => {
    if (location.state && (location.state as any).propertyId) {
      const propId = String((location.state as any).propertyId)
      setForm(f => ({ ...f, property_id: propId }))
      setIsFormOpen(true)
    }
  }, [location.state])

  // Summary Metrics
  const metrics = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'PENDING').length,
      inProgress: requests.filter(r => ['APPROVED', 'IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW'].includes(r.status)).length,
      readyForPickup: requests.filter(r => r.status === 'READY_FOR_PICKUP').length,
      released: requests.filter(r => ['RELEASED', 'COMPLETED'].includes(r.status)).length,
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
      // Text search across Ref #, Property, Type, Purpose
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchRef = String(req.reference_number || req.request_id).toLowerCase().includes(q)
        const matchType = String(req.certificate_type || '').toLowerCase().includes(q)
        const matchProp = String(req.location || req.lot_number || '').toLowerCase().includes(q)
        const matchPurp = String(req.purpose || '').toLowerCase().includes(q)
        if (!matchRef && !matchType && !matchProp && !matchPurp) return false
      }

      // Certificate Type filter
      if (typeFilter !== 'all' && req.certificate_type !== typeFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && req.status !== 'PENDING') return false
        if (statusFilter === 'approved' && req.status !== 'APPROVED') return false
        if (statusFilter === 'in_progress' && !['IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW', 'APPROVED'].includes(req.status)) return false
        if (statusFilter === 'ready' && req.status !== 'READY_FOR_PICKUP') return false
        if (statusFilter === 'released' && !['RELEASED', 'COMPLETED'].includes(req.status)) return false
        if (statusFilter === 'rejected' && !['REJECTED', 'RETURNED'].includes(req.status)) return false
      }

      // Date Range
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

  // Form Submission
  const validateForm = () => {
    const errs: Record<string, string> = {}
    if (!form.certificate_type.trim()) errs.certificate_type = 'Please select a certificate type'
    if (!form.purpose.trim()) errs.purpose = 'Purpose of request is required'
    if (form.certificate_type !== 'Certificate of No Property Holdings' && properties.length > 0 && !form.property_id) {
      errs.property_id = 'Please select a property for this certificate'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const res = await api.post('/client/certificate-requests', {
        property_id: form.property_id || null,
        certificate_type: form.certificate_type,
        purpose: form.purpose.trim(),
        remarks: form.remarks.trim(),
        contact_number: form.contact_number.trim()
      })

      const refNum = res.data?.reference_number || 'New Request'
      setSuccessBanner(`Your request has been successfully registered with Reference #${refNum}.`)
      setTimeout(() => setSuccessBanner(null), 8000)

      setIsFormOpen(false)
      setForm({
        property_id: '',
        certificate_type: 'Certificate of Property Ownership',
        purpose: '',
        remarks: '',
        contact_number: form.contact_number
      })
      setFormErrors({})

      showSuccess(`Certificate request ${refNum} submitted. You can track its processing in real time.`)
      await loadData()
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to submit certificate request.'
      showError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Preview & Print Document
  const handleOpenPrintPreview = async (req: CertificateRequest) => {
    setLoadingDoc(true)
    setIsPreviewOpen(true)
    setSelectedRequest(req)
    try {
      const res = await api.get(`/client/certificate-requests/${req.request_id}/document`)
      setPreviewDocData(res.data)
    } catch (err: any) {
      console.error('Failed to load certificate document:', err)
      showError('Unable to preview the certificate document. Please try again.')
      setIsPreviewOpen(false)
    } finally {
      setLoadingDoc(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RELEASED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 size={12} />
            Released
          </span>
        )
      case 'READY_FOR_PICKUP':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
            <CheckCircle2 size={12} />
            Ready for Pickup
          </span>
        )
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
            <CheckCircle2 size={12} />
            Approved
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock size={12} />
            Pending Review
          </span>
        )
      case 'IN_PROGRESS':
      case 'PROCESSING':
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <FileCheck size={12} />
            In Progress
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
      {/* Header (aligned with Reports Page aesthetic) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">
            Official Certificate Requests
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Request, track, and download official assessor property certifications and certified tax declaration copies.
          </p>
        </div>

        <button
          id="btn-request-certificate"
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow-md active:scale-[0.98] transition cursor-pointer self-start sm:self-auto"
        >
          <Plus size={18} />
          <span>Request Certificate</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 6 Summary Cards (Workflow aligned) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-white dark:bg-gray-800 border-green-500 shadow-md ring-2 ring-green-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">Total</span>
          <span className="text-2xl font-black text-gray-900 dark:text-white mt-0.5 block">{metrics.total}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">All submissions</span>
        </div>

        <div 
          onClick={() => setStatusFilter('pending')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-amber-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">Pending</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{metrics.pending}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">In queue</span>
        </div>

        <div 
          onClick={() => setStatusFilter('in_progress')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'in_progress'
              ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">In Progress</span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 block">{metrics.inProgress}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Staff preparing</span>
        </div>

        <div 
          onClick={() => setStatusFilter('ready')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ready'
              ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-indigo-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">Ready for Pickup</span>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">{metrics.readyForPickup}</span>
          <span className="text-[10px] text-indigo-600/70 mt-0.5 block">Available now</span>
        </div>

        <div 
          onClick={() => setStatusFilter('released')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'released'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-emerald-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Released</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{metrics.released}</span>
          <span className="text-[10px] text-emerald-600/70 mt-0.5 block">Completed</span>
        </div>

        <div 
          onClick={() => setStatusFilter('rejected')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'rejected'
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 shadow-md ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-rose-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">Rejected</span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{metrics.rejected}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Office returned</span>
        </div>
      </div>

      {/* Filter Bar (Reports Page Design) */}
      <div className="glass-panel p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-center gap-3 flex-wrap bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search Reference #, Property ID, or Purpose..."
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

      {/* Requests Data Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/40 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th className="px-6 py-3.5">Reference No.</th>
                <th className="px-6 py-3.5">Certificate Type</th>
                <th className="px-6 py-3.5">Linked Property</th>
                <th className="px-6 py-3.5">Purpose</th>
                <th className="px-6 py-3.5">Date Requested</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
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
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {req.certificate_type}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      {req.location || 'Lagonglong Property'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={req.purpose}>
                      {req.purpose}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      {req.requested_at ? new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(req.status)}
                      {req.rejection_reason && (
                        <p className="text-[11px] text-rose-500 mt-1 truncate max-w-[180px]" title={req.rejection_reason}>
                          Note: {req.rejection_reason}
                        </p>
                      )}
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
                            <span>Print Certificate</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs transition cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-medium">Loading certificate requests...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
                    <FileText size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="font-semibold text-gray-700 dark:text-gray-300">No certificate requests found</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      {search || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo
                        ? 'Try clearing your search query or filters to view all submitted applications.'
                        : 'You have not submitted any certificate requests yet. Click "Request Certificate" above to apply.'}
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- REQUEST CERTIFICATE MODAL ---------------- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Request Official Certificate</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Assessor's Office • Municipality of Lagonglong</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg font-bold p-1 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Certificate Type */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Certificate Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.certificate_type}
                  onChange={(e) => setForm({ ...form, certificate_type: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  required
                >
                  {CERTIFICATE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {formErrors.certificate_type && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.certificate_type}</p>
                )}
              </div>

              {/* Property Selection */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Select Registered Property {form.certificate_type !== 'Certificate of No Property Holdings' && <span className="text-rose-500">*</span>}
                </label>
                <select
                  value={form.property_id}
                  onChange={(e) => setForm({ ...form, property_id: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  required={form.certificate_type !== 'Certificate of No Property Holdings' && properties.length > 0}
                >
                  <option value="">-- Choose from your registered properties --</option>
                  {properties.map(p => (
                    <option key={p.property_id} value={p.property_id}>
                      #{p.property_id} - {p.property_type} ({p.lot_number || p.building_name || 'Land'}) • {p.location}
                    </option>
                  ))}
                </select>
                {properties.length === 0 && (
                  <p className="text-amber-600 dark:text-amber-400 text-[11px] mt-1">
                    No declared properties currently found under your name. For 'No Property Holdings', you may proceed without selecting a property.
                  </p>
                )}
                {formErrors.property_id && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.property_id}</p>
                )}
              </div>

              {/* Purpose */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Purpose of Request <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank Loan Application, Building Permit, BIR Requirement"
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Bank Loan', 'Building Permit', 'BIR Tax Filing', 'Court Requirement', 'Proof of Ownership'].map(sugg => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => setForm({ ...form, purpose: sugg })}
                      className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900/40 text-gray-600 dark:text-gray-300 text-[10px] font-medium transition cursor-pointer"
                    >
                      + {sugg}
                    </button>
                  ))}
                </div>
                {formErrors.purpose && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.purpose}</p>
                )}
              </div>

              {/* Contact Information */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Contact Number (for SMS / Call notification)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0917-123-4567"
                  value={form.contact_number}
                  onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Additional Information / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide any additional context or requirements..."
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              {/* Notice */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[11px]">
                Upon submission, a unique Reference Number will be generated. The Municipal Assessor staff will review your submitted records and prepare the official certificate.
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <span>Submit Certificate Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- REQUEST DETAILS MODAL ---------------- */}
      {selectedRequest && !isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-50 to-green-50/40 dark:from-gray-800 dark:to-gray-900">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Certificate Request Details
                </h2>
                <p className="text-xs font-mono text-gray-500">
                  {selectedRequest.reference_number || `REQ-${String(selectedRequest.request_id).padStart(5, '0')}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg font-bold p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-gray-50 dark:bg-gray-800/70 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Current Status:</span>
                  <span>{getStatusBadge(selectedRequest.status)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Certificate Type:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedRequest.certificate_type}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Property Location:</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-right max-w-[220px] truncate">
                    {selectedRequest.location || 'Lagonglong'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400">Date Requested:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedRequest.requested_at ? new Date(selectedRequest.requested_at).toLocaleString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-start pt-1">
                  <span className="text-gray-400">Purpose of Request:</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-right max-w-[220px]">
                    {selectedRequest.purpose}
                  </span>
                </div>
                {selectedRequest.remarks && (
                  <div className="flex justify-between items-start pt-1">
                    <span className="text-gray-400">Owner Remarks:</span>
                    <span className="text-gray-700 dark:text-gray-300 text-right max-w-[220px]">
                      {selectedRequest.remarks}
                    </span>
                  </div>
                )}

                {/* Status Dates / Audit Timeline */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1 text-[11px]">
                  {selectedRequest.reviewed_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Reviewed / Approved:</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {new Date(selectedRequest.reviewed_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedRequest.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ready for Pickup Since:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {new Date(selectedRequest.completed_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedRequest.released_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Released Date:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {new Date(selectedRequest.released_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {selectedRequest.rejection_reason && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 mt-2">
                    <strong className="block text-[11px] uppercase mb-0.5">Office Feedback / Rejection Reason:</strong>
                    <span>{selectedRequest.rejection_reason}</span>
                  </div>
                )}
              </div>

              {/* Ready for Pickup Official Banner */}
              {selectedRequest.status === 'READY_FOR_PICKUP' && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
                    <span className="font-bold text-xs uppercase tracking-wider">Ready for In-Person Pickup</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Your <strong>{selectedRequest.certificate_type}</strong> for property <strong>PROPERTY-{selectedRequest.property_id || 'RECORD'}</strong> is ready for pickup at the Assessor's Office. Please bring your valid identification and request reference number (<strong>{selectedRequest.reference_number || selectedRequest.request_id}</strong>) when claiming your certificate.
                  </p>
                  {selectedRequest.completed_at && (
                    <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
                      Prepared date: {new Date(selectedRequest.completed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}

              {/* Released Notice & Document Access */}
              {['RELEASED', 'COMPLETED'].includes(selectedRequest.status) && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs block">Certificate Released</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Official certified document has been released to you. You may preview and print a copy anytime.
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenPrintPreview(selectedRequest)}
                    className="px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>Print Document</span>
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- OFFICIAL CERTIFICATE PRINT & PREVIEW MODAL ---------------- */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col print:shadow-none print:max-w-none print:w-full print:h-auto print:max-h-none print:block overflow-hidden border border-gray-200 dark:border-gray-800">
            {/* Header (Hidden on Print) */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between print:hidden bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <FileCheck size={20} className="text-emerald-600" />
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  Official Assessor Certificate Document
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

            {/* Document Content (Printable Layout) */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 print:p-0 print:overflow-visible bg-gray-100 dark:bg-gray-950 flex justify-center">
              {loadingDoc ? (
                <div className="p-16 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading official certificate details...</span>
                </div>
              ) : (
                <div className="bg-white text-black p-10 sm:p-14 rounded-2xl shadow-xl print:shadow-none print:p-0 max-w-2xl w-full text-xs font-serif leading-relaxed border border-gray-200 print:border-none">
                  {/* Official Republic Header */}
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
                          : (previewDocData?.request?.client_name || 'REGISTERED PROPERTY OWNER').toUpperCase()}
                      </strong>, situated at Barangay <strong>{previewDocData?.property?.barangay_name || 'Lagonglong'}</strong>, 
                      Municipality of Lagonglong, Province of Misamis Oriental, is registered with the following tax and technical specifications:
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

                  {/* Signatures & Official Receipt Stamp */}
                  <div className="mt-14 pt-4 flex justify-between items-end font-sans">
                    <div className="text-[10px] space-y-0.5 text-gray-700">
                      <p>Certificate Ref: <strong>{previewDocData?.generatedCertificate?.certificate_number || selectedRequest?.reference_number}</strong></p>
                      <p>OR Number: <strong>{previewDocData?.generatedCertificate?.or_number || '4567695'}</strong></p>
                      <p>Fee Paid: <strong>₱60.50</strong> | Doc Stamp: <strong>₱30.00</strong></p>
                      <p>Issued at: <strong>Lagonglong, Misamis Oriental</strong></p>
                    </div>

                    <div className="text-center">
                      <p className="text-xs italic mb-8">Approved by:</p>
                      <div className="border-b border-black w-56 mx-auto mb-1" />
                      <p className="font-bold uppercase text-xs">
                        {previewDocData?.generatedCertificate?.signer_name || 'MARIE MAE P. UBALDE'}
                      </p>
                      <p className="text-[11px] italic text-gray-600">
                        {previewDocData?.generatedCertificate?.signer_title || 'OIC - Municipal Assessor'}
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
