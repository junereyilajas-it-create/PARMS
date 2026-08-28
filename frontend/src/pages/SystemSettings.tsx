import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import api, { ensureSession } from '../lib/api';

type TabId = 'users' | 'propertyTypes' | 'classifications' | 'assessmentLevels';

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
  assessmentLevels: {
    title: 'Assessment Levels', endpoint: '/assessmentLevels', idField: 'assessment_level_id',
    fields: [{ key: 'classification_id', label: 'Classification ID', type: 'number' }, { key: 'assessment_percentage', label: 'Percentage (%)', type: 'number' }],
    columns: [{ key: 'assessment_level_id', label: 'ID' }, { key: 'classification_id', label: 'Class ID' }, { key: 'assessment_percentage', label: 'Percentage' }]
  }
};

export const SystemSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);

  const current = config[activeTab];

  const load = async () => {
    try {
      await ensureSession();
      const res = await api.get(current.endpoint);
      setData(res.data);
    } catch {
      setError(`Unable to load ${current.title} from the database.`);
    }
  };

  useEffect(() => { load(); }, [activeTab]);

  const save = async (values: Record<string, string>) => {
    try {
      await ensureSession();
      setError(''); setSuccess('');
      if (modal?.mode === 'create') {
        await api.post(current.endpoint, values);
        setSuccess(`${current.title} record was successfully added.`);
      } else if (modal?.record) {
        await api.put(`${current.endpoint}/${modal.record[current.idField]}`, values);
        setSuccess(`${current.title} record was successfully updated.`);
      }
      setModal(null);
      await load();
    } catch {
      setError('Unable to save. Check required fields or unique constraints.');
    }
  };

  const remove = async (record: any) => {
    if (!confirm(`Delete this ${current.title} record?`)) return;
    try {
      setError(''); setSuccess('');
      await ensureSession();
      await api.delete(`${current.endpoint}/${record[current.idField]}`);
      await load();
      setSuccess('Record was successfully deleted.');
    } catch {
      setError('This record cannot be deleted because it is referenced elsewhere.');
    }
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

      <div className="flex gap-4 border-b border-gray-200">
        {(Object.keys(config) as TabId[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
            className={`py-2 px-4 font-medium transition-colors ${activeTab === tab ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {config[tab].title}
          </button>
        ))}
      </div>

      {error && <p className="text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-green-50 px-4 py-3 text-green-800">{success}</p>}

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
