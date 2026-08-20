import React, { useEffect, useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import { BarChartComponent } from '../components/charts/BarChartComponent';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';
import { BuildingRegistrationModal, type BuildingRegistration } from '../components/common/BuildingRegistrationModal';
import api, { ensureSession } from '../lib/api';

export const BuildingDirectory: React.FC<{ query?: string }> = ({ query = '' }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  const [showAddBuilding, setShowAddBuilding] = useState(false);

  // Mock data for construction trends
  const constructionTrendsData = [
    { year: '2019', structures: 1200 },
    { year: '2020', structures: 1450 },
    { year: '2021', structures: 1680 },
    { year: '2022', structures: 2100 },
    { year: '2023', structures: 2450 },
    { year: '2024 (Pro)', structures: 2800 },
  ];

  const [buildingData, setBuildingData] = useState<any[]>([]);
  const [error, setError] = useState('');
  const fields: CrudField[] = [{ key: 'property_id', label: 'Property ID', type: 'number' }, { key: 'building_name', label: 'Building name' }, { key: 'building_type', label: 'Type' }, { key: 'floor_area', label: 'Floor area', type: 'number' }, { key: 'floor_count', label: 'Floors', type: 'number' }, { key: 'construction_type', label: 'Construction type' }, { key: 'year_constructed', label: 'Year built', type: 'number' }, { key: 'market_value', label: 'Market value', type: 'number' }, { key: 'assessed_value', label: 'Assessed value', type: 'number' }, { key: 'building_status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] }];
  const load = async () => { try { await ensureSession(); const { data } = await api.get('/buildings'); setBuildingData(data); } catch { setError('Unable to load building records from the database.') } };
  useEffect(() => { load() }, []);
  const displayedBuildings = React.useMemo(() => buildingData.filter(b => !query || `${b.building_id} ${b.building_name} ${b.building_type}`.toLowerCase().includes(query.toLowerCase())), [buildingData, query]);
  const save = async (values: Record<string, string>) => { try { await ensureSession(); if (modal?.mode === 'create') await api.post('/buildings', values); else if (modal?.record) await api.put(`/buildings/${modal.record.building_id}`, values); setModal(null); await load(); } catch { setError('Unable to save the building. Check required property IDs and values.') } };
  const createBuilding = async (values: BuildingRegistration) => { try { await ensureSession(); const { data } = await api.post('/buildings', values); setShowAddBuilding(false); await load(); window.alert(`Building #${data.id} was successfully added to the database.`); } catch { setError('Unable to save the building. Check the linked property ID and required values.'); } };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-800',
      ARCHIVED: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyles[status]}`}>
        {status}
      </span>
    );
  };

  const columns = [
    { key: 'building_id', label: 'Building ID' },
    { key: 'building_type', label: 'Type' },
    { key: 'property_id', label: 'Property ID' },
    { key: 'year_constructed', label: 'Year Built' },
    { key: 'assessed_value', label: 'Last Assessment', render: (v: number) => `₱${Number(v).toLocaleString()}` },
    { key: 'building_status', label: 'Status', render: getStatusBadge },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Building Directory</h1>
          <p className="text-gray-600 mt-1">
            Manage structural assets and linked parcels across municipal districts.
          </p>
        </div>
        <button onClick={() => setShowAddBuilding(true)} className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition">
          <Plus size={20} />
          Add Building Structure
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Total Structures"
          value="12,482"
          trend={{ value: 1.3, isPositive: true, label: 'this quarter' }}
        />
        <MetricCard
          title="Residential Units"
          value="8,904"
          trend={{ value: 2.1, isPositive: true, label: 'increase' }}
        />
        <MetricCard
          title="Commercial Lots"
          value="3,578"
          trend={{ value: 0.5, isPositive: false, label: 'decrease' }}
        />
        <MetricCard
          title="Pending Valuation"
          value="142"
          trend={{ value: 15, isPositive: false, label: 'High Priority' }}
        />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <Filter size={20} className="text-gray-600" />
          <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
            <option>All Districts</option>
            <option>District 01</option>
            <option>District 02</option>
            <option>District 03</option>
            <option>District 04</option>
          </select>
          <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
            <option>Building Type</option>
            <option>Residential</option>
            <option>Commercial</option>
            <option>Industrial</option>
            <option>Mixed Use</option>
          </select>
          <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
            <option>Year Range</option>
            <option>1950-1980</option>
            <option>1981-2000</option>
            <option>2001-2020</option>
            <option>2021+</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      {error && <p className="text-red-700">{error}</p>}<DataTable
        columns={columns}
        data={displayedBuildings}
        currentPage={currentPage}
        totalPages={3}
        onPageChange={setCurrentPage}
        onView={(record) => setModal({ mode: 'view', record })}
        onEdit={(record) => setModal({ mode: 'edit', record })}
        onDelete={async (record) => { if (!confirm(`Delete building ${record.building_id}?`)) return; try { await ensureSession(); await api.delete(`/buildings/${record.building_id}`); await load(); window.alert(`Building #${record.building_id} was successfully deleted from the database.`); } catch { setError('This building cannot be deleted while it has related records.'); } }}
        showActions={true}
      />
      {modal && <CrudModal title={`${modal.mode === 'create' ? 'Add' : modal.mode === 'edit' ? 'Edit' : 'Building'} Structure`} fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}
      {showAddBuilding && <BuildingRegistrationModal close={() => setShowAddBuilding(false)} onSave={createBuilding} />}

      {/* Construction Trends Chart */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <BarChartComponent
            data={constructionTrendsData}
            title="Construction Trends (District 04)"
            xAxisKey="year"
            bars={[{ key: 'structures', fill: '#16a34a', name: 'Structures' }]}
          />
        </div>

        {/* AI Insights */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg shadow border border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-2xl">✨</div>
            <h3 className="font-semibold text-green-900">AI Insights</h3>
          </div>
          <p className="text-sm text-green-800 mb-4">
            District 04 is seeing a 14% increase in Mixed-Use building renovations. System suggests
            prioritized assessment for structural permits issued in the last 6 months.
          </p>
          <button 
            className="w-full px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition text-sm font-medium"
            onClick={() => window.alert('Risk report generation is currently in development.')}
          >
            Generate Risk Report
          </button>
        </div>
      </div>
    </div>
  );
};
