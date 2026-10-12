import React, { useState } from 'react';
import { CheckCircle2, RotateCcw, Camera, User, Tag, DollarSign } from 'lucide-react';
import api, { ensureSession } from '../../lib/api';
import { useModal } from '../../contexts/ModalContext';

export interface AssessmentReviewRecord {
  type: string;
  assessment_id: number;
  target_id: string | number;
  property_id?: string | number;
  assessor_user_id: number;
  first_name?: string;
  last_name?: string;
  market_value: number;
  assessed_value: number;
  assessment_date: string;
  remarks?: string;
  assessment_status: string;
  rejection_reason?: string;
  property_photo?: string | null;
  owner?: string;
}

interface AssessmentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AssessmentReviewRecord | null;
  onSuccess: () => void;
}

export const AssessmentReviewModal: React.FC<AssessmentReviewModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess
}) => {
  const { showSuccess, showError } = useModal();
  const [isReturning, setIsReturning] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !record) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await ensureSession();
      await api.post(`/assessments/${record.type}/${record.target_id}/review`, {
        status: 'approved'
      });
      showSuccess(`Assessment for ${record.type.toUpperCase()} #${record.target_id} officially approved.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to approve assessment.';
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnReason.trim()) {
      setErrorMessage('Please provide a correction note explaining what needs to be changed.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await ensureSession();
      await api.post(`/assessments/${record.type}/${record.target_id}/review`, {
        status: 'returned',
        reason: returnReason.trim()
      });
      showSuccess('Assessment returned to Assessor for correction.');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to return assessment.';
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const photoUrl = record.property_photo
    ? (record.property_photo.startsWith('http') ? record.property_photo : `http://localhost:5000${record.property_photo}`)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Head Assessor Assessment Review</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {record.type.toUpperCase()} • Target ID: <span className="font-mono font-semibold text-gray-900 dark:text-white">{record.target_id}</span>
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] text-gray-500 flex items-center gap-1"><Tag size={12} /> Target ID</span>
              <p className="text-sm font-bold font-mono text-gray-900 dark:text-white mt-0.5">{record.target_id}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] text-gray-500 flex items-center gap-1"><User size={12} /> Assessor</span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                {record.first_name ? `${record.first_name} ${record.last_name}` : `User #${record.assessor_user_id}`}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] text-gray-500 flex items-center gap-1"><DollarSign size={12} /> Market Value</span>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                ₱{Number(record.market_value).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] text-gray-500 flex items-center gap-1"><DollarSign size={12} /> Assessed Value</span>
              <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-0.5">
                ₱{Number(record.assessed_value).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Property Photo Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Camera size={14} className="text-green-600" />
              Property Photo
            </label>
            {photoUrl ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center max-h-64">
                <img 
                  src={photoUrl} 
                  alt="Assessed Property" 
                  className="w-full h-56 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                  onClick={() => window.open(photoUrl, '_blank')}
                  title="Click to view full photo"
                />
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center text-xs text-gray-400">
                No property photo was uploaded for this assessment.
              </div>
            )}
          </div>

          {/* Remarks */}
          {record.remarks && (
            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Assessor Remarks:</span>
              <p className="mt-1 text-gray-600 dark:text-gray-400">{record.remarks}</p>
            </div>
          )}

          {/* Return for correction form */}
          {isReturning && (
            <form onSubmit={handleConfirmReturn} className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <RotateCcw size={16} />
                Return Assessment for Correction
              </div>
              <textarea
                id="return-reason-input"
                data-testid="return-reason-input"
                rows={3}
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Specify the required corrections (e.g. Please re-verify market value based on recent schedule of fair market values)..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  id="cancel-return-btn"
                  type="button"
                  onClick={() => setIsReturning(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  id="confirm-return-btn"
                  data-testid="confirm-return-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  Confirm Return for Correction
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {!isReturning && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center gap-3 bg-gray-50/50 dark:bg-gray-900">
            <button
              id="close-review-modal-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Close
            </button>
            <div className="flex gap-2">
              <button
                id="return-for-correction-btn"
                data-testid="return-for-correction-btn"
                type="button"
                onClick={() => setIsReturning(true)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
              >
                <RotateCcw size={16} />
                Return for Correction
              </button>
              <button
                id="approve-assessment-btn"
                data-testid="approve-assessment-btn"
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Approve Assessment
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
