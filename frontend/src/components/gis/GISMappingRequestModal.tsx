import { useState } from 'react';
import { X, Send, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import type { GISFeature } from '../../types/gis';

interface GISMappingRequestModalProps {
  feature: GISFeature;
  onClose: () => void;
  onSubmitted: () => void;
}

export function GISMappingRequestModal({ feature, onClose, onSubmitted }: GISMappingRequestModalProps) {
  const isMapped = Boolean(feature.has_gis || (feature.coordinates && feature.coordinates !== 'null'));
  const defaultRequestType = isMapped ? 'mapping_update' : 'initial_mapping';

  const [requestType, setRequestType] = useState<'initial_mapping' | 'mapping_update'>(defaultRequestType);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for the mapping request.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/gis/requests', {
        property_id: feature.property_id,
        property_type: feature.type,
        target_id: feature.id,
        request_type: requestType,
        reason: reason.trim(),
        notes: notes.trim() || null,
      });

      setSuccess(true);
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit mapping request. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1350] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden text-gray-900 dark:text-gray-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Submit GIS Mapping Request
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Staff mapping requests require Admin approval before saving boundaries
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
        {success ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
            <CheckCircle2 size={44} className="text-emerald-500 animate-bounce" />
            <h4 className="font-bold text-lg text-gray-900 dark:text-white">Request Submitted!</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
              Your mapping request has been saved and is now Pending review by an Assessor or Administrator.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Property Summary Card */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/60 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {feature.title}
                </span>
                <span className="font-mono text-gray-400 text-[11px]">
                  Property #{feature.property_id} ({feature.type.toUpperCase()})
                </span>
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                Owner: <strong className="text-gray-800 dark:text-gray-200">{feature.owner || 'Unknown'}</strong>
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                Location: <span>{feature.barangay_name || 'Lagonglong'}, Misamis Oriental</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-800">
                <span className="text-gray-400">Current Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isMapped 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>
                  {isMapped ? 'Mapped' : 'Unmapped'}
                </span>
              </div>
            </div>

            {/* Request Type Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Request Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRequestType('initial_mapping')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    requestType === 'initial_mapping'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Initial Mapping
                  <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                    Draw new cadastral boundary
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('mapping_update')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    requestType === 'mapping_update'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Mapping Update
                  <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                    Correct or adjust boundary
                  </span>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label htmlFor="input-mapping-reason" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Reason for Request <span className="text-red-500">*</span>
              </label>
              <textarea
                id="input-mapping-reason"
                rows={3}
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="State the purpose (e.g., Cadastral survey conducted, boundary realignment, land dispute resolution)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="input-mapping-notes" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Optional Notes / References
              </label>
              <textarea
                id="input-mapping-notes"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Reference survey plan number, tax declaration number, or field notes..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
