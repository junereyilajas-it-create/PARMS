import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import api, { ensureSession } from '../lib/api';
import { useModal } from '../contexts/ModalContext';

type Assignment = {
  assignment_id: number;
  property_type: string;
  target_id_str: string;
  target_id_int: number;
  assessor_first_name: string;
  assessor_last_name: string;
  assignment_status: string;
  due_date: string;
  owner?: string; // We might need to fetch owner details, or they are passed down
};

export const AssessmentAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const { showSuccess, showError, showConfirm } = useModal();

  const load = async () => {
    try {
      await ensureSession();
      const { data } = await api.get('/assessments/assignments');
      setAssignments(data);
    } catch {
      showError('Unable to load assignments.');
    }
  };

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    showConfirm('Are you sure you want to assign this property to this Assessor?', async () => {
      try {
        await api.post('/assessments/assign', data);
        showSuccess('Assessment assigned successfully.');
        setShowAssignModal(false);
        load();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to assign assessment.');
      }
    });
  };

  const handleReassign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    
    const formData = new FormData(e.currentTarget);
    const reason = formData.get('reason');
    const new_assessor_id = formData.get('new_assessor_id');
    
    showConfirm(`Reassign ${selectedAssignment.target_id_str} to Assessor ${new_assessor_id}?`, async () => {
      try {
        await api.put(`/assessments/assignments/${selectedAssignment.assignment_id}/reassign`, {
          new_assessor_id: Number(new_assessor_id),
          reason
        });
        showSuccess('Assessment reassigned successfully.');
        setShowReassignModal(false);
        load();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Failed to reassign assessment.');
      }
    });
  };

  useEffect(() => { load(); }, []);

  const getStatusBadge = (status: string) => {
    const s = String(status).toUpperCase();
    const style = s === 'APPROVED' ? 'bg-green-100 text-green-800' 
                : s === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' 
                : s === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' 
                : s === 'PENDING' || s === 'SUBMITTED' ? 'bg-amber-100 text-amber-800'
                : s === 'RETURNED' ? 'bg-orange-100 text-orange-800'
                : s === 'REJECTED' || s === 'CANCELLED' ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>{status}</span>;
  };

  const columns = [
    { key: 'assignment_id', label: 'ASSIGNMENT ID' },
    { key: 'target_id_str', label: 'PROPERTY ID' },
    { key: 'property_type', label: 'TYPE', render: (v: string) => v.toUpperCase() },
    { key: 'assessor_first_name', label: 'ASSESSOR', render: (_: any, r: any) => `${r.assessor_first_name} ${r.assessor_last_name}` },
    { key: 'assignment_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) },
    { key: 'due_date', label: 'DUE DATE', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'actions', label: 'ACTIONS', render: (_: any, row: Assignment) => (
      <button 
        onClick={() => {
          setSelectedAssignment(row);
          setShowReassignModal(true);
        }}
        className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200"
      >
        Reassign
      </button>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Assessment Assignments</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage assessor assignments for properties.</p>
        </div>
        <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
          <Plus size={18} /> Assign Assessment
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <DataTable 
          columns={columns} 
          data={assignments} 
          onView={() => {}} 
          showActions={true} 
        />
      </div>
      {/* Modals */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Assign Assessment</h2>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property Type</label>
                <select name="property_type" required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <option value="lot">Lot</option>
                  <option value="building">Building</option>
                  <option value="property">Unified Property</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target ID Int (Numeric ID)</label>
                <input name="target_id_int" type="number" required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target ID String (e.g., LBP-P5-A1)</label>
                <input name="target_id_str" type="text" required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assessor User ID</label>
                <input name="assigned_to_user_id" type="number" required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowAssignModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="submit" className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReassignModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Reassign Assessment</h2>
            <form onSubmit={handleReassign} className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Reassigning Property: <span className="font-bold">{selectedAssignment.target_id_str}</span></p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Assessor User ID</label>
                <input name="new_assessor_id" type="number" required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <textarea name="reason" required rows={3} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowReassignModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="submit" className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700">Reassign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
