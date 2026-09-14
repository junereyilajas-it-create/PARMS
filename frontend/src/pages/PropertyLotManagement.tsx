import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { DataTable } from '../components/common/DataTable'
import { FilterBar } from '../components/common/FilterBar'
import { CrudModal, type CrudField } from '../components/common/CrudModal'
import { LotRegistrationModal } from '../components/common/LotRegistrationModal'
import { AddPropertyWorkflow, type UnifiedPropertyRegistration } from '../components/common/AddPropertyWorkflow'
import { useModal } from '../contexts/ModalContext'
import api, { ensureSession } from '../lib/api'

type Lot = { lot_id: number; property_id: number; lot_number: string; location: string; purok: string; barangay: string; municipality: string; province: string; lot_area: number; classification_name: string; property_type: string; owner: string; lot_status: string }
const fields: CrudField[] = [{ key: 'property_id', label: 'Property ID', type: 'number' }, { key: 'lot_number', label: 'Lot ID' }, { key: 'title_number', label: 'Title number' }, { key: 'purok', label: 'Purok' }, { key: 'barangay', label: 'Barangay' }, { key: 'municipality', label: 'Municipality' }, { key: 'province', label: 'Province' }, { key: 'lot_area', label: 'Area (sqm)', type: 'number' }, { key: 'latitude', label: 'Latitude', type: 'number' }, { key: 'longitude', label: 'Longitude', type: 'number' }, { key: 'lot_status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] }]

export function PropertyLotManagement({ query = '' }: { query?: string }) {
  const { showSuccess, showError, showConfirm } = useModal();
  const [lots, setLots] = useState<Lot[]>([]); const [filters, setFilters] = useState({ barangay: '', classification: '', propertyType: '', status: '' }); const [modal, setModal] = useState<{ mode: 'edit' | 'view'; record?: Lot } | null>(null); const [showAddProperty, setShowAddProperty] = useState(false)
  const load = async () => { try { await ensureSession(); const { data } = await api.get('/property-records'); setLots(data.filter((row: Lot) => row.lot_id)) } catch { showError('Unable to load database records. Start MySQL and the API server, then import backend/database.sql.') } }
  useEffect(() => { load() }, [])
  
  const displayedLots = useMemo(() => lots.filter(lot => {
    const searchMatch = !query || `${lot.lot_number} ${lot.property_id} ${lot.owner} ${lot.barangay} ${lot.purok} ${lot.classification_name}`.toLowerCase().includes(query.toLowerCase());
    const barangayMatch = !filters.barangay || (lot.barangay && lot.barangay.toLowerCase() === filters.barangay.toLowerCase());
    const classificationMatch = !filters.classification || (lot.classification_name && lot.classification_name.toLowerCase() === filters.classification.toLowerCase());
    const typeMatch = !filters.propertyType || (lot.property_type && lot.property_type.toLowerCase() === filters.propertyType.toLowerCase());
    const statusMatch = !filters.status || lot.lot_status === filters.status;
    return searchMatch && barangayMatch && classificationMatch && typeMatch && statusMatch;
  }), [lots, filters, query])

  const updateLot = async (values: Record<string, string>) => { try { await ensureSession(); if (modal?.record) await api.put(`/lots/${modal.record.lot_id}`, values); setModal(null); await load(); showSuccess(`Lot was successfully updated.`); } catch { showError('Unable to save the lot. Check required IDs and database constraints.'); throw new Error('Lot could not be updated') } }
  const createProperty = async (values: UnifiedPropertyRegistration) => { try { await ensureSession(); const { data } = await api.post('/properties/unified', values); await load(); setShowAddProperty(false); showSuccess(`Property Created Successfully. Property ID: ${data.id}`); } catch { showError('Unable to save property. Please check the required information and try again.'); throw new Error('Property could not be saved') } }
  const remove = async (record: Lot) => { showConfirm(`Delete ${record.lot_number}?`, async () => { try { await ensureSession(); await api.delete(`/lots/${record.lot_id}`); await load(); showSuccess(`Lot ${record.lot_number} was successfully deleted from the database.`) } catch { showError('This lot cannot be deleted while it has related records.') } }) }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lots</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage all registered lot properties.</p>
        </div>
        <button onClick={() => setShowAddProperty(true)} className="flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 px-4 py-2 text-white transition-colors">
          <Plus size={20}/>+ Add Property
        </button>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Lots</span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{lots.length}</div>
        </div>
        <div className="flex-1 max-w-4xl">
          <FilterBar filters={[
            { label: 'Barangay', value: filters.barangay, options: [{ label: 'All Barangays', value: '' }, ...['Banglay', 'Dampil', 'Gaston', 'Kabulawan', 'Kauswagan', 'Lumbo', 'Manaol', 'Poblacion', 'Tabok', 'Umagos'].map(v => ({ label: v, value: v }))] }, 
            { label: 'Classification', value: filters.classification, options: [{ label: 'All Classifications', value: '' }, ...['Residential Lot', 'Commercial Lot', 'Agricultural Land'].map(value => ({ label: value, value }))] }, 
            { label: 'Status', value: filters.status, options: [{ label: 'All Status', value: '' }, ...['active', 'inactive', 'pending'].map(value => ({ label: value, value }))] }
          ]} onFilterChange={(name, value) => setFilters(current => ({ ...current, [name === 'Barangay' ? 'barangay' : name === 'Classification' ? 'classification' : 'status']: value }))} onReset={() => setFilters({ barangay: '', classification: '', propertyType: '', status: '' })}/>
        </div>
      </div>
      
      {displayedLots.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No lots found.</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">There are no lots matching your search criteria.</p>
        </div>
      ) : (
        <DataTable columns={[
          { key: 'lot_number', label: 'LOT ID' }, 
          { key: 'property_id', label: 'PROPERTY ID' },
          { key: 'owner', label: 'OWNER' }, 
          { key: 'barangay', label: 'BARANGAY' }, 
          { key: 'purok', label: 'PUROK' }, 
          { key: 'lot_area', label: 'AREA (SQM)', render: (value: number) => Number(value).toFixed(2) }, 
          { key: 'classification_name', label: 'CLASSIFICATION' }, 
          { key: 'property_type', label: 'TYPE/USE' },
          { key: 'lot_status', label: 'STATUS' }
        ]} data={displayedLots} onView={record => setModal({ mode: 'view', record })} onEdit={record => setModal({ mode: 'edit', record })} onDelete={remove}/>
      )}
      
      {modal?.mode === 'view' && <CrudModal title="Lot Record" fields={fields} record={modal.record} readOnly onClose={() => setModal(null)} onSave={updateLot}/>} 
      {modal?.mode === 'edit' && modal.record && <LotRegistrationModal title="Edit Property Lot" initialValues={modal.record} close={() => setModal(null)} onSave={updateLot}/>} 
      {showAddProperty && <AddPropertyWorkflow close={() => setShowAddProperty(false)} onSave={createProperty}/>}
    </div>
  )
}
