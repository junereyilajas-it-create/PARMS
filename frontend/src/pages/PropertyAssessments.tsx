import React, { useEffect, useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import api, { ensureSession } from '../lib/api';

type Assessment = { assessment_id: number; property_id: number; assessor_user_id: number; assessor_level: number; market_value: number; assessed_value: number; assessment_date: string; remarks: string };

const fields: CrudField[] = [
  { key: 'property_id', label: 'Property ID', type: 'number' },
  { key: 'assessor_user_id', label: 'Assessor User ID', type: 'number' },
  { key: 'assessor_level', label: 'Assessor Level (%)', type: 'number' },
  { key: 'market_value', label: 'Market Value', type: 'number' },
  { key: 'assessed_value', label: 'Assessed Value', type: 'number' },
  { key: 'assessment_date', label: 'Assessment Date' },
  { key: 'remarks', label: 'Remarks' }
];

export const PropertyAssessments: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    try {
      await ensureSession();
      const { data } = await api.get('/assessments');
      setAssessments(data);
    } catch {
      setError('Unable to load assessments from the database.');
    }
  };

  useEffect(() => { load(); }, []);

  const displayedAssessments = useMemo(() => assessments.filter(a => !query || String(a.property_id).includes(query)), [assessments, query]);

  const save = async (values: Record<string, string>) => {
    try {
      await ensureSession();
      setError(''); setSuccess('');
      if (modal?.mode === 'create') {
        const { data } = await api.post('/assessments', values);
        setSuccess(`Assessment #${data.record.assessment_id} was successfully added.`);
      } else if (modal?.record) {
        await api.put(`/assessments/${modal.record.assessment_id}`, values);
        setSuccess('Assessment was successfully updated.');
      }
      setModal(null);
      await load();
    } catch {
      setError('Unable to save the assessment. Check required IDs (e.g. Property ID).');
    }
  };

  const remove = async (record: Assessment) => {
    if (!confirm(`Delete assessment #${record.assessment_id}?`)) return;
    try {
      setError(''); setSuccess('');
      await ensureSession();
      await api.delete(`/assessments/${record.assessment_id}`);
      await load();
      setSuccess('Assessment was successfully deleted.');
    } catch {
      setError('This assessment cannot be deleted due to dependencies.');
    }
  };

  const columns = [
    { key: 'assessment_id', label: 'Assessment ID' },
    { key: 'property_id', label: 'Property ID' },
    { key: 'assessor_level', label: 'Level', render: (val: number) => `${Number(val)}%` },
    { key: 'market_value', label: 'Market Value', render: (val: number) => `₱${Number(val).toLocaleString()}` },
    { key: 'assessed_value', label: 'Assessed Value', render: (val: number) => `₱${Number(val).toLocaleString()}` },
    { key: 'assessment_date', label: 'Date', render: (val: string) => new Date(val).toLocaleDateString() },
    { key: 'remarks', label: 'Remarks' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Valuation Workspace</h1>
          <p className="text-gray-600 mt-1">Manage and track property market value assessments.</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition">
          <Plus size={20} />
          New Assessment
        </button>
      </div>

      {error && <p className="text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-green-50 px-4 py-3 text-green-800">{success}</p>}

      <div className="bg-white p-4 rounded-lg shadow">
        <input type="text" placeholder="Search by Property ID..." value={query} onChange={e => setQuery(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <DataTable
        columns={columns}
        data={displayedAssessments}
        onView={(record) => setModal({ mode: 'view', record })}
        onEdit={(record) => setModal({ mode: 'edit', record })}
        onDelete={remove}
        showActions={true}
      />

      {modal && <CrudModal title={`${modal.mode === 'create' ? 'Add' : modal.mode === 'edit' ? 'Edit' : 'View'} Assessment`} fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
};
