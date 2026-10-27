import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Plus, Search, AlertCircle, 
  RotateCcw, Printer, Eye, X, 
  Building2, SquareDashed, History, AlertTriangle,
  Receipt
} from 'lucide-react';
import api from '../lib/api';
import { useModal } from '../contexts/ModalContext';

export interface TaxDeclaration {
  tax_declaration_id: number;
  declaration_number: string;
  property_id: number;
  property_code: string;
  property_type: 'land' | 'building';
  target_id_str: string;
  target_id_int: number;
  owner_id: number;
  owner_name: string;
  owner_contact?: string;
  owner_email?: string;
  property_address: string;
  barangay: string;
  classification: string;
  actual_use: string;
  land_area: number | string;
  building_area: number | string;
  market_value: number;
  assessment_level: number;
  assessed_value: number;
  effective_year: number;
  status: 'draft' | 'pending_review' | 'returned_for_correction' | 'approved' | 'issued' | 'superseded' | 'cancelled';
  previous_td_id?: number | null;
  previous_td_number?: string | null;
  revision_number: number;
  prepared_by_user_id?: number;
  preparer_first_name?: string;
  preparer_last_name?: string;
  approved_by_user_id?: number;
  approver_first_name?: string;
  approver_last_name?: string;
  approved_at?: string;
  notes?: string;
  return_reason?: string;
  created_at: string;
}

export interface EligibleAssessment {
  assessment_id: number;
  property_id: number;
  property_code: string;
  property_type: 'land' | 'building';
  target_id_str: string;
  target_id_int: number;
  owner_id: number;
  owner_name: string;
  barangay: string;
  classification: string;
  actual_use: string;
  land_area: number;
  building_area: number;
  market_value: number;
  assessment_level: number;
  assessed_value: number;
  assessment_date: string;
  approval_status: string;
}

export interface TaxDeclarationsProps {
  preselectedAssessment?: any;
  onClearPreselectedAssessment?: () => void;
  onNavigateToBilling?: (td: TaxDeclaration) => void;
  hideStandaloneHeader?: boolean;
}

export function TaxDeclarations({
  preselectedAssessment,
  onClearPreselectedAssessment,
  onNavigateToBilling,
  hideStandaloneHeader = false
}: TaxDeclarationsProps = {}) {
  const { showSuccess, showError, showConfirm } = useModal();
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [barangayFilter, setBarangayFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleAssessments, setEligibleAssessments] = useState<EligibleAssessment[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<EligibleAssessment | null>(null);
  const [effectiveYear, setEffectiveYear] = useState<number>(new Date().getFullYear());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // View / Print modal state
  const [selectedTd, setSelectedTd] = useState<TaxDeclaration | null>(null);
  const [tdHistory, setTdHistory] = useState<any[]>([]);

  // Return for correction modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTargetTd, setReturnTargetTd] = useState<TaxDeclaration | null>(null);
  const [returnReason, setReturnReason] = useState('');

  // Revise modal state
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseTargetTd, setReviseTargetTd] = useState<TaxDeclaration | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');

  const userPermissions: string[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('accessor_permissions');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }, []);

  const userRole = localStorage.getItem('accessor_role') || 'staff';
  const isAdminOrSuper = userRole === 'admin' || userRole === 'super_admin';
  const canCreateTD = isAdminOrSuper || userRole === 'staff' || userPermissions.includes('CREATE_TAX_DECLARATION');
  const canApproveTD = isAdminOrSuper || userPermissions.includes('APPROVE_TAX_DECLARATION');

  // Fetch Declarations
  const fetchDeclarations = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (barangayFilter !== 'ALL') params.barangay = barangayFilter;
      if (yearFilter !== 'ALL') params.year = yearFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await api.get('/tax-declarations', { params });
      setDeclarations(res.data || []);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to fetch tax declarations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeclarations();
  }, [statusFilter, typeFilter, barangayFilter, yearFilter]);

  // Handle preselected assessment from Assessments tab
  useEffect(() => {
    if (preselectedAssessment) {
      handleOpenWithAssessment(preselectedAssessment);
    }
  }, [preselectedAssessment]);

  const handleOpenWithAssessment = async (item: any) => {
    setShowCreateModal(true);
    setEffectiveYear(new Date().getFullYear());
    setNotes(`Drafted from Approved Assessment #${item.assessment_id || item.target_id || ''}`);
    try {
      setLoadingEligible(true);
      const res = await api.get('/tax-declarations/eligible-assessments');
      const list: EligibleAssessment[] = res.data || [];
      setEligibleAssessments(list);
      const match = list.find((ea) => 
        (item.assessment_id && ea.assessment_id === item.assessment_id) ||
        (item.target_id && (ea.target_id_str === item.target_id || String(ea.target_id_int) === String(item.target_id)))
      );
      if (match) {
        setSelectedAssessment(match);
      } else {
        setSelectedAssessment({
          assessment_id: Number(item.assessment_id) || 0,
          property_id: Number(item.property_id) || 0,
          property_code: item.property_code || '',
          property_type: item.type === 'lot' ? 'land' : 'building',
          target_id_str: item.target_id || item.lot_number || item.building_code || '',
          target_id_int: Number(item.target_id) || 0,
          owner_id: Number(item.owner_id) || 0,
          owner_name: item.owner || item.owner_name || 'Registered Owner',
          barangay: item.barangay || 'Lagonglong',
          classification: item.classification || 'Residential',
          actual_use: item.actual_use || 'Residential',
          land_area: Number(item.land_area) || 0,
          building_area: Number(item.building_area) || 0,
          market_value: Number(item.market_value) || 0,
          assessment_level: Number(item.assessment_level) || 20,
          assessed_value: Number(item.assessed_value) || 0,
          assessment_date: item.assessment_date || new Date().toISOString(),
          approval_status: 'approved'
        });
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to prepare assessment for declaration');
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDeclarations();
  };

  // Fetch Eligible Assessments for new TD
  const openCreateModal = async () => {
    setShowCreateModal(true);
    setSelectedAssessment(null);
    setEffectiveYear(new Date().getFullYear());
    setNotes('');
    try {
      setLoadingEligible(true);
      const res = await api.get('/tax-declarations/eligible-assessments');
      setEligibleAssessments(res.data || []);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load approved assessments');
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessment) {
      showError('Please select an approved assessment to base the declaration on.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        assessment_id: selectedAssessment.assessment_id,
        property_id: selectedAssessment.property_id,
        property_type: selectedAssessment.property_type,
        target_id_str: selectedAssessment.target_id_str,
        effective_year: effectiveYear,
        notes: notes.trim()
      };
      await api.post('/tax-declarations', payload);
      showSuccess('Draft Tax Declaration successfully prepared.');
      setShowCreateModal(false);
      if (onClearPreselectedAssessment) onClearPreselectedAssessment();
      fetchDeclarations();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to prepare tax declaration');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Details & Print view
  const openTdDetails = async (td: TaxDeclaration) => {
    setSelectedTd(td);
    try {
      const res = await api.get(`/tax-declarations/${td.tax_declaration_id}`);
      setSelectedTd(res.data);
      setTdHistory(res.data.revisions || []);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load full declaration details');
    }
  };

  // Submit for Review
  const handleSubmitReview = async (id: number) => {
    showConfirm('Submit this draft tax declaration for review and approval by the Municipal Assessor?', async () => {
      try {
        await api.post(`/tax-declarations/${id}/submit-review`);
        showSuccess('Tax Declaration submitted for review.');
        fetchDeclarations();
        if (selectedTd?.tax_declaration_id === id) {
          openTdDetails({ ...selectedTd, status: 'pending_review' });
        }
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to submit declaration for review');
      }
    });
  };

  // Approve TD
  const handleApprove = async (id: number) => {
    showConfirm('Approve this tax declaration? Once approved, it can be officially issued or billed.', async () => {
      try {
        await api.post(`/tax-declarations/${id}/approve`);
        showSuccess('Tax Declaration approved successfully.');
        fetchDeclarations();
        if (selectedTd?.tax_declaration_id === id) {
          openTdDetails({ ...selectedTd, status: 'approved' });
        }
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to approve declaration');
      }
    });
  };

  // Issue TD
  const handleIssue = async (id: number) => {
    showConfirm('Officially issue this tax declaration to the property owner?', async () => {
      try {
        await api.post(`/tax-declarations/${id}/issue`);
        showSuccess('Tax Declaration officially issued.');
        fetchDeclarations();
        if (selectedTd?.tax_declaration_id === id) {
          openTdDetails({ ...selectedTd, status: 'issued' });
        }
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to issue declaration');
      }
    });
  };

  // Return for Correction
  const handleOpenReturnModal = (td: TaxDeclaration) => {
    setReturnTargetTd(td);
    setReturnReason('');
    setShowReturnModal(true);
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTargetTd || !returnReason.trim()) {
      showError('Please provide a specific reason for returning this declaration.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/tax-declarations/${returnTargetTd.tax_declaration_id}/return`, {
        reason: returnReason.trim()
      });
      showSuccess('Tax Declaration returned for correction.');
      setShowReturnModal(false);
      fetchDeclarations();
      if (selectedTd?.tax_declaration_id === returnTargetTd.tax_declaration_id) {
        setSelectedTd(null);
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to return declaration');
    } finally {
      setSubmitting(false);
    }
  };

  // Revise TD
  const handleOpenReviseModal = (td: TaxDeclaration) => {
    setReviseTargetTd(td);
    setRevisionNotes('');
    setShowReviseModal(true);
  };

  const handleConfirmRevise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviseTargetTd || !revisionNotes.trim()) {
      showError('Please enter justification/notes for this revision.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/tax-declarations/${reviseTargetTd.tax_declaration_id}/revise`, {
        revision_notes: revisionNotes.trim()
      });
      showSuccess('New revision draft created successfully. Previous declaration marked superseded upon approval.');
      setShowReviseModal(false);
      fetchDeclarations();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to create revision');
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Helpers
  const formatCurrency = (val: number | string) => {
    const n = Number(val) || 0;
    return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Draft</span>;
      case 'pending_review':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Pending Review</span>;
      case 'returned_for_correction':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Returned for Correction</span>;
      case 'approved':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Approved</span>;
      case 'issued':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Issued</span>;
      case 'superseded':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Superseded</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  // Extract unique barangays for filter
  const barangays = useMemo(() => {
    const set = new Set<string>();
    declarations.forEach(d => { if (d.barangay) set.add(d.barangay); });
    return Array.from(set).sort();
  }, [declarations]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      {!hideStandaloneHeader ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-lg">
                <FileText size={22} />
              </span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tax Declarations (RPTD)</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage, review, approve, and officially issue Real Property Tax Declarations for the Municipality of Lagonglong.
            </p>
          </div>
          {canCreateTD && (
            <div className="flex items-center gap-3">
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition shadow-sm hover:shadow"
              >
                <Plus size={18} />
                <span>Prepare Draft Declaration</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="text-green-600 dark:text-green-500" size={18} />
              <span>Real Property Tax Declarations</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Draft, review, approve, and issue tax declarations from approved assessments.
            </p>
          </div>
          {canCreateTD && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition shadow-xs self-start sm:self-auto"
            >
              <Plus size={15} />
              <span>Prepare Draft Declaration</span>
            </button>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by TD number, Lot/Bldg ID, owner name, or property code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="returned_for_correction">Returned</option>
              <option value="approved">Approved</option>
              <option value="issued">Issued</option>
              <option value="superseded">Superseded</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Types</option>
              <option value="land">Land (Lots)</option>
              <option value="building">Buildings</option>
            </select>

            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Barangays</option>
              {barangays.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Years</option>
              <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>
              <option value={String(new Date().getFullYear() - 1)}>{new Date().getFullYear() - 1}</option>
              <option value={String(new Date().getFullYear() - 2)}>{new Date().getFullYear() - 2}</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {/* Tax Declarations Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading tax declarations...</p>
          </div>
        ) : declarations.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Tax Declarations Found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
              No tax declarations match your current search or filter criteria. Click "Prepare Draft Declaration" to start a new record from an approved assessment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">TD Number</th>
                  <th className="py-3.5 px-4">Property / Type</th>
                  <th className="py-3.5 px-4">Owner Name</th>
                  <th className="py-3.5 px-4">Barangay</th>
                  <th className="py-3.5 px-4">Market Value</th>
                  <th className="py-3.5 px-4">Assessed Value</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                {declarations.map((td) => (
                  <tr key={td.tax_declaration_id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition">
                    <td className="py-3 px-4 font-mono font-medium text-gray-900 dark:text-white">
                      <div className="flex flex-col">
                        <span>{td.declaration_number}</span>
                        {td.revision_number > 0 && (
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-sans">
                            Rev. {td.revision_number} (from {td.previous_td_number || 'previous'})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {td.property_type === 'land' ? (
                          <SquareDashed size={16} className="text-green-600 shrink-0" />
                        ) : (
                          <Building2 size={16} className="text-blue-600 shrink-0" />
                        )}
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{td.target_id_str}</span>
                          <span className="block text-[11px] text-gray-500 capitalize">{td.property_type} • {td.classification}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100 font-medium">
                      {td.owner_name}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {td.barangay}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-300">
                      {formatCurrency(td.market_value)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-green-700 dark:text-green-400">
                      {formatCurrency(td.assessed_value)}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(td.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openTdDetails(td)}
                          title="View & Print Declaration Statement"
                          className="p-1.5 text-gray-600 hover:text-green-700 dark:text-gray-400 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition"
                        >
                          <Eye size={17} />
                        </button>

                        {/* Staff / Preparer Actions */}
                        {td.status === 'draft' && (
                          <button
                            onClick={() => handleSubmitReview(td.tax_declaration_id)}
                            title="Submit for Review"
                            className="px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 rounded font-medium transition"
                          >
                            Submit
                          </button>
                        )}

                        {/* Admin / Head Assessor Actions */}
                        {canApproveTD && td.status === 'pending_review' && (
                          <>
                            <button
                              onClick={() => handleApprove(td.tax_declaration_id)}
                              title="Approve Declaration"
                              className="px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 rounded font-medium transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenReturnModal(td)}
                              title="Return for Correction"
                              className="px-2 py-1 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 rounded font-medium transition"
                            >
                              Return
                            </button>
                          </>
                        )}

                        {canApproveTD && td.status === 'approved' && (
                          <button
                            onClick={() => handleIssue(td.tax_declaration_id)}
                            title="Officially Issue Declaration"
                            className="px-2 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded font-medium transition"
                          >
                            Issue
                          </button>
                        )}

                        {/* View Tax Report shortcut from approved or issued TD */}
                        {(td.status === 'approved' || td.status === 'issued') && onNavigateToBilling && (
                          <button
                            onClick={() => onNavigateToBilling(td)}
                            title="View Property Tax Computation Report for this Declaration"
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition shadow-xs"
                          >
                            <FileText size={13} />
                            <span>Tax Report</span>
                          </button>
                        )}

                        {/* Revision action for Issued declarations */}
                        {(isAdminOrSuper || userRole === 'staff') && td.status === 'issued' && (
                          <button
                            onClick={() => handleOpenReviseModal(td)}
                            title="Create Authorized Revision"
                            className="px-2 py-1 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 rounded font-medium transition"
                          >
                            Revise
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Prepare Draft Tax Declaration */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <FileText className="text-green-600" size={20} />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Prepare Draft Tax Declaration</h3>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  if (onClearPreselectedAssessment) onClearPreselectedAssessment();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Approved Assessment
                </label>
                {loadingEligible ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Fetching eligible approved assessments...
                  </div>
                ) : eligibleAssessments.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>No Unlinked Approved Assessments Found.</strong>
                      <p className="mt-0.5 text-xs">
                        All approved assessments already have active tax declarations. To create a new declaration, an assessor must complete and the Head Assessor must approve an assessment first.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-800 rounded-lg p-2 custom-scrollbar">
                    {eligibleAssessments.map(item => {
                      const isSelected = selectedAssessment?.assessment_id === item.assessment_id;
                      return (
                        <div
                          key={item.assessment_id}
                          onClick={() => setSelectedAssessment(item)}
                          className={`p-3 rounded-lg border text-sm cursor-pointer transition ${
                            isSelected 
                              ? 'border-green-600 bg-green-50/70 dark:bg-green-950/40 dark:border-green-500' 
                              : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between font-medium">
                            <span className="text-gray-900 dark:text-white flex items-center gap-1.5">
                              {item.property_type === 'land' ? <SquareDashed size={15} /> : <Building2 size={15} />}
                              {item.target_id_str} ({item.classification})
                            </span>
                            <span className="font-mono text-green-700 dark:text-green-400 font-semibold">
                              AV: {formatCurrency(item.assessed_value)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex justify-between">
                            <span>Owner: {item.owner_name}</span>
                            <span>Barangay: {item.barangay}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedAssessment && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-2 text-xs border border-gray-200 dark:border-gray-700">
                  <div className="font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                    Assessment Summary Breakdown
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300">
                    <div>Market Value: <strong className="text-gray-900 dark:text-white font-mono">{formatCurrency(selectedAssessment.market_value)}</strong></div>
                    <div>Assessment Level: <strong className="text-gray-900 dark:text-white">{selectedAssessment.assessment_level}%</strong></div>
                    <div>Assessed Value: <strong className="text-green-600 dark:text-green-400 font-mono">{formatCurrency(selectedAssessment.assessed_value)}</strong></div>
                    <div>Area: <strong className="text-gray-900 dark:text-white">{selectedAssessment.land_area || selectedAssessment.building_area} sq.m.</strong></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Declaration Effective Year
                  </label>
                  <input
                    type="number"
                    min={2000}
                    max={2099}
                    value={effectiveYear}
                    onChange={(e) => setEffectiveYear(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  />
                  <span className="text-[11px] text-gray-500">Year from which this declaration takes tax effect.</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Preparer Notes / Supporting Docs
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Transfer of title, Cadastral survey ref"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    if (onClearPreselectedAssessment) onClearPreselectedAssessment();
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedAssessment || submitting}
                  className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition shadow-sm"
                >
                  {submitting ? 'Generating...' : 'Save as Draft Declaration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL / DRAWER: View & Print Official Declaration */}
      {selectedTd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="text-green-600" size={20} />
                <span className="font-bold text-gray-900 dark:text-white">Tax Declaration Form Preview</span>
                {getStatusBadge(selectedTd.status)}
              </div>
              <div className="flex items-center gap-2">
                {(selectedTd.status === 'approved' || selectedTd.status === 'issued') && onNavigateToBilling && (
                  <button
                    onClick={() => {
                      const target = selectedTd;
                      setSelectedTd(null);
                      onNavigateToBilling(target);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                  >
                    <Receipt size={15} />
                    <span>Generate Tax Bill</span>
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
                >
                  <Printer size={15} />
                  <span>Print Official Form</span>
                </button>
                <button
                  onClick={() => setSelectedTd(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Form Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white text-gray-900 custom-scrollbar print:p-0 print:overflow-visible">
              {/* Draft Watermark for unissued declarations */}
              {selectedTd.status !== 'issued' && (
                <div className="bg-amber-50 border border-amber-300 p-3 rounded text-center text-amber-800 text-xs font-semibold print:border-dashed">
                  OFFICIAL DRAFT / FOR REVIEW ONLY — NOT AN ISSUED TAX DECLARATION
                </div>
              )}

              {/* Form Header */}
              <div className="text-center space-y-1 border-b-2 border-gray-900 pb-4">
                <div className="text-xs uppercase tracking-widest text-gray-600">Republic of the Philippines</div>
                <div className="text-xs font-bold uppercase text-gray-700">Province of Misamis Oriental</div>
                <div className="text-base font-extrabold uppercase text-gray-900">Municipality of Lagonglong</div>
                <div className="text-sm font-semibold uppercase text-green-900">Office of the Municipal Assessor</div>
                <div className="text-lg font-black tracking-wider uppercase mt-2 pt-2 border-t border-gray-300">
                  REAL PROPERTY TAX DECLARATION
                </div>
              </div>

              {/* Identification Row */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <div><strong>TAX DECLARATION NO.:</strong> <span className="font-mono text-sm font-bold">{selectedTd.declaration_number}</span></div>
                  <div><strong>PROPERTY INDEX NUMBER (PIN):</strong> <span className="font-mono">{selectedTd.property_code}</span></div>
                  <div><strong>TARGET IDENTIFIER:</strong> <span className="font-semibold">{selectedTd.target_id_str}</span> ({selectedTd.property_type.toUpperCase()})</div>
                </div>
                <div className="space-y-1 text-right">
                  <div><strong>EFFECTIVE TAX YEAR:</strong> <span className="font-bold">{selectedTd.effective_year}</span></div>
                  <div><strong>REVISION NUMBER:</strong> <span>{selectedTd.revision_number}</span></div>
                  {selectedTd.previous_td_number && (
                    <div><strong>PREVIOUS TD NO.:</strong> <span className="font-mono">{selectedTd.previous_td_number}</span></div>
                  )}
                </div>
              </div>

              {/* Owner and Location */}
              <div className="border border-gray-900 text-xs">
                <div className="bg-gray-100 p-1.5 font-bold border-b border-gray-900">
                  I. OWNER AND PROPERTY LOCATION
                </div>
                <div className="p-3 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] text-gray-600">NAME OF DECLARED OWNER:</div>
                    <div className="font-bold text-sm">{selectedTd.owner_name}</div>
                    <div className="text-[11px] text-gray-600 mt-2">CONTACT / EMAIL:</div>
                    <div>{selectedTd.owner_contact || 'N/A'} • {selectedTd.owner_email || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-600">LOCATION OF PROPERTY:</div>
                    <div className="font-semibold">{selectedTd.property_address}</div>
                    <div className="text-[11px] text-gray-600 mt-2">BARANGAY / MUNICIPALITY:</div>
                    <div>Brgy. {selectedTd.barangay}, Lagonglong, Misamis Oriental</div>
                  </div>
                </div>
              </div>

              {/* Property Appraisal Table */}
              <div className="border border-gray-900 text-xs">
                <div className="bg-gray-100 p-1.5 font-bold border-b border-gray-900">
                  II. PROPERTY APPRAISAL & ASSESSMENT
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-900 bg-gray-50 text-[11px]">
                      <th className="p-2 border-r border-gray-900">Classification</th>
                      <th className="p-2 border-r border-gray-900">Actual Use</th>
                      <th className="p-2 border-r border-gray-900 text-right">Area (sq.m.)</th>
                      <th className="p-2 border-r border-gray-900 text-right">Market Value</th>
                      <th className="p-2 border-r border-gray-900 text-center">Assessment Level</th>
                      <th className="p-2 text-right">Assessed Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-900">
                      <td className="p-2 border-r border-gray-900 font-semibold">{selectedTd.classification}</td>
                      <td className="p-2 border-r border-gray-900">{selectedTd.actual_use}</td>
                      <td className="p-2 border-r border-gray-900 text-right font-mono">
                        {Number(selectedTd.land_area || selectedTd.building_area || 0).toLocaleString()}
                      </td>
                      <td className="p-2 border-r border-gray-900 text-right font-mono font-medium">
                        {formatCurrency(selectedTd.market_value)}
                      </td>
                      <td className="p-2 border-r border-gray-900 text-center font-mono">
                        {selectedTd.assessment_level}%
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-gray-900">
                        {formatCurrency(selectedTd.assessed_value)}
                      </td>
                    </tr>
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={3} className="p-2 border-r border-gray-900 text-right uppercase">
                        Total Applicable Assessed Value:
                      </td>
                      <td className="p-2 border-r border-gray-900 text-right font-mono">
                        {formatCurrency(selectedTd.market_value)}
                      </td>
                      <td className="p-2 border-r border-gray-900"></td>
                      <td className="p-2 text-right font-mono text-sm">
                        {formatCurrency(selectedTd.assessed_value)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures & Certification */}
              <div className="grid grid-cols-2 gap-8 text-xs pt-8">
                <div className="text-center space-y-8">
                  <div>
                    Prepared & Encoded By:
                  </div>
                  <div className="border-b border-gray-900 w-3/4 mx-auto pb-1 font-bold">
                    {selectedTd.preparer_first_name 
                      ? `${selectedTd.preparer_first_name} ${selectedTd.preparer_last_name}`
                      : 'MUNICIPAL ASSESSMENT STAFF'}
                  </div>
                  <div className="text-[10px] text-gray-600 -mt-6">Assessment Encoder / Staff</div>
                </div>

                <div className="text-center space-y-8">
                  <div>
                    Approved & Issued By:
                  </div>
                  <div className="border-b border-gray-900 w-3/4 mx-auto pb-1 font-bold">
                    {selectedTd.approver_first_name 
                      ? `${selectedTd.approver_first_name} ${selectedTd.approver_last_name}`
                      : 'HON. MUNICIPAL ASSESSOR'}
                  </div>
                  <div className="text-[10px] text-gray-600 -mt-6">Municipal Assessor, Lagonglong</div>
                </div>
              </div>

              {/* Revision History block if revisions exist */}
              {tdHistory.length > 0 && (
                <div className="pt-4 border-t border-gray-200 text-xs print:hidden">
                  <div className="font-bold flex items-center gap-1.5 mb-2 text-gray-700">
                    <History size={14} />
                    <span>Revision History Trail</span>
                  </div>
                  <div className="space-y-1">
                    {tdHistory.map((rev) => (
                      <div key={rev.tax_declaration_id} className="flex justify-between text-gray-600 bg-gray-50 p-2 rounded">
                        <span>Rev. {rev.revision_number}: {rev.declaration_number}</span>
                        <span>Assessed: {formatCurrency(rev.assessed_value)} ({rev.status})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Return for Correction */}
      {showReturnModal && returnTargetTd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-rose-600" size={18} />
                <span>Return Declaration for Correction</span>
              </h3>
              <button onClick={() => setShowReturnModal(false)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmReturn} className="p-5 space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Returning TD <strong className="font-mono text-gray-900 dark:text-white">{returnTargetTd.declaration_number}</strong> back to the assessment staff. Please state the specific discrepancies that need correction:
              </p>
              <textarea
                required
                rows={3}
                placeholder="e.g. Assessment level applied does not conform to the approved schedule; check actual use."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-rose-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition"
                >
                  {submitting ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Revise Tax Declaration */}
      {showReviseModal && reviseTargetTd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="text-purple-600" size={18} />
                <span>Prepare Declaration Revision</span>
              </h3>
              <button onClick={() => setShowReviseModal(false)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmRevise} className="p-5 space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                A new revision draft will be created for <strong className="font-mono text-gray-900 dark:text-white">{reviseTargetTd.declaration_number}</strong>. When approved, this existing declaration will be marked as <strong>superseded</strong>.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Revision Reason / Legal Justification:
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Reclassification from Residential to Commercial; Area resurvey subdivision."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviseModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                >
                  {submitting ? 'Creating Revision...' : 'Create Revision Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
