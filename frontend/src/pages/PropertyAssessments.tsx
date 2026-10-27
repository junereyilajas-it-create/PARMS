import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Camera, 
  Edit3, 
  FileCheck, 
  ShieldCheck, 
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
  History, 
  ArrowRightLeft,
  CheckCircle2,
  Layers,
  FileText,
  Clock,
  Receipt,
  Sliders
} from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { useModal } from '../contexts/ModalContext';
import api, { ensureSession } from '../lib/api';
import { AssessmentSubmissionModal, type AssessmentTarget } from '../components/common/AssessmentSubmissionModal';
import { AssessmentReviewModal, type AssessmentReviewRecord } from '../components/common/AssessmentReviewModal';
import { useSearchParams } from 'react-router-dom';
import { TaxDeclarations } from './TaxDeclarations';
import { PropertyTaxReports } from './PropertyTaxReports';
import { TaxConfigurationManager } from '../components/tax/TaxConfigurationManager';

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------
type Assessment = {
  type: 'lot' | 'building' | 'property';
  assessment_id: number;
  target_id: string;
  lot_number?: string;
  building_code?: string;
  property_id: string;
  property_code?: string;
  assessor_user_id: number;
  first_name?: string;
  last_name?: string;
  market_value: number;
  assessed_value: number;
  assessment_date: string;
  remarks: string;
  assessment_status: string;
  rejection_reason?: string;
  property_photo?: string | null;
  owner?: string;
  owner_name?: string;
  barangay?: string;
};

type Assignment = {
  assignment_id: number;
  property_type: 'lot' | 'building' | 'property';
  target_id_str: string;
  target_id_int: number;
  property_code?: string;
  lot_number?: string;
  building_code?: string;
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
  property_code?: string;
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

const LAGONGLONG_BARANGAYS = [
  'Banglay',
  'Dampil',
  'Gaston',
  'Kabulawan',
  'Kauswagan',
  'Lumbo',
  'Mabini',
  'Manaol',
  'Poblacion',
  'Tabok',
  'Umagos'
];

export const PropertyAssessments: React.FC = () => {
  const { showSuccess, showError, showConfirm } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active top-level tab: 'assessments' | 'declarations' | 'billing' | 'tax-config'
  const [activeMainTab, setActiveMainTab] = useState<'assessments' | 'declarations' | 'billing' | 'tax-config'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'declarations') return 'declarations';
    if (tabParam === 'billing' || tabParam === 'tax-reports' || tabParam === 'tax_reports') return 'billing';
    if (tabParam === 'tax-config' || tabParam === 'tax_config') return 'tax-config';
    return 'assessments';
  });

  // Assessments sub-view mode: 'list' | 'assignments' (for admin assignment management)
  const [assessmentsViewMode, setAssessmentsViewMode] = useState<'list' | 'assignments'>(() => {
    return searchParams.get('tab') === 'assignments' ? 'assignments' : 'list';
  });

  // Cross-tab workflow transfer states
  const [selectedAssessmentForTd, setSelectedAssessmentForTd] = useState<any | null>(null);
  const [selectedDeclarationForBill, setSelectedDeclarationForBill] = useState<any | null>(null);

  // Notification navigation & highlight tracking
  const [highlightedId, setHighlightedId] = useState<string | null>(() => searchParams.get('highlight') || null);
  const hasHandledHighlightRef = useRef<string | null>(null);

  // Sync state with URL params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'declarations') {
      setActiveMainTab('declarations');
    } else if (tabParam === 'billing') {
      setActiveMainTab('billing');
    } else if (tabParam === 'tax-config' || tabParam === 'tax_config') {
      setActiveMainTab('tax-config');
    } else if (tabParam === 'assignments') {
      setActiveMainTab('assessments');
      setAssessmentsViewMode('assignments');
    } else {
      setActiveMainTab('assessments');
      if (tabParam === 'assessments') {
        setAssessmentsViewMode('list');
      }
    }

    const hl = searchParams.get('highlight');
    if (hl) {
      setHighlightedId(hl);
    }
  }, [searchParams]);

  const handleTabSwitch = (tab: 'assessments' | 'declarations' | 'billing' | 'tax-config') => {
    setActiveMainTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  const handleAssessmentViewModeSwitch = (mode: 'list' | 'assignments') => {
    setAssessmentsViewMode(mode);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', mode === 'assignments' ? 'assignments' : 'assessments');
    setSearchParams(newParams);
  };

  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(false);

  // =========================================================================
  // Tab 1: All Assessments State
  // =========================================================================
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [pendingAssessments, setPendingAssessments] = useState<Assessment[]>([]);
  const [assessmentQuery, setAssessmentQuery] = useState('');
  const [assessmentStatusFilter, setAssessmentStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [assessmentTypeFilter, setAssessmentTypeFilter] = useState('ALL');
  const [assessmentBrgyFilter, setAssessmentBrgyFilter] = useState('ALL');
  const [assessmentAssessorFilter, setAssessmentAssessorFilter] = useState('ALL');

  // Modals for Assessments
  const [submissionTarget, setSubmissionTarget] = useState<AssessmentTarget | null>(null);
  const [reviewRecord, setReviewRecord] = useState<AssessmentReviewRecord | null>(null);

  // =========================================================================
  // Tab 2: Assessment Assignments State
  // =========================================================================
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentSubTab, setAssignmentSubTab] = useState<'active' | 'history'>('active');
  const [assignmentQuery, setAssignmentQuery] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('ALL');
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState('ALL');
  const [assignmentBrgyFilter, setAssignmentBrgyFilter] = useState('ALL');
  const [assignmentAssessorFilter, setAssignmentAssessorFilter] = useState('ALL');

  // Modals for Assignments
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [viewAssignmentDetails, setViewAssignmentDetails] = useState<Assignment | null>(null);
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
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

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

  const propDropdownRef = useRef<HTMLDivElement>(null);
  const assessorDropdownRef = useRef<HTMLDivElement>(null);
  const reassignAssessorDropdownRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // Data Loading
  // =========================================================================
  const loadAssessmentsData = async () => {
    setLoading(true);
    try {
      await ensureSession();
      const profileRes = await api.get('/profile');
      const role = profileRes.data.role;
      setUserRole(role);

      if (['admin', 'super_admin'].includes(role)) {
        try {
          const pendingRes = await api.get('/assessments/pending');
          setPendingAssessments(pendingRes.data.properties || []);
        } catch (pendingErr: any) {
          console.warn('Failed to load pending reviews:', pendingErr);
          setPendingAssessments([]);
        }
      }
      
      const { data } = await api.get('/assessments');
      setAssessments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load assessments:', err);
      showError(err.response?.data?.message || 'Unable to load assessments.');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignmentsData = async () => {
    setAssignmentsLoading(true);
    try {
      await ensureSession();
      const endpoint = userRole === 'assessor' 
        ? '/assessments/assignments/my' 
        : '/assessments/assignments';
      const { data } = await api.get(endpoint);
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('Unable to load assignments:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const fetchAssessorsList = async (q = '') => {
    setIsLoadingAssessors(true);
    try {
      const { data } = await api.get(`/assessments/assessors?q=${encodeURIComponent(q.trim())}`);
      setAssessorsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching assessors:', err);
    } finally {
      setIsLoadingAssessors(false);
    }
  };

  useEffect(() => {
    loadAssessmentsData();
    loadAssignmentsData();
    fetchAssessorsList();
  }, []);

  // Reload assignments when userRole is determined
  useEffect(() => {
    if (userRole) {
      loadAssignmentsData();
    }
  }, [userRole]);

  // Handle notification deep linking, record locating, and auto-opening modal
  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    if (!highlightParam || loading) return;

    if (hasHandledHighlightRef.current === highlightParam) return;

    const hLower = highlightParam.toLowerCase().trim();
    const matchedPending = pendingAssessments.find(a => 
      String(a.assessment_id).toLowerCase() === hLower ||
      String(a.target_id || '').toLowerCase() === hLower ||
      String(a.lot_number || '').toLowerCase() === hLower ||
      String(a.building_code || '').toLowerCase() === hLower ||
      String(a.property_code || '').toLowerCase() === hLower ||
      String(a.property_id || '').toLowerCase() === hLower
    );
    const matchedAll = assessments.find(a => 
      String(a.assessment_id).toLowerCase() === hLower ||
      String(a.target_id || '').toLowerCase() === hLower ||
      String(a.lot_number || '').toLowerCase() === hLower ||
      String(a.building_code || '').toLowerCase() === hLower ||
      String(a.property_code || '').toLowerCase() === hLower ||
      String(a.property_id || '').toLowerCase() === hLower
    );
    const matchedAssignment = assignments.find(a =>
      String(a.assignment_id).toLowerCase() === hLower ||
      String(a.target_id_str || '').toLowerCase() === hLower ||
      String(a.property_code || '').toLowerCase() === hLower ||
      String(a.lot_number || '').toLowerCase() === hLower ||
      String(a.building_code || '').toLowerCase() === hLower
    );

    const matchedRecord = matchedPending || matchedAll;

    if (matchedRecord) {
      hasHandledHighlightRef.current = highlightParam;
      setHighlightedId(matchedRecord.target_id || matchedRecord.lot_number || String(matchedRecord.assessment_id));

      const openReview = searchParams.get('openReview') === 'true';
      const openEdit = searchParams.get('openEdit') === 'true';

      if (openReview && ['admin', 'super_admin'].includes(userRole)) {
        handleOpenAssessmentDetails(matchedRecord);
      } else if (openEdit && userRole === 'assessor') {
        setSubmissionTarget({
          type: matchedRecord.type,
          target_id: matchedRecord.target_id,
          property_id: matchedRecord.property_id,
          owner_name: `${matchedRecord.first_name || ''} ${matchedRecord.last_name || ''}`.trim(),
          market_value: matchedRecord.market_value,
          assessed_value: matchedRecord.assessed_value,
          remarks: matchedRecord.remarks || '',
          property_photo: matchedRecord.property_photo,
          rejection_reason: matchedRecord.rejection_reason,
          assessment_id: matchedRecord.assessment_id,
          assessment_status: matchedRecord.assessment_status || 'returned'
        });
      }

      setTimeout(() => {
        const targetId = matchedRecord.target_id || matchedRecord.lot_number || matchedRecord.assessment_id;
        const elem = document.getElementById(`assessment-row-${targetId}`) || document.querySelector(`[data-testid*="${targetId}"]`);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
    } else if (matchedAssignment) {
      hasHandledHighlightRef.current = highlightParam;
      setHighlightedId(String(matchedAssignment.assignment_id));
      if (assessmentsViewMode !== 'assignments') {
        setAssessmentsViewMode('assignments');
      }
      setTimeout(() => {
        const elem = document.getElementById(`assignment-row-${matchedAssignment.assignment_id}`);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
    } else if (!assignmentsLoading && assessments.length > 0) {
      // If data is fully loaded and record is not found
      hasHandledHighlightRef.current = highlightParam;
      console.warn(`Assessment record #${highlightParam} could not be located.`);
      showError(`Assessment record #${highlightParam} could not be located or may have been deleted or reassigned.`);
    }
  }, [searchParams, loading, assignmentsLoading, pendingAssessments, assessments, assignments, userRole, assessmentsViewMode]);

  // Click outside listener for dropdowns
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

  // Debounced search for available properties
  useEffect(() => {
    if (!showAssignModal) return;
    const timer = setTimeout(async () => {
      setIsSearchingProps(true);
      try {
        const { data } = await api.get(`/assessments/available-properties?q=${encodeURIComponent(propSearchTerm.trim())}`);
        setPropResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching available properties:', err);
      } finally {
        setIsSearchingProps(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [propSearchTerm, showAssignModal]);

  // =========================================================================
  // Status Badge Helper
  // =========================================================================
  const getStatusBadge = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    switch (s) {
      case 'approved':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={11} /> Approved
          </span>
        );
      case 'submitted':
      case 'for_review':
      case 'pending_review':
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 rounded-full text-xs font-semibold border border-amber-200 dark:border-amber-800">
            <Clock size={11} /> Pending Review
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 rounded-full text-xs font-semibold border border-purple-200 dark:border-purple-800">
            In Progress
          </span>
        );
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 rounded-full text-xs font-semibold border border-blue-200 dark:border-blue-800">
            Assigned
          </span>
        );
      case 'reassigned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 rounded-full text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
            Reassigned
          </span>
        );
      case 'returned':
      case 'returned_for_correction':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 rounded-full text-xs font-semibold border border-rose-200 dark:border-rose-800">
            Correction Needed
          </span>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 rounded-full text-xs font-semibold border border-red-200 dark:border-red-800">
            {s === 'cancelled' ? 'Cancelled' : 'Rejected'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700">
            {status || 'Draft'}
          </span>
        );
    }
  };

  // =========================================================================
  // Tab 1: Filtered Assessments Logic
  // =========================================================================
  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      // Status filter
      if (assessmentStatusFilter !== 'ALL') {
        const sLower = assessmentStatusFilter.toLowerCase();
        const aStatus = (a.assessment_status || '').toLowerCase();
        if (sLower === 'pending') {
          if (!['submitted', 'assigned', 'in_progress', 'returned', 'returned_for_correction', 'pending'].includes(aStatus)) return false;
        } else if (sLower === 'approved' || sLower === 'completed') {
          if (aStatus !== 'approved' && aStatus !== 'completed') return false;
        } else if (sLower === 'rejected') {
          if (aStatus !== 'rejected') return false;
        } else if (aStatus !== sLower) {
          return false;
        }
      }

      // Property type filter
      if (assessmentTypeFilter !== 'ALL' && a.type?.toLowerCase() !== assessmentTypeFilter.toLowerCase()) {
        return false;
      }

      // Barangay filter
      if (assessmentBrgyFilter !== 'ALL' && a.barangay?.toLowerCase() !== assessmentBrgyFilter.toLowerCase()) {
        return false;
      }

      // Assessor filter
      if (assessmentAssessorFilter !== 'ALL') {
        if (String(a.assessor_user_id) !== assessmentAssessorFilter) return false;
      }

      // Search Query: matches Property ID, Lot ID, Building ID, Owner, or Assessor
      if (assessmentQuery.trim()) {
        const q = assessmentQuery.toLowerCase();
        const matchesTarget = String(a.target_id || '').toLowerCase().includes(q);
        const matchesLot = String(a.lot_number || '').toLowerCase().includes(q);
        const matchesBldg = String(a.building_code || '').toLowerCase().includes(q);
        const matchesProp = String(a.property_id || '').toLowerCase().includes(q) || String(a.property_code || '').toLowerCase().includes(q);
        const matchesOwner = String(a.owner || a.owner_name || '').toLowerCase().includes(q);
        const matchesAssessor = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase().includes(q);
        if (!matchesTarget && !matchesLot && !matchesBldg && !matchesProp && !matchesOwner && !matchesAssessor) {
          return false;
        }
      }

      return true;
    });
  }, [assessments, assessmentQuery, assessmentStatusFilter, assessmentTypeFilter, assessmentBrgyFilter, assessmentAssessorFilter]);

  const displayedPending = useMemo(() => {
    return pendingAssessments.filter(a => {
      if (!assessmentQuery.trim()) return true;
      const q = assessmentQuery.toLowerCase();
      return (
        String(a.target_id || '').toLowerCase().includes(q) ||
        String(a.lot_number || '').toLowerCase().includes(q) ||
        String(a.building_code || '').toLowerCase().includes(q) ||
        String(a.property_id || '').toLowerCase().includes(q) ||
        String(a.property_code || '').toLowerCase().includes(q) ||
        String(a.owner || a.owner_name || '').toLowerCase().includes(q) ||
        `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase().includes(q)
      );
    });
  }, [pendingAssessments, assessmentQuery]);

  // Statistics for Assessment overview cards
  const stats = useMemo(() => {
    const total = assessments.length;
    const approved = assessments.filter(a => ['approved', 'completed'].includes(a.assessment_status?.toLowerCase())).length;
    const pending = pendingAssessments.length;
    const active = assessments.filter(a => ['assigned', 'in_progress'].includes(a.assessment_status?.toLowerCase())).length;
    return { total, approved, pending, active };
  }, [assessments, pendingAssessments]);

  // =========================================================================
  // Tab 2: Filtered Assignments Logic
  // =========================================================================
  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      const isActive = ['assigned', 'in_progress', 'submitted', 'pending'].includes(item.assignment_status.toLowerCase());
      
      if (assignmentSubTab === 'active' && !isActive) return false;

      // Status filter
      if (assignmentStatusFilter !== 'ALL' && item.assignment_status?.toLowerCase() !== assignmentStatusFilter.toLowerCase()) {
        return false;
      }

      // Property type filter
      if (assignmentTypeFilter !== 'ALL' && item.property_type?.toLowerCase() !== assignmentTypeFilter.toLowerCase()) {
        return false;
      }

      // Barangay filter
      if (assignmentBrgyFilter !== 'ALL' && item.barangay?.toLowerCase() !== assignmentBrgyFilter.toLowerCase()) {
        return false;
      }

      // Assessor filter
      if (assignmentAssessorFilter !== 'ALL') {
        if (String(item.assigned_to_user_id) !== assignmentAssessorFilter) return false;
      }

      // Search Query
      if (assignmentQuery.trim()) {
        const q = assignmentQuery.toLowerCase();
        const matchesTarget = String(item.target_id_str || '').toLowerCase().includes(q);
        const matchesLot = String(item.lot_number || '').toLowerCase().includes(q);
        const matchesBldg = String(item.building_code || '').toLowerCase().includes(q);
        const matchesProp = String(item.property_code || '').toLowerCase().includes(q) || String(item.target_id_int || '').includes(q);
        const matchesOwner = String(item.owner_name || '').toLowerCase().includes(q);
        const matchesAssessor = `${item.assessor_first_name || ''} ${item.assessor_last_name || ''}`.toLowerCase().includes(q) || String(item.assigned_to_user_id).includes(q);
        const matchesAssigner = `${item.assigner_first_name || ''} ${item.assigner_last_name || ''}`.toLowerCase().includes(q);

        if (!matchesTarget && !matchesLot && !matchesBldg && !matchesProp && !matchesOwner && !matchesAssessor && !matchesAssigner) {
          return false;
        }
      }

      return true;
    });
  }, [assignments, assignmentSubTab, assignmentQuery, assignmentStatusFilter, assignmentTypeFilter, assignmentBrgyFilter, assignmentAssessorFilter]);

  const activeAssignmentsCount = assignments.filter(a => ['assigned', 'in_progress', 'submitted', 'pending'].includes(a.assignment_status.toLowerCase())).length;
  const historyAssignmentsCount = assignments.length;

  // =========================================================================
  // Handlers for Assignment Actions
  // =========================================================================
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
        setIsSubmittingAssignment(true);
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
          loadAssignmentsData();
          loadAssessmentsData();
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to create assessment assignment.');
        } finally {
          setIsSubmittingAssignment(false);
        }
      }
    );
  };

  const handleOpenReassignModal = (assignment: Assignment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedAssignment(assignment);
    setReassignAssessor(null);
    setReassignSearchTerm('');
    setReassignReason('');
    setReassignDueDate(assignment.due_date ? assignment.due_date.substring(0, 10) : '');
    setShowReassignAssessorDropdown(false);
    setShowReassignModal(true);
  };

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
          if (viewAssignmentDetails?.assignment_id === selectedAssignment.assignment_id) {
            setViewAssignmentDetails(null);
          }
          loadAssignmentsData();
          loadAssessmentsData();
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to reassign assessment.');
        } finally {
          setIsReassigning(false);
        }
      }
    );
  };

  const handleOpenCancelModal = (assignment: Assignment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedAssignment(assignment);
    setCancelReason('');
    setShowCancelModal(true);
  };

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
      if (viewAssignmentDetails?.assignment_id === selectedAssignment.assignment_id) {
        setViewAssignmentDetails(null);
      }
      loadAssignmentsData();
      loadAssessmentsData();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to cancel assignment.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Helper to open details modal when clicking on an assessment
  const handleOpenAssessmentDetails = (record: Assessment) => {
    setReviewRecord({
      type: record.type,
      assessment_id: record.assessment_id,
      target_id: record.lot_number || record.building_code || record.target_id,
      property_id: record.property_code || record.property_id,
      assessor_user_id: record.assessor_user_id,
      first_name: record.first_name,
      last_name: record.last_name,
      market_value: record.market_value,
      assessed_value: record.assessed_value,
      assessment_date: record.assessment_date,
      remarks: record.remarks,
      assessment_status: record.assessment_status,
      rejection_reason: record.rejection_reason,
      property_photo: record.property_photo,
      owner: record.owner || record.owner_name
    });
  };

  // Table Columns for All Assessments
  const assessmentColumns = [
    { 
      key: 'target_id', 
      label: 'PROPERTY / IDENTIFIER', 
      render: (_: any, row: Assessment) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 dark:text-white">
            {row.lot_number || row.building_code || row.target_id}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
            <span className="uppercase font-semibold text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {row.type}
            </span>
            {row.property_code && (
              <span className="text-gray-400 font-mono text-[11px]">{row.property_code}</span>
            )}
          </div>
        </div>
      )
    },
    { 
      key: 'owner', 
      label: 'OWNER & BARANGAY', 
      render: (_: any, row: Assessment) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {row.owner || row.owner_name || 'No Owner Listed'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
            <MapPin size={11} className="text-gray-400" />
            Brgy. {row.barangay || 'Lagonglong'}
          </span>
        </div>
      )
    },
    { 
      key: 'assessor', 
      label: 'ASSIGNED ASSESSOR', 
      render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center font-bold text-xs shrink-0">
            {row.first_name?.[0] || 'A'}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-xs">
              {`${row.first_name || ''} ${row.last_name || ''}`.trim() || `ID: ${row.assessor_user_id}`}
            </div>
            <span className="text-[10px] text-gray-400">Assessor #{row.assessor_user_id}</span>
          </div>
        </div>
      )
    },
    { 
      key: 'market_value', 
      label: 'MARKET VALUE', 
      render: (val: number) => Number(val) > 0 ? (
        <span className="font-semibold text-gray-900 dark:text-white">
          ₱{Number(val).toLocaleString()}
        </span>
      ) : (
        <span className="text-gray-400">—</span>
      )
    },
    { 
      key: 'assessed_value', 
      label: 'ASSESSED VALUE & LEVEL', 
      render: (val: number, row: Assessment) => {
        const mv = Number(row.market_value) || 0;
        const av = Number(val) || 0;
        const level = mv > 0 && av > 0 ? Math.round((av / mv) * 100) : null;
        return av > 0 ? (
          <div className="flex flex-col">
            <span className="font-bold text-green-700 dark:text-green-400">
              ₱{av.toLocaleString()}
            </span>
            {level !== null && (
              <span className="text-[11px] text-gray-500 font-medium">Level: {level}%</span>
            )}
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        );
      }
    },
    {
      key: 'property_photo',
      label: 'PHOTO',
      render: (_: any, row: Assessment) => row.property_photo ? (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
          <Camera size={12} /> Attached
        </span>
      ) : (
        <span className="text-xs text-gray-400 italic">None</span>
      )
    },
    { 
      key: 'assessment_status', 
      label: 'STATUS', 
      render: (val: string) => getStatusBadge(val) 
    },
    { 
      key: 'assessment_date', 
      label: 'ASSESSMENT DATE', 
      render: (val: string) => val ? (
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {new Date(val).toLocaleDateString()}
        </span>
      ) : (
        <span className="text-gray-400">—</span>
      )
    }
  ];

  const adminPendingColumns = [
    { 
      key: 'target_id', 
      label: 'PROPERTY / IDENTIFIER', 
      render: (_: any, row: Assessment) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 dark:text-white">
            {row.lot_number || row.building_code || row.target_id}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="uppercase font-semibold text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
              {row.type}
            </span>
            {row.property_code && <span className="font-mono text-gray-400">{row.property_code}</span>}
          </div>
        </div>
      ) 
    },
    { 
      key: 'assessor', 
      label: 'SUBMITTED BY', 
      render: (_: any, row: any) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || `ID: ${row.assessor_user_id}` 
    },
    { 
      key: 'market_value', 
      label: 'MARKET VALUE', 
      render: (val: number) => `₱${Number(val).toLocaleString()}` 
    },
    { 
      key: 'assessed_value', 
      label: 'ASSESSED VALUE', 
      render: (val: number) => `₱${Number(val).toLocaleString()}` 
    },
    {
      key: 'photo',
      label: 'PHOTO',
      render: (_: any, row: Assessment) => row.property_photo ? (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
          <Camera size={12} /> Attached
        </span>
      ) : (
        <span className="text-xs text-gray-400">None</span>
      )
    },
    { 
      key: 'assessment_date', 
      label: 'DATE SUBMITTED', 
      render: (val: string) => new Date(val).toLocaleDateString() 
    },
    ...(userRole === 'admin' ? [{
      key: 'actions', 
      label: 'REVIEW ACTION', 
      render: (_: any, row: Assessment) => (
        <button 
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleOpenAssessmentDetails(row);
          }} 
          id={`review-assessment-btn-${row.target_id}`}
          data-testid={`review-assessment-btn-${row.target_id}`}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
        >
          <ShieldCheck size={14} /> Review Assessment
        </button>
      )
    }] : [])
  ];

  const isAdminOrSuperAdmin = ['admin', 'super_admin'].includes(userRole);
  const canManageTaxConfig = ['assessor', 'admin'].includes(userRole);

  return (
    <div className="space-y-6 fade-in">
      {/* ========================================================================= */}
      {/* Page Header                                                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <ShieldCheck className="text-green-600 dark:text-green-500" size={32} />
            Assessments
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {userRole === 'assessor' 
              ? 'View assigned properties, conduct assessments, and monitor approval status.'
              : 'Unified assessment management: view assessments, assign field assessors, and review submissions.'}
          </p>
        </div>

        {/* Action Button: Assign Assessment (strictly Admin only, NOT Super Admin) */}
        {userRole === 'admin' && (
          <div className="flex items-center gap-3">
            <button 
              onClick={handleOpenAssignModal}
              id="assign-assessment-btn"
              data-testid="assign-assessment-btn"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl shadow-sm transition-colors focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              <Plus size={18} /> Assign Assessment
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3 Main Tabs Navigation (Assessments, Tax Declarations, Tax Computation Reports) */}
      {/* ========================================================================= */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 space-x-1 sm:space-x-4">
        <button
          onClick={() => handleTabSwitch('assessments')}
          id="tab-assessments"
          data-testid="tab-assessments"
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
            activeMainTab === 'assessments'
              ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-500'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <ShieldCheck size={18} />
          <span>Assessments</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {assessments.length}
          </span>
        </button>

        <button
          onClick={() => handleTabSwitch('declarations')}
          id="tab-declarations"
          data-testid="tab-declarations"
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
            activeMainTab === 'declarations'
              ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-500'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <FileText size={18} />
          <span>Tax Declarations</span>
        </button>

        <button
          onClick={() => handleTabSwitch('billing')}
          id="tab-tax-reports"
          data-testid="tab-tax-reports"
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
            activeMainTab === 'billing'
              ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-500'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Receipt size={18} />
          <span>Property Tax Reports</span>
        </button>

        {canManageTaxConfig && (
          <button
            onClick={() => handleTabSwitch('tax-config')}
            id="tab-tax-config"
            data-testid="tab-tax-config"
            className={`flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
              activeMainTab === 'tax-config'
                ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-500'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Sliders size={18} />
            <span>Tax Configuration</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT: 1. ASSESSMENTS                                               */}
      {/* ========================================================================= */}
      {activeMainTab === 'assessments' && (
        <div className="space-y-6">
          {/* Metric Cards (Assessments Overview) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Assessments</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center font-bold">
                <Layers size={22} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Approved / Completed</p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.approved}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pending Review</p>
                <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pending}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Clock size={22} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Assignments</p>
                <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{activeAssignmentsCount}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <User size={22} />
              </div>
            </div>
          </div>

          {/* Sub Navigation (All Assessments vs Assessment Assignments for Admin) */}
          {isAdminOrSuperAdmin && (
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handleAssessmentViewModeSwitch('list')}
                id="tab-all-assessments"
                data-testid="tab-all-assessments"
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
                  assessmentsViewMode === 'list'
                    ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-500'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <FileText size={18} />
                <span>All Assessments</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {assessments.length}
                </span>
              </button>

              <button
                onClick={() => handleAssessmentViewModeSwitch('assignments')}
                id="tab-assessment-assignments"
                data-testid="tab-assessment-assignments"
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
                  assessmentsViewMode === 'assignments'
                    ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-500'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <User size={18} />
                <span>Assessment Assignments</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                  {activeAssignmentsCount}
                </span>
              </button>
            </div>
          )}

          {/* Sub-view: All Assessments List */}
          {(assessmentsViewMode === 'list' || !isAdminOrSuperAdmin) && (
            <div className="space-y-6">
          {/* Section: Requires Head Assessor Review (Only for Admin / Super Admin with pending items) */}
          {isAdminOrSuperAdmin && (
            <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <ShieldCheck size={20} /> Requires Head Assessor Review
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                  {displayedPending.length} Pending
                </span>
              </div>
              {displayedPending.length > 0 ? (
                <DataTable 
                  columns={adminPendingColumns} 
                  data={displayedPending} 
                  onView={handleOpenAssessmentDetails}
                  highlightValue={highlightedId || searchParams.get('highlight') || undefined}
                />
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500 opacity-60" />
                  No assessments are currently awaiting review. All submitted records are up to date!
                </div>
              )}
            </div>
          )}

          {/* Section: All Assessments Database & Filter Controls */}
          <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {userRole === 'assessor' ? 'My Assigned & Submitted Assessments' : 'All Assessments Database'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Click any row to view full assessment details and official values.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  id="search-assessments-input"
                  data-testid="search-assessments-input"
                  type="text" 
                  placeholder="Search Property, Lot, Building, Owner, Assessor..." 
                  value={assessmentQuery} 
                  onChange={e => setAssessmentQuery(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500" 
                />
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              {/* Status Filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={assessmentStatusFilter}
                  onChange={(e) => setAssessmentStatusFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending Review</option>
                  <option value="in_progress">In Progress</option>
                  <option value="assigned">Assigned</option>
                  <option value="returned">Correction Needed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Property Type Filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Property Type</label>
                <select
                  value={assessmentTypeFilter}
                  onChange={(e) => setAssessmentTypeFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="lot">Lot</option>
                  <option value="building">Building</option>
                </select>
              </div>

              {/* Barangay Filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Barangay</label>
                <select
                  value={assessmentBrgyFilter}
                  onChange={(e) => setAssessmentBrgyFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Barangays</option>
                  {LAGONGLONG_BARANGAYS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Assessor Filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Assessor</label>
                <select
                  value={assessmentAssessorFilter}
                  onChange={(e) => setAssessmentAssessorFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Assessors</option>
                  {assessorsList.map(a => (
                    <option key={a.user_id} value={String(a.user_id)}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assessments Table */}
            {loading ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-green-600" />
                Loading assessment records...
              </div>
            ) : filteredAssessments.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500 opacity-60" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">No assessment records found</p>
                <p className="text-xs text-gray-500 mt-1">
                  Try adjusting your search query or clearing the status/barangay filters.
                </p>
              </div>
            ) : (
              <div className="cursor-pointer">
                <DataTable
                  columns={assessmentColumns}
                  data={filteredAssessments}
                  onView={handleOpenAssessmentDetails}
                  showActions={true}
                  highlightValue={highlightedId || searchParams.get('highlight') || undefined}
                  customActions={(record) => {
                    const isApproved = ['approved', 'completed'].includes(record.assessment_status?.toLowerCase());
                    return (
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Only approved assessments can generate Tax Declarations */}
                        {isApproved ? (
                          <button 
                            id={`create-td-btn-${record.target_id}`}
                            data-testid={`create-td-btn-${record.target_id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAssessmentForTd(record);
                              handleTabSwitch('declarations');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold shadow-xs transition"
                            title="Generate Tax Declaration from this approved assessment"
                          >
                            <FileText size={13} />
                            <span>Create TD</span>
                          </button>
                        ) : (
                          <span 
                            className="text-[11px] text-gray-400 dark:text-gray-500 italic px-1 cursor-default" 
                            title="Assessment must be approved before generating a tax declaration"
                          >
                            Approval required
                          </span>
                        )}

                        {/* Assessor Conduct & Update Actions */}
                        {userRole === 'assessor' && (
                          <>
                            {(record.assessment_status === 'returned' || record.assessment_status === 'returned_for_correction') && (
                              <button 
                                id={`update-assessment-btn-${record.target_id}`}
                                data-testid={`update-assessment-btn-${record.target_id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubmissionTarget({
                                    type: record.type,
                                    target_id: record.target_id,
                                    property_id: record.property_id,
                                    owner_name: `${record.first_name || ''} ${record.last_name || ''}`.trim(),
                                    market_value: record.market_value,
                                    assessed_value: record.assessed_value,
                                    remarks: record.remarks || '',
                                    property_photo: record.property_photo,
                                    rejection_reason: record.rejection_reason,
                                    assessment_id: record.assessment_id,
                                    assessment_status: 'returned'
                                  });
                                }} 
                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-xs transition"
                                title="Correct and resubmit this assessment"
                              >
                                <Edit3 size={13} /> Update
                              </button>
                            )}

                            {record.assessment_status === 'assigned' && (
                              <button 
                                id={`assess-property-btn-${record.target_id}`}
                                data-testid={`assess-property-btn-${record.target_id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubmissionTarget({
                                    type: record.type,
                                    target_id: record.target_id,
                                    property_id: record.property_id,
                                    market_value: '',
                                    assessed_value: '',
                                    remarks: record.remarks || '',
                                    assessment_status: 'assigned'
                                  });
                                }} 
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold shadow-xs transition"
                                title="Conduct Assessment"
                              >
                                <FileCheck size={13} /> Assess
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-view: Assessment Assignments (Admin) */}
      {assessmentsViewMode === 'assignments' && isAdminOrSuperAdmin && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
            {/* Sub-tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAssignmentSubTab('active')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    assignmentSubTab === 'active'
                      ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span>Active Assignments</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                    {activeAssignmentsCount}
                  </span>
                </button>
                <button
                  onClick={() => setAssignmentSubTab('history')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    assignmentSubTab === 'history'
                      ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <History size={16} />
                  <span>All / Assignment History</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {historyAssignmentsCount}
                  </span>
                </button>
              </div>

              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search assignments by ID, owner, assessor..." 
                  value={assignmentQuery}
                  onChange={(e) => setAssignmentQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Filter Controls Row for Assignments */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={assignmentStatusFilter}
                  onChange={(e) => setAssignmentStatusFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="reassigned">Reassigned</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Property Type</label>
                <select
                  value={assignmentTypeFilter}
                  onChange={(e) => setAssignmentTypeFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="lot">Lot</option>
                  <option value="building">Building</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Barangay</label>
                <select
                  value={assignmentBrgyFilter}
                  onChange={(e) => setAssignmentBrgyFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Barangays</option>
                  {LAGONGLONG_BARANGAYS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Assigned Assessor</label>
                <select
                  value={assignmentAssessorFilter}
                  onChange={(e) => setAssignmentAssessorFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Assessors</option>
                  {assessorsList.map(a => (
                    <option key={a.user_id} value={String(a.user_id)}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignments Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-750 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3">Property Identifier</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Owner & Location</th>
                    <th className="px-4 py-3">Assigned Assessor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {assignmentsLoading ? (
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
                            {assignmentSubTab === 'active' 
                              ? 'There are currently no active assignments matching your filters.' 
                              : 'No historical records match your criteria.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map((row) => {
                      const isActive = ['assigned', 'in_progress', 'submitted', 'pending'].includes(row.assignment_status.toLowerCase());
                      return (
                        <tr 
                          key={row.assignment_id} 
                          id={`assignment-row-${row.assignment_id}`}
                          onClick={() => setViewAssignmentDetails(row)}
                          className={`transition-colors cursor-pointer ${
                            highlightedId && (
                              String(row.assignment_id).toLowerCase() === String(highlightedId).toLowerCase() ||
                              String(row.target_id_str).toLowerCase() === String(highlightedId).toLowerCase() ||
                              String(row.property_code || '').toLowerCase() === String(highlightedId).toLowerCase()
                            )
                              ? 'bg-emerald-100/90 dark:bg-emerald-950/70 ring-2 ring-emerald-500 font-semibold shadow-xs'
                              : 'hover:bg-gray-50/70 dark:hover:bg-gray-700/30'
                          }`}
                        >
                          <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{row.lot_number || row.building_code || row.target_id_str}</span>
                            </div>
                            <div className="text-[11px] text-gray-400 font-normal">
                              {row.property_code ? `${row.property_code} • ` : ''}Assignment #{row.assignment_id}
                            </div>
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
                            {isActive && userRole === 'admin' ? (
                              <div className="inline-flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => handleOpenReassignModal(row, e)}
                                  title="Reassign to another assessor"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:hover:bg-green-900/60 dark:text-green-300 rounded-lg transition-colors border border-green-200 dark:border-green-800/60"
                                >
                                  <RefreshCw size={13} /> Reassign
                                </button>
                                <button
                                  onClick={(e) => handleOpenCancelModal(row, e)}
                                  title="Cancel this assessment assignment"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 rounded-lg transition-colors border border-red-200 dark:border-red-800/60"
                                >
                                  <XCircle size={13} /> Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">{isActive ? 'Active' : 'Historical'}</span>
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
        </div>
      )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: 2. TAX DECLARATIONS                                          */}
      {/* ========================================================================= */}
      {activeMainTab === 'declarations' && (
        <TaxDeclarations
          preselectedAssessment={selectedAssessmentForTd}
          onClearPreselectedAssessment={() => setSelectedAssessmentForTd(null)}
          onNavigateToBilling={(td) => {
            setSelectedDeclarationForBill(td);
            handleTabSwitch('billing');
          }}
          hideStandaloneHeader={true}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: 3. PROPERTY TAX REPORTS                                      */}
      {/* ========================================================================= */}
      {activeMainTab === 'billing' && (
        <PropertyTaxReports
          preselectedDeclaration={selectedDeclarationForBill}
          onClearPreselectedDeclaration={() => setSelectedDeclarationForBill(null)}
          hideStandaloneHeader={true}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: 4. TAX CONFIGURATION                                         */}
      {/* ========================================================================= */}
      {activeMainTab === 'tax-config' && canManageTaxConfig && (
        <div className="pt-2">
          <TaxConfigurationManager />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ASSIGNMENT DETAILS MODAL (When clicking any Assignment row)      */}
      {/* ========================================================================= */}
      {viewAssignmentDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl p-6 border border-gray-100 dark:border-gray-700 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700 mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={20} className="text-green-600" />
                  Assessment Assignment Details
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Assignment Record #{viewAssignmentDetails.assignment_id}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setViewAssignmentDetails(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Status and Type Header */}
              <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-gray-900 dark:text-white">
                    {viewAssignmentDetails.lot_number || viewAssignmentDetails.building_code || viewAssignmentDetails.target_id_str}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                    viewAssignmentDetails.property_type === 'lot' 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                  }`}>
                    {viewAssignmentDetails.property_type}
                  </span>
                </div>
                <div>{getStatusBadge(viewAssignmentDetails.assignment_status)}</div>
              </div>

              {/* Property Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-gray-400 font-medium">Main Property Code</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                    {viewAssignmentDetails.property_code || `PROP_${viewAssignmentDetails.target_id_int}`}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-gray-400 font-medium">Barangay</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                    Brgy. {viewAssignmentDetails.barangay || 'Lagonglong'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700 col-span-2">
                  <span className="text-gray-400 font-medium">Property Owner</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                    {viewAssignmentDetails.owner_name || 'No Owner Listed'}
                  </p>
                </div>
              </div>

              {/* Assessor Details */}
              <div className="p-3.5 bg-green-50/50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-900 dark:text-green-300">Assigned Assessor:</span>
                  <span className="font-bold text-green-800 dark:text-green-200">
                    {viewAssignmentDetails.assessor_first_name} {viewAssignmentDetails.assessor_last_name} (ID: #{viewAssignmentDetails.assigned_to_user_id})
                  </span>
                </div>
                {viewAssignmentDetails.assigner_first_name && (
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-green-200/60 dark:border-green-800/60">
                    <span>Assigned By:</span>
                    <span>Admin {viewAssignmentDetails.assigner_first_name} {viewAssignmentDetails.assigner_last_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Due Date:</span>
                  <span>{viewAssignmentDetails.due_date ? new Date(viewAssignmentDetails.due_date).toLocaleDateString() : 'None specified'}</span>
                </div>
              </div>

              {/* Instructions */}
              {viewAssignmentDetails.instructions && (
                <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Special Instructions / Notes:</span>
                  <p className="text-xs text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-wrap">
                    {viewAssignmentDetails.instructions}
                  </p>
                </div>
              )}

              {/* Action Buttons inside modal */}
              {['assigned', 'in_progress', 'submitted', 'pending'].includes(viewAssignmentDetails.assignment_status.toLowerCase()) && (
                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => handleOpenReassignModal(viewAssignmentDetails)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm transition"
                  >
                    <RefreshCw size={13} /> Reassign Assessor
                  </button>
                  <button
                    onClick={() => handleOpenCancelModal(viewAssignmentDetails)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition"
                  >
                    <XCircle size={13} /> Cancel Assignment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD ASSESSMENT ASSIGNMENT MODAL                                  */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
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
                  Property ID / Identifier <span className="text-red-500">*</span>
                </label>

                {!selectedProperty ? (
                  <div>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search by Lot ID (e.g. LOT_L-474), Building ID, Property ID, or Owner..."
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
                            No matching properties found. Search by Lot ID, Building ID, Property ID, or Owner name.
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
                                    {p.property_code && (
                                      <span className="text-[11px] text-gray-400 font-mono">
                                        {p.property_code}
                                      </span>
                                    )}
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
                        {selectedProperty.property_code && (
                          <span className="text-xs text-gray-500 font-medium">
                            ({selectedProperty.property_code})
                          </span>
                        )}
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
                  disabled={isSubmittingAssignment || !selectedProperty || !selectedAssessor}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-sm"
                >
                  {isSubmittingAssignment ? (
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
      {/* MODAL 3: REASSIGN ASSESSMENT MODAL                                        */}
      {/* ========================================================================= */}
      {showReassignModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
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
                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    {selectedAssignment.lot_number || selectedAssignment.building_code || selectedAssignment.target_id_str}
                  </span>
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
      {/* MODAL 4: CANCEL ASSIGNMENT MODAL                                          */}
      {/* ========================================================================= */}
      {showCancelModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
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
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedAssignment.lot_number || selectedAssignment.building_code || selectedAssignment.target_id_str}
                  </span>
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
                Notice: Cancelling will mark this assignment as cancelled and remove it from active assignments while preserving it in historical records.
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

      {/* ========================================================================= */}
      {/* Assessor Submission / Update Modal                                        */}
      {/* ========================================================================= */}
      <AssessmentSubmissionModal
        isOpen={Boolean(submissionTarget)}
        onClose={() => setSubmissionTarget(null)}
        target={submissionTarget}
        onSuccess={() => {
          loadAssessmentsData();
          loadAssignmentsData();
        }}
      />

      {/* ========================================================================= */}
      {/* Admin Review / View Modal                                                 */}
      {/* ========================================================================= */}
      <AssessmentReviewModal
        isOpen={Boolean(reviewRecord)}
        onClose={() => setReviewRecord(null)}
        record={reviewRecord}
        onSuccess={() => {
          loadAssessmentsData();
          loadAssignmentsData();
        }}
      />
    </div>
  );
};
