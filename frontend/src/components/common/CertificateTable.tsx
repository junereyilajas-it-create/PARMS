import { useState, useEffect, useMemo } from 'react'
import { 
  Search, 
  Filter, 
  RotateCcw, 
  Printer, 
  ExternalLink, 
  FileText, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  RefreshCw,
  Building2,
  Calendar
} from 'lucide-react'
import api from '../../lib/api'
import type { GeneratedCertificate } from '../../types/Certificate'
import { format } from 'date-fns'

interface CertificateTableProps {
  onOpenWorkspace?: (propertyId: number | string) => void
  onIssueNewCertificate?: () => void
  refreshTrigger?: number
}

type SortField = 'date' | 'number' | 'owner' | 'propertyId'
type SortOrder = 'asc' | 'desc'

export function CertificateTable({ 
  onOpenWorkspace, 
  onIssueNewCertificate,
  refreshTrigger = 0 
}: CertificateTableProps) {
  const [certificates, setCertificates] = useState<GeneratedCertificate[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Sorting
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

  // Copy indicator state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Quick Print Modal State
  const [printCert, setPrintCert] = useState<GeneratedCertificate | null>(null)

  const fetchCertificates = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get('/generator/certificates')
      const data: GeneratedCertificate[] = Array.isArray(res.data) ? res.data : []
      // Deduplicate by certificate_id to prevent any duplicate rows
      const uniqueMap = new Map<number, GeneratedCertificate>()
      for (const item of data) {
        if (!uniqueMap.has(item.certificate_id)) {
          uniqueMap.set(item.certificate_id, {
            ...item,
            status: item.status || 'Generated',
            owner_name: item.custom_owner_name?.trim() || item.owner_name?.trim() || 'Unassigned Owner'
          })
        }
      }
      setCertificates(Array.from(uniqueMap.values()))
    } catch (err: any) {
      console.error('Failed to load certificates:', err)
      const message = err.response?.data?.message || err.message || 'Failed to retrieve certificate records from database.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCertificates()
  }, [refreshTrigger])

  // Reset to first page when search/filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, typeFilter, statusFilter, pageSize])

  // Extract distinct certificate types for filter dropdown
  const certificateTypes = useMemo(() => {
    const types = new Set<string>()
    for (const c of certificates) {
      if (c.certificate_type) types.add(c.certificate_type)
    }
    return Array.from(types).sort()
  }, [certificates])

  // Filtered & Sorted records
  const filteredRecords = useMemo(() => {
    return certificates.filter((item) => {
      // Search across number, propertyId, owner, requestor, purpose, type
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const propIdStr = item.property_id ? `property-${item.property_id} ${item.property_id}` : ''
        const matchNumber = (item.certificate_number || '').toLowerCase().includes(query)
        const matchOwner = (item.owner_name || '').toLowerCase().includes(query)
        const matchRequestor = (item.requestor_name || '').toLowerCase().includes(query)
        const matchPurpose = (item.purpose || '').toLowerCase().includes(query)
        const matchType = (item.certificate_type || '').toLowerCase().includes(query)
        const matchProp = propIdStr.toLowerCase().includes(query)

        if (!matchNumber && !matchOwner && !matchRequestor && !matchPurpose && !matchType && !matchProp) {
          return false
        }
      }

      // Type filter
      if (typeFilter !== 'all' && item.certificate_type !== typeFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        const currentStatus = (item.status || 'Generated').toLowerCase()
        if (currentStatus !== statusFilter.toLowerCase()) {
          return false
        }
      }

      return true
    }).sort((a, b) => {
      let comparison = 0
      if (sortField === 'date') {
        const dateA = new Date(a.issued_at).getTime() || 0
        const dateB = new Date(b.issued_at).getTime() || 0
        comparison = dateA - dateB
      } else if (sortField === 'number') {
        comparison = (a.certificate_number || '').localeCompare(b.certificate_number || '')
      } else if (sortField === 'owner') {
        comparison = (a.owner_name || '').localeCompare(b.owner_name || '')
      } else if (sortField === 'propertyId') {
        const idA = a.property_id || 0
        const idB = b.property_id || 0
        comparison = idA - idB
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [certificates, searchTerm, typeFilter, statusFilter, sortField, sortOrder])

  // Pagination calculation
  const totalRecords = filteredRecords.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage, pageSize])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setTypeFilter('all')
    setStatusFilter('all')
    setSortField('date')
    setSortOrder('desc')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatIssueDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr || '—'
      return format(d, 'MMM dd, yyyy')
    } catch {
      return dateStr || '—'
    }
  }

  const formatIssueDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr || '—'
      return format(d, 'MMM dd, yyyy hh:mm a')
    } catch {
      return dateStr || '—'
    }
  }

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} className="text-gray-400 dark:text-gray-500 opacity-60 ml-1 inline" />
    }
    return sortOrder === 'asc' 
      ? <ArrowUp size={13} className="text-green-600 dark:text-green-400 ml-1 inline" />
      : <ArrowDown size={13} className="text-green-600 dark:text-green-400 ml-1 inline" />
  }

  const getCleanTemplateName = (rawType: string) => {
    if (!rawType) return 'Standard Certification'
    return rawType.replace(/^Template\s*\d+:\s*/i, '')
  }

  return (
    <div className="space-y-4">
      {/* Search, Filters, and Actions Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-gray-50 dark:bg-gray-800/80 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80 focus-within:ring-2 focus-within:ring-green-500/30 focus-within:border-green-600 transition-all">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            id="certificate-search-input"
            type="text"
            placeholder="Search certificate #, property ID, owner name, or requestor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-gray-900 dark:text-white placeholder-gray-400"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Certificate Type Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/80 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700/80 text-xs">
            <Filter size={13} className="text-gray-400 shrink-0" />
            <select
              id="certificate-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
            >
              <option value="all">All Certificate Types</option>
              {certificateTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/80 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700/80 text-xs">
            <select
              id="certificate-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="Generated">Generated</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 flex items-center gap-1.5 cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchCertificates}
            disabled={isLoading}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
            title="Refresh certificate list"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-green-600' : ''} />
          </button>

          {/* Generate New Certificate CTA */}
          {onIssueNewCertificate && (
            <button
              id="btn-issue-new-certificate"
              onClick={onIssueNewCertificate}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>Issue Certificate</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-green-600 border-t-transparent mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Retrieving official certificate records...
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Synchronizing with Assessor's Office database
            </p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-8 text-center bg-red-50/50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/40">
            <AlertCircle size={36} className="mx-auto text-red-600 dark:text-red-400 mb-2" />
            <h3 className="text-base font-bold text-red-900 dark:text-red-200">
              Unable to Load Certificate Records
            </h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-md mx-auto">
              {error}
            </p>
            <button
              onClick={fetchCertificates}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredRecords.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-3 border border-green-200 dark:border-green-800/60">
              <FileText size={26} />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {certificates.length === 0 ? 'No Certificates Issued Yet' : 'No Matching Certificates Found'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              {certificates.length === 0
                ? 'No official certificates have been issued yet. Click below to select a property and generate an official certificate.'
                : 'No certificate records match your current search and filter criteria. Try clearing your filters.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  Clear Filters
                </button>
              )}
              {onIssueNewCertificate && (
                <button
                  onClick={onIssueNewCertificate}
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition shadow-sm"
                >
                  Issue New Certificate
                </button>
              )}
            </div>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && filteredRecords.length > 0 && (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-800/40 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th 
                      scope="col"
                      className="px-5 py-3.5 cursor-pointer select-none hover:text-green-700 dark:hover:text-green-400 transition"
                      onClick={() => handleSort('number')}
                      title="Sort by Certificate Number"
                    >
                      <div className="flex items-center">
                        <span>CERTIFICATE NO.</span>
                        {renderSortIndicator('number')}
                      </div>
                    </th>

                    <th 
                      scope="col"
                      className="px-5 py-3.5 cursor-pointer select-none hover:text-green-700 dark:hover:text-green-400 transition"
                      onClick={() => handleSort('propertyId')}
                      title="Sort by Property ID"
                    >
                      <div className="flex items-center">
                        <span>PROPERTY ID</span>
                        {renderSortIndicator('propertyId')}
                      </div>
                    </th>

                    <th 
                      scope="col"
                      className="px-5 py-3.5 cursor-pointer select-none hover:text-green-700 dark:hover:text-green-400 transition"
                      onClick={() => handleSort('owner')}
                      title="Sort by Property Owner"
                    >
                      <div className="flex items-center">
                        <span>PROPERTY OWNER</span>
                        {renderSortIndicator('owner')}
                      </div>
                    </th>

                    <th scope="col" className="px-5 py-3.5">
                      <span>CERTIFICATE TYPE</span>
                    </th>

                    <th 
                      scope="col"
                      className="px-5 py-3.5 cursor-pointer select-none hover:text-green-700 dark:hover:text-green-400 transition"
                      onClick={() => handleSort('date')}
                      title="Sort by Date Issued"
                    >
                      <div className="flex items-center">
                        <span>DATE ISSUED</span>
                        {renderSortIndicator('date')}
                      </div>
                    </th>

                    <th scope="col" className="px-5 py-3.5">
                      <span>STATUS</span>
                    </th>

                    <th scope="col" className="px-5 py-3.5 text-right">
                      <span>ACTIONS</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {paginatedRecords.map((cert) => {
                    const cleanType = getCleanTemplateName(cert.certificate_type)
                    const isCopied = copiedId === cert.certificate_number

                    return (
                      <tr 
                        key={cert.certificate_id}
                        className="hover:bg-green-50/40 dark:hover:bg-gray-800/50 transition-colors group"
                      >
                        {/* 1. Certificate Number */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-green-700 dark:text-green-400">
                              {cert.certificate_number}
                            </span>
                            <button
                              onClick={() => copyToClipboard(cert.certificate_number)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded transition"
                              title="Copy certificate number"
                              aria-label={`Copy certificate number ${cert.certificate_number}`}
                            >
                              {isCopied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                          {cert.or_number && (
                            <span className="text-[10px] text-gray-400 block font-mono">
                              OR: {cert.or_number}
                            </span>
                          )}
                        </td>

                        {/* 2. Property ID */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {cert.property_id ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700/60 font-mono"
                              title={`Property ID #${cert.property_id}`}
                            >
                              <Building2 size={11} className="text-gray-500" />
                              PROPERTY-{cert.property_id}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              Unlinked
                            </span>
                          )}
                        </td>

                        {/* 3. Property Owner Name */}
                        <td className="px-5 py-3.5">
                          <div className="max-w-[220px]">
                            <strong 
                              className="text-xs font-semibold text-gray-900 dark:text-white block truncate" 
                              title={cert.owner_name}
                            >
                              {cert.owner_name || 'Unassigned Owner'}
                            </strong>
                            {cert.requestor_name && cert.requestor_name !== cert.owner_name && (
                              <span 
                                className="text-[11px] text-gray-500 dark:text-gray-400 block truncate"
                                title={`Requested by: ${cert.requestor_name}`}
                              >
                                Req: {cert.requestor_name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Certificate Type */}
                        <td className="px-5 py-3.5">
                          <div className="max-w-[240px]">
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 truncate max-w-full"
                              title={cert.certificate_type}
                            >
                              <FileText size={11} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <span className="truncate">{cleanType}</span>
                            </span>
                            {cert.purpose && (
                              <span 
                                className="text-[10px] text-gray-400 block truncate mt-0.5" 
                                title={`Purpose: ${cert.purpose}`}
                              >
                                {cert.purpose}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Date Issued */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1.5" title={formatIssueDateTime(cert.issued_at)}>
                            <Calendar size={13} className="text-gray-400 shrink-0" />
                            <span>{formatIssueDate(cert.issued_at)}</span>
                          </div>
                          {cert.generated_by_name && (
                            <span 
                              className="text-[10px] text-gray-400 block truncate max-w-[120px] mt-0.5" 
                              title={`Issued by ${cert.generated_by_name}`}
                            >
                              By: {cert.generated_by_name}
                            </span>
                          )}
                        </td>

                        {/* 6. Status */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {cert.status === 'Cancelled' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                              <XCircle size={11} />
                              Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 border border-green-200 dark:border-green-800">
                              <CheckCircle2 size={11} />
                              Generated
                            </span>
                          )}
                        </td>

                        {/* 7. Actions */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View / Quick Print Modal Button */}
                            <button
                              onClick={() => setPrintCert(cert)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-green-50 hover:text-green-700 dark:bg-gray-800 dark:hover:bg-green-950/40 dark:hover:text-green-300 transition cursor-pointer border border-transparent hover:border-green-200 dark:hover:border-green-800"
                              title="Preview and print certificate"
                              aria-label={`Preview certificate ${cert.certificate_number}`}
                            >
                              <Printer size={13} />
                              <span>Print</span>
                            </button>

                            {/* Open in Workspace Button */}
                            {cert.property_id && onOpenWorkspace && (
                              <button
                                onClick={() => onOpenWorkspace(cert.property_id!)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-300 dark:bg-green-900/30 dark:hover:bg-green-900/50 transition cursor-pointer border border-green-200 dark:border-green-800"
                                title="Open in Certificate Workspace to edit or reissue"
                                aria-label={`Open certificate workspace for property ${cert.property_id}`}
                              >
                                <ExternalLink size={13} />
                                <span>Workspace</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination & Summary Footer */}
            <div className="px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/20 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-3">
                <span>
                  Showing{' '}
                  <strong className="text-gray-900 dark:text-white">
                    {(currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-gray-900 dark:text-white">
                    {Math.min(currentPage * pageSize, totalRecords)}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-gray-900 dark:text-white">{totalRecords}</strong>{' '}
                  certificates
                </span>

                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] text-gray-500">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Page Navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition"
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((page, index, arr) => {
                      const prevPage = arr[index - 1]
                      const showEllipsis = prevPage && page - prevPage > 1

                      return (
                        <div key={page} className="flex items-center">
                          {showEllipsis && <span className="px-1 text-gray-400">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition ${
                              currentPage === page
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      )
                    })}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition"
                    title="Next page"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Quick Print Preview Modal */}
      {printCert && (
        <QuickCertificatePrintModal 
          cert={printCert} 
          onClose={() => setPrintCert(null)} 
          onOpenWorkspace={onOpenWorkspace ? () => {
            const pid = printCert.property_id
            setPrintCert(null)
            if (pid) onOpenWorkspace(pid)
          } : undefined}
        />
      )}
    </div>
  )
}

/**
 * Quick Certificate Print / View Modal
 */
function QuickCertificatePrintModal({ 
  cert, 
  onClose,
  onOpenWorkspace 
}: { 
  cert: GeneratedCertificate
  onClose: () => void
  onOpenWorkspace?: () => void
}) {
  const handlePrint = () => {
    window.print()
  }

  const formattedDate = cert.issued_at ? format(new Date(cert.issued_at), "do 'day of' MMMM, yyyy") : ''
  const formattedShortDate = cert.issued_at ? format(new Date(cert.issued_at), 'MMMM dd, yyyy') : ''

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800 print:border-none print:shadow-none print:max-w-none print:w-full print:h-auto print:block">
        {/* Modal Header (Hidden on Print) */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-green-600 dark:text-green-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Official Certificate Preview: {cert.certificate_number}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onOpenWorkspace && cert.property_id && (
              <button
                onClick={onOpenWorkspace}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink size={13} />
                <span>Open Workspace</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Printable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950/50 print:bg-white print:p-0">
          <div className="bg-white mx-auto shadow-md print:shadow-none p-10 max-w-[210mm] min-h-[260mm] font-serif text-gray-900 border border-gray-200 print:border-none print:p-0 print:w-full">
            {/* Republic Header */}
            <div className="text-center mb-6 border-b-2 border-black pb-4">
              <p className="text-xs uppercase tracking-wider">Republic of the Philippines</p>
              <p className="text-xs">Province of Misamis Oriental</p>
              <h2 className="text-sm font-bold uppercase tracking-widest mt-0.5">MUNICIPALITY OF LAGONGLONG</h2>
              <div className="w-16 h-0.5 bg-black mx-auto my-2" />
              <h1 className="text-base font-bold tracking-wider uppercase">Office of the Municipal Assessor</h1>
              <p className="text-xs text-right mt-3 font-sans font-medium text-gray-700">
                Date: {formattedShortDate}
              </p>
            </div>

            {/* Certificate Title */}
            <div className="text-center my-6">
              <h2 className="text-xl font-bold tracking-widest underline uppercase underline-offset-4 font-serif">
                {cert.certificate_type.includes('Template 3') 
                  ? 'REAL PROPERTY HISTORICAL OWNERSHIP'
                  : 'C E R T I F I C A T I O N'}
              </h2>
              <p className="text-xs font-mono text-gray-500 mt-1">
                Reference: {cert.certificate_number}
              </p>
            </div>

            {/* Salutation */}
            <p className="font-bold text-xs uppercase mb-4 tracking-wider">
              TO WHOM IT MAY CONCERN:
            </p>

            {/* Certificate Body */}
            <div className="text-xs leading-relaxed space-y-4 text-justify">
              <p className="indent-8">
                THIS IS TO CERTIFY that according to the records on file in this Office,{' '}
                <strong className="underline uppercase tracking-wider">
                  {cert.owner_name}
                </strong>
                {cert.property_id ? (
                  <>
                    {' '}is declared owner of the real property designated as{' '}
                    <strong>PROPERTY-{cert.property_id}</strong>
                    {cert.custom_tax_declaration_no ? ` covered under Tax Declaration No. ${cert.custom_tax_declaration_no}` : ''}
                    , situated within the Municipality of Lagonglong, Province of Misamis Oriental.
                  </>
                ) : (
                  <>
                    {' '}has real property records registered for taxation purposes within the jurisdiction of this Municipality.
                  </>
                )}
              </p>

              <p className="indent-8">
                This certification is issued upon the request of{' '}
                <strong className="uppercase underline">
                  {cert.requestor_name || cert.owner_name}
                </strong>{' '}
                for <strong>{cert.purpose || 'any legal purpose it may serve'}</strong>.
              </p>

              <p className="indent-8">
                Issued this {formattedDate} at Lagonglong, Misamis Oriental, Philippines.
              </p>
            </div>

            {/* Signatures & Footer */}
            <div className="mt-16 grid grid-cols-2 gap-8 text-xs font-sans">
              <div>
                <p className="text-[11px] text-gray-600 font-medium mb-1">Official Payment Details:</p>
                <div className="space-y-0.5 text-[11px] font-mono text-gray-800">
                  <p>O.R. Number: {cert.or_number || '4567695'}</p>
                  <p>Amount Paid: ₱60.50</p>
                  <p>Doc. Stamp: ₱30.00</p>
                  <p>Issued at: Lagonglong, Mis. Or.</p>
                </div>
              </div>

              <div className="text-center pt-4">
                <p className="text-[11px] italic text-gray-500 mb-6 text-left">Approved and Certified by:</p>
                <p className="font-bold uppercase tracking-wider text-xs border-b border-black pb-0.5 inline-block min-w-[200px]">
                  {cert.signer_name || 'MARIE MAE P. UBALDE'}
                </p>
                <p className="text-[11px] italic text-gray-600 mt-0.5">
                  {cert.signer_title || 'OIC - Municipal Assessor'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
