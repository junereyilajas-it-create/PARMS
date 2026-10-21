import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  X,
  RefreshCw,
  Building2,
  SquareDashed,
  PencilRuler,
  Eye,
  FileText
} from 'lucide-react';
import api from '../../lib/api';
import type { GISMappingRequest } from '../../types/gis';

interface GISMappingRequestsTableProps {
  userRole: string;
  onOpenReviewModal: (request: GISMappingRequest) => void;
  onOpenDrawModalForRequest: (propertyId: number, propertyType: 'lot' | 'building', targetId: number) => void;
  onViewProperty: (propertyId: number, propertyType: 'lot' | 'building') => void;
  refreshTrigger?: number;
}

export function GISMappingRequestsTable({
  userRole,
  onOpenReviewModal,
  onOpenDrawModalForRequest,
  onViewProperty,
  refreshTrigger = 0,
}: GISMappingRequestsTableProps) {
  const [requests, setRequests] = useState<GISMappingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isAdminOrSuper = ['admin', 'super_admin', 'assessor'].includes(userRole);
  const isStaff = userRole === 'staff';

  const loadRequests = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const { data } = await api.get('/gis/requests');
      setRequests(data || []);
    } catch {
      setActionMessage({ text: 'Failed to retrieve mapping requests from server.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [refreshTrigger]);

  const handleCancelRequest = async (requestId: number) => {
    if (!window.confirm('Are you sure you want to cancel this pending mapping request?')) return;
    setCancellingId(requestId);
    try {
      await api.put(`/gis/requests/${requestId}/cancel`);
      setActionMessage({ text: 'Mapping request successfully cancelled.', type: 'success' });
      await loadRequests();
    } catch (err: any) {
      setActionMessage({ text: err.response?.data?.message || 'Failed to cancel request.', type: 'error' });
    } finally {
      setCancellingId(null);
    }
  };

  // Filtered requests
  const filteredRequests = requests.filter(req => {
    if (statusFilter !== 'all' && req.request_status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = (req.property_title || '').toLowerCase().includes(q);
      const matchOwner = (req.owner_name || '').toLowerCase().includes(q);
      const matchStaff = (req.requested_by_name || '').toLowerCase().includes(q);
      const matchPropId = `property-${req.property_id}`.toLowerCase().includes(q) || String(req.property_id).includes(q);
      const matchReason = (req.reason || '').toLowerCase().includes(q);

      if (!matchTitle && !matchOwner && !matchStaff && !matchPropId && !matchReason) {
        return false;
      }
    }
    return true;
  });

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.request_status === 'pending').length,
    approved: requests.filter(r => r.request_status === 'approved').length,
    rejected: requests.filter(r => r.request_status === 'rejected').length,
    completed: requests.filter(r => r.request_status === 'completed').length,
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
      {/* Top Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Title and Search */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition shadow-sm text-xs">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                id="input-mapping-requests-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search requests by Property, Staff, Reason..."
                className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-gray-200/80 dark:bg-gray-700/80 p-0.5 rounded-xl text-xs font-semibold overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All Requests', count: counts.all },
                { id: 'pending', label: 'Pending', count: counts.pending },
                { id: 'approved', label: 'Approved', count: counts.approved },
                { id: 'rejected', label: 'Rejected', count: counts.rejected },
                { id: 'completed', label: 'Completed', count: counts.completed },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                id={`tab-req-filter-${tab.id}`}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  tab.id === 'pending'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                    : tab.id === 'approved'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300'
                      : tab.id === 'rejected'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300'
                        : 'bg-gray-300/60 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadRequests}
            disabled={isLoading}
            className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition"
            title="Refresh requests"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* Action banner */}
      {actionMessage && (
        <div className={`p-3 text-xs font-semibold flex items-center justify-between border-b ${
          actionMessage.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200'
            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200'
        }`}>
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto min-h-[380px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3.5">Req #</th>
              <th className="py-3 px-3.5">Property</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3.5">Submitted By</th>
              <th className="py-3 px-3.5">Request Type</th>
              <th className="py-3 px-4">Reason & Notes</th>
              <th className="py-3 px-3 text-center">Current GIS</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3.5">Date</th>
              <th className="py-3 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading mapping requests...</span>
                  </div>
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileText size={32} className="text-gray-400" />
                    <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                      No mapping requests found for this filter.
                    </p>
                    <p className="text-xs text-gray-400">
                      Staff can submit requests from the GIS Property Directory or Map view.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRequests.map(req => {
                const isBuilding = req.property_type === 'building';
                const isPending = req.request_status === 'pending';
                const isApproved = req.request_status === 'approved';
                const isRejected = req.request_status === 'rejected';
                const isCompleted = req.request_status === 'completed';

                return (
                  <tr
                    key={`req-row-${req.request_id}`}
                    className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition"
                  >
                    {/* Req # */}
                    <td className="py-3 px-3.5 font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      #{req.request_id}
                    </td>

                    {/* Property */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {req.property_title}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        Prop #{req.property_id} • Owner: {req.owner_name || 'N/A'}
                      </div>
                    </td>

                    {/* Entity Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isBuilding
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {isBuilding ? <Building2 size={11} /> : <SquareDashed size={11} />}
                        {isBuilding ? 'Building' : 'Lot'}
                      </span>
                    </td>

                    {/* Submitted By */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {req.requested_by_name || 'Staff User'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Staff Assessor
                      </div>
                    </td>

                    {/* Request Type */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className={`font-semibold ${
                        req.request_type === 'mapping_update'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {req.request_type === 'mapping_update' ? 'Mapping Update' : 'Initial Mapping'}
                      </span>
                    </td>

                    {/* Reason & Notes */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="text-gray-900 dark:text-white font-medium truncate" title={req.reason}>
                        "{req.reason}"
                      </div>
                      {req.notes && (
                        <div className="text-[10px] text-gray-400 truncate mt-0.5" title={req.notes}>
                          Note: {req.notes}
                        </div>
                      )}
                      {isRejected && req.rejection_reason && (
                        <div className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 p-1 bg-red-50 dark:bg-red-950/40 rounded border border-red-200 dark:border-red-800/50">
                          Rejection Reason: {req.rejection_reason}
                        </div>
                      )}
                    </td>

                    {/* Current GIS Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        req.current_mapping_status === 'mapped'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>
                        {req.current_mapping_status === 'mapped' ? 'Mapped' : 'Unmapped'}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200">
                          <Clock size={11} /> Pending Review
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200">
                          <CheckCircle2 size={11} /> Approved
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200">
                          <XCircle size={11} /> Rejected
                        </span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200">
                          <CheckCircle2 size={11} /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          Cancelled
                        </span>
                      )}
                    </td>

                    {/* Submission Date */}
                    <td className="py-3 px-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap text-[11px]">
                      {formatDate(req.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Admin / Super Admin Review Action */}
                        {isAdminOrSuper && isPending && (
                          <button
                            type="button"
                            onClick={() => onOpenReviewModal(req)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                          >
                            <Clock size={12} />
                            <span>Review</span>
                          </button>
                        )}

                        {/* Staff Map Property if Approved */}
                        {isStaff && isApproved && (
                          <button
                            type="button"
                            onClick={() => onOpenDrawModalForRequest(req.property_id, req.property_type, req.target_id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition animate-pulse"
                          >
                            <PencilRuler size={12} />
                            <span>Map Now</span>
                          </button>
                        )}

                        {/* Staff Cancel if Pending */}
                        {isStaff && isPending && (
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(req.request_id)}
                            disabled={cancellingId === req.request_id}
                            className="px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-xs font-semibold transition"
                          >
                            {cancellingId === req.request_id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}

                        {/* View Property */}
                        <button
                          type="button"
                          onClick={() => onViewProperty(req.property_id, req.property_type)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition"
                          title="View property details"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
