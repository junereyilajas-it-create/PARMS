import React, { useEffect, useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { useModal } from '../contexts/ModalContext';
import api, { ensureSession } from '../lib/api';

type Owner = { owner_id: number; first_name: string; middle_name: string; last_name: string; contact_number: string; email: string };

const fields: CrudField[] = [
  { key: 'first_name', label: 'First Name' },
  { key: 'middle_name', label: 'Middle Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'contact_number', label: 'Contact Number' },
  { key: 'email', label: 'Email' }
];

export const PropertyOwnershipTransfer: React.FC = () => {
  const { showSuccess, showError, showConfirm } = useModal();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    try {
      await ensureSession();
      const { data } = await api.get('/owners');
      setOwners(data);
    } catch {
      showError('Unable to load owners from the database.');
    }
  };

  useEffect(() => { load(); }, []);

  const displayedOwners = useMemo(() => owners.filter(o => !query || `${o.first_name} ${o.last_name} ${o.email}`.toLowerCase().includes(query.toLowerCase())), [owners, query]);

  const save = async (values: Record<string, string>) => {
    try {
      await ensureSession();
      if (modal?.mode === 'create') {
        const { data } = await api.post('/owners', values);
        showSuccess(`Owner ${data.record.first_name} was successfully added.`);
      } else if (modal?.record) {
        await api.put(`/owners/${modal.record.owner_id}`, values);
        showSuccess('Owner was successfully updated.');
      }
      setModal(null);
      await load();
    } catch {
      showError('Unable to save the owner. Check required fields.');
    }
  };

  const remove = async (record: Owner) => {
    showConfirm(`Are you sure you want to delete owner ${record.first_name} ${record.last_name}?`, async () => {
      try {
        await ensureSession();
        await api.delete(`/owners/${record.owner_id}`);
        await load();
        showSuccess('Owner was successfully deleted.');
      } catch {
        showError('This owner cannot be deleted while they have linked properties.');
      }
    });
  };

  const columns = [
    { key: 'owner_id', label: 'Owner ID' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'contact_number', label: 'Contact' },
    { key: 'email', label: 'Email' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Owner Directory</h1>
          <p className="text-gray-600 mt-1">Manage legal records and contact information for registered owners.</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition">
          <Plus size={20} />
          Register Owner
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <input type="text" placeholder="Search owners..." value={query} onChange={e => setQuery(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <DataTable
        columns={columns}
        data={displayedOwners}
        onView={(record) => setModal({ mode: 'view', record })}
        onEdit={(record) => setModal({ mode: 'edit', record })}
        onDelete={remove}
        showActions={true}
      />

      {modal && <CrudModal title={`${modal.mode === 'create' ? 'Register' : modal.mode === 'edit' ? 'Edit' : 'View'} Owner`} fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
};
