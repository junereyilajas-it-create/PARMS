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
  Sparkles,
  Eye,
  Check,
  Send,
  Building,
  ExternalLink,
  AlertTriangle
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

interface AdminCertificateRequestsProps {
  isEmbedded?: boolean
  onOpenWorkspace?: (propertyId: number | string) => void
}

export function AdminCertificateRequests({ isEmbedded = false, onOpenWorkspace }: AdminCertificateRequestsProps = {}) {
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

  // Detail Modal State
  const [selectedRequest, setSelectedRequest] = useState<CertificateRequest | null>(null)
  const [detailModalTab, setDetailModalTab] = useState<'verification' | 'audit'>('verification')
  const [processingNotes, setProcessingNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Confirmation Action Dialog State
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean
    type: 'APPROVE' | 'IN_PROGRESS' | 'READY_FOR_PICKUP' | 'RELEASE' | 'REJECT'
    req: CertificateRequest
  } | null>(null)
  const [rejectionInput, setRejectionInput] = useState('')
  const [rejectionInputError, setRejectionInputError] = useState<string | null>(null)

  // Direct Issuance / Preparation Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [targetGenerateReq, setTargetGenerateReq] = useState<CertificateRequest | null>(null)
  const [customOwnerName, setCustomOwnerName] = useState('')
  const [customTaxDecNo, setCustomTaxDecNo] = useState('')
  const [signerName, setSignerName] = useState('MARIE MAE P. UBALDE')
  const [signerTitle, setSignerTitle] = useState('OIC - Municipal Assessor')
  const [orNumber, setOrNumber] = useState('4567695')

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

  const isAuthorizedToProcess = ['staff', 'super_admin'].includes(userRole)

  // Summary Metrics
  const metrics = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'PENDING').length,
      approved: requests.filter(r => r.status === 'APPROVED').length,
      inProgress: requests.filter(r => ['IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW'].includes(r.status)).length,
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
        if (statusFilter === 'approved' && req.status !== 'APPROVED') return false
        if (statusFilter === 'in_progress' && !['IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW'].includes(req.status)) return false
        if (statusFilter === 'ready' && req.status !== 'READY_FOR_PICKUP') return false
        if (statusFilter === 'released' && !['RELEASED', 'COMPLETED'].includes(req.status)) return false
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

  // Open Details Modal
  const handleOpenDetails = (req: CertificateRequest) => {
    setSelectedRequest(req)
    setDetailModalTab('verification')
    setProcessingNotes(req.processing_notes || '')
  }

  // Open Confirmation Modal
  const handleInitiateStatusChange = (
    req: CertificateRequest, 
    type: 'APPROVE' | 'IN_PROGRESS' | 'READY_FOR_PICKUP' | 'RELEASE' | 'REJECT'
  ) => {
    setConfirmationModal({ isOpen: true, type, req })
    setRejectionInput('')
    setRejectionInputError(null)
  }

  // Execute Status Transition
  const handleConfirmStatusChange = async () => {
    if (!confirmationModal) return
    const { type, req } = confirmationModal

    let newStatus = ''
    if (type === 'APPROVE') newStatus = 'APPROVED'
    else if (type === 'IN_PROGRESS') newStatus = 'IN_PROGRESS'
    else if (type === 'READY_FOR_PICKUP') newStatus = 'READY_FOR_PICKUP'
    else if (type === 'RELEASE') newStatus = 'RELEASED'
    else if (type === 'REJECT') {
      newStatus = 'REJECTED'
      if (!rejectionInput.trim()) {
        setRejectionInputError('Rejection reason is required. Please explain why this request is ineligible or rejected.')
        return
      }
    }

    setActionLoading(true)
    try {
      await api.put(`/admin/certificate-requests/${req.request_id}`, {
        status: newStatus,
        rejection_reason: type === 'REJECT' ? rejectionInput.trim() : undefined,
        processing_notes: processingNotes.trim() || undefined,
        assigned_to: (type === 'IN_PROGRESS' || type === 'READY_FOR_PICKUP') && !req.assigned_to ? currentUserId : undefined
      })

      showSuccess(`Certificate request #${req.reference_number || req.request_id} successfully marked as ${newStatus.replace(/_/g, ' ')}.`)
      setConfirmationModal(null)
      if (selectedRequest && selectedRequest.request_id === req.request_id) {
        setSelectedRequest(null)
      }
      await loadData()
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update certificate request status.')
    } finally {
      setActionLoading(false)
    }
  }

  // Open Certificate Preparation Modal
  const handleOpenGenerateModal = (req: CertificateRequest) => {
    setTargetGenerateReq(req)
    setCustomOwnerName(req.owner_name || '')
    setCustomTaxDecNo(req.tax_declaration_no || '')
    setSignerName('MARIE MAE P. UBALDE')
    setSignerTitle('OIC - Municipal Assessor')
    setOrNumber('4567695')
    setIsGenerateModalOpen(true)
  }

  // Generate Certificate Record & Set Status to READY_FOR_PICKUP
  const handleGenerateAndMarkReady = async () => {
    if (!targetGenerateReq) return

    setActionLoading(true)
    try {
      const res = await api.post(`/admin/certificate-requests/${targetGenerateReq.request_id}/generate`, {
        certificate_type: targetGenerateReq.certificate_type,
        signer_name: signerName.trim(),
        signer_title: signerTitle.trim(),
        or_number: orNumber.trim(),
        custom_owner_name: customOwnerName.trim() || undefined,
        custom_tax_declaration_no: customTaxDecNo.trim() || undefined
      })

      showSuccess(`Certificate ${res.data.certificate_number} generated and marked Ready for Pickup! Owner has been automatically notified.`)
      setIsGenerateModalOpen(false)
      setTargetGenerateReq(null)
      if (selectedRequest) setSelectedRequest(null)
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
      const res = await api.get(`/client/certificate-requests/${req.request_id}/document`)
      setPreviewDocData(res.data)
    } catch (err: any) {
      console.error('Failed to load certificate document for preview:', err)
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
            <Sparkles size={12} />
            Ready for Pickup
          </span>
        )
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
            <Check size={12} />
            Approved
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
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock size={12} />
            Pending Review
          </span>
        )
      case 'REJECTED':
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertCircle size={12} />
            Rejected
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
    <div className={`space-y-6 ${isEmbedded ? '' : 'fade-in'}`}>
      {/* Header (Only shown when not embedded) */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-green-800 dark:text-green-400">
              Certificate Request Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Verify property ownership, approve applications, prepare certificates, and manage pickup releases.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-green-50 dark:bg-green-950/50 text-xs font-bold text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 uppercase flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Staff Certificate Desk
            </span>
          </div>
        </div>
      )}

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-white dark:bg-gray-800 border-green-600 shadow-md ring-2 ring-green-600/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">Total</span>
          <span className="text-2xl font-black text-gray-900 dark:text-white mt-0.5 block">{metrics.total}</span>
          <span className="text-[10px] text-gray-400 block mt-0.5">All requests</span>
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
          <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 block mt-0.5">Requires review</span>
        </div>

        <div 
          onClick={() => setStatusFilter('approved')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'approved'
              ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-500 shadow-md ring-2 ring-teal-500/20'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-teal-300 shadow-sm'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">Approved</span>
          <span className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-0.5 block">{metrics.approved}</span>
          <span className="text-[10px] text-teal-600/70 dark:text-teal-400/70 block mt-0.5">Ready to process</span>
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
          <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70 block mt-0.5">Being prepared</span>
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
          <span className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 block mt-0.5">Owner notified</span>
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
          <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 block mt-0.5">Completed</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-center gap-3 flex-wrap bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400" />
          <input
            id="search-certificate-requests"
            type="text"
            placeholder="Search Reference #, Owner, Property ID, or Certificate Type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
          <Filter size={14} className="text-gray-400" />
          <select
            id="filter-certificate-type"
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
            id="filter-certificate-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="ready">Ready for Pickup</option>
            <option value="released">Released</option>
            <option value="rejected">Rejected</option>
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
                <th className="px-5 py-3.5">Reference No.</th>
                <th className="px-5 py-3.5">Property ID</th>
                <th className="px-5 py-3.5">Owner / Applicant</th>
                <th className="px-5 py-3.5">Certificate Type</th>
                <th className="px-5 py-3.5">Date Requested</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Processed By</th>
                <th className="px-5 py-3.5 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredRequests.map((req) => {
                return (
                  <tr
                    key={req.request_id}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {/* Reference No */}
                    <td className="px-5 py-4 font-mono font-bold text-xs text-green-700 dark:text-green-400">
                      {req.reference_number || `REQ-${String(req.request_id).padStart(5, '0')}`}
                    </td>

                    {/* Property ID */}
                    <td className="px-5 py-4">
                      {req.property_id ? (
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                          PROPERTY-{req.property_id}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No Holdings</span>
                      )}
                    </td>

                    {/* Owner / Applicant */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {req.owner_name || req.client_name}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        Applicant: {req.client_name}
                      </div>
                    </td>

                    {/* Certificate Type */}
                    <td className="px-5 py-4 text-xs font-medium text-gray-800 dark:text-gray-200">
                      {req.certificate_type}
                    </td>

                    {/* Date Requested */}
                    <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {req.requested_at ? new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </td>

                    {/* Processed By */}
                    <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-400">
                      {req.released_by_name ? (
                        <span title="Released by">Rel: {req.released_by_name}</span>
                      ) : req.reviewer_name ? (
                        <span title="Reviewed/Approved by">Appr: {req.reviewer_name}</span>
                      ) : req.assigned_staff_name ? (
                        <span>Assigned: {req.assigned_staff_name}</span>
                      ) : (
                        <span className="text-gray-400 italic">Pending Staff</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details button is always available */}
                        <button
                          onClick={() => handleOpenDetails(req)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium text-xs transition cursor-pointer"
                          title="View Full Details & Audit Trail"
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>

                        {/* WORKFLOW ACTIONS BASED ON STATUS */}
                        {isAuthorizedToProcess && (
                          <>
                            {/* STATUS: PENDING -> Approve or Reject */}
                            {req.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleInitiateStatusChange(req, 'APPROVE')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                                  title="Approve this certificate request"
                                >
                                  <Check size={13} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleInitiateStatusChange(req, 'REJECT')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold text-xs transition cursor-pointer"
                                  title="Reject request with required reason"
                                >
                                  <X size={13} />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* STATUS: APPROVED -> Start Processing or Reject */}
                            {req.status === 'APPROVED' && (
                              <>
                                <button
                                  onClick={() => handleInitiateStatusChange(req, 'IN_PROGRESS')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                                  title="Begin preparing this certificate"
                                >
                                  <FileCheck size={13} />
                                  <span>Start Processing</span>
                                </button>
                                <button
                                  onClick={() => handleInitiateStatusChange(req, 'REJECT')}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 text-xs transition cursor-pointer"
                                  title="Reject if found ineligible"
                                >
                                  <X size={13} />
                                </button>
                              </>
                            )}

                            {/* STATUS: IN PROGRESS -> Mark Ready for Pickup or Prepare */}
                            {['IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW'].includes(req.status) && (
                              <>
                                <button
                                  onClick={() => handleOpenGenerateModal(req)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                                  title="Prepare & Generate Certificate Record"
                                >
                                  <Sparkles size={13} />
                                  <span>Prepare Cert</span>
                                </button>
                                <button
                                  onClick={() => handleInitiateStatusChange(req, 'READY_FOR_PICKUP')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                                  title="Mark certificate as ready for owner pickup"
                                >
                                  <Send size={13} />
                                  <span>Ready for Pickup</span>
                                </button>
                              </>
                            )}

                            {/* STATUS: READY FOR PICKUP -> Mark as Released */}
                            {req.status === 'READY_FOR_PICKUP' && (
                              <>
                                <button
                                  onClick={() => handleInitiateStatusChange(req, 'RELEASE')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                                  title="Confirm owner collected certificate in person"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Mark as Released</span>
                                </button>
                                <button
                                  onClick={() => handleOpenPrintPreview(req)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium text-xs transition cursor-pointer"
                                  title="Print Certificate"
                                >
                                  <Printer size={13} />
                                  <span>Print</span>
                                </button>
                              </>
                            )}

                            {/* STATUS: RELEASED -> Print */}
                            {['RELEASED', 'COMPLETED'].includes(req.status) && (
                              <button
                                onClick={() => handleOpenPrintPreview(req)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 font-bold text-xs transition cursor-pointer"
                                title="Print Certificate Copy"
                              >
                                <Printer size={13} />
                                <span>Print Copy</span>
                              </button>
                            )}
                          </>
                        )}
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
                      <p className="text-sm font-medium">Loading certificate requests from database...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
                    <FileText size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="font-semibold text-gray-700 dark:text-gray-300">No certificate requests found</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      There are currently no certificate requests matching the selected search and filter criteria.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- 1. DETAILS & VERIFICATION MODAL ---------------- */}
      {selectedRequest && !isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Certificate Request Review & Verification
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono font-bold text-green-700 dark:text-green-400">
                      {selectedRequest.reference_number || `REQ-${String(selectedRequest.request_id).padStart(5, '0')}`}
                    </span>
                    <span>•</span>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg font-bold p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sub-Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 bg-gray-50/50 dark:bg-gray-800/40">
              <button
                onClick={() => setDetailModalTab('verification')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  detailModalTab === 'verification'
                    ? 'border-green-600 text-green-700 dark:text-green-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Building size={14} />
                <span>Property & Owner Verification</span>
              </button>
              <button
                onClick={() => setDetailModalTab('audit')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  detailModalTab === 'audit'
                    ? 'border-green-600 text-green-700 dark:text-green-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Clock size={14} />
                <span>Workflow Audit & Timestamps</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {detailModalTab === 'verification' ? (
                <>
                  {/* Database Property Records Verification Box */}
                  <div className="bg-gray-50 dark:bg-gray-800/70 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                    <span className="font-bold text-xs text-gray-900 dark:text-white block uppercase tracking-wider">
                      Verified Database Information
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400 block text-[11px]">Registered Owner:</span>
                        <span className="font-bold text-gray-900 dark:text-white">{selectedRequest.owner_name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[11px]">Requesting Client Account:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {selectedRequest.client_name} ({selectedRequest.client_email || 'No email'})
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[11px]">Property ID:</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {selectedRequest.property_id ? `PROPERTY-${selectedRequest.property_id}` : 'General / No Holdings'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[11px]">Tax Declaration Number:</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {selectedRequest.tax_declaration_no || '23-09000-EXISTING'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[11px]">Cadastral Lot Number:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {selectedRequest.lot_number || 'On File'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[11px]">Title / OCT / TCT No.:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {selectedRequest.title_number || 'Official Record'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block text-[11px]">Property Location:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {selectedRequest.location || 'Lagonglong, Misamis Oriental'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Request Specific Details */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2">
                    <span className="font-bold text-xs text-gray-900 dark:text-white block uppercase tracking-wider">
                      Request Parameters
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Requested Certificate:</span>
                        <span className="font-bold text-green-700 dark:text-green-400">{selectedRequest.certificate_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Purpose:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{selectedRequest.purpose}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Contact Number:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{selectedRequest.contact_number || selectedRequest.owner_contact || 'None provided'}</span>
                      </div>
                      {selectedRequest.remarks && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Applicant Remarks:</span>
                          <span className="text-gray-700 dark:text-gray-300">{selectedRequest.remarks}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rejection Notice if rejected */}
                  {selectedRequest.rejection_reason && (
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
                      <span className="font-bold block text-xs uppercase mb-1">Official Rejection Reason</span>
                      <p>{selectedRequest.rejection_reason}</p>
                    </div>
                  )}

                  {/* Staff Internal Notes */}
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Staff Verification Notes
                    </label>
                    <textarea
                      rows={2}
                      value={processingNotes}
                      onChange={(e) => setProcessingNotes(e.target.value)}
                      placeholder="Add internal notes about parcel check, cadastral verification, or ID checking..."
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </>
              ) : (
                /* Workflow Audit Trail & Status History */
                <div className="space-y-4">
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                    {/* 1. Request Submitted */}
                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-green-500 ring-4 ring-white dark:ring-gray-900" />
                      <div className="font-bold text-gray-900 dark:text-white">Request Submitted</div>
                      <div className="text-gray-500 text-[11px]">
                        {selectedRequest.requested_at ? new Date(selectedRequest.requested_at).toLocaleString() : 'N/A'}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                        Submitted by applicant: <strong>{selectedRequest.client_name}</strong>
                      </div>
                    </div>

                    {/* 2. Reviewed / Approved */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-gray-900 ${
                        selectedRequest.reviewed_at ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <div className="font-bold text-gray-900 dark:text-white">Staff Review & Approval</div>
                      <div className="text-gray-500 text-[11px]">
                        {selectedRequest.reviewed_at ? new Date(selectedRequest.reviewed_at).toLocaleString() : 'Pending review'}
                      </div>
                      {selectedRequest.reviewer_name && (
                        <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                          Reviewed by Staff: <strong>{selectedRequest.reviewer_name}</strong>
                        </div>
                      )}
                    </div>

                    {/* 3. Preparation In Progress */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-gray-900 ${
                        ['IN_PROGRESS', 'PROCESSING', 'READY_FOR_PICKUP', 'RELEASED', 'COMPLETED'].includes(selectedRequest.status) ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <div className="font-bold text-gray-900 dark:text-white">Preparation In Progress</div>
                      <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                        Assigned Staff: <strong>{selectedRequest.assigned_staff_name || 'Staff Desk'}</strong>
                      </div>
                    </div>

                    {/* 4. Ready for Pickup */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-gray-900 ${
                        selectedRequest.completed_at ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <div className="font-bold text-gray-900 dark:text-white">Ready for Pickup (Notification Dispatched)</div>
                      <div className="text-gray-500 text-[11px]">
                        {selectedRequest.completed_at ? new Date(selectedRequest.completed_at).toLocaleString() : 'Not yet ready'}
                      </div>
                      {selectedRequest.certificate_number && (
                        <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                          Certificate Reference: <strong>{selectedRequest.certificate_number}</strong>
                        </div>
                      )}
                    </div>

                    {/* 5. Released */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-gray-900 ${
                        selectedRequest.released_at ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <div className="font-bold text-gray-900 dark:text-white">Certificate Released to Owner</div>
                      <div className="text-gray-500 text-[11px]">
                        {selectedRequest.released_at ? new Date(selectedRequest.released_at).toLocaleString() : 'Not yet claimed'}
                      </div>
                      {selectedRequest.released_by_name && (
                        <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                          Released by Staff: <strong>{selectedRequest.released_by_name}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Embedded workspace shortcut */}
                {onOpenWorkspace && selectedRequest.property_id && (
                  <button
                    onClick={() => {
                      const propId = selectedRequest.property_id!
                      setSelectedRequest(null)
                      onOpenWorkspace(propId)
                    }}
                    className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    title="Open this property in the Certificate Workspace editor"
                  >
                    <ExternalLink size={13} />
                    <span>Open in Workspace</span>
                  </button>
                )}

                {/* Print button if ready/released */}
                {['READY_FOR_PICKUP', 'RELEASED', 'COMPLETED'].includes(selectedRequest.status) && (
                  <button
                    onClick={() => handleOpenPrintPreview(selectedRequest)}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>
                )}

                {/* Contextual Workflow buttons in Modal */}
                {isAuthorizedToProcess && (
                  <>
                    {selectedRequest.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleInitiateStatusChange(selectedRequest, 'REJECT')}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleInitiateStatusChange(selectedRequest, 'APPROVE')}
                          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Approve Request</span>
                        </button>
                      </>
                    )}

                    {selectedRequest.status === 'APPROVED' && (
                      <>
                        <button
                          onClick={() => handleInitiateStatusChange(selectedRequest, 'REJECT')}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleInitiateStatusChange(selectedRequest, 'IN_PROGRESS')}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1 cursor-pointer"
                        >
                          <FileCheck size={14} />
                          <span>Start Processing</span>
                        </button>
                      </>
                    )}

                    {['IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW'].includes(selectedRequest.status) && (
                      <>
                        <button
                          onClick={() => handleOpenGenerateModal(selectedRequest)}
                          className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles size={14} />
                          <span>Prepare & Issue Certificate</span>
                        </button>
                        <button
                          onClick={() => handleInitiateStatusChange(selectedRequest, 'READY_FOR_PICKUP')}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1 cursor-pointer"
                        >
                          <Send size={14} />
                          <span>Mark Ready for Pickup</span>
                        </button>
                      </>
                    )}

                    {selectedRequest.status === 'READY_FOR_PICKUP' && (
                      <button
                        onClick={() => handleInitiateStatusChange(selectedRequest, 'RELEASE')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark as Released</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 2. CONFIRMATION MODAL BEFORE STATUS CHANGES ---------------- */}
      {confirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                confirmationModal.type === 'REJECT' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' :
                confirmationModal.type === 'RELEASE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' :
                confirmationModal.type === 'READY_FOR_PICKUP' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400' :
                'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400'
              }`}>
                {confirmationModal.type === 'REJECT' ? <AlertTriangle size={20} /> :
                 confirmationModal.type === 'RELEASE' ? <CheckCircle2 size={20} /> :
                 confirmationModal.type === 'READY_FOR_PICKUP' ? <Send size={20} /> :
                 <Check size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  {confirmationModal.type === 'APPROVE' && 'Approve Certificate Request'}
                  {confirmationModal.type === 'IN_PROGRESS' && 'Start Processing Certificate'}
                  {confirmationModal.type === 'READY_FOR_PICKUP' && 'Mark Ready for Pickup'}
                  {confirmationModal.type === 'RELEASE' && 'Confirm Certificate Release'}
                  {confirmationModal.type === 'REJECT' && 'Reject Certificate Request'}
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Ref: {confirmationModal.req.reference_number || confirmationModal.req.request_id}
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
              {confirmationModal.type === 'APPROVE' && (
                <p>
                  Are you sure you want to approve this request for <strong>{confirmationModal.req.owner_name || confirmationModal.req.client_name}</strong>? 
                  The owner will be notified that their request is approved and being queued for preparation.
                </p>
              )}

              {confirmationModal.type === 'IN_PROGRESS' && (
                <p>
                  Move this approved request to <strong>In Progress</strong>? This assigns your Staff account to prepare the official certified document.
                </p>
              )}

              {confirmationModal.type === 'READY_FOR_PICKUP' && (
                <div className="space-y-2">
                  <p>
                    Mark this certificate as <strong>Ready for Pickup</strong>? An automated notification will be sent immediately to the property owner:
                  </p>
                  <blockquote className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 italic text-[11px]">
                    "Your {confirmationModal.req.certificate_type} for property PROPERTY-{confirmationModal.req.property_id || 'RECORD'} is ready for pickup at the Assessor's Office. Please bring your valid identification and request reference number when claiming your certificate."
                  </blockquote>
                </div>
              )}

              {confirmationModal.type === 'RELEASE' && (
                <div className="space-y-2">
                  <p>
                    Please confirm that <strong>{confirmationModal.req.owner_name || confirmationModal.req.client_name}</strong> has physically presented valid identification and collected their certificate.
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Your Staff user ID and the current timestamp will be permanently recorded in the official audit log.
                  </p>
                </div>
              )}

              {confirmationModal.type === 'REJECT' && (
                <div className="space-y-3">
                  <p className="text-rose-600 dark:text-rose-400 font-medium">
                    Please provide the reason for rejecting this certificate request. The applicant will see this explanation.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Rejection Reason (Required) <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="input-rejection-reason"
                      rows={3}
                      value={rejectionInput}
                      onChange={(e) => {
                        setRejectionInput(e.target.value)
                        setRejectionInputError(null)
                      }}
                      placeholder="e.g. Property tax records show delinquent balance, invalid cadastral survey parcel, or applicant name mismatch..."
                      className={`w-full bg-gray-50 dark:bg-gray-800 border rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none ${
                        rejectionInputError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-rose-500'
                      }`}
                    />
                    {rejectionInputError && (
                      <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 block">
                        {rejectionInputError}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setConfirmationModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-status-transition"
                onClick={handleConfirmStatusChange}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                  confirmationModal.type === 'REJECT' ? 'bg-rose-600 hover:bg-rose-700' :
                  confirmationModal.type === 'RELEASE' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  confirmationModal.type === 'READY_FOR_PICKUP' ? 'bg-indigo-600 hover:bg-indigo-700' :
                  'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>
                  {confirmationModal.type === 'APPROVE' && 'Confirm Approval'}
                  {confirmationModal.type === 'IN_PROGRESS' && 'Start Processing'}
                  {confirmationModal.type === 'READY_FOR_PICKUP' && 'Confirm Ready for Pickup'}
                  {confirmationModal.type === 'RELEASE' && 'Confirm Release'}
                  {confirmationModal.type === 'REJECT' && 'Confirm Rejection'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 3. CERTIFICATE ISSUANCE & PREPARATION MODAL ---------------- */}
      {isGenerateModalOpen && targetGenerateReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-gray-900">
              <div className="flex items-center gap-2.5">
                <Sparkles size={20} className="text-green-700 dark:text-green-400" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Prepare Official Certificate Record
                </h3>
              </div>
              <button
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Request:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {targetGenerateReq.reference_number || targetGenerateReq.request_id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Type:</span>
                  <span className="font-bold text-green-700 dark:text-green-400">{targetGenerateReq.certificate_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Property:</span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {targetGenerateReq.property_id ? `PROPERTY-${targetGenerateReq.property_id}` : 'General Ownership'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Owner Name on Certificate
                </label>
                <input
                  type="text"
                  value={customOwnerName}
                  onChange={(e) => setCustomOwnerName(e.target.value)}
                  placeholder="Full name of registered owner"
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Tax Declaration Number
                </label>
                <input
                  type="text"
                  value={customTaxDecNo}
                  onChange={(e) => setCustomTaxDecNo(e.target.value)}
                  placeholder="Tax declaration number"
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Official Signer
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Signer Title
                  </label>
                  <input
                    type="text"
                    value={signerTitle}
                    onChange={(e) => setSignerTitle(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Official Receipt (OR) Number
                </label>
                <input
                  type="text"
                  value={orNumber}
                  onChange={(e) => setOrNumber(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs"
                />
              </div>

              <p className="text-[11px] text-gray-500">
                Generating this certificate will issue an official certificate document number, set the request status to <strong>Ready for Pickup</strong>, and immediately notify the property owner.
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setIsGenerateModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateAndMarkReady}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <Sparkles size={14} />
                <span>Generate & Mark Ready for Pickup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. OFFICIAL CERTIFICATE PRINT & PREVIEW MODAL ---------------- */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white text-gray-900 rounded-3xl max-w-3xl w-full max-h-[95vh] shadow-2xl flex flex-col overflow-hidden print:max-w-none print:w-full print:h-auto print:shadow-none print:border-none print:rounded-none">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-green-700" />
                <span className="font-bold text-sm text-gray-800">Official Certificate Print Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => {
                    setIsPreviewOpen(false)
                    setPreviewDocData(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 sm:p-12 overflow-y-auto print:p-0 print:overflow-visible">
              {loadingDoc ? (
                <div className="py-20 text-center text-gray-500">
                  <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold">Generating document preview...</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto border-2 border-double border-gray-300 p-8 sm:p-10 font-serif text-xs leading-relaxed text-gray-900 bg-white">
                  {/* Republic Header */}
                  <div className="text-center space-y-1 mb-8 font-sans">
                    <p className="text-[11px] uppercase tracking-wider text-gray-600 font-semibold">Republic of the Philippines</p>
                    <p className="text-xs uppercase font-bold">Province of Misamis Oriental</p>
                    <p className="text-xs uppercase font-bold text-green-900">MUNICIPALITY OF LAGONGLONG</p>
                    <p className="text-sm font-black tracking-wide text-gray-900 mt-1 uppercase">OFFICE OF THE MUNICIPAL ASSESSOR</p>
                    <div className="w-24 h-0.5 bg-green-700 mx-auto mt-2 mb-2" />
                  </div>

                  <div className="flex justify-between items-baseline mb-6 font-sans text-[11px]">
                    <span className="font-mono text-gray-600">
                      Doc Control: <strong>{previewDocData?.generatedCertificate?.certificate_number || selectedRequest?.reference_number}</strong>
                    </span>
                    <p className="text-gray-600">
                      Date: <strong>{format(new Date(), 'MMMM dd, yyyy')}</strong>
                    </p>
                  </div>

                  <h3 className="text-center text-base font-bold underline mb-6 tracking-widest font-sans uppercase">
                    C E R T I F I C A T I O N
                  </h3>

                  <div className="space-y-4 text-justify leading-relaxed">
                    <p className="font-bold font-sans">TO WHOM IT MAY CONCERN:</p>
                    
                    <p className="indent-8">
                      THIS IS TO CERTIFY that according to the official assessment records filed in this Office, 
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
                        <span className="font-bold">PROPERTY-{previewDocData?.property?.property_id || selectedRequest?.property_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax Declaration No.:</span>
                        <span className="font-bold">{previewDocData?.property?.tax_declaration_no || selectedRequest?.tax_declaration_no || '23-09000-EXISTING'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lot / Survey No.:</span>
                        <span className="font-bold">{previewDocData?.property?.lot_number || selectedRequest?.lot_number || 'LOT ON FILE'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Classification:</span>
                        <span className="font-bold">{previewDocData?.property?.classification_name || 'Active Property'}</span>
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
                      THIS IS TO CERTIFY FURTHER that the assessment and tax declaration of said property are active and recognized by the Assessor's Office as of this date.
                    </p>

                    <p className="indent-8">
                      This certification is issued upon the request of{' '}
                      <strong>{selectedRequest?.client_name || 'the registered owner'}</strong> for{' '}
                      <u>{selectedRequest?.purpose || 'legal reference purposes'}</u>.
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
