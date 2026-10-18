import { useEffect, useMemo, useState } from 'react'
import { Filter, Search, Plus, UserCheck } from 'lucide-react'
import { DataTable } from '../components/common/DataTable'
import { MetricCard } from '../components/common/MetricCard'
import { CrudModal, type CrudField } from '../components/common/CrudModal'
import { LotRegistrationModal } from '../components/common/LotRegistrationModal'
import { AddPropertyWorkflow, type UnifiedPropertyRegistration } from '../components/common/AddPropertyWorkflow'
import { AssignAssessorModal, type SelectedPropertyAssignment } from '../components/common/AssignAssessorModal'
import { useModal } from '../contexts/ModalContext'
import api, { ensureSession } from '../lib/api'

type Lot = { 
  lot_id: number; 
  property_id: number; 
  lot_number: string; 
  location: string; 
  purok: string; 
  barangay: string; 
  municipality: string; 
  province: string; 
  lot_area: number; 
  classification_name: string; 
  property_type: string; 
  owner: string; 
  lot_status: string; 
  has_pending_changes?: number;
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
const fields: CrudField[] = [{ key: 'property_id', label: 'Property ID', type: 'number' }, { key: 'lot_number', label: 'Lot ID' }, { key: 'title_number', label: 'Title number' }, { key: 'purok', label: 'Purok' }, { key: 'barangay', label: 'Barangay' }, { key: 'municipality', label: 'Municipality' }, { key: 'province', label: 'Province' }, { key: 'lot_area', label: 'Area (sqm)', type: 'number' }, { key: 'latitude', label: 'Latitude', type: 'number' }, { key: 'longitude', label: 'Longitude', type: 'number' }, { key: 'lot_status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] }]

export function PropertyLotManagement() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [internalSearch, setInternalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lots, setLots] = useState<Lot[]>([]);
  const [filters, setFilters] = useState({ barangay: '', classification: '', propertyType: '', status: '' });
  const [modal, setModal] = useState<{ mode: 'edit' | 'view'; record?: Lot } | null>(null);
  const [showAddProperty, setShowAddProperty] = useState(() => {
    return new URLSearchParams(window.location.search).get('add') === 'true';
  });
  const [userRole, setUserRole] = useState(() => localStorage.getItem('accessor_role') || '');
  const [assignmentProperty, setAssignmentProperty] = useState<SelectedPropertyAssignment | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(internalSearch), 300);
    return () => clearTimeout(timer);
  }, [internalSearch]);
  const load = async () => { try { await ensureSession(); const profileRes = await api.get('/profile'); setUserRole(profileRes.data.role); const { data } = await api.get('/property-records'); setLots(data.filter((row: Lot) => row.lot_id)) } catch { showError('Unable to load database records. Start MySQL and the API server, then import backend/database.sql.') } }
  useEffect(() => { load() }, [])

  const displayedLots = useMemo(() => lots.filter(lot => {
    const searchMatch = !debouncedSearch || `${lot.lot_number} ${lot.property_id} ${lot.owner} ${lot.barangay} ${lot.purok} ${lot.classification_name}`.toLowerCase().includes(debouncedSearch.toLowerCase());
    const barangayMatch = !filters.barangay || (lot.barangay && lot.barangay.toLowerCase() === filters.barangay.toLowerCase());
    const classificationMatch = !filters.classification || (lot.classification_name && lot.classification_name.toLowerCase() === filters.classification.toLowerCase());
    const typeMatch = !filters.propertyType || (lot.property_type && lot.property_type.toLowerCase() === filters.propertyType.toLowerCase());
    const statusMatch = !filters.status || lot.lot_status === filters.status;
    return searchMatch && barangayMatch && classificationMatch && typeMatch && statusMatch;
  }), [lots, filters, debouncedSearch])

  const updateLot = async (values: Record<string, string>) => { try { await ensureSession(); if (modal?.record) await api.put(`/lots/${modal.record.lot_id}`, values); setModal(null); await load(); showSuccess(`Lot was successfully updated.`); } catch { showError('Unable to save the lot. Check required IDs and database constraints.'); throw new Error('Lot could not be updated') } }
  const createProperty = async (values: UnifiedPropertyRegistration) => {
    try {
      await ensureSession();
      const { data } = await api.post('/properties/unified', values);
      await load();
      setShowAddProperty(false);
      showSuccess(`Property Created Successfully. Property ID: ${data.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unable to save property. Please check the required information and try again.';
      showError(msg);
      throw new Error(msg);
    }
  };
  const remove = async (record: Lot) => { showConfirm(`Delete ${record.lot_number}?`, async () => { try { await ensureSession(); await api.delete(`/lots/${record.lot_id}`); await load(); showSuccess(`Lot ${record.lot_number} was successfully deleted from the database.`) } catch { showError('This lot cannot be deleted while it has related records.') } }) }

  const handleRequestPermission = async (record: Lot) => {
    const reason = prompt('Please enter the reason for requesting permission to assess this lot:');
    if (reason === null) return;
    if (!reason.trim()) {
      showError('A reason is required to request permission.');
      return;
    }
    try {
      await ensureSession();
      await api.post('/assessments/requests', {
        property_type: 'lot',
        target_id_int: record.lot_id,
        target_id_str: `LOT-${record.lot_id}`,
        reason: reason.trim()
      });
      showSuccess('Permission request submitted successfully.');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to submit permission request.');
    }
  };

  const handleRowClick = (record: Lot) => {
    if (!['admin', 'super_admin'].includes(userRole)) return;
    setAssignmentProperty({
      property_id: record.property_id,
      target_id_int: record.lot_id,
      target_id_str: record.lot_number || `LOT-${record.lot_id}`,
      property_type: 'lot',
      owner: record.owner,
      location: record.location,
      purok: record.purok,
      barangay: record.barangay,
      lot_area: record.lot_area,
      status: record.lot_status,
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
    const s = String(status).toUpperCase();
    const isPendingChanges = has_pending_changes ? true : false;
    const style = (s === 'ACTIVE' || s === 'APPROVED') && !isPendingChanges ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : (s === 'PENDING' || isPendingChanges) ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    let label = status;
    if (s === 'PENDING') label = 'Pending Admin Approval';
    if (s === 'ACTIVE') label = 'Approved';
    if (isPendingChanges) label = 'Pending Changes';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>{label}</span>;
  };

  const getAssessmentBadge = (record: Lot) => {
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
    if (record.assessment_status === 'approved') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
          Assessed
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
        Pending Assessment
      </span>
    );
  };

  const columns = [
    { key: 'lot_number', label: 'LOT ID' },
    { key: 'property_id', label: 'PROPERTY ID' },
    { key: 'owner', label: 'OWNER' },
    { key: 'barangay', label: 'BARANGAY' },
    { key: 'purok', label: 'PUROK' },
    { key: 'classification_name', label: 'CLASSIFICATION' },
    { key: 'property_type', label: 'TYPE/USE' },
    { key: 'lot_area', label: 'AREA (SQM)', render: (value: number) => Number(value).toFixed(2) },
    { key: 'lot_status', label: 'PROPERTY STATUS', render: (v: string, record: Lot) => getStatusBadge(v, record.has_pending_changes) },
    { key: 'assessment_status', label: 'ASSESSMENT STATUS', render: (_: any, record: Lot) => getAssessmentBadge(record) }
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lots</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage all registered lot properties.</p>
        </div>
        {['admin', 'staff', 'super_admin'].includes(userRole) && (
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
            placeholder="Search lots by ID, owner, barangay..."
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
            value={filters.classification}
            onChange={(e) => setFilters(f => ({ ...f, classification: e.target.value }))}
            className="bg-transparent border-none text-sm outline-none w-36 dark:text-white"
          >
            <option value="">All Classifications</option>
            <option value="Residential Lot">Residential</option>
            <option value="Commercial Lot">Commercial</option>
            <option value="Agricultural Land">Agricultural</option>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Total Lots" value={lots.length.toLocaleString()} trend={{ value: 0, isPositive: true, label: 'overall' }} />
        <MetricCard title="Active Lots" value={lots.filter(l => l.lot_status === 'active').length.toLocaleString()} trend={{ value: 0, isPositive: true, label: 'completed' }} />
        <MetricCard title="Pending Lots" value={lots.filter(l => l.lot_status === 'pending').length.toLocaleString()} trend={{ value: 0, isPositive: false, label: 'pending' }} />
      </div>

      {['admin', 'super_admin'].includes(userRole) && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/60 rounded-xl flex items-center justify-between text-xs text-green-800 dark:text-green-300">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-green-600 dark:text-green-400 shrink-0" />
            <span>
              <strong>Quick Assessment Assignment:</strong> Left-click any lot row below to automatically select it and open the Assign Assessor modal.
            </span>
          </div>
        </div>
      )}

      {displayedLots.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No lots found.</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">There are no lots matching your search criteria.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={displayedLots}
          onView={record => setModal({ mode: 'view', record })}
          onEdit={record => setModal({ mode: 'edit', record })}
          onDelete={remove}
          onRowClick={['admin', 'super_admin'].includes(userRole) ? handleRowClick : undefined}
          userRole={userRole}
          customActions={userRole === 'assessor' ? (record) => (
            <button
              onClick={(e) => { e.stopPropagation(); handleRequestPermission(record); }}
              className="flex items-center gap-1 text-green-600 hover:text-green-800 transition text-sm font-medium"
              title="Request Permission to Assess"
            >
              <Plus size={18} /> Request Permission
            </button>
          ) : undefined}
        />
      )}

      {modal?.mode === 'view' && <CrudModal title="Lot Record" fields={fields} record={modal.record} readOnly onClose={() => setModal(null)} onSave={updateLot} />}
      {modal?.mode === 'edit' && modal.record && <LotRegistrationModal title="Edit Property Lot" initialValues={modal.record} close={() => setModal(null)} onSave={updateLot} />}
      {showAddProperty && (
        <AddPropertyWorkflow
          close={() => setShowAddProperty(false)}
          onSave={createProperty}
          initialType="LOT"
        />
      )}

      {/* Assign Assessor Modal */}
      <AssignAssessorModal
        isOpen={Boolean(assignmentProperty)}
        onClose={() => setAssignmentProperty(null)}
        property={assignmentProperty}
        onSuccess={load}
      />
    </div>
  )
}
