import { useState } from 'react';
import { X, Check, XCircle, AlertTriangle, Building2, SquareDashed, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import type { GISMappingRequest } from '../../types/gis';

interface GISReviewRequestModalProps {
  request: GISMappingRequest;
  onClose: () => void;
  onReviewed: () => void;
  onViewProperty?: (propertyId: number, type: 'lot' | 'building') => void;
}

export function GISReviewRequestModal({ request, onClose, onReviewed, onViewProperty }: GISReviewRequestModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectingOpen, setIsRejectingOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleReview = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      await api.put(`/gis/requests/${request.request_id}/review`, {
        action,
        rejection_reason: action === 'reject' ? rejectionReason.trim() : null,
      });

      setSuccessMessage(
        action === 'approve'
          ? 'Mapping request approved! The requesting Staff member is now authorized to map this property.'
          : 'Mapping request has been rejected with the stated reason.'
      );

      setTimeout(() => {
        onReviewed();
        onClose();
      }, 1300);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to review mapping request.');
      setIsProcessing(false);
    }
  };

  const isBuilding = request.property_type === 'building';

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Not recorded';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[1350] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden text-gray-900 dark:text-gray-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Review Mapping Request #{request.request_id}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Submitted by {request.requested_by_name || 'Staff'} on {formatDate(request.created_at)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {successMessage ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
            <CheckCircle2 size={44} className="text-emerald-500 animate-bounce" />
            <h4 className="font-bold text-lg text-gray-900 dark:text-white">Request Processed!</h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 max-w-sm">
              {successMessage}
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Property details */}
            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700/60 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white text-sm">
                  {isBuilding ? <Building2 size={16} className="text-purple-500" /> : <SquareDashed size={16} className="text-emerald-500" />}
                  <span>{request.property_title || `Property #${request.property_id}`}</span>
                </div>
                <span className="font-mono text-gray-400 text-[11px]">
                  Property #{request.property_id} ({request.property_type.toUpperCase()} #{request.target_id})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-gray-800">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Owner</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{request.owner_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Location</span>
                  <span>{request.barangay_name || 'Lagonglong'}, Misamis Oriental</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-gray-800">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Request Type</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {request.request_type === 'mapping_update' ? 'Mapping Update' : 'Initial Mapping'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Current Mapping Status</span>
                  <span className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    request.current_mapping_status === 'mapped'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    {request.current_mapping_status === 'mapped' ? 'Mapped' : 'Unmapped'}
                  </span>
                </div>
              </div>
            </div>

            {/* Staff Reason & Notes */}
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Reason Submitted by Staff</span>
                <p className="mt-1 p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700/60 text-gray-800 dark:text-gray-200 font-medium">
                  "{request.reason}"
                </p>
              </div>

              {request.notes && (
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Staff Notes</span>
                  <p className="mt-1 p-2 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300">
                    {request.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Rejection input when reject is clicked */}
            {isRejectingOpen && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800/40 space-y-2 text-xs animate-fade-in">
                <label htmlFor="input-rejection-reason" className="block font-bold text-red-700 dark:text-red-300">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="input-rejection-reason"
                  rows={2}
                  required
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Explain why this request cannot be approved (e.g. Missing survey documents, boundary overlap with adjacent parcel)..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRejectingOpen(false)}
                    className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-white"
                  >
                    Cancel Rejection
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview('reject')}
                    disabled={isProcessing || !rejectionReason.trim()}
                    className="px-4 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold transition"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isRejectingOpen && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                {onViewProperty && (
                  <button
                    type="button"
                    onClick={() => onViewProperty(request.property_id, request.property_type)}
                    className="px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    View Property
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsRejectingOpen(true)}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold transition"
                  >
                    <XCircle size={14} />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview('approve')}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Check size={14} />
                    <span>Approve Request</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
