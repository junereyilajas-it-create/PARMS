import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Save, 
  History, 
  Search, 
  Download, 
  RotateCcw, 
  Loader2
} from 'lucide-react';
import api from '../lib/api';
import { useModal } from '../contexts/ModalContext';
import { DataTable } from '../components/common/DataTable';

const LAGONGLONG_BARANGAYS = [
  'Dampil',
  'Gaston',
  'Kauswagan',
  'Lumbo',
  'Mabini',
  'Poblacion',
  'Tabok'
];

export const OperationalIntelligenceReports: React.FC = () => {
  const { showSuccess, showError } = useModal();
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  // Selected report type
  const [reportType, setReportType] = useState('semi-annual');

  // Report Specific Filter States
  const [semester, setSemester] = useState('January-June');
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [selectedPropType, setSelectedPropType] = useState('all');
  const [selectedClassification, setSelectedClassification] = useState('all');
  const [selectedAssessorId, setSelectedAssessorId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data states
  const [reportData, setReportData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [assessorsList, setAssessorsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Load assessors and user profile on mount
  useEffect(() => {
    api.get('/profile').then(res => setCurrentUser(res.data)).catch(console.error);
    api.get('/assessments/assessors').then(res => setAssessorsList(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    try {
      const res = await api.get('/reports/history');
      setHistoryData(res.data);
    } catch (e) {
      console.error('Failed to load report history:', e);
    }
  };

  const handleResetFilters = () => {
    setSelectedBarangay('all');
    setSelectedPropType('all');
    setSelectedClassification('all');
    setSelectedAssessorId('all');
    setSelectedStatus('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSemester('January-June');
    setYear(new Date().getFullYear().toString());
  };

  // Generate Report from Backend
  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      if (reportType === 'semi-annual') {
        const res = await api.get(`/reports/semi-annual?period=${encodeURIComponent(semester)}&year=${encodeURIComponent(year)}`);
        setReportData({ type: 'semi-annual', data: res.data });
      } else if (reportType === 'property-summary') {
        const queryParams = selectedBarangay !== 'all' ? `?barangay=${encodeURIComponent(selectedBarangay)}` : '';
        const res = await api.get(`/reports/property-summary${queryParams}`);
        setReportData({ type: 'property-summary', data: res.data });
      } else if (reportType === 'gis-summary') {
        const queryParams = selectedBarangay !== 'all' ? `?barangay=${encodeURIComponent(selectedBarangay)}` : '';
        const res = await api.get(`/reports/gis-summary${queryParams}`);
        setReportData({ type: 'gis-summary', data: res.data });
      } else if (reportType === 'assessed-value') {
        const params = new URLSearchParams();
        if (selectedBarangay !== 'all') params.append('barangay', selectedBarangay);
        if (selectedPropType !== 'all') params.append('property_type', selectedPropType);
        if (selectedClassification !== 'all') params.append('classification', selectedClassification);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (searchTerm.trim()) params.append('search', searchTerm.trim());

        const res = await api.get(`/reports/assessed-value?${params.toString()}`);
        setReportData({ type: 'assessed-value', data: res.data });
      } else if (reportType === 'new-assessments') {
        const params = new URLSearchParams();
        if (selectedAssessorId !== 'all') params.append('assessor_id', selectedAssessorId);
        if (selectedBarangay !== 'all') params.append('barangay', selectedBarangay);
        if (selectedStatus !== 'all') params.append('status', selectedStatus);
        if (selectedPropType !== 'all') params.append('property_type', selectedPropType);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (searchTerm.trim()) params.append('search', searchTerm.trim());

        const res = await api.get(`/reports/new-assessments?${params.toString()}`);
        setReportData({ type: 'new-assessments', data: res.data });
      }
    } catch (e: any) {
      showError(e.response?.data?.message || 'Failed to generate report from database.');
    } finally {
      setIsLoading(false);
    }
  };

  const getReportTitle = (type: string) => {
    const titles: Record<string, string> = {
      'semi-annual': 'Semi-Annual Assessment Report',
      'property-summary': 'Property Assessment Summary',
      'gis-summary': 'GIS / Tax Mapping Report',
      'assessed-value': 'Assessed Value Report',
      'new-assessments': 'New Assessment Report'
    };
    return titles[type] || 'Official Assessment Report';
  };

  const handleSaveToHistory = async () => {
    if (!reportData) return;
    try {
      const period = reportType === 'semi-annual' ? `${semester} ${year}` : new Date().toLocaleDateString();
      const count = 
        reportData.data?.summary?.record_count || 
        reportData.data?.summary?.total_new_assessments ||
        reportData.data?.summary?.total_properties || 
        reportData.data?.total_properties || 
        reportData.data?.total_mapped_properties || 
        reportData.data?.records?.length || 0;

      await api.post('/reports/history', {
        report_type: getReportTitle(reportType),
        reporting_period: period,
        record_count: count
      });
      showSuccess('Official report successfully saved to report history.');
      loadHistory();
    } catch (e: any) {
      showError(e.response?.data?.message || 'Failed to save report to history.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Export to CSV Functionality
  const handleExportCSV = () => {
    if (!reportData || !reportData.data) {
      showError('No report data available to export.');
      return;
    }

    let csvContent = '';
    const title = getReportTitle(reportType);
    const dateGenerated = new Date().toLocaleString();

    if (reportType === 'assessed-value' || reportType === 'new-assessments') {
      const rows = reportData.data.records || [];
      if (rows.length === 0) {
        showError('The current report dataset has no records to export.');
        return;
      }

      const headers = reportType === 'assessed-value' 
        ? ['Property ID', 'Type', 'Owner Name', 'Classification', 'Location', 'Market Value', 'Assessment Level (%)', 'Assessed Value', 'Assessment Date', 'Assessor']
        : ['Property ID', 'Type', 'Owner Name', 'Barangay', 'Status', 'Market Value', 'Assessed Value', 'Assessment Date', 'Assessor'];

      const csvRows = rows.map((r: any) => {
        if (reportType === 'assessed-value') {
          return [
            `"${r.target_id_str || r.property_id}"`,
            `"${r.property_type}"`,
            `"${(r.owner_name || '').replace(/"/g, '""')}"`,
            `"${r.classification}"`,
            `"${(r.location || '').replace(/"/g, '""')}"`,
            Number(r.market_value || 0).toFixed(2),
            Number(r.assessor_level || 0).toFixed(2),
            Number(r.assessed_value || 0).toFixed(2),
            `"${r.assessment_date ? new Date(r.assessment_date).toLocaleDateString() : ''}"`,
            `"${(r.assessor_name || '').replace(/"/g, '""')}"`
          ].join(',');
        } else {
          return [
            `"${r.target_id_str || r.property_id}"`,
            `"${r.property_type}"`,
            `"${(r.owner_name || '').replace(/"/g, '""')}"`,
            `"${r.barangay}"`,
            `"${r.assessment_status}"`,
            Number(r.market_value || 0).toFixed(2),
            Number(r.assessed_value || 0).toFixed(2),
            `"${r.assessment_date ? new Date(r.assessment_date).toLocaleDateString() : ''}"`,
            `"${(r.assessor_name || '').replace(/"/g, '""')}"`
          ].join(',');
        }
      });

      csvContent = [
        `# ${title}`,
        `# Generated: ${dateGenerated}`,
        headers.join(','),
        ...csvRows
      ].join('\r\n');
    } else if (reportType === 'semi-annual') {
      const summary = reportData.data.summary || {};
      const barangays = reportData.data.barangayActivity || [];

      csvContent = [
        `# SEMI-ANNUAL PROPERTY ASSESSMENT REPORT`,
        `# Reporting Period: ${reportData.data.period}`,
        `# Generated: ${dateGenerated}`,
        '',
        'Summary Metric,Count/Value',
        `Total Registered Properties,${summary.total_properties || 0}`,
        `Total Lots Registered,${summary.total_lots || 0}`,
        `Total Buildings Registered,${summary.total_buildings || 0}`,
        `Newly Assessed in Period,${summary.newly_assessed || 0}`,
        `Pending Assessments,${summary.pending_assessments || 0}`,
        `Active Assessment Assignments,${summary.active_assignments || 0}`,
        `Cancelled Assignments in Period,${summary.cancelled_assessments || 0}`,
        `Total Assessed Value (PHP),${Number(summary.total_assessed_value || 0).toFixed(2)}`,
        '',
        'Barangay,Total Properties,Total Lots,Total Buildings,Assessed Value (PHP)',
        ...barangays.map((b: any) => `"${b.barangay_name}",${b.total_properties},${b.total_lots},${b.total_buildings},${Number(b.total_assessed_value || 0).toFixed(2)}`)
      ].join('\r\n');
    } else if (reportType === 'property-summary') {
      const d = reportData.data || {};
      const classifications = d.byClassification || [];
      const barangays = d.byBarangay || [];

      csvContent = [
        `# PROPERTY ASSESSMENT SUMMARY REPORT`,
        `# Generated: ${dateGenerated}`,
        '',
        'Metric,Value',
        `Total Properties,${d.total_properties || 0}`,
        `Total Lots,${d.total_lots || 0}`,
        `Total Buildings,${d.total_buildings || 0}`,
        `Total Property Owners,${d.total_owners || 0}`,
        `Assessed Properties,${d.assessed_properties || 0}`,
        `Unassessed Properties,${d.unassessed_properties || 0}`,
        '',
        'Classification,Property Count,Total Assessed Value (PHP)',
        ...classifications.map((c: any) => `"${c.classification_name}",${c.count},${Number(c.total_assessed_value || 0).toFixed(2)}`),
        '',
        'Barangay,Total Properties,Lots,Buildings,Assessed Properties,Unassessed Properties',
        ...barangays.map((b: any) => `"${b.barangay_name}",${b.total_properties},${b.total_lots},${b.total_buildings},${b.assessed_properties},${b.unassessed_properties}`)
      ].join('\r\n');
    } else if (reportType === 'gis-summary') {
      const d = reportData.data || {};
      const barangays = d.byBarangay || [];

      csvContent = [
        `# GIS / TAX MAPPING SUMMARY REPORT`,
        `# Generated: ${dateGenerated}`,
        '',
        'Metric,Value',
        `Total Mapped Properties,${d.total_mapped_properties || 0}`,
        `Mapped Lots,${d.mapped_lots || 0}`,
        `Mapped Buildings,${d.mapped_buildings || 0}`,
        `Unmapped Properties,${d.unmapped_properties || 0}`,
        '',
        'Barangay,Total Properties,Mapped Count,Unmapped Count,Coverage (%)',
        ...barangays.map((b: any) => `"${b.barangay_name}",${b.total_properties},${b.mapped_count},${b.unmapped_count},${b.coverage_pct}%`)
      ].join('\r\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showSuccess('Report exported to CSV successfully.');
  };

  return (
    <div className="space-y-6 fade-in print:p-0 print:m-0 print:space-y-0">
      {/* Header - hide in print */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">Official Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Generate, export, print, and audit official assessment reports from database records.</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl self-start sm:self-auto border border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => setActiveTab('generate')} 
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'generate' 
                ? 'bg-white dark:bg-gray-700 shadow-sm text-green-700 dark:text-green-400' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Generate Report
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'history' 
                ? 'bg-white dark:bg-gray-700 shadow-sm text-green-700 dark:text-green-400' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <History size={16} /> Report History
          </button>
        </div>
      </div>

      {activeTab === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
          {/* Controls & Configuration Sidebar - hide in print */}
          <div className="lg:col-span-1 space-y-6 print:hidden">
            <div className="glass-panel p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Report Configuration</h2>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                  Report Type
                </label>
                <select 
                  value={reportType} 
                  onChange={(e) => {
                    setReportType(e.target.value);
                    setReportData(null);
                  }} 
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
                >
                  <option value="semi-annual">Semi-Annual Assessment Report</option>
                  <option value="property-summary">Property Assessment Summary</option>
                  <option value="assessed-value">Assessed Value Report</option>
                  <option value="new-assessments">New Assessment Report</option>
                  <option value="gis-summary">GIS / Tax Mapping Report</option>
                </select>
              </div>

              {/* REPORT SPECIFIC FILTERS */}
              {reportType === 'semi-annual' && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Reporting Semester</label>
                    <select 
                      value={semester} 
                      onChange={(e) => setSemester(e.target.value)} 
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="January-June">1st Semester (January - June)</option>
                      <option value="July-December">2nd Semester (July - December)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Calendar Year</label>
                    <input 
                      type="number" 
                      value={year} 
                      onChange={(e) => setYear(e.target.value)} 
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                    />
                  </div>
                </div>
              )}

              {reportType === 'property-summary' && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Filter by Barangay</label>
                    <select 
                      value={selectedBarangay} 
                      onChange={(e) => setSelectedBarangay(e.target.value)} 
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="all">All Barangays (Municipality-wide)</option>
                      {LAGONGLONG_BARANGAYS.map(b => (
                        <option key={b} value={b}>Brgy. {b}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {reportType === 'gis-summary' && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Filter by Barangay</label>
                    <select 
                      value={selectedBarangay} 
                      onChange={(e) => setSelectedBarangay(e.target.value)} 
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="all">All Barangays (Municipality-wide)</option>
                      {LAGONGLONG_BARANGAYS.map(b => (
                        <option key={b} value={b}>Brgy. {b}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {reportType === 'assessed-value' && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Search Identifier / Owner</label>
                    <input 
                      type="text"
                      placeholder="e.g. LOT-1, Alberto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Property Type</label>
                    <select 
                      value={selectedPropType} 
                      onChange={(e) => setSelectedPropType(e.target.value)} 
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="all">All Types</option>
                      <option value="lot">Lot Only</option>
                      <option value="building">Building Only</option>
                      <option value="property">Unified Property</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Barangay</label>
                    <select 
                      value={selectedBarangay} 
                      onChange={(e) => setSelectedBarangay(e.target.value)} 
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="all">All Barangays</option>
                      {LAGONGLONG_BARANGAYS.map(b => (
                        <option key={b} value={b}>Brgy. {b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                      <input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {reportType === 'new-assessments' && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Search Identifier / Owner</label>
                    <input 
                      type="text"
                      placeholder="e.g. LOT-1, Owner..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Assessor</label>
                    <select 
                      value={selectedAssessorId} 
                      onChange={(e) => setSelectedAssessorId(e.target.value)} 
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="all">All Field Assessors</option>
                      {assessorsList.map((a: any) => (
                        <option key={a.user_id} value={a.user_id}>{a.first_name} {a.last_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Assessment Status</label>
                    <select 
                      value={selectedStatus} 
                      onChange={(e) => setSelectedStatus(e.target.value)} 
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="approved">Approved</option>
                      <option value="submitted">Submitted / Awaiting Review</option>
                      <option value="draft">Draft</option>
                      <option value="returned">Returned</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Barangay</label>
                    <select 
                      value={selectedBarangay} 
                      onChange={(e) => setSelectedBarangay(e.target.value)} 
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="all">All Barangays</option>
                      {LAGONGLONG_BARANGAYS.map(b => (
                        <option key={b} value={b}>Brgy. {b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                      <input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button 
                  onClick={handleGenerate} 
                  disabled={isLoading} 
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      Generate Report
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full flex justify-center items-center gap-1.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                >
                  <RotateCcw size={13} /> Reset Filters
                </button>
              </div>
            </div>

            {/* ACTION BUTTONS (PRINT, EXPORT CSV, SAVE) */}
            {reportData && (
              <div className="glass-panel p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col gap-2.5">
                <button 
                  onClick={handlePrint} 
                  className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-xl font-medium text-xs transition-colors"
                >
                  <Printer size={15} /> Print Document
                </button>

                <button 
                  onClick={handleExportCSV} 
                  className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl font-medium text-xs transition-colors"
                >
                  <Download size={15} /> Export as CSV
                </button>

                <button 
                  onClick={handleSaveToHistory} 
                  className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-xs transition-colors shadow-xs"
                >
                  <Save size={15} /> Save to Official History
                </button>
              </div>
            )}
          </div>

          {/* Report Preview Document */}
          <div className="lg:col-span-3 glass-panel p-8 md:p-12 rounded-2xl bg-white dark:bg-gray-900 min-h-[800px] text-gray-900 dark:text-gray-100 print:shadow-none print:border-none print:w-full print:absolute print:left-0 print:top-0 print:bg-white print:text-black print:p-0">
            {reportData ? (
              <div className="max-w-3xl mx-auto font-serif">
                {/* Official Municipal Header */}
                <div className="text-center mb-8 border-b-2 border-black dark:border-white print:border-black pb-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 print:text-black">Republic of the Philippines</h2>
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 print:text-black">Province of Misamis Oriental</h3>
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 print:text-black">Municipality of Lagonglong</h3>
                  <h1 className="text-xl font-black uppercase mt-3 tracking-wide text-green-800 dark:text-green-400 print:text-black">Office of the Municipal Assessor</h1>
                  <p className="text-[11px] text-gray-500 print:text-black mt-1">Property Assessment and Records Management System (PARMS)</p>
                </div>

                {/* ========================================================================= */}
                {/* 1. SEMI-ANNUAL ASSESSMENT REPORT PREVIEW                                  */}
                {/* ========================================================================= */}
                {reportType === 'semi-annual' && reportData.type === 'semi-annual' && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <h2 className="text-lg font-bold underline uppercase tracking-wide">SEMI-ANNUAL PROPERTY ASSESSMENT REPORT</h2>
                      <p className="text-xs font-semibold mt-1">Reporting Period: {reportData.data.period} ({reportData.data.dateRange})</p>
                    </div>

                    <div className="space-y-4 text-sm font-sans">
                      <p className="font-bold underline text-sm font-serif">I. SUMMARY OF ASSESSMENTS & REAL PROPERTY INVENTORY</p>
                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 bg-gray-50 dark:bg-gray-800/40 print:bg-transparent p-4 rounded-xl border border-gray-200 dark:border-gray-700 print:border-black">
                        <span className="text-gray-600 dark:text-gray-300 print:text-black">Total Properties Registered:</span>
                        <span className="font-bold text-right text-gray-900 dark:text-white print:text-black">{reportData.data.summary.total_properties}</span>

                        <span className="text-gray-600 dark:text-gray-300 print:text-black">Total Lots Registered:</span>
                        <span className="font-bold text-right text-gray-900 dark:text-white print:text-black">{reportData.data.summary.total_lots}</span>

                        <span className="text-gray-600 dark:text-gray-300 print:text-black">Total Buildings Registered:</span>
                        <span className="font-bold text-right text-gray-900 dark:text-white print:text-black">{reportData.data.summary.total_buildings}</span>

                        <span className="text-gray-600 dark:text-gray-300 print:text-black">Newly Approved Assessments (in period):</span>
                        <span className="font-bold text-right text-green-700 dark:text-green-400 print:text-black">{reportData.data.summary.newly_assessed}</span>

                        <span className="text-gray-600 dark:text-gray-300 print:text-black">Pending Assessments Awaiting Review:</span>
                        <span className="font-bold text-right text-amber-600 dark:text-amber-400 print:text-black">{reportData.data.summary.pending_assessments}</span>

                        <span className="text-gray-600 dark:text-gray-300 print:text-black">Active Field Assignments:</span>
                        <span className="font-bold text-right text-blue-600 dark:text-blue-400 print:text-black">{reportData.data.summary.active_assignments}</span>

                        <span className="text-gray-600 dark:text-gray-300 print:text-black">Cancelled Assignments (in period):</span>
                        <span className="font-bold text-right text-red-600 dark:text-red-400 print:text-black">{reportData.data.summary.cancelled_assessments}</span>

                        <span className="font-bold text-gray-900 dark:text-white print:text-black pt-2 border-t border-gray-200 dark:border-gray-700">Total Assessed Value (Approved):</span>
                        <span className="font-bold text-right text-base text-green-700 dark:text-green-400 print:text-black pt-2 border-t border-gray-200 dark:border-gray-700">
                          ₱{Number(reportData.data.summary.total_assessed_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 text-sm font-sans">
                      <p className="font-bold underline text-sm font-serif">II. ASSESSMENT ACTIVITY BY BARANGAY</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse border border-gray-300 dark:border-gray-600 print:border-black">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                              <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-left">Barangay</th>
                              <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Properties</th>
                              <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Lots</th>
                              <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Buildings</th>
                              <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Total Assessed Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.data.barangayActivity?.map((b: any) => (
                              <tr key={b.barangay_name} className="hover:bg-gray-50/50">
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 font-medium">Brgy. {b.barangay_name}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">{b.total_properties}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">{b.total_lots}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">{b.total_buildings}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right font-semibold">
                                  ₱{Number(b.total_assessed_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* 2. PROPERTY ASSESSMENT SUMMARY PREVIEW                                    */}
                {/* ========================================================================= */}
                {reportType === 'property-summary' && reportData.type === 'property-summary' && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <h2 className="text-lg font-bold underline uppercase tracking-wide">PROPERTY ASSESSMENT SUMMARY REPORT</h2>
                      <p className="text-xs font-semibold mt-1">Comprehensive Municipal Inventory as of {new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 font-sans">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[11px] text-gray-500 uppercase block font-semibold">Registered Properties</span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">{reportData.data.total_properties}</span>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800 text-center">
                        <span className="text-[11px] text-green-700 dark:text-green-300 uppercase block font-semibold">Assessed Properties</span>
                        <span className="text-xl font-bold text-green-700 dark:text-green-400">{reportData.data.assessed_properties}</span>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                        <span className="text-[11px] text-amber-700 dark:text-amber-300 uppercase block font-semibold">Unassessed Properties</span>
                        <span className="text-xl font-bold text-amber-700 dark:text-amber-400">{reportData.data.unassessed_properties}</span>
                      </div>
                    </div>

                    <div className="space-y-3 font-sans text-xs">
                      <p className="font-bold underline text-sm font-serif">I. CLASSIFICATION BREAKDOWN</p>
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 print:border-black">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-left">Property Classification</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Count</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Total Assessed Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.byClassification?.map((c: any) => (
                            <tr key={c.classification_name}>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 font-medium">{c.classification_name}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">{c.count}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right font-semibold">
                                ₱{Number(c.total_assessed_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 font-sans text-xs">
                      <p className="font-bold underline text-sm font-serif">II. BARANGAY SUMMARY</p>
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 print:border-black">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-left">Barangay</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Total</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Lots</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Buildings</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Assessed</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Unassessed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.byBarangay?.map((b: any) => (
                            <tr key={b.barangay_name}>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 font-medium">Brgy. {b.barangay_name}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right font-bold">{b.total_properties}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">{b.total_lots}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">{b.total_buildings}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right text-green-700 dark:text-green-400 font-semibold">{b.assessed_properties}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right text-amber-700 dark:text-amber-400 font-semibold">{b.unassessed_properties}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* 3. GIS / TAX MAPPING SUMMARY PREVIEW                                      */}
                {/* ========================================================================= */}
                {reportType === 'gis-summary' && reportData.type === 'gis-summary' && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <h2 className="text-lg font-bold underline uppercase tracking-wide">GIS & TAX MAPPING SUMMARY REPORT</h2>
                      <p className="text-xs font-semibold mt-1">Spatial Inventory & Coordinate Status as of {new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="grid grid-cols-4 gap-2 font-sans">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] text-gray-500 uppercase block font-semibold">Mapped Properties</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{reportData.data.total_mapped_properties}</span>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase block font-semibold">Mapped Lots</span>
                        <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{reportData.data.mapped_lots}</span>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 text-center">
                        <span className="text-[10px] text-purple-700 dark:text-purple-300 uppercase block font-semibold">Mapped Buildings</span>
                        <span className="text-lg font-bold text-purple-700 dark:text-purple-400">{reportData.data.mapped_buildings}</span>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase block font-semibold">Unmapped</span>
                        <span className="text-lg font-bold text-amber-700 dark:text-amber-400">{reportData.data.unmapped_properties}</span>
                      </div>
                    </div>

                    <div className="space-y-3 font-sans text-xs">
                      <p className="font-bold underline text-sm font-serif">BARANGAY GIS MAPPING COVERAGE</p>
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 print:border-black">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-left">Barangay</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Total Properties</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Mapped</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Unmapped</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">Coverage (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.byBarangay?.map((b: any) => (
                            <tr key={b.barangay_name}>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 font-medium">Brgy. {b.barangay_name}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right">{b.total_properties}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right text-green-700 dark:text-green-400 font-semibold">{b.mapped_count}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right text-gray-500">{b.unmapped_count}</td>
                              <td className="border border-gray-300 dark:border-gray-600 print:border-black p-2 text-right font-bold text-green-800 dark:text-green-300">{b.coverage_pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* 4. ASSESSED VALUE REPORT PREVIEW                                          */}
                {/* ========================================================================= */}
                {reportType === 'assessed-value' && reportData.type === 'assessed-value' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-lg font-bold underline uppercase tracking-wide">ASSESSED VALUE REPORT</h2>
                      <p className="text-xs font-semibold mt-1">Approved Municipal Property Assessments as of {new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="grid grid-cols-4 gap-2 font-sans">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] text-gray-500 uppercase block font-semibold">Total Records</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{reportData.data.summary?.record_count || 0}</span>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] text-gray-500 uppercase block font-semibold">Avg. Assessment Level</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{reportData.data.summary?.average_assessment_level || 0}%</span>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                        <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase block font-semibold">Total Market Value</span>
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-300 block truncate">
                          ₱{Number(reportData.data.summary?.total_market_value || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800 text-center">
                        <span className="text-[10px] text-green-700 dark:text-green-300 uppercase block font-semibold">Total Assessed Value</span>
                        <span className="text-sm font-bold text-green-800 dark:text-green-300 block truncate">
                          ₱{Number(reportData.data.summary?.total_assessed_value || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto font-sans">
                      <table className="w-full text-[11px] border-collapse border border-gray-300 dark:border-gray-600 print:border-black">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Property ID</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Type</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Owner</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Classification</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Barangay</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right">Market Value</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right">Assessed Value</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.records?.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-4 text-center text-gray-400">No approved assessments match the selected filters.</td>
                            </tr>
                          ) : (
                            reportData.data.records?.map((r: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50/50">
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 font-bold">{r.target_id_str || r.property_id}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5">{r.property_type}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5">{r.owner_name}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5">{r.classification}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5">{r.barangay}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right">₱{Number(r.market_value || 0).toLocaleString()}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right font-bold text-green-700 dark:text-green-400 print:text-black">
                                  ₱{Number(r.assessed_value || 0).toLocaleString()}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right">
                                  {r.assessment_date ? new Date(r.assessment_date).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* 5. NEW ASSESSMENT REPORT PREVIEW                                          */}
                {/* ========================================================================= */}
                {reportType === 'new-assessments' && reportData.type === 'new-assessments' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-lg font-bold underline uppercase tracking-wide">NEW ASSESSMENT REPORT</h2>
                      <p className="text-xs font-semibold mt-1">Assessment Records & Field Appraisal Submissions as of {new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="grid grid-cols-4 gap-2 font-sans">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] text-gray-500 uppercase block font-semibold">Total Assessments</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{reportData.data.summary?.total_new_assessments || 0}</span>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800 text-center">
                        <span className="text-[10px] text-green-700 dark:text-green-300 uppercase block font-semibold">Approved</span>
                        <span className="text-lg font-bold text-green-700 dark:text-green-400">{reportData.data.summary?.approved_count || 0}</span>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase block font-semibold">Pending Review</span>
                        <span className="text-lg font-bold text-amber-700 dark:text-amber-400">{reportData.data.summary?.pending_count || 0}</span>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                        <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase block font-semibold">Assessed Total</span>
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-300 block truncate">
                          ₱{Number(reportData.data.summary?.total_assessed_value || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto font-sans">
                      <table className="w-full text-[11px] border-collapse border border-gray-300 dark:border-gray-600 print:border-black">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Property ID</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Owner</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Barangay</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Assessor</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-left">Status</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right">Assessed Value</th>
                            <th className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.records?.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-gray-400">No assessments match the selected filters.</td>
                            </tr>
                          ) : (
                            reportData.data.records?.map((r: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50/50">
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 font-bold">{r.target_id_str || r.property_id}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5">{r.owner_name}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5">{r.barangay}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 font-medium">{r.assessor_name}</td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    r.assessment_status === 'approved' ? 'bg-green-100 text-green-800' :
                                    r.assessment_status === 'submitted' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {r.assessment_status?.toUpperCase()}
                                  </span>
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right font-bold text-green-700 dark:text-green-400 print:text-black">
                                  ₱{Number(r.assessed_value || 0).toLocaleString()}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 print:border-black p-1.5 text-right">
                                  {r.assessment_date ? new Date(r.assessment_date).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Official Signatures - preserved and styled for print */}
                <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm font-sans pt-6 border-t border-gray-300 dark:border-gray-700 print:border-black">
                  <div>
                    <p className="text-gray-500 print:text-black text-xs">Prepared by:</p>
                    <div className="mt-8">
                      <p className="font-bold uppercase underline decoration-black print:decoration-black dark:decoration-white underline-offset-4 text-gray-900 dark:text-white print:text-black">
                        {currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Junerey D. Ilajas'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 print:text-black font-semibold mt-0.5">Municipal Assessor</p>
                      <p className="text-[11px] text-gray-400 print:text-black mt-1">Date: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500 print:text-black text-xs">Submitted to:</p>
                    <div className="mt-8">
                      <p className="font-bold uppercase text-gray-900 dark:text-white print:text-black">Hon. Municipal Mayor</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 print:text-black font-semibold mt-0.5">& Sangguniang Bayan</p>
                      <p className="text-[11px] text-gray-400 print:text-black mt-1">Municipality of Lagonglong</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-gray-400">
                <FileText size={64} className="mb-4 opacity-40 text-green-600" />
                <p className="font-semibold text-gray-600 dark:text-gray-300">Select Report Configuration and click "Generate Report"</p>
                <p className="text-xs text-gray-400 mt-1">Real-time calculations and official printable municipal documents will load here.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* REPORT HISTORY TAB (DATABASE BACKED)                                      */
        /* ========================================================================= */
        <div className="glass-panel p-6 rounded-2xl border border-gray-100 dark:border-gray-700 print:hidden space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Generated Report History</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Historical official reports saved to persistent database audit records.</p>
            </div>
            <button
              onClick={loadHistory}
              className="text-xs font-semibold text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1"
            >
              <RotateCcw size={13} /> Refresh History
            </button>
          </div>

          <DataTable
            columns={[
              { key: 'report_id', label: 'Report ID' },
              { key: 'report_type', label: 'Report Title' },
              { key: 'reporting_period', label: 'Period' },
              { key: 'record_count', label: 'Records' },
              { 
                key: 'status', 
                label: 'Status',
                render: (val) => (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {val || 'Generated'}
                  </span>
                )
              },
              { key: 'generated_date', label: 'Generated Date', render: (val) => new Date(val).toLocaleString() },
              { key: 'first_name', label: 'Generated By', render: (_, row) => `${row.first_name || ''} ${row.last_name || ''}` }
            ]}
            data={historyData}
          />
        </div>
      )}
    </div>
  );
};
