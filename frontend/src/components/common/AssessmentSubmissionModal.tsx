import React, { useState, useEffect } from 'react';
import { Camera, X, AlertCircle, Building2, SquareDashed, CheckCircle2, UploadCloud, Info } from 'lucide-react';
import api, { ensureSession } from '../../lib/api';
import { useModal } from '../../contexts/ModalContext';

export interface AssessmentTarget {
  type: 'lot' | 'building' | 'property';
  target_id: string | number;
  property_id?: string | number;
  owner_name?: string;
  market_value?: number | string;
  assessed_value?: number | string;
  remarks?: string;
  property_photo?: string | null;
  rejection_reason?: string | null;
  assessment_id?: number;
  assessment_status?: string;
}

interface AssessmentSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: AssessmentTarget | null;
  onSuccess: () => void;
}

export const AssessmentSubmissionModal: React.FC<AssessmentSubmissionModalProps> = ({
  isOpen,
  onClose,
  target,
  onSuccess
}) => {
  const { showSuccess, showError } = useModal();

  const [marketValue, setMarketValue] = useState<string>('');
  const [assessedValue, setAssessedValue] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    if (target && isOpen) {
      setMarketValue(target.market_value ? String(target.market_value) : '');
      setAssessedValue(target.assessed_value ? String(target.assessed_value) : '');
      setRemarks(target.remarks || '');
      setExistingPhoto(target.property_photo || null);
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setFormError('');
    }
  }, [target, isOpen]);

  // Automatically calculate 20% assessment level if user enters market value and assessed is empty
  const handleMarketValueChange = (val: string) => {
    setMarketValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && (!assessedValue || assessedValue === '0')) {
      setAssessedValue(String(Math.round(num * 0.2)));
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setFormError('Please select a valid image file (JPG, PNG, WebP).');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setFormError('Photo file size must not exceed 10MB.');
        return;
      }
      setFormError('');
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    setExistingPhoto(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;

    const numMarket = parseFloat(marketValue);
    const numAssessed = parseFloat(assessedValue);

    if (isNaN(numMarket) || numMarket <= 0) {
      setFormError('Market Value is required and must be greater than 0.');
      return;
    }
    if (isNaN(numAssessed) || numAssessed <= 0) {
      setFormError('Assessed Value is required and must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      await ensureSession();

      const formData = new FormData();
      formData.append('type', target.type);
      formData.append('target_id', String(target.target_id));
      formData.append('market_value', String(numMarket));
      formData.append('assessed_value', String(numAssessed));
      formData.append('assessor_level', '20');
      if (remarks.trim()) {
        formData.append('remarks', remarks.trim());
      }
      if (selectedPhoto) {
        formData.append('photo', selectedPhoto);
      } else if (existingPhoto) {
        formData.append('property_photo', existingPhoto);
      }

      if (target.assessment_id && target.assessment_status === 'returned') {
        // Resubmitting corrected assessment
        await api.put(`/assessments/${target.type}/${target.assessment_id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        showSuccess('Assessment corrected and submitted to Head Assessor for review.');
      } else {
        // Submitting new assessment
        await api.post('/assessments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        showSuccess('Assessment successfully submitted for Head Assessor review.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to submit assessment. Please check the values.';
      setFormError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center">
              {target.type === 'building' ? <Building2 size={20} /> : <SquareDashed size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {target.assessment_status === 'returned' ? 'Update & Resubmit Assessment' : 'Conduct Property Assessment'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {target.type.toUpperCase()} • Target ID: <span className="font-mono font-semibold text-gray-900 dark:text-white">{target.target_id}</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Returned correction banner */}
          {target.rejection_reason && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <p className="font-bold">Correction Requested by Head Assessor:</p>
                <p className="mt-1 font-medium">{target.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Form error banner */}
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Property Summary Pill */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Authorized Property Target:</span>
            <span className="font-semibold text-gray-900 dark:text-white font-mono">
              {target.target_id} {target.owner_name ? `• ${target.owner_name}` : ''}
            </span>
          </div>

          {/* Valuation Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Market Value (₱) <span className="text-red-500">*</span>
              </label>
              <input
                id="market-value-input"
                data-testid="market-value-input"
                type="number"
                step="any"
                min="1"
                required
                value={marketValue}
                onChange={(e) => handleMarketValueChange(e.target.value)}
                placeholder="e.g. 500000"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Assessed Value (₱) <span className="text-red-500">*</span>
              </label>
              <input
                id="assessed-value-input"
                data-testid="assessed-value-input"
                type="number"
                step="any"
                min="1"
                required
                value={assessedValue}
                onChange={(e) => setAssessedValue(e.target.value)}
                placeholder="e.g. 100000"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Optional Property Photo Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Camera size={14} className="text-green-600" />
                Property Photo <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              {(photoPreview || existingPhoto) && (
                <button
                  id="remove-photo-btn"
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-[11px] text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                >
                  <X size={12} /> Remove photo
                </button>
              )}
            </div>

            {photoPreview || existingPhoto ? (
              <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-800 max-h-48 flex items-center justify-center">
                <img 
                  src={photoPreview || (existingPhoto?.startsWith('http') ? existingPhoto : `http://localhost:5000${existingPhoto}`)} 
                  alt="Property Preview" 
                  className="w-full h-44 object-cover"
                />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white rounded text-[11px] flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-green-400" /> Photo attached
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 dark:bg-gray-800/50 transition">
                <UploadCloud size={24} className="text-gray-400 dark:text-gray-500 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Click to attach property photo</span>
                <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, or WebP up to 10MB (Optional)</span>
                <input 
                  id="photo-upload-input"
                  data-testid="photo-upload-input"
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  className="hidden" 
                  onChange={handlePhotoSelect}
                />
              </label>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Assessment Remarks & Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="remarks-input"
              data-testid="remarks-input"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Concrete residential structure with standard finishing in good condition..."
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Notice about Head Assessor Review */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
            <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              Submitting this assessment will register it with <strong>Pending Review</strong> status. It will be officially assessed once approved by the Head Assessor.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <button
              id="cancel-assessment-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              id="submit-assessment-btn"
              data-testid="submit-assessment-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting to Head Assessor...
                </>
              ) : (
                target.assessment_status === 'returned' ? 'Resubmit for Review' : 'Submit for Review'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
