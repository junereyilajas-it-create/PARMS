import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserCheck, 
  Search, 
  X, 
  Calendar, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  ShieldCheck, 
  Loader2,
  Clock,
  ArrowRightLeft
} from 'lucide-react';
import api, { ensureSession } from '../../lib/api';
import { useModal } from '../../contexts/ModalContext';

export interface SelectedPropertyAssignment {
  property_id: number | string;
  target_id_int: number;
  target_id_str: string;
  property_type: 'lot' | 'building';
  owner?: string;
  location?: string;
  purok?: string;
  barangay?: string;
  lot_area?: number;
  floor_area?: number;
  building_type?: string;
  status?: string;
  assessment_status?: string;
  active_assignment_id?: number | null;
  assigned_assessor_id?: number | null;
  assigned_assessor_name?: string | null;
  assigned_assessor_username?: string | null;
  assigned_assessor_email?: string | null;
  active_assignment_status?: string | null;
  assignment_due_date?: string | null;
  assignment_instructions?: string | null;
}

interface AssessorUser {
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: string;
  status: string;
}

interface AssignAssessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: SelectedPropertyAssignment | null;
  onSuccess: () => void;
}

export const AssignAssessorModal: React.FC<AssignAssessorModalProps> = ({
  isOpen,
  onClose,
  property,
  onSuccess,
}) => {
  const { showSuccess, showError } = useModal();
  
  const [assessors, setAssessors] = useState<AssessorUser[]>([]);
  const [loadingAssessors, setLoadingAssessors] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAssessor, setSelectedAssessor] = useState<AssessorUser | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if property is currently assigned
  const hasCurrentAssignment = Boolean(
    property?.assigned_assessor_id || 
    (property?.active_assignment_status && property.active_assignment_status !== 'reassigned' && property.active_assignment_status !== 'cancelled')
  );

  // Fetch assessors list from backend API
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchAssessors = async () => {
      setLoadingAssessors(true);
      try {
        await ensureSession();
        const res = await api.get('/assessments/assessors');
        if (isMounted) {
          setAssessors(res.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage('Unable to retrieve assessors from database.');
        }
      } finally {
        if (isMounted) {
          setLoadingAssessors(false);
        }
      }
    };

    fetchAssessors();

    // Reset inputs when opening
    setSearchTerm('');
    setSelectedAssessor(null);
    setDueDate('');
    setInstructions('');
    setReassignReason('');
    setErrorMessage('');
    setIsDropdownOpen(false);

    return () => {
      isMounted = false;
    };
  }, [isOpen, property]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter matching assessors by first name, last name, full name, username, or email
  const filteredAssessors = useMemo(() => {
    if (!searchTerm.trim()) return assessors;
    const term = searchTerm.toLowerCase().trim();
    return assessors.filter((assessor) => {
      const fullName = `${assessor.first_name} ${assessor.last_name}`.toLowerCase();
      const firstName = assessor.first_name.toLowerCase();
      const lastName = assessor.last_name.toLowerCase();
      const username = assessor.username.toLowerCase();
      const email = (assessor.email || '').toLowerCase();

      return (
        fullName.includes(term) ||
        firstName.includes(term) ||
        lastName.includes(term) ||
        username.includes(term) ||
        email.includes(term)
      );
    });
  }, [assessors, searchTerm]);

  if (!isOpen || !property) return null;

  const handleSelectAssessor = (assessor: AssessorUser) => {
    setSelectedAssessor(assessor);
    setSearchTerm(`${assessor.first_name} ${assessor.last_name}`);
    setIsDropdownOpen(false);
    setErrorMessage('');
  };

  const handleClearSelection = () => {
    setSelectedAssessor(null);
    setSearchTerm('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedAssessor) {
      setErrorMessage('Please search and select an eligible assessor from the database.');
      return;
    }

    if (hasCurrentAssignment && !reassignReason.trim()) {
      setErrorMessage('A reason is required when reassigning this property to another assessor.');
      return;
    }

    if (hasCurrentAssignment && property.assigned_assessor_id === selectedAssessor.user_id) {
      setErrorMessage(`This property is already actively assigned to ${selectedAssessor.first_name} ${selectedAssessor.last_name}. Select a different assessor to reassign.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await ensureSession();
      const payload = {
        property_type: property.property_type,
        target_id_int: property.target_id_int,
        target_id_str: property.target_id_str,
        assigned_to_user_id: selectedAssessor.user_id,
        due_date: dueDate || null,
        instructions: instructions.trim() || undefined,
        reassign: hasCurrentAssignment,
        reason: reassignReason.trim() || undefined
      };

      const res = await api.post('/assessments/assign', payload);

      showSuccess(res.data?.message || 'Property assessment assigned successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      const apiMsg = err.response?.data?.message || 'Failed to save assessment assignment in database.';
      setErrorMessage(apiMsg);
      showError(apiMsg);
      // Selection, search term, due date, and instructions are preserved!
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLot = property.property_type === 'lot';
  const propertyLabel = isLot ? 'Lot' : 'Building';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all my-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-green-700 to-emerald-800 p-6 text-white relative">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-5 right-5 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
              {hasCurrentAssignment ? <ArrowRightLeft size={24} className="text-white" /> : <UserCheck size={24} className="text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {hasCurrentAssignment ? `Reassign ${propertyLabel} Assessor` : `Assign Assessor for Assessment`}
              </h2>
              <p className="text-green-100 text-xs mt-0.5">
                {hasCurrentAssignment 
                  ? 'Reassign this property to another certified assessor.'
                  : 'Select an assessor from the official municipal registry.'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmitAssignment} className="p-6 space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Selected Property Details Card */}
          <div className="bg-gray-50 dark:bg-gray-900/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700/80 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700/60 pb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Selected Property
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                {isLot ? 'Lot Property' : 'Building Asset'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Property ID</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  PROPERTY-{property.property_id}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">
                  {isLot ? 'Lot Number' : 'Building Name'}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white truncate block" title={property.target_id_str}>
                  {property.target_id_str}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Owner Name</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate block" title={property.owner || 'Unassigned'}>
                  {property.owner || 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Assessment Status</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  {property.assessment_status === 'approved' ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold">
                      Assessed (Approved)
                    </span>
                  ) : hasCurrentAssignment ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold">
                      Assigned ({property.active_assignment_status || 'Pending'})
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold">
                      Pending Assessment
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Current Assessor Banner if Already Assigned */}
            {hasCurrentAssignment && (
              <div className="mt-2 pt-2.5 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between bg-blue-50/60 dark:bg-blue-900/20 p-2.5 rounded-lg border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
                  <User size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Currently assigned to: <strong className="font-semibold text-blue-950 dark:text-blue-100">{property.assigned_assessor_name || 'Assessor'}</strong>
                    {property.assigned_assessor_username ? ` (@${property.assigned_assessor_username})` : ''}
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Active
                </span>
              </div>
            )}
          </div>

          {/* Searchable Assessor Selection */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                {hasCurrentAssignment ? 'Select New Assessor' : 'Search & Select Assessor'} <span className="text-red-500">*</span>
              </label>
              {loadingAssessors && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Loader2 size={12} className="animate-spin" /> Loading registry...
                </span>
              )}
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                <Search size={18} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                  if (selectedAssessor && e.target.value !== `${selectedAssessor.first_name} ${selectedAssessor.last_name}`) {
                    setSelectedAssessor(null);
                  }
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search assessor by first name, last name, or full name..."
                disabled={isSubmitting}
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-600 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Assessor Dropdown Results */}
            {isDropdownOpen && (
              <div 
                ref={dropdownRef}
                className="absolute z-20 left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60 custom-scrollbar"
              >
                {filteredAssessors.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No matching assessors found for <span className="font-semibold text-gray-700 dark:text-gray-300">"{searchTerm}"</span>
                  </div>
                ) : (
                  filteredAssessors.map((assessor) => {
                    const isSelected = selectedAssessor?.user_id === assessor.user_id;
                    const isCurrentlyAssigned = property.assigned_assessor_id === assessor.user_id;
                    return (
                      <button
                        type="button"
                        key={assessor.user_id}
                        onClick={() => handleSelectAssessor(assessor)}
                        className={`w-full text-left p-3 hover:bg-green-50 dark:hover:bg-green-900/20 transition flex items-center justify-between gap-3 ${
                          isSelected ? 'bg-green-50/80 dark:bg-green-900/30 font-medium' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Initials Avatar */}
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 font-bold flex items-center justify-center text-xs shrink-0">
                            {assessor.first_name[0]}{assessor.last_name[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                              {assessor.first_name} {assessor.last_name}
                              {isCurrentlyAssigned && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              @{assessor.username} • {assessor.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                            Assessor
                          </span>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Selected Assessor Confirmation Card */}
            {selectedAssessor && (
              <div className="mt-2.5 p-3 rounded-xl bg-green-50/80 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {selectedAssessor.first_name[0]}{selectedAssessor.last_name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-green-900 dark:text-green-100 flex items-center gap-1.5">
                      {selectedAssessor.first_name} {selectedAssessor.last_name}
                      <ShieldCheck size={16} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-300">
                      @{selectedAssessor.username} • {selectedAssessor.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-white font-semibold underline underline-offset-2"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Reassignment Reason Field (if already assigned) */}
          {hasCurrentAssignment && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                Reason for Reassignment <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                rows={2}
                placeholder="State the reason for reassigning this property (e.g. Assessor re-allocation, urgent workload adjustment)..."
                disabled={isSubmitting}
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-600 transition"
              />
            </div>
          )}

          {/* Additional Assignment Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-500" /> Due Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Clock size={14} className="text-gray-500" /> Initial Status
              </label>
              <div className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium">
                Assigned / Pending Assessment
              </div>
            </div>
          </div>

          {/* Assessment Instructions Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
              <FileText size={14} className="text-gray-500" /> Instructions or Notes (Optional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="Add specific inspection notes or requirements for this property..."
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-600 transition"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded-xl transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !selectedAssessor}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-sm transition ${
                isSubmitting || !selectedAssessor
                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-75'
                  : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Assignment...</span>
                </>
              ) : hasCurrentAssignment ? (
                <>
                  <ArrowRightLeft size={16} />
                  <span>Confirm Reassignment</span>
                </>
              ) : (
                <>
                  <UserCheck size={16} />
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
