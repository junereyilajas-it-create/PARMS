import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Info, 
  Palette, 
  ShieldAlert, 
  Sliders, 
  Shield, 
  Database, 
  Download, 
  History, 
  Loader2
} from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import api, { ensureSession } from '../lib/api';

type TabId = 'systemInfo' | 'preferences' | 'appearance' | 'security' | 'maintenance' | 'propertyTypes' | 'classifications';

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
  const [activeTab, setActiveTab] = useState<TabId>('systemInfo');
  const [data, setData] = useState<any[]>([]);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  
  // Global settings state
  const [settings, setSettings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
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

        if (activeTab === 'maintenance') {
          try {
            const auditRes = await api.get('/system-settings/audit-summary');
            setAuditLogs(auditRes.data.logs || []);
          } catch (e) {
            console.error('Failed to load audit logs:', e);
          }
        }
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
      showSuccess(`Setting updated and applied successfully.`);
      await loadData();
    } catch (e: any) {
      showError(e.response?.data?.message || 'Failed to update setting.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      await ensureSession();
      const response = await api.get('/system-settings/backup', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `parms_database_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess('Official database backup JSON snapshot generated and downloaded.');
    } catch (e: any) {
      showError(e.response?.data?.message || 'Failed to generate database backup. Super Admin permission required.');
    } finally {
      setIsDownloadingBackup(false);
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
          <option value="false">Disabled (Normal Operations)</option>
          <option value="true">Enabled (Maintenance Notice Active)</option>
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
          <option value="light">Light Mode</option>
          <option value="dark">Dark Mode</option>
          <option value="system">System Default</option>
        </select>
      );
    }
    if (setting.setting_key === 'sidebar_collapsed_default') {
      return (
        <select
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
          value={setting.setting_value}
          onChange={(e) => saveSetting(setting.setting_key, e.target.value)}
          disabled={busy}
        >
          <option value="false">Expanded (Default)</option>
          <option value="true">Collapsed (Mini Sidebar)</option>
        </select>
      );
    }
    if (setting.setting_key === 'default_date_format') {
      return (
        <select
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
          value={setting.setting_value}
          onChange={(e) => saveSetting(setting.setting_key, e.target.value)}
          disabled={busy}
        >
          <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/20/2026)</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 20/10/2026)</option>
        </select>
      );
    }
    if (setting.setting_key === 'default_time_format') {
      return (
        <select
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
          value={setting.setting_value}
          onChange={(e) => saveSetting(setting.setting_key, e.target.value)}
          disabled={busy}
        >
          <option value="12h">12-Hour (e.g. 02:30 PM)</option>
          <option value="24h">24-Hour (e.g. 14:30)</option>
        </select>
      );
    }
    if (setting.setting_key === 'default_reporting_period') {
      return (
        <select
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
          value={setting.setting_value}
          onChange={(e) => saveSetting(setting.setting_key, e.target.value)}
          disabled={busy}
        >
          <option value="monthly">Monthly</option>
          <option value="semi-annual">Semi-Annual</option>
          <option value="annual">Annual</option>
        </select>
      );
    }
    if (setting.setting_key === 'default_page_size') {
      return (
        <select
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm"
          value={setting.setting_value}
          onChange={(e) => saveSetting(setting.setting_key, e.target.value)}
          disabled={busy}
        >
          <option value="10">10 records per page</option>
          <option value="20">20 records per page</option>
          <option value="50">50 records per page</option>
        </select>
      );
    }

    return (
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white"
          defaultValue={setting.setting_value}
          onBlur={(e) => {
            if (e.target.value !== setting.setting_value) {
              saveSetting(setting.setting_key, e.target.value);
            }
          }}
          disabled={busy}
        />
        <button
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
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
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure municipal jurisdiction, display defaults, security policies, and administrative maintenance.
          </p>
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
          onClick={() => setActiveTab('systemInfo')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg flex items-center gap-1.5 ${activeTab === 'systemInfo' ? 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          <Info size={16} /> Office & Jurisdiction
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg flex items-center gap-1.5 ${activeTab === 'preferences' ? 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          <Sliders size={16} /> Preferences
        </button>
        <button
          onClick={() => setActiveTab('appearance')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg flex items-center gap-1.5 ${activeTab === 'appearance' ? 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          <Palette size={16} /> Appearance
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg flex items-center gap-1.5 ${activeTab === 'security' ? 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          <Shield size={16} /> Security & Policy
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg flex items-center gap-1.5 ${activeTab === 'maintenance' ? 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          <ShieldAlert size={16} /> Maintenance & Backup
        </button>
        <button
          onClick={() => setActiveTab('propertyTypes')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg ${activeTab === 'propertyTypes' ? 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Property Types
        </button>
        <button
          onClick={() => setActiveTab('classifications')}
          className={`whitespace-nowrap py-2 px-4 font-medium transition-colors text-sm rounded-t-lg ${activeTab === 'classifications' ? 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
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
        <div className="space-y-6">
          {activeTab === 'systemInfo' && renderSettingsCategory('System Information', <Info size={18} className="text-green-600" />)}
          {activeTab === 'preferences' && renderSettingsCategory('Preferences', <Sliders size={18} className="text-green-600" />)}
          {activeTab === 'appearance' && renderSettingsCategory('Appearance', <Palette size={18} className="text-green-600" />)}
          {activeTab === 'security' && renderSettingsCategory('Security', <Shield size={18} className="text-green-600" />)}

          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              {renderSettingsCategory('Maintenance', <ShieldAlert size={18} className="text-amber-600" />)}

              {/* Database Backup Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Database size={18} className="text-green-600" /> Database Backup & Snapshot
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Download a complete, structured JSON archive of all property records, assessments, users, tax declarations, and GIS mapping entries.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadBackup}
                    disabled={isDownloadingBackup}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50 shrink-0 self-start sm:self-auto"
                  >
                    {isDownloadingBackup ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Generating Backup...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download Database JSON
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
                  <p><strong>Security Note:</strong> Backups contain sensitive assessment and owner information. Restrict access and store archives securely in municipal offline storage. Authorized Role: <span className="font-bold uppercase text-green-700 dark:text-green-400">{userRole}</span>.</p>
                </div>
              </div>

              {/* Recent Audit Logs */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <History size={18} className="text-blue-600" /> Recent Administrative Audit Logs
                  </h3>
                  <span className="text-xs text-gray-500">{auditLogs.length} recent events</span>
                </div>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">No recent audit logs recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 border-b border-gray-200 dark:border-gray-700">
                          <th className="p-2.5">Timestamp</th>
                          <th className="p-2.5">User</th>
                          <th className="p-2.5">Action</th>
                          <th className="p-2.5">Entity</th>
                          <th className="p-2.5">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/60 hover:bg-gray-50/50">
                            <td className="p-2.5 whitespace-nowrap text-gray-500">{new Date(log.created_at || log.timestamp).toLocaleString()}</td>
                            <td className="p-2.5 font-semibold text-gray-800 dark:text-gray-200">{log.first_name ? `${log.first_name} ${log.last_name}` : `User #${log.user_id}`}</td>
                            <td className="p-2.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 uppercase">{log.action}</span></td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-400">{log.entity || 'System'}</td>
                            <td className="p-2.5 text-gray-700 dark:text-gray-300 max-w-xs truncate">{log.details || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
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

