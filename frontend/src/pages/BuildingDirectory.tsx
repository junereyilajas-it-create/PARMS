import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Filter } from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { AddPropertyWorkflow, type UnifiedPropertyRegistration } from '../components/common/AddPropertyWorkflow';
import { useModal } from '../contexts/ModalContext';
import api, { ensureSession } from '../lib/api';

export const BuildingDirectory: React.FC<{ query?: string }> = ({ query = '' }) => {
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [filters, setFilters] = useState({ barangay: '', type: '', status: '', assessment: '' });

  const { showSuccess, showError, showConfirm } = useModal();
  const [buildingData, setBuildingData] = useState<any[]>([]);
  
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
      const { data } = await api.get('/buildings'); 
      setBuildingData(data); 
    } catch { 
      showError('Unable to load building records from the database.') 
    } 
  };
  
  useEffect(() => { load() }, []);
  
  const displayedBuildings = useMemo(() => buildingData.filter(b => {
    const searchMatch = !query || `${b.building_id} ${b.property_id} ${b.owner} ${b.barangay} ${b.purok} ${b.building_type}`.toLowerCase().includes(query.toLowerCase());
    const barangayMatch = !filters.barangay || (b.barangay && b.barangay.toLowerCase() === filters.barangay.toLowerCase());
    const typeMatch = !filters.type || (b.building_type && b.building_type.toLowerCase() === filters.type.toLowerCase());
    const statusMatch = !filters.status || b.building_status === filters.status;
    
    let assessMatch = true;
    if (filters.assessment === 'assessed') assessMatch = Number(b.assessed_value) > 0;
    if (filters.assessment === 'unassessed') assessMatch = Number(b.assessed_value) === 0;

    return searchMatch && barangayMatch && typeMatch && statusMatch && assessMatch;
  }), [buildingData, query, filters]);
  
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
    { key: 'assessed_value', label: 'ASSESSMENT STATUS', render: (v: number) => Number(v) > 0 ? getStatusBadge('Assessed') : getStatusBadge('Pending') }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Buildings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage structural assets and linked properties.</p>
        </div>
        <button onClick={() => setShowAddProperty(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
          <Plus size={20} />
          + Add Property
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-center">
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
        <MetricCard title="Assessed Buildings" value={buildingData.filter(b => Number(b.assessed_value) > 0).length.toLocaleString()} trend={{ value: 0, isPositive: true, label: 'completed' }} />
        <MetricCard title="Unassessed Buildings" value={(buildingData.length - buildingData.filter(b => Number(b.assessed_value) > 0).length).toLocaleString()} trend={{ value: 0, isPositive: false, label: 'pending' }} />
      </div>

      <DataTable 
        columns={columns} 
        data={displayedBuildings} 
        onView={record => setModal({ mode: 'view', record })} 
        onEdit={record => setModal({ mode: 'edit', record })} 
        onDelete={remove} 
      />

      {modal && <CrudModal title="Building Record" fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}
      {showAddProperty && <AddPropertyWorkflow close={() => setShowAddProperty(false)} onSave={createProperty} />}
    </div>
  );
};
