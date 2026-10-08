import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Send } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { useModal } from '../contexts/ModalContext';
import api, { ensureSession } from '../lib/api';

type Assessment = { type: string; assessment_id: number; target_id: string; property_id: string; assessor_user_id: number; first_name?: string; last_name?: string; market_value: number; assessed_value: number; assessment_date: string; remarks: string; assessment_status: string; rejection_reason?: string };

const fields: CrudField[] = [
  { key: 'type', label: 'Type', type: 'select', options: ['property', 'lot', 'building'] },
  { key: 'target_id', label: 'Target ID (e.g. LP-PX-A1, LP-PX-L1, LBP-PX-A1)', type: 'text' },
  { key: 'market_value', label: 'Market Value', type: 'number' },
  { key: 'assessed_value', label: 'Assessed Value', type: 'number' },
  { key: 'remarks', label: 'Remarks' }
];

import { useSearchParams } from 'react-router-dom';

export const PropertyAssessments: React.FC = () => {
  const { showSuccess, showError, showConfirm } = useModal();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [pendingAssessments, setPendingAssessments] = useState<Assessment[]>([]);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  const [query, setQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [searchParams] = useSearchParams();
  const filterStatus = searchParams.get('status');

  const load = async () => {
    try {
      await ensureSession();
      const profileRes = await api.get('/profile');
      setUserRole(profileRes.data.role);

      if (['admin', 'super_admin'].includes(profileRes.data.role)) {
        const pendingRes = await api.get('/assessments/pending');
        setPendingAssessments(pendingRes.data.properties || []);
      }
      
      const { data } = await api.get('/assessments');
      setAssessments(data);
    } catch {
      showError('Unable to load assessments.');
    }
  };

  useEffect(() => { load(); }, []);

  const displayedAssessments = useMemo(() => assessments.filter(a => {
    if (filterStatus && a.assessment_status !== filterStatus) return false;
    if (query && !String(a.target_id).toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [assessments, query, filterStatus]);
  
  const displayedPending = useMemo(() => pendingAssessments.filter(a => !query || String(a.target_id).toLowerCase().includes(query.toLowerCase())), [pendingAssessments, query]);

  const save = async (values: Record<string, string>) => {
    if ((modal?.mode === 'create' && !values.type) || !values.target_id || !values.market_value || !values.assessed_value) {
      showError('Unable to save assessment. Please check the required information.');
      return;
    }

    try {
      await ensureSession();
      if (modal?.mode === 'create') {
        const payload = { ...values, assessor_level: 20, assessment_date: new Date().toISOString().split('T')[0] };
        await api.post('/assessments', payload);
        showSuccess('Assessment saved successfully.');
      } else if (modal?.record) {
        await api.put(`/assessments/${modal.record.type}/${modal.record.assessment_id}`, values);
        showSuccess('Assessment saved successfully.');
      }
      setModal(null);
      await load();
    } catch {
      showError('Unable to save assessment. Please check the required information.');
    }
  };

  const submitForReview = async (record: Assessment) => {
    showConfirm(`Submit ${record.type} assessment for ${record.target_id} for review?`, async () => {
      try {
        await ensureSession();
        await api.post(`/assessments/${record.type}/${record.target_id}/submit`);
        showSuccess('Assessment submitted to Admin for review.');
        await load();
      } catch (e: any) {
        showError(e.response?.data?.message || 'Failed to submit assessment.');
      }
    });
  };

  const handleReview = async (record: Assessment, status: 'approved' | 'rejected' | 'returned') => {
    let reason = '';
    if (status === 'rejected' || status === 'returned') {
      const promptText = status === 'rejected' ? 'Please provide the reason for rejecting this assessment:' : 'Please provide a correction note for returning this assessment:';
      const input = prompt(promptText);
      if (input === null) return;
      if (!input.trim()) {
        showError(`A reason or note is required to ${status} an assessment.`);
        return;
      }
      reason = input.trim();
    }

    showConfirm(`Are you sure you want to ${status} this assessment?`, async () => {
      try {
        await ensureSession();
        await api.post(`/assessments/${record.type}/${record.target_id}/review`, { status, reason });
        showSuccess(`Assessment successfully ${status}.`);
        await load();
      } catch (e: any) {
        showError(e.response?.data?.message || `Failed to ${status} assessment.`);
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">Approved</span>;
      case 'submitted': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">Pending Review</span>;
      case 'returned': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">Returned for Correction</span>;
      case 'rejected': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">Rejected</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold uppercase">Draft</span>;
    }
  };

  const columns = [
    { key: 'target_id', label: 'Target ID', render: (_: any, row: Assessment) => <div className="flex flex-col"><span className="font-medium text-gray-900">{row.target_id}</span><span className="text-xs text-gray-500 uppercase">{row.type}</span></div> },
    { key: 'assessor', label: 'Assessor', render: (_: any, row: any) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || `ID: ${row.assessor_user_id}` },
    { key: 'market_value', label: 'Market Value', render: (val: number) => `₱${Number(val).toLocaleString()}` },
    { key: 'assessed_value', label: 'Assessed Value', render: (val: number) => `₱${Number(val).toLocaleString()}` },
    { key: 'assessment_status', label: 'Status', render: (val: string) => getStatusBadge(val) },
    { key: 'assessment_date', label: 'Date', render: (val: string) => new Date(val).toLocaleDateString() }
  ];

  const adminPendingColumns = [
    { key: 'target_id', label: 'Target ID', render: (_: any, row: Assessment) => <div className="flex flex-col"><span className="font-medium text-gray-900">{row.target_id}</span><span className="text-xs text-gray-500 uppercase">{row.type}</span></div> },
    { key: 'assessor', label: 'Assessor', render: (_: any, row: any) => `${row.first_name || ''} ${row.last_name || ''}`.trim() },
    { key: 'assessed_value', label: 'Assessed Value', render: (val: number) => `₱${Number(val).toLocaleString()}` },
    { key: 'assessment_date', label: 'Date Submitted', render: (val: string) => new Date(val).toLocaleDateString() },
    {
      key: 'actions', label: 'Review Action', render: (_: any, row: Assessment) => (
        <div className="flex gap-2">
          <button onClick={() => setModal({ mode: 'view', record: row })} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 font-medium">View</button>
          <button onClick={() => handleReview(row, 'approved')} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 font-medium">Approve</button>
          <button onClick={() => handleReview(row, 'rejected')} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 font-medium">Reject</button>
          <button onClick={() => handleReview(row, 'returned')} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 font-medium">Return</button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Assessment Approvals</h1>
          <p className="text-gray-500 mt-2">Manage property valuation workflows.</p>
        </div>
        {['assessor'].includes(userRole) && (
          <button onClick={() => setModal({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow">
            <Plus size={18} />
            New Assessment Draft
          </button>
        )}
      </div>

      <div className="glass-panel p-4 rounded-xl">
        <input type="text" placeholder="Search by Target ID (e.g. LP-P1-A1)..." value={query} onChange={e => setQuery(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:border-gray-700" />
      </div>

      {['admin', 'super_admin'].includes(userRole) && (
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-lg font-bold mb-4 text-green-600 flex items-center gap-2">Requires Head Assessor Review</h2>
          {displayedPending.length > 0 ? (
            <DataTable columns={adminPendingColumns} data={displayedPending} />
          ) : (
            <p className="text-gray-500 text-sm">No assessments are currently pending review.</p>
          )}
        </div>
      )}

      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-lg font-bold mb-4">{['assessor'].includes(userRole) ? 'My Assessments' : 'All Assessments Database'}</h2>
        <DataTable
          columns={columns}
          data={displayedAssessments}
          onView={(record) => setModal({ mode: 'view', record })}
          onEdit={(['assessor'].includes(userRole)) ? (record) => {
            if (record.assessment_status === 'approved' || record.assessment_status === 'submitted') {
              showError(`Cannot edit a ${record.assessment_status} assessment.`);
              return;
            }
            setModal({ mode: 'edit', record });
          } : undefined}
          showActions={true}
          customActions={(record) => {
            if (['assessor'].includes(userRole) && (record.assessment_status === 'draft' || record.assessment_status === 'returned')) {
              return (
                <button onClick={() => submitForReview(record)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Submit for Review">
                  <Send size={18} />
                </button>
              );
            }
            return null;
          }}
        />
      </div>

      {modal && <CrudModal title={`${modal.mode === 'create' ? 'Draft' : modal.mode === 'edit' ? 'Edit' : 'View'} Assessment`} fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
};
