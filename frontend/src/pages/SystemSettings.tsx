import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { useModal } from '../contexts/ModalContext';
import api, { ensureSession } from '../lib/api';

type TabId = 'users' | 'propertyTypes' | 'classifications';

const config: Record<TabId, { title: string; endpoint: string; idField: string; fields: CrudField[]; columns: { key: string; label: string }[] }> = {
  users: {
    title: 'Users', endpoint: '/users', idField: 'user_id',
    fields: [
      { key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' },
      { key: 'username', label: 'Username' }, { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', type: 'select', options: ['admin', 'staff', 'viewer'] },
      { key: 'password_hash', label: 'Password (leave blank to keep current)' }
    ],
    columns: [{ key: 'user_id', label: 'ID' }, { key: 'username', label: 'Username' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }]
  },
  propertyTypes: {
    title: 'Property Types', endpoint: '/propertyTypes', idField: 'property_type_id',
    fields: [{ key: 'property_type_name', label: 'Type Name' }],
    columns: [{ key: 'property_type_id', label: 'ID' }, { key: 'property_type_name', label: 'Name' }]
  },
  classifications: {
    title: 'Classifications', endpoint: '/classifications', idField: 'classification_id',
    fields: [{ key: 'classification_name', label: 'Classification Name' }],
    columns: [{ key: 'classification_id', label: 'ID' }, { key: 'classification_name', label: 'Name' }]
  },
};

export const SystemSettings: React.FC = () => {
  const { showSuccess, showError, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [data, setData] = useState<any[]>([]);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);

  const current = config[activeTab];

  const load = async () => {
    try {
      await ensureSession();
      const res = await api.get(current.endpoint);
      setData(res.data);
    } catch {
      showError(`Unable to load ${current.title} from the database.`);
    }
  };

  useEffect(() => { load(); }, [activeTab]);

  const save = async (values: Record<string, string>) => {
    try {
      await ensureSession();
      if (modal?.mode === 'create') {
        await api.post(current.endpoint, values);
        showSuccess(`${current.title} record was successfully added.`);
      } else if (modal?.record) {
        await api.put(`${current.endpoint}/${modal.record[current.idField]}`, values);
        showSuccess(`${current.title} record was successfully updated.`);
      }
      setModal(null);
      await load();
    } catch {
      showError('Unable to save. Check required fields or unique constraints.');
    }
  };

  const remove = async (record: any) => {
    showConfirm(`Are you sure you want to delete this ${current.title} record?`, async () => {
      try {
        await ensureSession();
        await api.delete(`${current.endpoint}/${record[current.idField]}`);
        await load();
        showSuccess('Record was successfully deleted.');
      } catch {
        showError('This record cannot be deleted because it is referenced elsewhere.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">Manage users, taxonomies, and core system properties.</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition">
          <Plus size={20} />
          Add {current.title}
        </button>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-6">
        {(Object.keys(config) as TabId[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 px-4 font-medium transition-colors ${activeTab === tab ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {config[tab].title}
          </button>
        ))}
      </div>

      <DataTable
        columns={current.columns}
        data={data}
        onView={(record) => setModal({ mode: 'view', record })}
        onEdit={(record) => setModal({ mode: 'edit', record })}
        onDelete={remove}
        showActions={true}
      />

      {modal && <CrudModal title={`${modal.mode === 'create' ? 'Add' : modal.mode === 'edit' ? 'Edit' : 'View'} ${current.title}`} fields={current.fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
};
