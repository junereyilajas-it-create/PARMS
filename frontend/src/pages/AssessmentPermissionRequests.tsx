import React, { useEffect, useState, useMemo } from 'react';
import { Search, Filter, Edit3, RotateCcw, AlertTriangle, XCircle, CheckCircle, Clock, ShieldAlert, X, FileText, UserCheck } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import api, { ensureSession } from '../lib/api';
import { useModal } from '../contexts/ModalContext';
import { useSearchParams } from 'react-router-dom';

export type PermissionRequest = {
  request_id: number;
  property_type: string;
  target_id_str: string;
  target_id_int: number;
  requested_by_user_id: number;
  first_name: string;
  last_name: string;
  requester_role?: string;
  requester_username?: string;
  requester_email?: string;
  reason: string;
  request_status: string;
  request_action: string;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
  reviewed_by_user_id?: number;
  reviewed_at?: string;
  reviewer_first_name?: string;
  reviewer_last_name?: string;
  owner_name?: string;
  property_address?: string;
  property_or_lot_number?: string;
  barangay?: string;
  assignment_id?: number;
  assignment_status?: string;
  assigned_to_user_id?: number;
  assessor_first_name?: string;
  assessor_last_name?: string;
};

type AssessorOption = {
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
};

export const AssessmentPermissionRequests: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [userRole, setUserRole] = useState(() => localStorage.getItem('accessor_role') || '');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const isAdminOrSuper = ['admin', 'super_admin'].includes(userRole);
  const isStaff = userRole === 'staff';

  // Tabs state: 'my' or 'all'
  // Super Admin & Admin ONLY have 'all' (My Request is removed)
  // Staff ONLY has 'my' (All Request is removed)
  const getInitialTab = (): 'my' | 'all' => {
    if (isAdminOrSuper) return 'all';
    if (isStaff) return 'my';
    return searchParams.get('tab') === 'all_requests' ? 'all' : 'my';
  };
  const [activeTab, setActiveTab] = useState<'my' | 'all'>(getInitialTab);

  // Data
  const [myRequests, setMyRequests] = useState<PermissionRequest[]>([]);
  const [allRequests, setAllRequests] = useState<PermissionRequest[]>([]);
  const [canViewAll, setCanViewAll] = useState<boolean>(true);
  const [assessors, setAssessors] = useState<AssessorOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const initialStatus = searchParams.get('status') || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState('');

  const { showSuccess, showError, showConfirm } = useModal();

  // Modals
  const [cancelTarget, setCancelTarget] = useState<PermissionRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const [editRequest, setEditRequest] = useState<PermissionRequest | null>(null);
  const [editFormData, setEditFormData] = useState({
    property_type: 'lot',
    target_id_str: '',
    requested_by_user_id: 0,
    reason: '',
    request_action: 'ASSESSMENT'
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [revokeRequest, setRevokeRequest] = useState<PermissionRequest | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeReturnTo, setRevokeReturnTo] = useState<'pending' | 'revoked'>('pending');
  const [isSavingRevoke, setIsSavingRevoke] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  // Details Modal and URL Navigation State
  const [highlightedRequestId, setHighlightedRequestId] = useState<number | null>(null);
  const [selectedDetailsRequest, setSelectedDetailsRequest] = useState<PermissionRequest | null>(null);
  const [isProcessingReview, setIsProcessingReview] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [isRejectingInline, setIsRejectingInline] = useState(false);

  // Staff Request Permission Modal State
  const [showRequestPermModal, setShowRequestPermModal] = useState(false);
  const [requestPermForm, setRequestPermForm] = useState({
    permission: 'MANAGE_CERTIFICATES',
    reason: ''
  });
  const [isSubmittingPerm, setIsSubmittingPerm] = useState(false);

  // Synchronize requestId from searchParams
  useEffect(() => {
    const urlReqId = searchParams.get('requestId');
    if (urlReqId) {
      const idNum = Number(urlReqId);
      setHighlightedRequestId(idNum);
      const allCombined = [...myRequests, ...allRequests];
      const match = allCombined.find(r => r.request_id === idNum);
      if (match) {
        setSelectedDetailsRequest(match);
      }
    }
  }, [searchParams, myRequests, allRequests]);

  const handleOpenRequestPerm = () => {
    setRequestPermForm({
      permission: 'MANAGE_CERTIFICATES',
      reason: ''
    });
    setShowRequestPermModal(true);
  };

  const handleSubmitPermRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestPermForm.reason.trim()) {
      showError('Please provide a reason for requesting this permission.');
      return;
    }
    setIsSubmittingPerm(true);
    try {
      await ensureSession();
      await api.post('/assessments/requests', {
        property_type: 'system',
        request_action: 'PERMISSION',
        target_id_str: requestPermForm.permission,
        reason: requestPermForm.reason.trim()
      });
      showSuccess('Permission request submitted successfully. Administrator and Super Admin have been notified.', 'Request Submitted');
      setShowRequestPermModal(false);
      await loadData();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to submit permission request.');
    } finally {
      setIsSubmittingPerm(false);
    }
  };

  // Sync URL search params with state
  useEffect(() => {
    if (isAdminOrSuper) {
      setActiveTab('all');
    } else if (isStaff) {
      setActiveTab('my');
    } else {
      const urlTab = searchParams.get('tab');
      if (urlTab === 'all_requests') {
        setActiveTab('all');
      } else if (urlTab === 'my_requests') {
        setActiveTab('my');
      }
    }

    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams, userRole, isAdminOrSuper, isStaff]);

  const loadData = async () => {
    setLoading(true);
    try {
      await ensureSession();
      const profile = await api.get('/profile');
      const role = profile.data.role;
      setUserRole(role);
      setCurrentUserId(profile.data.id || profile.data.user_id);

      if (['admin', 'super_admin'].includes(role)) {
        setActiveTab('all');
      } else if (role === 'staff') {
        setActiveTab('my');
      }

      // Fetch My Requests
      const myRes = await api.get('/assessments/requests?scope=my');
      setMyRequests(Array.isArray(myRes.data) ? myRes.data : []);

      // Fetch All Requests (if authorized)
      try {
        const allRes = await api.get('/assessments/requests?scope=all');
        setAllRequests(Array.isArray(allRes.data) ? allRes.data : []);
        setCanViewAll(true);
      } catch (allErr: any) {
        if (allErr.response?.status === 403 || allErr.response?.data?.unauthorized) {
          setCanViewAll(false);
          setAllRequests([]);
        } else {
          console.warn('Error fetching all requests:', allErr);
        }
      }

      if (['admin', 'super_admin'].includes(profile.data.role)) {
        const assessorsRes = await api.get('/assessments/assessors').catch(() => ({ data: [] }));
        if (Array.isArray(assessorsRes.data)) {
          setAssessors(assessorsRes.data);
        }
      }
    } catch (e: any) {
      console.error('Error loading requests:', e);
      showError(e.response?.data?.message || 'Unable to load permission requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (tab: 'my' | 'all') => {
    if (isAdminOrSuper && tab === 'my') return;
    if (isStaff && tab === 'all') return;
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab === 'my' ? 'my_requests' : 'all_requests');
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setTypeFilter('');
    const newParams = new URLSearchParams();
    if (activeTab === 'all') newParams.set('tab', 'all_requests');
    setSearchParams(newParams);
  };

  // Filter requests for current tab
  const activeDataset = activeTab === 'my' ? myRequests : allRequests;

  const filteredRequests = useMemo(() => {
    return activeDataset.filter(r => {
      // Partial text search across fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTarget = String(r.target_id_str || '').toLowerCase().includes(q);
        const matchesOwner = String(r.owner_name || '').toLowerCase().includes(q);
        const matchesType = String(r.property_type || '').toLowerCase().includes(q);
        const matchesAddr = String(r.property_address || '').toLowerCase().includes(q);
        const matchesBarangay = String(r.barangay || '').toLowerCase().includes(q);
        const matchesLot = String(r.property_or_lot_number || '').toLowerCase().includes(q);
        const matchesAssessor = `${r.first_name || ''} ${r.last_name || ''} ${r.requester_username || ''}`.toLowerCase().includes(q);
        const matchesReason = String(r.reason || '').toLowerCase().includes(q);
        const matchesId = String(r.request_id).includes(q);

        if (!matchesTarget && !matchesOwner && !matchesType && !matchesAddr && !matchesBarangay && !matchesLot && !matchesAssessor && !matchesReason && !matchesId) {
          return false;
        }
      }

      // Type filter
      if (typeFilter && String(r.property_type || '').toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }

      // Status filter
      if (statusFilter && String(r.request_status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [activeDataset, searchQuery, typeFilter, statusFilter]);

  // Request Cancel Handler
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;

    setIsCancelling(true);
    setCancelError('');

    try {
      await ensureSession();
      const res = await api.post(`/assessments/requests/${cancelTarget.request_id}/cancel`);
      showSuccess(res.data?.message || `Request #${cancelTarget.request_id} was successfully cancelled.`, 'Request Cancelled');
      setCancelTarget(null);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to cancel the request. Please try again.';
      setCancelError(msg);
      showError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  // Admin Actions
  const approveRequest = async (id: number) => {
    showConfirm('Approve this request? This will immediately apply the requested access.', async () => {
      setIsProcessingReview(true);
      try {
        await ensureSession();
        await api.post(`/assessments/requests/${id}/approve`);
        showSuccess('Request approved successfully.');
        window.dispatchEvent(new Event('permissions_updated'));
        if (selectedDetailsRequest?.request_id === id) {
          setSelectedDetailsRequest(prev => prev ? { ...prev, request_status: 'approved' } : null);
        }
        await loadData();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to approve request.');
      } finally {
        setIsProcessingReview(false);
      }
    }, 'Confirm Approval');
  };

  const rejectRequest = async (id: number, reasonInput?: string) => {
    let reason = reasonInput;
    if (reason === undefined) {
      reason = window.prompt('Enter rejection reason:') || '';
      if (!reason.trim()) {
        showError('A rejection reason is required.');
        return;
      }
    }
    setIsProcessingReview(true);
    try {
      await ensureSession();
      await api.post(`/assessments/requests/${id}/reject`, { reason });
      showSuccess('Request rejected.');
      setIsRejectingInline(false);
      setRejectReasonInput('');
      if (selectedDetailsRequest?.request_id === id) {
        setSelectedDetailsRequest(prev => prev ? { ...prev, request_status: 'rejected', rejection_reason: reason } : null);
      }
      await loadData();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to reject request.');
    } finally {
      setIsProcessingReview(false);
    }
  };

  const resubmitRequest = async (id: number) => {
    showConfirm('Resubmit this request for review?', async () => {
      try {
        await ensureSession();
        await api.post(`/assessments/requests/${id}/resubmit`);
        showSuccess('Request resubmitted successfully.');
        await loadData();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to resubmit request.');
      }
    });
  };

  const openEditModal = (request: PermissionRequest) => {
    setEditRequest(request);
    setEditFormData({
      property_type: request.property_type || 'lot',
      target_id_str: request.target_id_str || '',
      requested_by_user_id: request.assigned_to_user_id || request.requested_by_user_id || 0,
      reason: request.reason || '',
      request_action: request.request_action || 'ASSESSMENT'
    });
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRequest) return;

    if (!editFormData.target_id_str.trim()) {
      setEditError('Property ID is required.');
      return;
    }
    if (!editFormData.requested_by_user_id) {
      setEditError('Please select an assigned assessor.');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');

    try {
      await ensureSession();
      await api.put(`/assessments/requests/${editRequest.request_id}`, editFormData);
      showSuccess('Assessment request updated successfully.');
      setEditRequest(null);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update request.';
      setEditError(msg);
      showError(msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openRevokeModal = (request: PermissionRequest) => {
    setRevokeRequest(request);
    setRevokeReason('');
    setRevokeReturnTo('pending');
    setRevokeError('');
  };

  const handleConfirmRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeRequest) return;

    if (!revokeReason.trim()) {
      setRevokeError('Please provide a reason for cancelling or revoking this approval.');
      return;
    }

    setIsSavingRevoke(true);
    setRevokeError('');

    try {
      await ensureSession();
      const res = await api.post(`/assessments/requests/${revokeRequest.request_id}/revoke`, {
        reason: revokeReason.trim(),
        return_to: revokeReturnTo
      });
      showSuccess(res.data.message || 'Approval revoked successfully.');
      setRevokeRequest(null);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to revoke approval.';
      setRevokeError(msg);
      showError(msg);
    } finally {
      setIsSavingRevoke(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    let style = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    let icon = null;

    if (s === 'APPROVED') {
      style = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
      icon = <CheckCircle size={12} className="inline mr-1" />;
    } else if (s === 'PENDING') {
      style = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
      icon = <Clock size={12} className="inline mr-1" />;
    } else if (s === 'REJECTED') {
      style = 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800';
      icon = <XCircle size={12} className="inline mr-1" />;
    } else if (s === 'CANCELLED' || s === 'REVOKED') {
      style = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700';
      icon = <X size={12} className="inline mr-1" />;
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${style}`}>
        {icon}
        {status}
      </span>
    );
  };


  // Tab A: My Requests Columns
  const myRequestsColumns = [
    {
      key: 'request_id',
      label: 'REQUEST ID',
      render: (id: number) => (
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded transition-all ${
          highlightedRequestId === id
            ? 'bg-amber-100 text-amber-900 border border-amber-400 ring-2 ring-amber-300 dark:bg-amber-950 dark:text-amber-200'
            : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'
        }`}>
          #{id}
        </span>
      )
    },
    {
      key: 'target_id_str',
      label: 'TARGET / PROPERTY',
      render: (v: string, r: PermissionRequest) => {
        const isPerm = r.property_type === 'system' || r.request_action === 'PERMISSION';
        const label = v === 'MANAGE_CERTIFICATES' ? 'Manage Certificates' : v;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-white">{isPerm ? label : v}</span>
            <span className={`text-[11px] capitalize font-semibold ${isPerm ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {isPerm ? 'System Permission' : (r.property_type || 'Property')}
            </span>
          </div>
        );
      }
    },
    {
      key: 'property_or_lot_number',
      label: 'LOT / BLDG #',
      render: (v: string, r: PermissionRequest) => {
        const isPerm = r.property_type === 'system' || r.request_action === 'PERMISSION';
        return (
          <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">
            {isPerm ? '-' : (v || r.target_id_str || '-')}
          </span>
        );
      }
    },
    {
      key: 'owner_name',
      label: 'OWNER / SCOPE',
      render: (v: string, r: PermissionRequest) => {
        const isPerm = r.property_type === 'system' || r.request_action === 'PERMISSION';
        return (
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {isPerm ? 'System Scope' : (v || 'Unassigned')}
          </span>
        );
      }
    },
    {
      key: 'property_address',
      label: 'ADDRESS / MODULE',
      render: (v: string, r: PermissionRequest) => {
        const isPerm = r.property_type === 'system' || r.request_action === 'PERMISSION';
        return (
          <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate block" title={isPerm ? 'Certificates Module' : v}>
            {isPerm ? 'Certificates Module' : (v || 'Address not yet mapped')}
          </span>
        );
      }
    },
    {
      key: 'created_at',
      label: 'DATE REQUESTED',
      render: (v: string) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {v ? new Date(v).toLocaleDateString() : '-'}
        </span>
      )
    },
    {
      key: 'reason',
      label: 'REASON',
      render: (v: string, r: PermissionRequest) => (
        <div className="max-w-[180px] truncate" title={v || r.rejection_reason || ''}>
          <span className="text-xs text-gray-700 dark:text-gray-300">{v || '-'}</span>
          {r.rejection_reason && (
            <p className="text-[11px] text-red-500 dark:text-red-400 truncate mt-0.5" title={r.rejection_reason}>
              Note: {r.rejection_reason}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'request_status',
      label: 'STATUS',
      render: (v: string) => getStatusBadge(v)
    }
  ];

  // Tab B: All Requests Columns
  const allRequestsColumns = [
    {
      key: 'request_id',
      label: 'REQUEST ID',
      render: (id: number) => (
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded transition-all ${
          highlightedRequestId === id
            ? 'bg-amber-100 text-amber-900 border border-amber-400 ring-2 ring-amber-300 dark:bg-amber-950 dark:text-amber-200'
            : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'
        }`}>
          #{id}
        </span>
      )
    },
    {
      key: 'first_name',
      label: 'REQUESTING USER',
      render: (_: any, r: PermissionRequest) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {r.first_name} {r.last_name}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {r.requester_role && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {r.requester_role}
              </span>
            )}
            {r.requester_username && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                @{r.requester_username}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'target_id_str',
      label: 'TARGET / PROPERTY',
      render: (v: string, r: PermissionRequest) => {
        const isPerm = r.property_type === 'system' || r.request_action === 'PERMISSION';
        const label = v === 'MANAGE_CERTIFICATES' ? 'Manage Certificates' : v;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-white">{isPerm ? label : v}</span>
            <span className={`text-[11px] capitalize font-semibold ${isPerm ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {isPerm ? 'System Permission' : (r.property_type || 'Property')}
            </span>
          </div>
        );
      }
    },
    {
      key: 'owner_name',
      label: 'OWNER / SCOPE',
      render: (v: string, r: PermissionRequest) => {
        const isPerm = r.property_type === 'system' || r.request_action === 'PERMISSION';
        return (
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {isPerm ? 'System Scope' : (v || 'Unassigned')}
          </span>
        );
      }
    },
    {
      key: 'property_address',
      label: 'ADDRESS / MODULE',
      render: (v: string, r: PermissionRequest) => {
        const isPerm = r.property_type === 'system' || r.request_action === 'PERMISSION';
        return (
          <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate block" title={isPerm ? 'Certificates Module' : v}>
            {isPerm ? 'Certificates Module' : (v || 'Address not yet mapped')}
          </span>
        );
      }
    },
    {
      key: 'created_at',
      label: 'DATE REQUESTED',
      render: (v: string) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {v ? new Date(v).toLocaleDateString() : '-'}
        </span>
      )
    },
    {
      key: 'request_status',
      label: 'STATUS',
      render: (v: string) => getStatusBadge(v)
    }
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {isAdminOrSuper ? 'Permission Requests' : 'My Requests'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isAdminOrSuper
              ? 'Review, assign, and manage permission and property assessment requests across all staff and assessors.'
              : 'Track, submit, and manage your property and system permission requests.'}
          </p>
        </div>
        {!isAdminOrSuper && (
          <button
            id="request-permission-btn"
            data-testid="request-permission-btn"
            onClick={handleOpenRequestPerm}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition shadow-sm cursor-pointer"
          >
            <ShieldAlert size={16} /> Request Permission
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800">
        {!isAdminOrSuper && (
          <button
            id="tab-my-requests-btn"
            data-testid="tab-my-requests-btn"
            onClick={() => handleTabChange('my')}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'my'
                ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <FileText size={16} />
            My Requests
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'my'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {myRequests.length}
            </span>
          </button>
        )}

        {!isStaff && (
          <button
            id="tab-all-requests-btn"
            data-testid="tab-all-requests-btn"
            onClick={() => handleTabChange('all')}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'all'
                ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <UserCheck size={16} />
            All Requests
            {canViewAll && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'all'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {allRequests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center flex-wrap bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex-1 min-w-[250px] flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
          <Search size={18} className="text-gray-500" />
          <input
            id="requests-search-input"
            data-testid="requests-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Property ID, Lot #, Owner, Address, or Status..."
            className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <Filter size={16} className="text-gray-500" />
          <select
            id="requests-type-filter"
            data-testid="requests-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent border-none text-sm outline-none dark:text-white dark:bg-gray-800 cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="lot">Lot</option>
            <option value="building">Building</option>
            <option value="property">Property</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <select
            id="requests-status-filter"
            data-testid="requests-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent border-none text-sm outline-none dark:text-white dark:bg-gray-800 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {(searchQuery || typeFilter || statusFilter) && (
          <button
            onClick={handleClearFilters}
            className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 underline cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading requests...</span>
          </div>
        ) : activeTab === 'all' && !canViewAll ? (
          /* Tab B: Access Restricted */
          <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Access Restricted
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
              You do not have administrative permission (<span className="font-mono text-xs">VIEW_PERMISSION_REQUEST</span>) to view requests submitted by other assessors. Please use the <strong className="text-green-600 dark:text-green-400">My Requests</strong> tab to track and manage your own permission requests.
            </p>
            <button
              onClick={() => handleTabChange('my')}
              className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition shadow-sm cursor-pointer"
            >
              Go to My Requests
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          /* Empty state */
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <p className="text-base font-semibold text-gray-800 dark:text-gray-200">No requests found</p>
            <p className="text-xs text-gray-500 mt-1">
              {searchQuery || typeFilter || statusFilter
                ? 'Try adjusting your search query or filter options.'
                : activeTab === 'my'
                  ? 'You have not submitted any permission requests yet.'
                  : 'There are no permission requests from other assessors.'}
            </p>
          </div>
        ) : (
          /* Request Table */
          <DataTable
            columns={activeTab === 'my' ? myRequestsColumns : allRequestsColumns}
            data={filteredRequests}
            onView={(record) => {
              setSelectedDetailsRequest(record);
              setIsRejectingInline(false);
              setRejectReasonInput('');
            }}
            showActions={true}
            customActions={(record: PermissionRequest) => {
              const isOwner = record.requested_by_user_id === currentUserId;
              const isPending = record.request_status === 'pending';

              return (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* View Details Button */}
                  <button
                    id={`view-details-btn-${record.request_id}`}
                    data-testid={`view-details-btn-${record.request_id}`}
                    onClick={() => {
                      setSelectedDetailsRequest(record);
                      setIsRejectingInline(false);
                      setRejectReasonInput('');
                    }}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 rounded text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    title="View Request Details"
                  >
                    <FileText size={13} />
                    Details
                  </button>
                  {/* Assessor Cancel Request Button (Only for Pending requests owned by logged-in user) */}
                  {isPending && isOwner && (
                    <button
                      id={`cancel-request-btn-${record.request_id}`}
                      data-testid={`cancel-request-btn-${record.request_id}`}
                      onClick={() => {
                        setCancelTarget(record);
                        setCancelError('');
                      }}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded text-xs font-semibold border border-rose-200 dark:border-rose-800 transition flex items-center gap-1 cursor-pointer"
                      title="Cancel this pending request"
                    >
                      <XCircle size={13} />
                      Cancel Request
                    </button>
                  )}

                  {/* Resubmit if rejected and user is owner */}
                  {record.request_status === 'rejected' && isOwner && (
                    <button
                      onClick={() => resubmitRequest(record.request_id)}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-xs font-semibold border border-blue-200 dark:border-blue-800 transition"
                    >
                      Resubmit
                    </button>
                  )}

                  {/* Admin controls */}
                  {isAdminOrSuper && isPending && (
                    <>
                      <button
                        onClick={() => approveRequest(record.request_id)}
                        className="px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded text-xs font-semibold transition"
                        title="Approve Request"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectRequest(record.request_id)}
                        className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded text-xs font-semibold transition"
                        title="Reject Request"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => openEditModal(record)}
                        className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-xs font-semibold transition flex items-center gap-1"
                        title="Edit Request Information"
                      >
                        <Edit3 size={13} />
                        Edit
                      </button>
                    </>
                  )}

                  {isAdminOrSuper && record.request_status === 'approved' && (
                    <>
                      <button
                        onClick={() => openEditModal(record)}
                        className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-xs font-semibold transition flex items-center gap-1"
                        title="Edit Request Information"
                      >
                        <Edit3 size={13} />
                        Edit
                      </button>
                      <button
                        onClick={() => openRevokeModal(record)}
                        className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded text-xs font-semibold transition flex items-center gap-1"
                        title="Cancel or Revoke this Approval"
                      >
                        <RotateCcw size={13} />
                        Revoke Approval
                      </button>
                    </>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>

      {/* ---------------- CANCEL REQUEST CONFIRMATION MODAL ---------------- */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cancel Permission Request</h2>
                  <p className="text-xs text-gray-500">Request #{cancelTarget.request_id} • Status: Pending</p>
                </div>
              </div>
              <button
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Property Details Card */}
              <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Property ID:</span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">{cancelTarget.target_id_str}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Property Type:</span>
                  <span className="font-semibold text-gray-900 dark:text-white capitalize">{cancelTarget.property_type}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Property / Lot #:</span>
                  <span className="font-semibold text-gray-900 dark:text-white font-mono">{cancelTarget.property_or_lot_number || cancelTarget.target_id_str}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Owner Name:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{cancelTarget.owner_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Property Address:</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-right max-w-[240px] truncate" title={cancelTarget.property_address}>
                    {cancelTarget.property_address || 'Address not yet mapped'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Date Requested:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {cancelTarget.created_at ? new Date(cancelTarget.created_at).toLocaleDateString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-start pt-1">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Reason for Request:</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right max-w-[240px]">
                    {cancelTarget.reason || 'None provided'}
                  </span>
                </div>
              </div>

              {cancelError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  {cancelError}
                </div>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to cancel this permission request? This will mark the request as <strong className="text-rose-600 dark:text-rose-400 uppercase">Cancelled</strong> and close it from further review.
              </p>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  id="cancel-modal-close-btn"
                  onClick={() => setCancelTarget(null)}
                  disabled={isCancelling}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Keep Request
                </button>
                <button
                  type="button"
                  id="confirm-cancel-request-btn"
                  data-testid="confirm-cancel-request-btn"
                  onClick={handleConfirmCancel}
                  disabled={isCancelling}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isCancelling ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- ADMIN EDIT REQUEST MODAL ---------------- */}
      {editRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Assessment Request</h2>
                  <p className="text-xs text-gray-500">Request #{editRequest.request_id} • Status: <span className="font-semibold uppercase">{editRequest.request_status}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setEditRequest(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {editRequest.request_status === 'approved' && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">Notice for Approved Request</p>
                    <p className="mt-0.5">This request was already approved. Updating the property or assigned assessor will synchronize the active assessment assignment record.</p>
                  </div>
                </div>
              )}

              {editError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Property Type</label>
                  <select
                    value={editFormData.property_type}
                    onChange={(e) => setEditFormData({ ...editFormData, property_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                  >
                    <option value="lot">Lot</option>
                    <option value="building">Building</option>
                    <option value="property">Property</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Target Property ID</label>
                  <input
                    type="text"
                    value={editFormData.target_id_str}
                    onChange={(e) => setEditFormData({ ...editFormData, target_id_str: e.target.value })}
                    placeholder="e.g. BLDG-15 or LOT-1"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Assigned Assessor</label>
                <select
                  value={editFormData.requested_by_user_id}
                  onChange={(e) => setEditFormData({ ...editFormData, requested_by_user_id: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                >
                  <option value={0}>Select an eligible assessor...</option>
                  {assessors.map(a => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.first_name} {a.last_name} ({a.username}) - {a.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Request Action</label>
                <select
                  value={editFormData.request_action}
                  onChange={(e) => setEditFormData({ ...editFormData, request_action: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                >
                  <option value="ASSESSMENT">ASSESSMENT (Property Valuation)</option>
                  <option value="ADDITION">ADDITION (New Property Record)</option>
                  <option value="MANAGEMENT">MANAGEMENT (Property Update)</option>
                  <option value="GIS_UPDATE">GIS UPDATE (Spatial Mapping)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Reason / Instructions</label>
                <textarea
                  rows={3}
                  value={editFormData.reason}
                  onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                  placeholder="Provide instructions or purpose for this assessment..."
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditRequest(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- ADMIN REVOKE / CANCEL APPROVAL MODAL ---------------- */}
      {revokeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-600/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 flex items-center justify-center font-bold">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Revoke / Cancel Approval</h2>
                  <p className="text-xs text-gray-500">Assessment Request #{revokeRequest.request_id}</p>
                </div>
              </div>
              <button 
                onClick={() => setRevokeRequest(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRevoke} className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Property ID:</span>
                  <span className="font-semibold text-gray-900 dark:text-white font-mono">{revokeRequest.target_id_str} ({revokeRequest.property_type.toUpperCase()})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Property Owner:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{revokeRequest.owner_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Assigned Assessor:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {revokeRequest.assessor_first_name 
                      ? `${revokeRequest.assessor_first_name} ${revokeRequest.assessor_last_name}` 
                      : `${revokeRequest.first_name} ${revokeRequest.last_name}`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Current Status:</span>
                  <span className="font-bold text-green-700 dark:text-green-400 uppercase">APPROVED</span>
                </div>
              </div>

              {revokeError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  {revokeError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Desired Action</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-green-500 transition">
                    <input 
                      type="radio" 
                      name="returnTo" 
                      value="pending" 
                      checked={revokeReturnTo === 'pending'} 
                      onChange={() => setRevokeReturnTo('pending')}
                      className="mt-0.5 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Return to Pending Review (Recommended)</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Allows the Admin to correct the property or assessor details and approve it again.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-green-500 transition">
                    <input 
                      type="radio" 
                      name="returnTo" 
                      value="revoked" 
                      checked={revokeReturnTo === 'revoked'} 
                      onChange={() => setRevokeReturnTo('revoked')}
                      className="mt-0.5 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Mark as Revoked / Cancelled</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Closes and cancels the approval completely without deleting records.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Reason for Revoking Approval <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g., Assigned to incorrect assessor, property details need correction, duplicate request..."
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRevokeRequest(null)}
                  disabled={isSavingRevoke}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Keep Approved
                </button>
                <button
                  type="submit"
                  disabled={isSavingRevoke}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSavingRevoke ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Revoking Approval...
                    </>
                  ) : (
                    'Confirm Revoke Approval'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- REQUEST DETAILS MODAL (CLICKABLE NOTIFICATION TARGET) ---------------- */}
      {selectedDetailsRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Request #{selectedDetailsRequest.request_id}
                    </h2>
                    {getStatusBadge(selectedDetailsRequest.request_status)}
                  </div>
                  <p className="text-xs text-gray-500">
                    Requested on {selectedDetailsRequest.created_at ? new Date(selectedDetailsRequest.created_at).toLocaleString() : '-'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedDetailsRequest(null);
                  setIsRejectingInline(false);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Requester Profile Information */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Requester Information</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Name:</span> <strong className="text-gray-900 dark:text-white">{selectedDetailsRequest.first_name} {selectedDetailsRequest.last_name}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Username:</span> <span className="font-mono text-gray-700 dark:text-gray-300">@{selectedDetailsRequest.requester_username || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Role:</span> <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ml-1">{selectedDetailsRequest.requester_role || 'Staff/Assessor'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span> <span className="text-gray-700 dark:text-gray-300 truncate block">{selectedDetailsRequest.requester_email || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Request Details */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Target & Scope</h4>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500">Requested Action / Target:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedDetailsRequest.target_id_str === 'MANAGE_CERTIFICATES' ? 'Manage Certificates' : selectedDetailsRequest.target_id_str}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500">Request Type:</span>
                  <span className="font-semibold text-gray-900 dark:text-white capitalize">
                    {selectedDetailsRequest.property_type === 'system' ? 'System Permission' : selectedDetailsRequest.property_type}
                  </span>
                </div>
                {selectedDetailsRequest.property_type !== 'system' && (
                  <>
                    <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-gray-500">Property / Lot #:</span>
                      <span className="font-mono text-gray-900 dark:text-white">{selectedDetailsRequest.property_or_lot_number || selectedDetailsRequest.target_id_str}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-gray-500">Owner Name:</span>
                      <span className="text-gray-900 dark:text-white">{selectedDetailsRequest.owner_name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-gray-500">Property Address:</span>
                      <span className="text-gray-900 dark:text-white text-right max-w-[240px] truncate">{selectedDetailsRequest.property_address || 'Address not yet mapped'}</span>
                    </div>
                  </>
                )}
                <div className="pt-2">
                  <span className="text-gray-500 block mb-1">Reason / Notes:</span>
                  <p className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                    {selectedDetailsRequest.reason || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Review Information (If already processed) */}
              {selectedDetailsRequest.reviewed_by_user_id && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs space-y-1.5">
                  <h4 className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Review Details</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Reviewed By:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{selectedDetailsRequest.reviewer_first_name} {selectedDetailsRequest.reviewer_last_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Decision Date:</span>
                    <span className="text-gray-700 dark:text-gray-300">{selectedDetailsRequest.reviewed_at ? new Date(selectedDetailsRequest.reviewed_at).toLocaleString() : '-'}</span>
                  </div>
                  {selectedDetailsRequest.rejection_reason && (
                    <div className="pt-1 text-red-600 dark:text-red-400">
                      <span className="font-semibold">Rejection Reason:</span> {selectedDetailsRequest.rejection_reason}
                    </div>
                  )}
                </div>
              )}

              {/* Inline Rejection Reason Field */}
              {isRejectingInline && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-3">
                  <label className="block text-xs font-bold text-red-800 dark:text-red-300">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="Enter the reason for rejecting this request..."
                    className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-red-300 dark:border-red-700 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRejectingInline(false)}
                      className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectRequest(selectedDetailsRequest.request_id, rejectReasonInput)}
                      disabled={isProcessingReview || !rejectReasonInput.trim()}
                      className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessingReview ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Approve / Reject Controls */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => {
                  setSelectedDetailsRequest(null);
                  setIsRejectingInline(false);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {isAdminOrSuper && selectedDetailsRequest.request_status === 'pending' && !isRejectingInline && (
                  <>
                    <button
                      type="button"
                      id="details-reject-btn"
                      data-testid="details-reject-btn"
                      onClick={() => setIsRejectingInline(true)}
                      disabled={isProcessingReview}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button
                      type="button"
                      id="details-approve-btn"
                      data-testid="details-approve-btn"
                      onClick={() => approveRequest(selectedDetailsRequest.request_id)}
                      disabled={isProcessingReview}
                      className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessingReview ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} /> Approve Request
                        </>
                      )}
                    </button>
                  </>
                )}

                {selectedDetailsRequest.requested_by_user_id === currentUserId && selectedDetailsRequest.request_status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelTarget(selectedDetailsRequest);
                      setSelectedDetailsRequest(null);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <XCircle size={16} /> Cancel Request
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- STAFF REQUEST PERMISSION MODAL ---------------- */}
      {showRequestPermModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Request Permission</h2>
                  <p className="text-xs text-gray-500">Submit a request to Admin & Super Admin</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRequestPermModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPermRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Requested Permission
                </label>
                <select
                  value={requestPermForm.permission}
                  onChange={(e) => setRequestPermForm({ ...requestPermForm, permission: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white cursor-pointer"
                >
                  <option value="MANAGE_CERTIFICATES">Manage Certificates (Issue, view, and process certifications)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Reason for Request <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={requestPermForm.reason}
                  onChange={(e) => setRequestPermForm({ ...requestPermForm, reason: e.target.value })}
                  placeholder="State your reason for needing this permission (e.g., Assigned to issue certificate of property holdings for clients in Lagonglong)..."
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRequestPermModal(false)}
                  disabled={isSubmittingPerm}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPerm}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingPerm ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
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
