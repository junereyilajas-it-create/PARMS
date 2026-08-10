import React, { useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import { BarChartComponent } from '../charts/BarChartComponent';
import { MetricCard } from '../common/MetricCard';
import { DataTable } from '../common/DataTable';
import { CrudModal, type CrudField } from '../common/CrudModal';

export const BuildingDirectory: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);

  // Mock data for construction trends
  const constructionTrendsData = [
    { year: '2019', structures: 1200 },
    { year: '2020', structures: 1450 },
    { year: '2021', structures: 1680 },
    { year: '2022', structures: 2100 },
    { year: '2023', structures: 2450 },
    { year: '2024 (Pro)', structures: 2800 },
  ];

  const initialBuildings = [
    {
      id: 'BLDG-10294-A',
      type: 'Residential',
      lotPin: 'LOT-01-010-012',
      yearBuilt: 1988,
      lastAssessment: 425000,
      status: 'APPROVED',
    },
    {
      id: 'BLDG-98219-C',
      type: 'Commercial',
      lotPin: 'LOT-04-210-015',
      yearBuilt: 2012,
      lastAssessment: 1850000,
      status: 'APPROVED',
    },
    {
      id: 'BLDG-30642-B',
      type: 'Residential',
      lotPin: 'LOT-22-812-011',
      yearBuilt: 1965,
      lastAssessment: 780200,
      status: 'ARCHIVED',
    },
    {
      id: 'BLDG-99291-F',
      type: 'Industrial',
      lotPin: 'LOT-28-308-013',
      yearBuilt: 2023,
      lastAssessment: 3120000,
      status: 'PENDING',
    },
    {
      id: 'BLDG-44192-X',
      type: 'Mixed Use',
      lotPin: 'LOT-04-110-008',
      yearBuilt: 2005,
      lastAssessment: 920000,
      status: 'APPROVED',
    },
  ];
  const [buildingData, setBuildingData] = useState(initialBuildings);
  const fields: CrudField[] = [{ key: 'id', label: 'Building ID' }, { key: 'type', label: 'Type', type: 'select', options: ['Residential', 'Commercial', 'Industrial', 'Mixed Use'] }, { key: 'lotPin', label: 'Lot PIN' }, { key: 'yearBuilt', label: 'Year Built', type: 'number' }, { key: 'lastAssessment', label: 'Last Assessment', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['APPROVED', 'PENDING', 'ARCHIVED'] }];
  const save = (values: Record<string, string>) => { const record = { ...values, yearBuilt: Number(values.yearBuilt), lastAssessment: Number(values.lastAssessment) } as typeof initialBuildings[number]; if (modal?.mode === 'create') setBuildingData(items => [...items, record]); else if (modal?.record) setBuildingData(items => items.map(item => item.id === modal.record.id ? record : item)); setModal(null); };

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
    { key: 'id', label: 'Building ID' },
    { key: 'type', label: 'Type' },
    { key: 'lotPin', label: 'Lot PIN' },
    { key: 'yearBuilt', label: 'Year Built' },
    { key: 'lastAssessment', label: 'Last Assessment', render: (v: number) => `$${v.toLocaleString()}` },
    { key: 'status', label: 'Status', render: getStatusBadge },
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
        <button onClick={() => setModal({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition">
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
      <DataTable
        columns={columns}
        data={buildingData}
        currentPage={currentPage}
        totalPages={3}
        onPageChange={setCurrentPage}
        onView={(record) => setModal({ mode: 'view', record })}
        onEdit={(record) => setModal({ mode: 'edit', record })}
        onDelete={(record) => { if (confirm(`Delete ${record.id}?`)) setBuildingData(items => items.filter(item => item.id !== record.id)); }}
        showActions={true}
      />
      {modal && <CrudModal title={`${modal.mode === 'create' ? 'Add' : modal.mode === 'edit' ? 'Edit' : 'Building'} Structure`} fields={fields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={save} />}

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
          <button className="w-full px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition text-sm font-medium">
            Generate Risk Report
          </button>
        </div>
      </div>
    </div>
  );
};
