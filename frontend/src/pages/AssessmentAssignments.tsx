import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  XCircle, 
  AlertTriangle, 
  User, 
  Building, 
  MapPin, 
  Calendar, 
  X, 
  Loader2, 
  ShieldCheck, 
  History, 
  ArrowRightLeft
} from 'lucide-react';
import api, { ensureSession } from '../lib/api';
import { useModal } from '../contexts/ModalContext';

type Assignment = {
  assignment_id: number;
  property_type: 'lot' | 'building' | 'property';
  target_id_str: string;
  target_id_int: number;
  assessor_first_name: string;
  assessor_last_name: string;
  assigned_to_user_id: number;
  assigner_first_name?: string;
  assigner_last_name?: string;
  assignment_status: string;
  due_date: string | null;
  instructions: string | null;
  owner_name?: string;
  barangay?: string;
  property_address?: string;
  created_at?: string;
  updated_at?: string;
};

interface AvailableProperty {
  property_type: 'lot' | 'building';
  target_id_int: number;
  target_id_str: string;
  property_id: number;
  owner_name: string;
  barangay: string;
  location: string;
  assessment_status: string;
  active_assignment_id: number | null;
  active_assessor_name: string | null;
  has_active_assignment: boolean;
}

interface AssessorOption {
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: string;
  status: string;
  active_assignments_count: number;
  total_assignments_count: number;
}

export const AssessmentAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [tableSearch, setTableSearch] = useState('');

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // Form states for Add Assignment Modal
  const [propSearchTerm, setPropSearchTerm] = useState('');
  const [propResults, setPropResults] = useState<AvailableProperty[]>([]);
  const [isSearchingProps, setIsSearchingProps] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<AvailableProperty | null>(null);
  const [showPropDropdown, setShowPropDropdown] = useState(false);

  const [assessorSearchTerm, setAssessorSearchTerm] = useState('');
  const [assessorsList, setAssessorsList] = useState<AssessorOption[]>([]);
  const [isLoadingAssessors, setIsLoadingAssessors] = useState(false);
  const [selectedAssessor, setSelectedAssessor] = useState<AssessorOption | null>(null);
  const [showAssessorDropdown, setShowAssessorDropdown] = useState(false);

  const [dueDate, setDueDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Reassign Modal
  const [reassignSearchTerm, setReassignSearchTerm] = useState('');
  const [reassignAssessor, setReassignAssessor] = useState<AssessorOption | null>(null);
  const [showReassignAssessorDropdown, setShowReassignAssessorDropdown] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [reassignDueDate, setReassignDueDate] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Form states for Cancel Modal
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const { showSuccess, showError, showConfirm } = useModal();

  const propDropdownRef = useRef<HTMLDivElement>(null);
  const assessorDropdownRef = useRef<HTMLDivElement>(null);
  const reassignAssessorDropdownRef = useRef<HTMLDivElement>(null);

  const loadAssignments = async () => {
    setIsLoading(true);
    try {
      await ensureSession();
      const { data } = await api.get('/assessments/assignments');
      setAssignments(data);
    } catch {
      showError('Unable to load assignments from the database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (propDropdownRef.current && !propDropdownRef.current.contains(e.target as Node)) {
        setShowPropDropdown(false);
      }
      if (assessorDropdownRef.current && !assessorDropdownRef.current.contains(e.target as Node)) {
        setShowAssessorDropdown(false);
      }
      if (reassignAssessorDropdownRef.current && !reassignAssessorDropdownRef.current.contains(e.target as Node)) {
        setShowReassignAssessorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search properties debounce
  useEffect(() => {
    if (!showAssignModal) return;
    const timer = setTimeout(async () => {
      setIsSearchingProps(true);
      try {
        const { data } = await api.get(`/assessments/available-properties?q=${encodeURIComponent(propSearchTerm.trim())}`);
        setPropResults(data);
      } catch (err) {
        console.error('Error fetching available properties:', err);
      } finally {
        setIsSearchingProps(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [propSearchTerm, showAssignModal]);

  // Load assessors
  const fetchAssessors = async (q = '') => {
    setIsLoadingAssessors(true);
    try {
      const { data } = await api.get(`/assessments/assessors?q=${encodeURIComponent(q.trim())}`);
      setAssessorsList(data);
    } catch (err) {
      console.error('Error fetching assessors:', err);
    } finally {
      setIsLoadingAssessors(false);
    }
  };

  useEffect(() => {
    if (showAssignModal || showReassignModal) {
      fetchAssessors();
    }
  }, [showAssignModal, showReassignModal]);

  // Handle open Add Modal
  const handleOpenAssignModal = () => {
    setSelectedProperty(null);
    setSelectedAssessor(null);
    setPropSearchTerm('');
    setAssessorSearchTerm('');
    setDueDate('');
    setInstructions('');
    setShowPropDropdown(false);
    setShowAssessorDropdown(false);
    setShowAssignModal(true);
  };

  // Submit Add Assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProperty) {
      showError('Please search and select a valid Lot or Building record.');
      return;
    }

    if (selectedProperty.has_active_assignment) {
      showError(`This ${selectedProperty.property_type.toUpperCase()} already has an active assignment to ${selectedProperty.active_assessor_name || 'an assessor'}. Duplicate assignments are prevented.`);
      return;
    }

    if (!selectedAssessor) {
      showError('Please search and select an eligible assessor account.');
      return;
    }

    showConfirm(
      `Confirm assessment assignment of ${selectedProperty.property_type.toUpperCase()} "${selectedProperty.target_id_str}" to Assessor ${selectedAssessor.first_name} ${selectedAssessor.last_name}?`,
      async () => {
        setIsSubmitting(true);
        try {
          await api.post('/assessments/assign', {
            property_type: selectedProperty.property_type,
            target_id_int: selectedProperty.target_id_int,
            target_id_str: selectedProperty.target_id_str,
            assigned_to_user_id: selectedAssessor.user_id,
            due_date: dueDate || null,
            instructions: instructions.trim() || null
          });
          showSuccess(`Assessment successfully assigned to Assessor ${selectedAssessor.first_name} ${selectedAssessor.last_name}.`);
          setShowAssignModal(false);
          loadAssignments();
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to create assessment assignment.');
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // Submit Cancel Assignment
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    setIsCancelling(true);
    try {
      await api.post(`/assessments/assignments/${selectedAssignment.assignment_id}/cancel`, {
        reason: cancelReason.trim() || undefined
      });
      showSuccess(`Assignment for ${selectedAssignment.target_id_str} was cancelled successfully.`);
      setShowCancelModal(false);
      loadAssignments();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to cancel assignment.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Open Reassign Modal
  const handleOpenReassignModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setReassignAssessor(null);
    setReassignSearchTerm('');
    setReassignReason('');
    setReassignDueDate(assignment.due_date ? assignment.due_date.substring(0, 10) : '');
    setShowReassignAssessorDropdown(false);
    setShowReassignModal(true);
  };

  // Submit Reassignment
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    if (!reassignAssessor) {
      showError('Please select a valid replacement assessor.');
      return;
    }

    if (reassignAssessor.user_id === selectedAssignment.assigned_to_user_id) {
      showError('Replacement assessor cannot be the same as the currently assigned assessor.');
      return;
    }

    showConfirm(
      `Reassign ${selectedAssignment.target_id_str} from Assessor ${selectedAssignment.assessor_first_name} ${selectedAssignment.assessor_last_name} to Assessor ${reassignAssessor.first_name} ${reassignAssessor.last_name}?`,
      async () => {
        setIsReassigning(true);
        try {
          await api.put(`/assessments/assignments/${selectedAssignment.assignment_id}/reassign`, {
            new_assessor_id: reassignAssessor.user_id,
            reason: reassignReason.trim() || undefined,
            due_date: reassignDueDate || undefined
          });
          showSuccess(`Assessment successfully reassigned to ${reassignAssessor.first_name} ${reassignAssessor.last_name}.`);
          setShowReassignModal(false);
          loadAssignments();
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to reassign assessment.');
        } finally {
          setIsReassigning(false);
        }
      }
    );
  };

  // Status Badge styling
  const getStatusBadge = (status: string) => {
    const s = String(status).toUpperCase();
    const style = 
      s === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800' :
      s === 'ASSIGNED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
      s === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
      s === 'PENDING' || s === 'SUBMITTED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
      s === 'REASSIGNED' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' :
      s === 'CANCELLED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800' :
      s === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
      'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  // Filtered assignments based on tab and search
  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      const isActive = ['assigned', 'in_progress', 'submitted', 'pending'].includes(item.assignment_status.toLowerCase());
      
      if (activeTab === 'active' && !isActive) return false;

      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      return (
        item.target_id_str?.toLowerCase().includes(q) ||
        item.property_type?.toLowerCase().includes(q) ||
        item.owner_name?.toLowerCase().includes(q) ||
        item.barangay?.toLowerCase().includes(q) ||
        `${item.assessor_first_name} ${item.assessor_last_name}`.toLowerCase().includes(q) ||
        item.assignment_status?.toLowerCase().includes(q) ||
        String(item.assignment_id).includes(q)
      );
    });
  }, [assignments, activeTab, tableSearch]);

  const activeCount = assignments.filter(a => ['assigned', 'in_progress', 'submitted', 'pending'].includes(a.assignment_status.toLowerCase())).length;
  const historyCount = assignments.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">Assessment Assignments</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage, assign, reassign, and track municipal property assessments.</p>
        </div>
        <button 
          onClick={handleOpenAssignModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl shadow-sm transition-colors focus:ring-2 focus:ring-green-500 focus:outline-none"
        >
          <Plus size={18} /> Assign Assessment
        </button>
      </div>

      {/* Tabs and Search Controls */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <span>Active Assignments</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                {activeCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <History size={16} />
              <span>All / Assignment History</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {historyCount}
              </span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search assignments..." 
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Assignments Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3">Property ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Owner & Location</th>
                <th className="px-4 py-3">Assigned Assessor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-green-600" />
                    Loading assignments from database...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <div className="max-w-sm mx-auto">
                      <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500 opacity-60" />
                      <p className="font-medium text-gray-600 dark:text-gray-300">No assignments found</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activeTab === 'active' 
                          ? 'There are currently no active assignments. Click "Assign Assessment" to assign a property.' 
                          : 'No historical records match your search criteria.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((row) => {
                  const isActive = ['assigned', 'in_progress', 'submitted', 'pending'].includes(row.assignment_status.toLowerCase());
                  return (
                    <tr key={row.assignment_id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{row.target_id_str}</span>
                        </div>
                        <span className="text-[11px] text-gray-400 font-normal">Assignment #{row.assignment_id}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                          row.property_type === 'lot' 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                            : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                        }`}>
                          {row.property_type === 'lot' ? <MapPin size={12} /> : <Building size={12} />}
                          {row.property_type?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{row.owner_name || 'No Owner Listed'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="shrink-0" />
                          <span>{row.barangay ? `Brgy. ${row.barangay}` : 'Lagonglong'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {row.assessor_first_name?.[0] || 'A'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {row.assessor_first_name} {row.assessor_last_name}
                            </div>
                            <div className="text-[11px] text-gray-400">Assessor ID #{row.assigned_to_user_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(row.assignment_status)}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-400">
                        {row.due_date ? new Date(row.due_date).toLocaleDateString() : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {isActive ? (
                          <div className="inline-flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleOpenReassignModal(row)}
                              title="Reassign to another assessor"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:hover:bg-green-900/60 dark:text-green-300 rounded-lg transition-colors border border-green-200 dark:border-green-800/60"
                            >
                              <RefreshCw size={13} /> Reassign
                            </button>
                            <button
                              onClick={() => handleOpenCancelModal(row)}
                              title="Cancel this assessment assignment"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 rounded-lg transition-colors border border-red-200 dark:border-red-800/60"
                            >
                              <XCircle size={13} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Archived in history</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ADD ASSESSMENT ASSIGNMENT MODAL                                        */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl p-6 border border-gray-100 dark:border-gray-700 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700 mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={20} className="text-green-600" />
                  Assign Assessment
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Select a property and assign an eligible field assessor.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-5">
              {/* FIELD 1: SEARCHABLE PROPERTY SELECTION (LOT OR BUILDING) */}
              <div ref={propDropdownRef} className="relative">
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Property ID <span className="text-red-500">*</span>
                </label>

                {!selectedProperty ? (
                  <div>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search by Lot ID, Building ID, Property ID, or Owner Name..."
                        value={propSearchTerm}
                        onChange={(e) => {
                          setPropSearchTerm(e.target.value);
                          setShowPropDropdown(true);
                        }}
                        onFocus={() => setShowPropDropdown(true)}
                        className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {isSearchingProps && (
                        <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 animate-spin" />
                      )}
                    </div>

                    {showPropDropdown && (
                      <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {isSearchingProps ? (
                          <div className="p-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin text-green-600" /> Searching database records...
                          </div>
                        ) : propResults.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
                            No matching properties found. Try searching by Lot ID (e.g. LOT-1), Building ID, or Owner name.
                          </div>
                        ) : (
                          propResults.map((p) => {
                            const isAssigned = p.has_active_assignment;
                            return (
                              <div
                                key={`${p.property_type}-${p.target_id_int}`}
                                onClick={() => {
                                  if (isAssigned) {
                                    showError(`This property is already actively assigned to ${p.active_assessor_name || 'an assessor'}. Please use Reassign instead.`);
                                    return;
                                  }
                                  setSelectedProperty(p);
                                  setShowPropDropdown(false);
                                }}
                                className={`p-3 text-xs transition-colors cursor-pointer ${
                                  isAssigned 
                                    ? 'bg-amber-50/50 dark:bg-amber-950/20 opacity-75 hover:bg-amber-100/50' 
                                    : 'hover:bg-green-50 dark:hover:bg-green-950/30'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                                      {p.target_id_str}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      p.property_type === 'lot' 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                                    }`}>
                                      {p.property_type.toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                                    {p.assessment_status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1.5 text-gray-600 dark:text-gray-400">
                                  <span className="flex items-center gap-1 font-medium text-gray-800 dark:text-gray-200">
                                    <User size={12} /> {p.owner_name}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin size={12} /> Brgy. {p.barangay}
                                  </span>
                                </div>
                                {isAssigned && (
                                  <div className="mt-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <AlertTriangle size={12} /> Currently assigned to: {p.active_assessor_name || 'Assessor'} (Active)
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border-2 border-green-500/40 bg-green-50/40 dark:bg-green-950/20 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-gray-900 dark:text-white">
                          {selectedProperty.target_id_str}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          selectedProperty.property_type === 'lot' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                        }`}>
                          {selectedProperty.property_type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          (Property #{selectedProperty.property_id})
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-3">
                        <span><strong>Owner:</strong> {selectedProperty.owner_name}</span>
                        <span>•</span>
                        <span><strong>Location:</strong> {selectedProperty.location}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProperty(null);
                        setPropSearchTerm('');
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      title="Change selected property"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* FIELD 2: SEARCHABLE ASSESSOR SELECTION */}
              <div ref={assessorDropdownRef} className="relative">
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Assigned Assessor <span className="text-red-500">*</span>
                </label>

                {!selectedAssessor ? (
                  <div>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search assessor by name or Assessor ID..."
                        value={assessorSearchTerm}
                        onChange={(e) => {
                          setAssessorSearchTerm(e.target.value);
                          setShowAssessorDropdown(true);
                        }}
                        onFocus={() => setShowAssessorDropdown(true)}
                        className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {isLoadingAssessors && (
                        <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 animate-spin" />
                      )}
                    </div>

                    {showAssessorDropdown && (
                      <div className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {assessorsList
                          .filter(a => {
                            if (!assessorSearchTerm.trim()) return true;
                            const q = assessorSearchTerm.toLowerCase();
                            return (
                              `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
                              a.first_name.toLowerCase().includes(q) ||
                              a.last_name.toLowerCase().includes(q) ||
                              String(a.user_id).includes(q) ||
                              a.username.toLowerCase().includes(q)
                            );
                          })
                          .map((a) => (
                            <div
                              key={a.user_id}
                              onClick={() => {
                                setSelectedAssessor(a);
                                setShowAssessorDropdown(false);
                              }}
                              className="p-3 text-xs hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center font-bold text-xs">
                                  {a.first_name[0]}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900 dark:text-white text-sm">
                                    {a.first_name} {a.last_name}
                                  </div>
                                  <div className="text-gray-500 text-[11px]">
                                    Assessor ID: #{a.user_id} • @{a.username}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                  {a.active_assignments_count} Active Task{a.active_assignments_count !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border-2 border-green-500/40 bg-green-50/40 dark:bg-green-950/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">
                        {selectedAssessor.first_name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-900 dark:text-white">
                          {selectedAssessor.first_name} {selectedAssessor.last_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Assessor ID: #{selectedAssessor.user_id} • Currently: {selectedAssessor.active_assignments_count} active assignments
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssessor(null);
                        setAssessorSearchTerm('');
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      title="Change selected assessor"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* FIELD 3: DUE DATE */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={15} className="text-gray-400" />
                  Due Date <span className="text-xs font-normal text-gray-400">(Optional)</span>
                </label>
                <input 
                  type="date"
                  value={dueDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* FIELD 4: INSTRUCTIONS / REMARKS */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Assessment Instructions & Notes <span className="text-xs font-normal text-gray-400">(Optional)</span>
                </label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Conduct boundary inspection and lot area appraisal..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                ></textarea>
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedProperty || !selectedAssessor}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Assign Assessment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. REASSIGN ASSESSMENT MODAL                                              */}
      {/* ========================================================================= */}
      {showReassignModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-gray-100 dark:border-gray-700 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700 mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ArrowRightLeft size={20} className="text-green-600" />
                  Reassign Assessment
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Transfer an active assessment assignment to another eligible assessor.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowReassignModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              {/* CURRENT PROPERTY & ASSIGNMENT DETAILS */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Property Identifier:</span>
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{selectedAssignment.target_id_str}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Property Type:</span>
                  <span className="font-semibold uppercase text-gray-800 dark:text-gray-200">{selectedAssignment.property_type}</span>
                </div>
                {selectedAssignment.owner_name && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Property Owner:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{selectedAssignment.owner_name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Currently Assigned To:</span>
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {selectedAssignment.assessor_first_name} {selectedAssignment.assessor_last_name} (ID: #{selectedAssignment.assigned_to_user_id})
                  </span>
                </div>
              </div>

              {/* SEARCHABLE REPLACEMENT ASSESSOR */}
              <div ref={reassignAssessorDropdownRef} className="relative">
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Select Replacement Assessor <span className="text-red-500">*</span>
                </label>

                {!reassignAssessor ? (
                  <div>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search replacement assessor by name or ID..."
                        value={reassignSearchTerm}
                        onChange={(e) => {
                          setReassignSearchTerm(e.target.value);
                          setShowReassignAssessorDropdown(true);
                        }}
                        onFocus={() => setShowReassignAssessorDropdown(true)}
                        className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {showReassignAssessorDropdown && (
                      <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {assessorsList
                          .filter(a => a.user_id !== selectedAssignment.assigned_to_user_id)
                          .filter(a => {
                            if (!reassignSearchTerm.trim()) return true;
                            const q = reassignSearchTerm.toLowerCase();
                            return (
                              `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
                              String(a.user_id).includes(q)
                            );
                          })
                          .map((a) => (
                            <div
                              key={a.user_id}
                              onClick={() => {
                                setReassignAssessor(a);
                                setShowReassignAssessorDropdown(false);
                              }}
                              className="p-3 text-xs hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center font-bold text-xs">
                                  {a.first_name[0]}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900 dark:text-white">
                                    {a.first_name} {a.last_name}
                                  </div>
                                  <div className="text-[11px] text-gray-400">ID #{a.user_id}</div>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">
                                {a.active_assignments_count} Active
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-green-500/40 bg-green-50/40 dark:bg-green-950/20 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-white">
                        {reassignAssessor.first_name} {reassignAssessor.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Assessor ID: #{reassignAssessor.user_id} • Currently {reassignAssessor.active_assignments_count} active
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReassignAssessor(null)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* REASSIGNMENT REASON */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Reason for Reassignment <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Assessor on field leave, workload redistribution, etc."
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                ></textarea>
              </div>

              {/* OPTIONAL DUE DATE */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Updated Due Date <span className="text-xs font-normal text-gray-400">(Optional)</span>
                </label>
                <input 
                  type="date"
                  value={reassignDueDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setReassignDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning || !reassignAssessor || !reassignReason.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-sm"
                >
                  {isReassigning ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Reassign Assessment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CANCEL ASSIGNMENT CONFIRMATION MODAL                                    */}
      {/* ========================================================================= */}
      {showCancelModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 dark:border-gray-700 my-8">
            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <XCircle size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cancel Assignment</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Assignment #{selectedAssignment.assignment_id}</p>
              </div>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200/60 dark:border-red-900/40 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Property Identifier:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedAssignment.target_id_str}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Property Type:</span>
                  <span className="font-semibold uppercase text-gray-800 dark:text-gray-200">{selectedAssignment.property_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Assigned Assessor:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedAssignment.assessor_first_name} {selectedAssignment.assessor_last_name}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Cancellation Reason <span className="text-xs font-normal text-gray-400">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Duplicate assignment request, property schedule altered, etc."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                ></textarea>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Notice: Cancelling will mark this assignment as cancelled and remove it from active assignments while preserving it in historical records. Property records will remain intact.
              </p>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 rounded-xl transition"
                >
                  Keep Assignment
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition shadow-sm"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
