import { useEffect, useMemo, useState } from 'react'
import { Filter, Search, Plus } from 'lucide-react'
import { DataTable } from '../components/common/DataTable'
import { MetricCard } from '../components/common/MetricCard'
import { CrudModal, type CrudField } from '../components/common/CrudModal'
import { LotRegistrationModal } from '../components/common/LotRegistrationModal'
import { AddPropertyWorkflow, type UnifiedPropertyRegistration } from '../components/common/AddPropertyWorkflow'
import { useModal } from '../contexts/ModalContext'
import api, { ensureSession } from '../lib/api'

type Lot = { lot_id: number; property_id: number; lot_number: string; location: string; purok: string; barangay: string; municipality: string; province: string; lot_area: number; classification_name: string; property_type: string; owner: string; lot_status: string }
const fields: CrudField[] = [{ key: 'property_id', label: 'Property ID', type: 'number' }, { key: 'lot_number', label: 'Lot ID' }, { key: 'title_number', label: 'Title number' }, { key: 'purok', label: 'Purok' }, { key: 'barangay', label: 'Barangay' }, { key: 'municipality', label: 'Municipality' }, { key: 'province', label: 'Province' }, { key: 'lot_area', label: 'Area (sqm)', type: 'number' }, { key: 'latitude', label: 'Latitude', type: 'number' }, { key: 'longitude', label: 'Longitude', type: 'number' }, { key: 'lot_status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] }]

export function PropertyLotManagement() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [internalSearch, setInternalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lots, setLots] = useState<Lot[]>([]); const [filters, setFilters] = useState({ barangay: '', classification: '', propertyType: '', status: '' }); const [modal, setModal] = useState<{ mode: 'edit' | 'view'; record?: Lot } | null>(null); const [showAddProperty, setShowAddProperty] = useState(false); const [userRole, setUserRole] = useState('');
  
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
  const createProperty = async (values: UnifiedPropertyRegistration) => { try { await ensureSession(); const { data } = await api.post('/properties/unified', values); await load(); setShowAddProperty(false); showSuccess(`Property Created Successfully. Property ID: ${data.id}`); } catch { showError('Unable to save property. Please check the required information and try again.'); throw new Error('Property could not be saved') } }
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

  const getStatusBadge = (status: string) => {
    const s = String(status).toUpperCase();
    const style = s === 'ACTIVE' || s === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                : s === 'PENDING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>{status}</span>;
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
    { key: 'lot_status', label: 'STATUS', render: (v: string) => getStatusBadge(v) }
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lots</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage all registered lot properties.</p>
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
      
      {modal?.mode === 'view' && <CrudModal title="Lot Record" fields={fields} record={modal.record} readOnly onClose={() => setModal(null)} onSave={updateLot}/>} 
      {modal?.mode === 'edit' && modal.record && <LotRegistrationModal title="Edit Property Lot" initialValues={modal.record} close={() => setModal(null)} onSave={updateLot}/>} 
      {showAddProperty && <AddPropertyWorkflow close={() => setShowAddProperty(false)} onSave={createProperty}/>}
    </div>
  )
}
