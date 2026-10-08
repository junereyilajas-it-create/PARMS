import React, { useEffect, useState } from 'react';
import { DataTable } from '../components/common/DataTable';
import api, { ensureSession } from '../lib/api';
import { useModal } from '../contexts/ModalContext';

type PermissionRequest = {
  request_id: number;
  property_type: string;
  target_id_str: string;
  target_id_int: number;
  first_name: string;
  last_name: string;
  reason: string;
  request_status: string;
  created_at: string;
};

export const AssessmentPermissionRequests: React.FC = () => {
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const { showSuccess, showError, showConfirm } = useModal();
  const [userRole, setUserRole] = useState('');

  const load = async () => {
    try {
      await ensureSession();
      const profile = await api.get('/profile');
      setUserRole(profile.data.role);
      const { data } = await api.get('/assessments/requests');
      setRequests(data);
    } catch (e: any) {
      console.error('Error loading requests:', e);
      showError('Unable to load permission requests.');
    }
  };

  useEffect(() => { load(); }, []);

  const approveRequest = async (id: number) => {
    showConfirm('Approve this request and assign the property to the assessor?', async () => {
      try {
        await api.post(`/assessments/requests/${id}/approve`);
        showSuccess('Request approved successfully.');
        load();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to approve request.');
      }
    });
  };

  const rejectRequest = async (id: number) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      await api.post(`/assessments/requests/${id}/reject`, { reason });
      showSuccess('Request rejected.');
      load();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to reject request.');
    }
  };

  const getStatusBadge = (status: string) => {
    const s = String(status).toUpperCase();
    const style = s === 'APPROVED' ? 'bg-green-100 text-green-800' 
                : s === 'PENDING' ? 'bg-green-100 text-green-800'
                : s === 'REJECTED' ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>{status}</span>;
  };

  const columns = [
    { key: 'request_id', label: 'REQUEST ID' },
    { key: 'target_id_str', label: 'PROPERTY ID' },
    { key: 'property_type', label: 'TYPE', render: (v: string) => v.toUpperCase() },
    { key: 'first_name', label: 'ASSESSOR', render: (_: any, r: any) => `${r.first_name} ${r.last_name}` },
    { key: 'reason', label: 'REASON' },
    { key: 'request_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) },
    { key: 'created_at', label: 'DATE', render: (v: string) => new Date(v).toLocaleDateString() }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Assessment Permission Requests</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Review requests from assessors to access unassigned properties.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <DataTable 
          columns={columns} 
          data={requests} 
          onView={() => {}} 
          showActions={['admin', 'super_admin'].includes(userRole)}
          customActions={['admin', 'super_admin'].includes(userRole) ? (record) => (
            record.request_status === 'pending' ? (
              <div className="flex gap-2">
                <button onClick={() => approveRequest(record.request_id)} className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">Approve</button>
                <button onClick={() => rejectRequest(record.request_id)} className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">Reject</button>
              </div>
            ) : null
          ) : undefined}
        />
      </div>
    </div>
  );
};
