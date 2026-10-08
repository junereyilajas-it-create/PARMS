import React, { useEffect, useState, useMemo } from 'react';
import { Filter, Search, Plus } from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { AddPropertyWorkflow, type UnifiedPropertyRegistration } from '../components/common/AddPropertyWorkflow';
import { useModal } from '../contexts/ModalContext';
import api, { ensureSession } from '../lib/api';

export const BuildingDirectory: React.FC = () => {
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [filters, setFilters] = useState({ barangay: '', type: '', status: '', assessment: '' });
  const [internalSearch, setInternalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { showSuccess, showError, showConfirm } = useModal();
  const [buildingData, setBuildingData] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('');

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
      showSuccess(`Property Created Successfully. Property ID: ${data.id} Building ID: ${data.buildingId}`); 
    } catch { 
      showError('Unable to save property. Please check the required information and try again.'); 
      throw new Error('Property could not be saved'); 
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

  const getStatusBadge = (status: string) => {
    const s = String(status).toUpperCase();
    const style = s === 'ACTIVE' || s === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                : s === 'PENDING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>{status}</span>;
  };

  const columns = [
    { key: 'building_id', label: 'BUILDING ID' },
    { key: 'property_id', label: 'PROPERTY ID' },
    { key: 'owner', label: 'OWNER' },
    { key: 'barangay', label: 'BARANGAY' },
    { key: 'purok', label: 'PUROK' },
    { key: 'building_type', label: 'TYPE' },
    { key: 'building_use', label: 'USE', render: (v: string) => v ? v : '-' },
    { key: 'assessment_status', label: 'ASSESSMENT STATUS', render: (v: string) => v === 'approved' ? getStatusBadge('Assessed') : getStatusBadge('Pending') }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Buildings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage structural assets and linked properties.</p>
        </div>
        {!['admin'].includes(userRole) && (
          <button onClick={() => setShowAddProperty(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            Add Property
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
          onEdit={!['admin'].includes(userRole) ? record => setModal({ mode: 'edit', record }) : undefined} 
          onDelete={!['admin'].includes(userRole) ? remove : undefined} 
          customActions={userRole === 'assessor' ? (record) => (
            <button
              onClick={() => handleRequestPermission(record)}
              className="text-green-600 hover:text-green-800 transition"
              title="Request Permission to Assess"
            >
              <Plus size={18} />
            </button>
          ) : undefined}
        />
      )}

      {modal && <CrudModal title="Building Record" fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}
      {showAddProperty && <AddPropertyWorkflow close={() => setShowAddProperty(false)} onSave={createProperty} />}
    </div>
  );
};
