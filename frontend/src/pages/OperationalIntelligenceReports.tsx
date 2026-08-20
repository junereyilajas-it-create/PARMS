import React, { useState } from 'react';
import { FileText, Download as DownloadIcon, Plus } from 'lucide-react';
import { BarChartComponent } from '../components/charts/BarChartComponent';
import { DonutChartComponent } from '../components/charts/DonutChartComponent';
import { DataTable } from '../components/common/DataTable';
import { CrudModal, type CrudField } from '../components/common/CrudModal';

export const OperationalIntelligenceReports: React.FC = () => {
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; record?: any } | null>(null);
  // Mock data for AI Prediction Accuracy
  const predictionAccuracyData = [
    { month: 'Jan', accuracy: 88 },
    { month: 'Feb', accuracy: 89 },
    { month: 'Mar', accuracy: 87 },
    { month: 'Apr', accuracy: 91 },
    { month: 'May', accuracy: 94 },
    { month: 'Jun', accuracy: 96 },
    { month: 'Jul', accuracy: 95 },
  ];

  // Mock data for Property Inventory
  const propertyInventoryData = [
    { name: 'Residential', value: 14204, fill: '#16a34a' },
    { name: 'Commercial', value: 3400, fill: '#3b82f6' },
    { name: 'Industrial', value: 1280, fill: '#1f2937' },
  ];

  // Mock activity logs
  const activityLogs = [
    {
      id: '1',
      action: 'Valuation Override',
      parcel: 'LOT-8829-B0',
      timestamp: '10:12 AM',
      user: 'Admin_SR',
      severity: 'info',
    },
    {
      id: '2',
      action: 'Bulk Import Success',
      parcel: '420 new zoning records',
      timestamp: '09:35 AM',
      user: 'Sys_Daemon',
      severity: 'success',
    },
    {
      id: '3',
      action: 'API Auth Failure',
      parcel: 'Invalid token from 192.168.1.1',
      timestamp: '08:15 AM',
      user: 'Critical',
      severity: 'critical',
    },
  ];

  // Mock detailed reports
  const initialReports = [
    {
      id: '1',
      name: 'Residential Market Trends',
      category: 'Economic',
      schedule: 'Weekly (Mon)',
      recipient: 'Planning Commission',
      status: 'ACTIVE',
    },
    {
      id: '2',
      name: 'Foreclosure Warning Heatmap',
      category: 'Risk Mgmt',
      schedule: 'Monthly (1st)',
      recipient: "Mayor's Office",
      status: 'ACTIVE',
    },
    {
      id: '3',
      name: 'Zoning Compliance Audit',
      category: 'Compliance',
      schedule: 'On-Demand',
      recipient: 'Internal Audit',
      status: 'ARCHIVED',
    },
  ];
  const [detailedReports, setDetailedReports] = useState(initialReports);
  const reportFields: CrudField[] = [{ key: 'name', label: 'Report name' }, { key: 'category', label: 'Category' }, { key: 'schedule', label: 'Schedule' }, { key: 'recipient', label: 'Recipient' }, { key: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'ARCHIVED'] }];
  const saveReport = (values: Record<string, string>) => { const record = { ...values, id: modal?.record?.id ?? crypto.randomUUID() } as typeof initialReports[number]; if (modal?.mode === 'create') setDetailedReports(items => [...items, record]); else if (modal?.record) setDetailedReports(items => items.map(item => item.id === modal.record.id ? record : item)); setModal(null); };

  const reportColumns = [
    { key: 'name', label: 'Report Name' },
    { key: 'category', label: 'Category' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'recipient', label: 'Recipient' },
    {
      key: 'status',
      label: 'Status',
      render: (status: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === 'ACTIVE'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {status}
        </span>
      ),
    },
  ];

  const getActivityBadge = (severity: string) => {
    const severityStyles: Record<string, string> = {
      info: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      critical: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${severityStyles[severity]}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Operational Intelligence Reports</h1>
          <p className="text-gray-600 mt-1">
            Aggregate and analyze city-wide parcel data, tax distributions, and AI valuation performance
            for the 2024 fiscal year.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition"><Plus size={18}/>New Report</button>
          <button type="button" onClick={() => window.alert('Export to PDF is in development.')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
            <FileText size={18} />
            Generate PDF
          </button>
          <button type="button" onClick={() => window.alert('Scheduling reports is in development.')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
            <DownloadIcon size={18} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* AI Prediction Accuracy Chart */}
        <BarChartComponent
          data={predictionAccuracyData}
          title="AI Prediction Accuracy"
          xAxisKey="month"
          bars={[{ key: 'accuracy', fill: '#16a34a', name: 'Accuracy %' }]}
          height={300}
        />

        {/* Property Inventory Donut Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Property Inventory</h3>
          <p className="text-sm text-gray-600 mb-4">Current distribution of assets.</p>
          <div className="flex items-center justify-center">
            <DonutChartComponent
              data={propertyInventoryData}
              title=""
              colors={['#16a34a', '#3b82f6', '#1f2937']}
              height={250}
            />
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">
                <span className="inline-block w-3 h-3 bg-green-600 rounded mr-2"></span>
                Residential
              </span>
              <span className="font-semibold">68%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">
                <span className="inline-block w-3 h-3 bg-blue-600 rounded mr-2"></span>
                Commercial
              </span>
              <span className="font-semibold">24%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">
                <span className="inline-block w-3 h-3 bg-gray-900 rounded mr-2"></span>
                Industrial
              </span>
              <span className="font-semibold">9%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tax Collection & Activity */}
      <div className="grid grid-cols-2 gap-6">
        {/* Tax Collection Estimates */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Tax Collection Estimates</h3>
          <p className="text-sm text-gray-600 mb-4">Projected revenue vs. Historical averages.</p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Q3 2024 Projection</span>
                <span className="text-lg font-bold text-green-600">$12.4M</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-600" style={{ width: '80%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">YTD Actuals</span>
                <span className="text-lg font-bold text-blue-600">$24.1M</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Growth Rate</p>
              <p className="text-2xl font-bold text-green-600">+4.2%</p>
            </div>
            <div>
              <p className="text-gray-600">Variance</p>
              <p className="text-2xl font-bold text-blue-600">-0.8%</p>
            </div>
          </div>
        </div>

        {/* User Activity Logs */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">User Activity Logs</h3>
            <a href="#" className="text-green-600 text-sm hover:text-green-700">
              View All →
            </a>
          </div>
          <p className="text-sm text-gray-600 mb-4">Recent administrative and system actions.</p>
          <div className="space-y-3">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">{log.action}</span>
                    {getActivityBadge(log.severity)}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600">
                    <span>{log.parcel}</span>
                    <span>{log.timestamp}</span>
                    <span>{log.user}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Report Inventory */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Report Inventory - Current Queue</h3>
            <span className="text-sm text-gray-600">Last synced: 4 minutes ago</span>
          </div>
        </div>
        <DataTable
          columns={reportColumns}
          data={detailedReports}
          onView={(record) => setModal({ mode: 'view', record })}
          onEdit={(record) => setModal({ mode: 'edit', record })}
          onDelete={(record) => { if (confirm(`Delete ${record.name}?`)) setDetailedReports(items => items.filter(item => item.id !== record.id)); }}
          showActions={true}
        />
        {modal && <CrudModal title={`${modal.mode === 'create' ? 'Create' : modal.mode === 'edit' ? 'Edit' : 'View'} Report`} fields={reportFields} record={modal.record} readOnly={modal.mode === 'view'} onClose={() => setModal(null)} onSave={saveReport} />}
      </div>
    </div>
  );
};
