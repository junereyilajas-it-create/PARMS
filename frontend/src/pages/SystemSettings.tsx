import React, { useEffect, useState } from 'react';
import { Plus, Info, Palette, ShieldAlert } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import api, { ensureSession } from '../lib/api';

type TabId = 'general' | 'systemInfo' | 'appearance' | 'maintenance' | 'propertyTypes' | 'classifications';

const crudConfig: Record<string, { title: string; endpoint: string; idField: string; fields: CrudField[]; columns: { key: string; label: string }[] }> = {
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
  const { setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [data, setData] = useState<any[]>([]);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  
  // Global settings state
  const [settings, setSettings] = useState<any[]>([]);
  const userRole = localStorage.getItem('accessor_role') || '';
  const [busy, setBusy] = useState(false);

  const isCrudTab = activeTab === 'propertyTypes' || activeTab === 'classifications';

  const loadData = async () => {
    try {
      await ensureSession();
      if (isCrudTab) {
        const res = await api.get(crudConfig[activeTab].endpoint);
        setData(res.data);
      } else {
        const res = await api.get('/system-settings');
        setSettings(res.data);
      }
    } catch {
      showError(`Unable to load data from the database.`);
    }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const saveCrud = async (values: Record<string, string>) => {
    try {
      await ensureSession();
      const current = crudConfig[activeTab];
      if (modal?.mode === 'create') {
        await api.post(current.endpoint, values);
        showSuccess(`${current.title} record was successfully added.`);
      } else if (modal?.record) {
        await api.put(`${current.endpoint}/${modal.record[current.idField]}`, values);
        showSuccess(`${current.title} record was successfully updated.`);
      }
      setModal(null);
      await loadData();
    } catch {
      showError('Unable to save. Check required fields or unique constraints.');
    }
  };

  const removeCrud = async (record: any) => {
    const current = crudConfig[activeTab];
    showConfirm(`Are you sure you want to delete this ${current.title} record?`, async () => {
      try {
        await ensureSession();
        await api.delete(`${current.endpoint}/${record[current.idField]}`);
        await loadData();
        showSuccess('Record was successfully deleted.');
      } catch {
        showError('This record cannot be deleted because it is referenced elsewhere.');
      }
    });
  };

  const saveSetting = async (key: string, value: string) => {
    setBusy(true);
    try {
      await ensureSession();
      await api.put(`/system-settings/${key}`, { value });
      showSuccess(`Setting updated successfully.`);
      await loadData();
    } catch (e: any) {
      showError(e.response?.data?.message || 'Failed to update setting.');
    } finally {
      setBusy(false);
    }
  };

  const renderSettingInput = (setting: any) => {
    if (setting.setting_key === 'maintenance_mode') {
      return (
        <select
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
          value={setting.setting_value}
          onChange={(e) => saveSetting(setting.setting_key, e.target.value)}
          disabled={busy}
        >
          <option value="false">Off</option>
          <option value="true">On</option>
        </select>
      );
    }
    if (setting.setting_key === 'default_theme') {
      return (
        <select
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
          value={setting.setting_value}
          onChange={(e) => {
            const val = e.target.value;
            saveSetting(setting.setting_key, val);
            if (val === 'light' || val === 'dark') {
              setTheme(val);
            }
          }}
          disabled={busy}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System Default</option>
        </select>
      );
    }
    return (
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
          defaultValue={setting.setting_value}
          onBlur={(e) => {
            if (e.target.value !== setting.setting_value) {
              saveSetting(setting.setting_key, e.target.value);
            }
          }}
          disabled={busy}
        />
        <button
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          onClick={(e) => {
            const input = (e.currentTarget.previousSibling as HTMLInputElement);
            if (input.value !== setting.setting_value) {
              saveSetting(setting.setting_key, input.value);
            }
          }}
          disabled={busy}
        >
          Save
        </button>
      </div>
    );
  };

  const renderSettingsCategory = (category: string, icon: React.ReactNode) => {
    const categorySettings = settings.filter(s => s.setting_category === category);
    
    if (categorySettings.length === 0) {
      return <div className="p-8 text-center text-gray-500">No settings available in this category.</div>;
    }

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {icon} {category}
            </h3>
          </div>
          <div className="p-6 space-y-6">
            {categorySettings.map((setting) => (
              <div key={setting.setting_key} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start pb-6 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{setting.description}</p>
                </div>
                <div className="md:col-span-2">
                  {renderSettingInput(setting)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage users, taxonomies, and core system properties.</p>
        </div>
        {isCrudTab && (
          <button onClick={() => setModal({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition">
            <Plus size={20} />
            Add {crudConfig[activeTab].title}
          </button>
        )}
      </div>

      <div className="flex overflow-x-auto gap-1 border-b border-gray-200 dark:border-gray-800 mb-6 custom-scrollbar pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg ${activeTab === 'general' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('systemInfo')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg ${activeTab === 'systemInfo' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          System Information
        </button>
        <button
          onClick={() => setActiveTab('appearance')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg ${activeTab === 'appearance' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Appearance
        </button>
        {userRole === 'super_admin' && (
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg ${activeTab === 'maintenance' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            Maintenance
          </button>
        )}
        <button
          onClick={() => setActiveTab('propertyTypes')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg ${activeTab === 'propertyTypes' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Property Types
        </button>
        <button
          onClick={() => setActiveTab('classifications')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg ${activeTab === 'classifications' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Classifications
        </button>
      </div>

      {isCrudTab ? (
        <DataTable
          columns={crudConfig[activeTab].columns}
          data={data}
          onView={(record) => setModal({ mode: 'view', record })}
          onEdit={(record) => setModal({ mode: 'edit', record })}
          onDelete={removeCrud}
          showActions={true}
        />
      ) : (
        <div>
          {activeTab === 'systemInfo' && renderSettingsCategory('System Information', <Info size={18} className="text-gray-500" />)}
          {activeTab === 'appearance' && renderSettingsCategory('Appearance', <Palette size={18} className="text-gray-500" />)}
          {activeTab === 'maintenance' && renderSettingsCategory('Maintenance', <ShieldAlert size={18} className="text-gray-500" />)}
          {activeTab === 'general' && (
             <div className="p-8 text-center text-gray-500">General settings placeholder. Navigate to System Information or Appearance.</div>
          )}
        </div>
      )}

      {isCrudTab && modal && (
        <CrudModal 
          title={`${modal.mode === 'create' ? 'Add' : modal.mode === 'edit' ? 'Edit' : 'View'} ${crudConfig[activeTab].title}`} 
          fields={crudConfig[activeTab].fields} 
          record={modal.record} 
          readOnly={modal.mode === 'view'} 
          onClose={() => setModal(null)} 
          onSave={saveCrud} 
        />
      )}
    </div>
  );
};
