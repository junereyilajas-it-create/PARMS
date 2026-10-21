import React, { useEffect, useState, useMemo } from 'react';
import { Filter, Search, Plus, UserCheck, FileCheck, Edit3 } from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { AddPropertyWorkflow, type UnifiedPropertyRegistration } from '../components/common/AddPropertyWorkflow';
import { AssignAssessorModal, type SelectedPropertyAssignment } from '../components/common/AssignAssessorModal';
import { AssessmentSubmissionModal, type AssessmentTarget } from '../components/common/AssessmentSubmissionModal';
import { useModal } from '../contexts/ModalContext';
import api, { ensureSession } from '../lib/api';

export const BuildingDirectory: React.FC = () => {
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  const [showAddProperty, setShowAddProperty] = useState(() => {
    return new URLSearchParams(window.location.search).get('add') === 'true';
  });
  const [filters, setFilters] = useState({ barangay: '', type: '', status: '', assessment: '' });
  const [internalSearch, setInternalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { showSuccess, showError, showConfirm } = useModal();
  const [buildingData, setBuildingData] = useState<any[]>([]);
  const [userRole, setUserRole] = useState(() => localStorage.getItem('accessor_role') || '');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [assignmentProperty, setAssignmentProperty] = useState<SelectedPropertyAssignment | null>(null);
  const [assessmentTarget, setAssessmentTarget] = useState<AssessmentTarget | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(internalSearch), 300);
    return () => clearTimeout(timer);
  }, [internalSearch]);

  const fields: CrudField[] = [
    { key: 'property_id', label: 'Property ID', type: 'number' },
    { key: 'building_name', label: 'Building name' },
    { key: 'building_type', label: 'Type' },
    { key: 'floor_area', label: 'Floor area', type: 'number' },
    { key: 'floor_count', label: 'Floors', type: 'number' },
    { key: 'construction_type', label: 'Construction type' },
    { key: 'year_constructed', label: 'Year built', type: 'number' },
    { key: 'market_value', label: 'Market value', type: 'number' },
    { key: 'assessed_value', label: 'Assessed value', type: 'number' },
    { key: 'building_status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] }
  ];

  const load = async () => {
    try {
      await ensureSession();
      const profileRes = await api.get('/profile');
      setUserRole(profileRes.data.role);
      setCurrentUser(profileRes.data);
      const { data } = await api.get('/buildings');
      setBuildingData(data);
    } catch {
      showError('Unable to load building records from the database.')
    }
  };

  useEffect(() => { load() }, []);

  const displayedBuildings = useMemo(() => buildingData.filter(b => {
    const searchMatch = !debouncedSearch || `${b.building_id} ${b.property_id} ${b.owner} ${b.barangay} ${b.purok} ${b.building_type}`.toLowerCase().includes(debouncedSearch.toLowerCase());
    const barangayMatch = !filters.barangay || (b.barangay && b.barangay.toLowerCase() === filters.barangay.toLowerCase());
    const typeMatch = !filters.type || (b.building_type && b.building_type.toLowerCase() === filters.type.toLowerCase());
    const statusMatch = !filters.status || b.building_status === filters.status;

    let assessMatch = true;
    if (filters.assessment === 'assessed') assessMatch = b.assessment_status === 'approved';
    if (filters.assessment === 'unassessed') assessMatch = b.assessment_status !== 'approved';

    return searchMatch && barangayMatch && typeMatch && statusMatch && assessMatch;
  }), [buildingData, debouncedSearch, filters]);

  const save = async (values: Record<string, string>) => {
    try {
      await ensureSession();
      if (modal?.mode === 'create') await api.post('/buildings', values);
      else if (modal?.record) await api.put(`/buildings/${modal.record.building_id}`, values);
      setModal(null);
      await load();
      showSuccess('Building saved successfully.');
    } catch {
      showError('Unable to save the building. Check required property IDs and values.')
    }
  };

  const createProperty = async (values: UnifiedPropertyRegistration) => {
    try {
      await ensureSession();
      const { data } = await api.post('/properties/unified', values);
      await load();
      setShowAddProperty(false);
      showSuccess(`Property Created Successfully. Property ID: ${data.id}${data.buildingId ? ` Building ID: ${data.buildingId}` : ''}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unable to save property. Please check the required information and try again.';
      showError(msg);
      throw new Error(msg);
    }
  };

  const remove = async (record: any) => {
    showConfirm(`Delete this building property?`, async () => {
      try {
        await ensureSession();
        await api.delete(`/buildings/${record.building_id}`);
        await load();
        showSuccess(`Building deleted successfully.`)
      } catch {
        showError('This building cannot be deleted while it has related records.')
      }
    })
  }

  const handleRequestPermission = async (record: any) => {
    const reason = prompt('Please enter the reason for requesting permission to assess this building:');
    if (reason === null) return;
    if (!reason.trim()) {
      showError('A reason is required to request permission.');
      return;
    }
    try {
      await ensureSession();
      await api.post('/assessments/requests', {
        property_type: 'building',
        target_id_int: record.building_id,
        target_id_str: `BLDG-${record.building_id}`,
        reason: reason.trim()
      });
      showSuccess('Permission request submitted successfully.');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to submit permission request.');
    }
  };

  // Handler when Admin/Head Assessor clicks any building row to assign/reassign assessor
  const handleRowClick = (record: any) => {
    if (!['admin', 'super_admin'].includes(userRole)) return;
    setAssignmentProperty({
      property_id: record.property_id,
      target_id_int: record.building_id,
      target_id_str: record.building_name || `BLDG-${record.building_id}`,
      property_type: 'building',
      owner: record.owner,
      location: `${record.purok ? record.purok + ', ' : ''}${record.barangay || ''}`,
      purok: record.purok,
      barangay: record.barangay,
      building_type: record.building_type,
      floor_area: record.floor_area,
      status: record.building_status,
      assessment_status: record.active_assignment_status || record.assessment_status,
      active_assignment_id: record.active_assignment_id,
      assigned_assessor_id: record.assigned_assessor_id,
      assigned_assessor_name: record.assigned_assessor_name,
      assigned_assessor_username: record.assigned_assessor_username,
      assigned_assessor_email: record.assigned_assessor_email,
      active_assignment_status: record.active_assignment_status,
      assignment_due_date: record.assignment_due_date,
      assignment_instructions: record.assignment_instructions,
    });
  };

  const getStatusBadge = (status: string, has_pending_changes?: number) => {
    if (!status) return null;
    const s = String(status).toUpperCase();
    const isPendingChanges = has_pending_changes ? true : false;
    if (s === 'SUBMITTED' || s === 'PENDING REVIEW' || s === 'PENDING_REVIEW') {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Pending Review</span>;
    }
    if (s === 'RETURNED' || s === 'RETURNED_FOR_CORRECTION') {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Returned for Correction</span>;
    }
    const style = (s === 'ACTIVE' || s === 'APPROVED' || s === 'ASSESSED') && !isPendingChanges ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : (s.includes('PENDING') || isPendingChanges) ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    let label = status;
    if (s === 'PENDING') label = 'Pending Admin Approval';
    if (s === 'ACTIVE') label = 'Approved';
    if (isPendingChanges) label = 'Pending Changes';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>{label}</span>;
  };

  const columns = [
    { key: 'building_id', label: 'BUILDING ID' },
    { key: 'property_id', label: 'PROPERTY ID' },
    { key: 'owner', label: 'OWNER' },
    { key: 'barangay', label: 'BARANGAY' },
    { key: 'purok', label: 'PUROK' },
    { key: 'building_type', label: 'TYPE' },
    { key: 'building_use', label: 'USE', render: (v: string) => v ? v : '-' },
    { key: 'building_status', label: 'PROPERTY STATUS', render: (v: string, record: any) => getStatusBadge(v, record.has_pending_changes) },
    { 
      key: 'assessment_status', 
      label: 'ASSESSMENT STATUS', 
      render: (_: any, record: any) => {
        if (record.assessment_status === 'submitted') {
          return getStatusBadge('submitted');
        }
        if (record.assessment_status === 'returned') {
          return getStatusBadge('returned');
        }
        if (record.assessment_status === 'approved') {
          return getStatusBadge('Assessed');
        }
        if (record.assigned_assessor_name) {
          return (
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              title={`Assigned to ${record.assigned_assessor_name}`}
            >
              <UserCheck size={12} className="shrink-0" />
              Assigned: {record.assigned_assessor_name}
            </span>
          );
        }
        return getStatusBadge('Pending Assessment');
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {userRole === 'assessor' ? 'Assigned Properties' : 'Buildings'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {userRole === 'assessor' 
              ? 'Manage your assigned properties, conduct assessments, and submit for review.' 
              : 'Manage structural assets and linked properties.'}
          </p>
        </div>
        {['admin', 'staff'].includes(userRole) && (
          <button id="add-property-btn" onClick={() => setShowAddProperty(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm cursor-pointer">
            <Plus size={18} /> Add Property
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-center flex-wrap">
        <div className="flex-1 min-w-[250px] flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 dark:focus-within:border-green-500 transition-all">
          <Search size={18} className="text-gray-500" />
          <input
            type="text"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            placeholder="Search buildings by ID, owner, barangay..."
            className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          {internalSearch && (
            <button onClick={() => setInternalSearch('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              &times;
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
          <Filter size={18} className="text-gray-500" />
          <select
            value={filters.barangay}
            onChange={(e) => setFilters(f => ({ ...f, barangay: e.target.value }))}
            className="bg-transparent border-none text-sm outline-none w-32 dark:text-white"
          >
            <option value="">All Barangays</option>
            {['Banglay', 'Dampil', 'Gaston', 'Kabulawan', 'Kauswagan', 'Lumbo', 'Manaol', 'Poblacion', 'Tabok', 'Umagos'].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="bg-transparent border-none text-sm outline-none w-32 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
          <select
            value={filters.assessment}
            onChange={(e) => setFilters(f => ({ ...f, assessment: e.target.value }))}
            className="bg-transparent border-none text-sm outline-none w-36 dark:text-white"
          >
            <option value="">Assessment Status</option>
            <option value="assessed">Assessed</option>
            <option value="unassessed">Unassessed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Total Buildings" value={buildingData.length.toLocaleString()} trend={{ value: 0, isPositive: true, label: 'overall' }} />
        <MetricCard title="Assessed Buildings" value={buildingData.filter(b => b.assessment_status === 'approved').length.toLocaleString()} trend={{ value: 0, isPositive: true, label: 'completed' }} />
        <MetricCard title="Unassessed Buildings" value={(buildingData.length - buildingData.filter(b => b.assessment_status === 'approved').length).toLocaleString()} trend={{ value: 0, isPositive: false, label: 'pending' }} />
      </div>

      {['admin', 'super_admin'].includes(userRole) && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/60 rounded-xl flex items-center justify-between text-xs text-green-800 dark:text-green-300">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-green-600 dark:text-green-400 shrink-0" />
            <span>
              <strong>Quick Assessment Assignment:</strong> Left-click any building row below to automatically select it and open the Assign Assessor modal.
            </span>
          </div>
        </div>
      )}

      {displayedBuildings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No buildings found.</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">There are no buildings matching your search criteria.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={displayedBuildings}
          onView={record => setModal({ mode: 'view', record })}
          onEdit={['admin', 'staff'].includes(userRole) ? (record => setModal({ mode: 'edit', record })) : undefined}
          onDelete={['admin', 'super_admin'].includes(userRole) ? remove : undefined} 
          onRowClick={['admin', 'super_admin'].includes(userRole) ? handleRowClick : undefined}
          userRole={userRole}
          customActions={userRole === 'assessor' ? (record) => {
            const currentId = currentUser?.id || currentUser?.user_id;
            const isAssignedToMe = (record.assigned_assessor_id && currentId && Number(record.assigned_assessor_id) === Number(currentId)) || 
                                   (record.assigned_assessor_username && currentUser?.username && record.assigned_assessor_username === currentUser.username);
            const isPermitted = Boolean(record.is_permitted_for_user);
            const isAuthorized = isAssignedToMe || isPermitted;

            if (isAuthorized) {
              if (record.assessment_status === 'submitted') {
                return (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Pending Review
                  </span>
                );
              }
              if (record.assessment_status === 'approved') {
                return (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                    Approved
                  </span>
                );
              }
              if (record.assessment_status === 'returned') {
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssessmentTarget({
                        type: 'building',
                        target_id: record.building_id,
                        property_id: record.property_id,
                        owner_name: record.owner,
                        market_value: record.market_value,
                        assessed_value: record.assessed_value,
                        remarks: '',
                        property_photo: record.property_photo,
                        rejection_reason: record.rejection_reason,
                        assessment_id: record.building_assessment_history_id,
                        assessment_status: 'returned'
                      });
                    }}
                    id={`update-assessment-btn-${record.building_id}`}
                    data-testid={`update-assessment-btn-${record.building_id}`}
                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium transition shadow-sm"
                    title="Update returned assessment"
                  >
                    <Edit3 size={14} /> Update Assessment
                  </button>
                );
              }
              return (
                <button
                  id={`assess-property-btn-${record.building_id}`}
                  data-testid={`assess-property-btn-${record.building_id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssessmentTarget({
                      type: 'building',
                      target_id: record.building_id,
                      property_id: record.property_id,
                      owner_name: record.owner,
                      market_value: record.market_value || '',
                      assessed_value: record.assessed_value || '',
                      remarks: '',
                      property_photo: record.property_photo,
                      assessment_id: record.building_assessment_history_id,
                      assessment_status: record.assessment_status || 'assigned'
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold transition shadow-sm"
                  title="Conduct Assessment"
                >
                  <FileCheck size={14} /> Assess Property
                </button>
              );
            }

            return (
              <button
                id={`request-permission-btn-${record.building_id}`}
                data-testid={`request-permission-btn-${record.building_id}`}
                onClick={(e) => { e.stopPropagation(); handleRequestPermission(record); }}
                className="flex items-center gap-1 text-green-600 hover:text-green-800 transition text-sm font-medium"
                title="Request Permission to Assess"
              >
                <Plus size={18} /> Request Permission
              </button>
            );
          } : undefined}
        />
      )}

      {modal && <CrudModal title="Building Record" fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}
      {showAddProperty && userRole !== 'super_admin' && (
        <AddPropertyWorkflow
          close={() => setShowAddProperty(false)}
          onSave={createProperty}
          initialType="BUILDING"
        />
      )}

      {/* Assign Assessor Modal */}
      <AssignAssessorModal
        isOpen={Boolean(assignmentProperty)}
        onClose={() => setAssignmentProperty(null)}
        property={assignmentProperty}
        onSuccess={load}
      />

      {/* Assessment Submission Modal for Assessors */}
      <AssessmentSubmissionModal
        isOpen={Boolean(assessmentTarget)}
        onClose={() => setAssessmentTarget(null)}
        target={assessmentTarget}
        onSuccess={load}
      />
    </div>
  );
};
