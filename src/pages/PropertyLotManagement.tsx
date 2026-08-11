import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { DataTable } from '../components/common/DataTable'
import { FilterBar } from '../components/common/FilterBar'
import { CrudModal, type CrudField } from '../components/common/CrudModal'
import api, { ensureSession } from '../lib/api'

type Lot = { lot_id: number; property_id: number; lot_number: string; location: string; lot_area: number; classification_name: string; owner: string; lot_status: string }
const fields: CrudField[] = [
  { key: 'property_id', label: 'Property ID', type: 'number' }, { key: 'lot_number', label: 'Lot number' },
  { key: 'title_number', label: 'Title number' }, { key: 'location', label: 'Location' }, { key: 'lot_area', label: 'Area (sqm)', type: 'number' },
  { key: 'latitude', label: 'Latitude', type: 'number' }, { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'lot_status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] },
]

export function PropertyLotManagement() {
  const [lots, setLots] = useState<Lot[]>([]); const [error, setError] = useState(''); const [filters, setFilters] = useState({ district: '', classification: '', status: '' }); const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: Lot } | null>(null)
  const load = async () => { try { await ensureSession(); const { data } = await api.get('/property-records'); setLots(data.filter((row: Lot) => row.lot_id)) } catch { setError('Unable to load database records. Start MySQL and the API server, then import server/database.sql.') } }
  useEffect(() => { load() }, [])
  const displayedLots = useMemo(() => lots.filter(lot => (!filters.district || lot.location.toLowerCase().includes(filters.district.replace('-', ' '))) && (!filters.classification || lot.classification_name.toLowerCase().includes(filters.classification)) && (!filters.status || lot.lot_status === filters.status)), [lots, filters])
  const save = async (values: Record<string, string>) => { try { await ensureSession(); if (modal?.mode === 'create') await api.post('/lots', values); else if (modal?.record) await api.put(`/lots/${modal.record.lot_id}`, values); setModal(null); await load() } catch { setError('Unable to save the lot. Check required IDs and database constraints.') } }
  const remove = async (record: Lot) => { if (!confirm(`Delete ${record.lot_number}?`)) return; try { await ensureSession(); await api.delete(`/lots/${record.lot_id}`); await load() } catch { setError('This lot cannot be deleted while it has related records.') } }
  return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold text-gray-900">Property Lot Management</h1><p className="mt-1 text-gray-600">Live records from the property-management database.</p></div><button onClick={() => setModal({ mode: 'create' })} className="flex items-center gap-2 rounded-lg bg-green-800 px-4 py-2 text-white"><Plus size={20}/>Add lot</button></div>
    {error && <p className="text-red-700">{error}</p>}<FilterBar filters={[{ label: 'Barangay', value: filters.district, options: [{ label: 'All Barangays', value: '' }, { label: 'Poblacion', value: 'poblacion' }, { label: 'Manaol', value: 'manaol' }, { label: 'Umagos', value: 'umagos' }] }, { label: 'Classification', value: filters.classification, options: [{ label: 'All Classifications', value: '' }, ...['residential', 'commercial', 'agricultural'].map(value => ({ label: value, value }))] }, { label: 'Status', value: filters.status, options: [{ label: 'All Status', value: '' }, ...['active', 'inactive', 'pending'].map(value => ({ label: value, value }))] }]} onFilterChange={(name, value) => setFilters(current => ({ ...current, [name === 'Barangay' ? 'district' : name === 'Classification' ? 'classification' : 'status']: value }))} onReset={() => setFilters({ district: '', classification: '', status: '' })}/>
    <p className="text-gray-600">Displaying {displayedLots.length} registered lots</p><DataTable columns={[{ key: 'lot_number', label: 'LOT ID' }, { key: 'location', label: 'LOCATION' }, { key: 'lot_area', label: 'AREA (SQM)', render: (value: number) => Number(value).toFixed(2) }, { key: 'classification_name', label: 'CLASSIFICATION' }, { key: 'owner', label: 'OWNER' }, { key: 'lot_status', label: 'STATUS' }]} data={displayedLots} onView={record => setModal({ mode: 'view', record })} onEdit={record => setModal({ mode: 'edit', record })} onDelete={remove}/>
    {modal && <CrudModal title={`${modal.mode === 'create' ? 'Add' : modal.mode === 'edit' ? 'Edit' : 'Lot'} Record`} fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save}/>}</div>
}
