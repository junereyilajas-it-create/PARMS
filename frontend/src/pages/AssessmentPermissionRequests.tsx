import React, { useEffect, useState } from 'react';
import { Search, Filter, Edit3, RotateCcw, AlertTriangle } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import api, { ensureSession } from '../lib/api';
import { useModal } from '../contexts/ModalContext';

type PermissionRequest = {
  request_id: number;
  property_type: string;
  target_id_str: string;
  target_id_int: number;
  requested_by_user_id: number;
  first_name: string;
  last_name: string;
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
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [assessors, setAssessors] = useState<AssessorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError, showConfirm } = useModal();
  const [userRole, setUserRole] = useState('');

  const [internalSearch, setInternalSearch] = useState('');
  const [filters, setFilters] = useState({ type: '', status: '' });

  // Modal states
  const [editRequest, setEditRequest] = useState<PermissionRequest | null>(null);
  const [revokeRequest, setRevokeRequest] = useState<PermissionRequest | null>(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    property_type: 'lot',
    target_id_str: '',
    requested_by_user_id: 0,
    reason: '',
    request_action: 'ASSESSMENT'
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Revoke form state
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeReturnTo, setRevokeReturnTo] = useState<'pending' | 'revoked'>('pending');
  const [isSavingRevoke, setIsSavingRevoke] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      await ensureSession();
      const profile = await api.get('/profile');
      setUserRole(profile.data.role);

      const [requestsRes, assessorsRes] = await Promise.all([
        api.get('/assessments/requests'),
        api.get('/assessments/assessors').catch(() => ({ data: [] }))
      ]);

      setRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
      if (Array.isArray(assessorsRes.data)) {
        setAssessors(assessorsRes.data);
      }
    } catch (e: any) {
      console.error('Error loading requests:', e);
      showError(e.response?.data?.message || 'Unable to load permission requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const displayedRequests = requests.filter(r => {
    const sMatch = !internalSearch || `${r.target_id_str} ${r.first_name} ${r.last_name} ${r.owner_name || ''}`.toLowerCase().includes(internalSearch.toLowerCase());
    const tMatch = !filters.type || (r.property_type && r.property_type.toLowerCase() === filters.type.toLowerCase());
    const stMatch = !filters.status || r.request_status.toLowerCase() === filters.status.toLowerCase();
    return sMatch && tMatch && stMatch;
  });

  const approveRequest = async (id: number) => {
    showConfirm('Approve this request? This will create an active assessment assignment.', async () => {
      try {
        await ensureSession();
        await api.post(`/assessments/requests/${id}/approve`);
        showSuccess('Request approved successfully.');
        await load();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to approve request.');
      }
    });
  };

  const rejectRequest = async (id: number) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    if (!reason.trim()) {
      showError('A rejection reason is required.');
      return;
    }
    try {
      await ensureSession();
      await api.post(`/assessments/requests/${id}/reject`, { reason });
      showSuccess('Request rejected.');
      await load();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to reject request.');
    }
  };

  const cancelRequest = async (id: number) => {
    showConfirm('Cancel this request?', async () => {
      try {
        await ensureSession();
        await api.post(`/assessments/requests/${id}/cancel`);
        showSuccess('Request cancelled successfully.');
        await load();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to cancel request.');
      }
    });
  };

  const resubmitRequest = async (id: number) => {
    showConfirm('Resubmit this request for review?', async () => {
      try {
        await ensureSession();
        await api.post(`/assessments/requests/${id}/resubmit`);
        showSuccess('Request resubmitted successfully.');
        await load();
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
      await load();
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
      await load();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to revoke approval.';
      setRevokeError(msg);
      showError(msg);
    } finally {
      setIsSavingRevoke(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = String(status).toUpperCase();
    let style = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    if (s === 'APPROVED') {
      style = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-semibold';
    } else if (s === 'PENDING') {
      style = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold';
    } else if (s === 'REJECTED') {
      style = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-semibold';
    } else if (s === 'REVOKED' || s === 'CANCELLED') {
      style = 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-semibold';
    }
    return <span className={`px-2.5 py-1 rounded-full text-xs uppercase tracking-wide ${style}`}>{status}</span>;
  };

  const columns = [
    { key: 'request_id', label: 'REQUEST ID', render: (id: number) => <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">#{id}</span> },
    { 
      key: 'target_id_str', 
      label: 'PROPERTY ID', 
      render: (v: string, r: PermissionRequest) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 dark:text-white">{v}</span>
          <span className="text-[11px] text-gray-500 uppercase tracking-wider">{r.property_type}</span>
        </div>
      )
    },
    { key: 'owner_name', label: 'OWNER', render: (v: string) => <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{v || '-'}</span> },
    { key: 'request_action', label: 'ACTION', render: (v: string) => <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{(v || 'ASSESSMENT').replace('_', ' ')}</span> },
    { 
      key: 'first_name', 
      label: 'ASSESSOR / STAFF', 
      render: (_: any, r: PermissionRequest) => {
        const name = r.assessor_first_name ? `${r.assessor_first_name} ${r.assessor_last_name}` : `${r.first_name} ${r.last_name}`;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}</span>
            {r.requester_username && <span className="text-[11px] text-gray-500">@{r.requester_username}</span>}
          </div>
        );
      }
    },
    { 
      key: 'reason', 
      label: 'REASON / DETAILS', 
      render: (v: string, r: PermissionRequest) => (
        <div className="max-w-[220px] truncate" title={v || r.rejection_reason || ''}>
          <span className="text-xs text-gray-700 dark:text-gray-300">{v || '-'}</span>
          {r.rejection_reason && (
            <p className="text-[11px] text-red-500 dark:text-red-400 truncate mt-0.5" title={r.rejection_reason}>
              Note: {r.rejection_reason}
            </p>
          )}
        </div>
      )
    },
    { key: 'request_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) },
    { key: 'created_at', label: 'DATE', render: (v: string) => <span className="text-xs text-gray-500">{v ? new Date(v).toLocaleDateString() : '-'}</span> }
  ];

  const isAdminOrSuper = ['admin', 'super_admin'].includes(userRole);

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Assessment Requests</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Review, assign, edit, and manage property assessment requests.</p>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center flex-wrap">
        <div className="flex-1 min-w-[250px] flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
          <Search size={18} className="text-gray-500" />
          <input
            type="text"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            placeholder="Search by Property ID, Owner, or Assessor name..."
            className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <Filter size={16} className="text-gray-500" />
          <select
            value={filters.type}
            onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
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
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="bg-transparent border-none text-sm outline-none dark:text-white dark:bg-gray-800 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading permission requests...</div>
        ) : (
          <DataTable 
            columns={columns} 
            data={displayedRequests} 
            onView={() => {}} 
            showActions={true}
          customActions={(record: PermissionRequest) => (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Admin Actions for Pending */}
              {isAdminOrSuper && record.request_status === 'pending' && (
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

              {/* Admin Actions for Approved: Edit or Revoke Approval */}
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

              {/* Admin Actions for Revoked / Rejected: Can still Edit to correct */}
              {isAdminOrSuper && ['revoked', 'rejected'].includes(record.request_status) && (
                <button 
                  onClick={() => openEditModal(record)} 
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded text-xs font-semibold transition flex items-center gap-1"
                  title="Edit and Correct Request"
                >
                  <Edit3 size={13} />
                  Edit
                </button>
              )}

              {/* Requester Actions */}
              {['staff', 'assessor'].includes(userRole) && record.request_status === 'pending' && (
                <button 
                  onClick={() => cancelRequest(record.request_id)} 
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded text-xs font-semibold transition"
                >
                  Cancel
                </button>
              )}
              {['staff', 'assessor'].includes(userRole) && record.request_status === 'rejected' && (
                <button 
                  onClick={() => resubmitRequest(record.request_id)} 
                  className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-xs font-semibold transition"
                >
                  Resubmit
                </button>
              )}
            </div>
          )}
        />
        )}
      </div>

      {/* ---------------- EDIT REQUEST MODAL ---------------- */}
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
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1"
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
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
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

      {/* ---------------- REVOKE / CANCEL APPROVAL MODAL ---------------- */}
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
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRevoke} className="p-6 space-y-4">
              {/* Property & Request Summary Card */}
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

              {/* Resolution options */}
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

              {/* Revocation Reason */}
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
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Keep Approved
                </button>
                <button
                  type="submit"
                  disabled={isSavingRevoke}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
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
    </div>
  );
};
