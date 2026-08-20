import React from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { BarChartComponent } from '../components/charts/BarChartComponent';
import { DataTable } from '../components/common/DataTable';

export const AiPropertyValuation: React.FC = () => {
  // Mock data for price index chart
  const priceIndexData = [
    { month: 'JAN', 'This Property': 680000, 'District Avg': 620000 },
    { month: 'FEB', 'This Property': 700000, 'District Avg': 630000 },
    { month: 'MAR', 'This Property': 720000, 'District Avg': 640000 },
    { month: 'APR', 'This Property': 760000, 'District Avg': 680000 },
    { month: 'MAY', 'This Property': 820000, 'District Avg': 710000 },
    { month: 'JUN', 'This Property': 850000, 'District Avg': 750000 },
    { month: 'JUL', 'This Property': 880000, 'District Avg': 780000 },
    { month: 'DEC', 'This Property': 842500, 'District Avg': 780000 },
  ];

  const comparableProperties = [
    {
      id: '1',
      address: '750 Evergreen Terrace',
      distance: '0.05 miles away',
      salePrice: '$655,000',
      sqft: '2,400',
      similarity: '98%',
      status: 'SOLD (2024)',
    },
    {
      id: '2',
      address: '730 Evergreen Terrace',
      distance: '0.03 miles away',
      salePrice: '$612,000',
      sqft: '2,150',
      similarity: '92%',
      status: 'SOLD (2023)',
    },
    {
      id: '3',
      address: '12 Oak Street',
      distance: '0.2 miles away',
      salePrice: '$800,000',
      sqft: '2,800',
      similarity: '86%',
      status: 'SOLD (2024)',
    },
  ];

  const getSimilarityBadge = (similarity: string) => {
    return (
      <div className="flex items-center gap-1">
        <div className="h-2 w-16 bg-gray-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600"
            style={{ width: similarity }}
          ></div>
        </div>
        <span className="text-sm font-medium">{similarity}</span>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        {status}
      </span>
    );
  };

  const comparableColumns = [
    { key: 'address', label: 'ADDRESS' },
    { key: 'distance', label: 'DISTANCE' },
    { key: 'salePrice', label: 'SALE PRICE' },
    { key: 'sqft', label: 'SQ FT' },
    { key: 'similarity', label: 'SIMILARITY', render: getSimilarityBadge },
    { key: 'status', label: 'STATUS', render: getStatusBadge },
  ];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Property Valuation Dossier</h1>
          <p className="text-gray-600 mt-1">
            Parcel ID: 124-44-002-1 | 742 Evergreen Terrace, Springfield
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.alert('PDF Export is currently in development.')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
            <Download size={18} />
            Export PDF
          </button>
          <button type="button" onClick={() => window.alert('Valuation approved successfully!')} className="flex items-center gap-2 px-4 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 transition">
            <CheckCircle2 size={18} />
            Approve Valuation
          </button>
        </div>
      </div>

      {/* Valuation Summary */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 p-8 rounded-lg shadow">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-gray-600 text-sm mb-2">Estimated Market Value</p>
            <h2 className="text-4xl font-bold text-gray-900">$842,500</h2>
            <p className="text-green-700 font-medium mt-2">+4.2% (YOY)</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-2">Confidence Score</p>
            <div className="flex items-center gap-2">
              <div className="relative w-32 h-32">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="8"
                    strokeDasharray={`${(94 / 100) * 351} 351`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">94%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Price Index Chart */}
        <div className="col-span-2">
          <BarChartComponent
            data={priceIndexData}
            title="Price Index vs. District Average"
            xAxisKey="month"
            bars={[
              { key: 'This Property', fill: '#1f2937', name: 'This Property' },
              { key: 'District Avg', fill: '#d1d5db', name: 'District Avg' },
            ]}
          />
        </div>

        {/* GIS Parcel View */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">GIS Parcel View</h3>
          <div className="bg-gradient-to-br from-green-100 to-blue-100 h-64 rounded-lg mb-4 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🗺️</div>
              <p className="text-gray-600 text-sm">Zone: Residential-Maui (R-2)</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Land Area</span>
              <span className="font-semibold">0.45 Acres</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Assessed</span>
              <span className="font-semibold">24 Jan 2023</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Market Pulse */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 text-white p-6 rounded-lg shadow">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">AI Market Pulse</h3>
            <p className="text-green-100 mb-4">
              Market liquidity in this sector is High. Average days-on-market for similar R-2 parcels
              has decreased by 12% in the last 60 days.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-green-200 text-xs">Demand Index</p>
                <p className="text-2xl font-bold">8.4/10</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Market Analysis Sections */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl mb-3">📈</div>
          <h3 className="font-semibold text-gray-900 mb-2">Market Trends</h3>
          <p className="text-sm text-gray-600">
            Significant uptick in local residential demand followed by tech corridor expansion.
            Compliance within 2-mile radius shows a consistent 15% premium over previous valuation
            cycles.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl mb-3">🏗️</div>
          <h3 className="font-semibold text-gray-900 mb-2">Infrastructure</h3>
          <p className="text-sm text-gray-600">
            Valuation includes a positive adjustment (+3.5%) due to the proximity to the upcoming
            Springfield Metro expansion and relieved municipal park improvements.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl mb-3">✨</div>
          <h3 className="font-semibold text-gray-900 mb-2">Asset Quality</h3>
          <p className="text-sm text-gray-600">
            Recent permit history indicates a high-grade HVAC overhaul and solar installation in 2023,
            contributing an estimated $42k in additional structural equity.
          </p>
        </div>
      </div>

      {/* Similar Property Comparables */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Similar Property Comparables (AI Selected)
          </h3>
          <a href="#" className="text-green-600 text-sm hover:text-green-700">
            View Map View →
          </a>
        </div>
        <DataTable
          columns={comparableColumns}
          data={comparableProperties}
          showActions={false}
        />
      </div>

      {/* Final Appraisal */}
      <div className="bg-green-50 border border-green-200 p-6 rounded-lg shadow flex items-start gap-4">
        <div className="text-4xl">✓</div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-2">Final Appraisal Recommendation</h3>
          <p className="text-gray-700 mb-4">
            All models converge on $842.5k. Ready for official assessment.
          </p>
          <button type="button" onClick={() => window.alert('Valuation finalized successfully!')} className="px-6 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition flex items-center gap-2">
            <CheckCircle2 size={18} />
            Approve & Finalize Valuation
          </button>
        </div>
        <button type="button" onClick={() => window.alert('Valuation flagged for manual review.')} className="px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition">
          Flag for Review
        </button>
      </div>
    </div>
  );
};
