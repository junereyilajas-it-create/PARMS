import React, { useState, useEffect } from 'react';
import { FileText, Printer, Save, History, Search } from 'lucide-react';
import api from '../lib/api';
import { useModal } from '../contexts/ModalContext';
import { DataTable } from '../components/common/DataTable';

export const OperationalIntelligenceReports: React.FC = () => {
  const { showSuccess, showError } = useModal();
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  const [reportType, setReportType] = useState('semi-annual');
  const [semester, setSemester] = useState('January-June');
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const [reportData, setReportData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
    // Get current user for signature
    api.get('/profile').then(res => setCurrentUser(res.data)).catch(console.error);
  }, [activeTab]);

  const loadHistory = async () => {
    try {
      const res = await api.get('/reports/history');
      setHistoryData(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      if (reportType === 'semi-annual') {
        const res = await api.get(`/reports/semi-annual?period=${semester}&year=${year}`);
        setReportData({ type: 'semi-annual', data: res.data });
      } else if (reportType === 'property-summary') {
        const res = await api.get(`/reports/property-summary`);
        setReportData({ type: 'property-summary', data: res.data });
      } else if (reportType === 'gis-summary') {
        const res = await api.get(`/reports/gis-summary`);
        setReportData({ type: 'gis-summary', data: res.data });
      } else if (reportType === 'assessed-value') {
        const res = await api.get(`/reports/assessed-value`);
        setReportData({ type: 'assessed-value', data: res.data });
      } else if (reportType === 'new-assessments') {
        const res = await api.get(`/reports/new-assessments`);
        setReportData({ type: 'new-assessments', data: res.data });
      } else if (reportType === 'cancellation-modification') {
        const res = await api.get(`/reports/cancellation-modification`);
        setReportData({ type: 'cancellation-modification', data: res.data });
      } else if (reportType === 'appeals') {
        const res = await api.get(`/reports/appeals`);
        setReportData({ type: 'appeals', data: res.data });
      }
    } catch (e: any) {
      showError(e.response?.data?.message || 'Failed to generate report.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!reportData) return;
    try {
      const period = reportType === 'semi-annual' ? `${semester} ${year}` : new Date().toLocaleDateString();
      const count = reportData.data?.summary?.total_properties || reportData.data?.total_properties || reportData.data?.total_mapped_properties || 0;

      const getReportTitle = (type: string) => {
        const titles: Record<string, string> = {
          'semi-annual': 'Semi-Annual Assessment Report',
          'property-summary': 'Property Assessment Summary',
          'gis-summary': 'GIS / Tax Mapping Report',
          'assessed-value': 'Assessed Value Report',
          'new-assessments': 'New Assessment Report',
          'cancellation-modification': 'Cancellation and Modification Report',
          'appeals': 'Assessment Appeal Report'
        };
        return titles[type] || 'Official Report';
      };

      await api.post('/reports/history', {
        report_type: getReportTitle(reportType),
        reporting_period: period,
        record_count: count
      });
      showSuccess('Official report saved to history.');
    } catch (e: any) {
      showError(e.response?.data?.message || 'Failed to save report.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 fade-in print:p-0 print:m-0 print:space-y-0">
      {/* Header - hide in print */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">Official Reports</h1>
          <p className="text-gray-500 mt-2">Generate, print, and manage official assessment reports for the Municipal Mayor.</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button onClick={() => setActiveTab('generate')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'generate' ? 'bg-white dark:bg-gray-700 shadow text-green-600' : 'text-gray-500 hover:text-gray-900'}`}>Generate Report</button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'bg-white dark:bg-gray-700 shadow text-green-600' : 'text-gray-500 hover:text-gray-900'}`}><History size={16} /> Report History</button>
        </div>
      </div>

      {activeTab === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
          {/* Filters - hide in print */}
          <div className="lg:col-span-1 space-y-6 print:hidden">
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-4">Report Configuration</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Report Type</label>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                    <option value="semi-annual">Semi-Annual Assessment Report</option>
                    <option value="property-summary">Property Assessment Summary</option>
                    <option value="assessed-value">Assessed Value Report</option>
                    <option value="new-assessments">New Assessment Report</option>
                    <option value="cancellation-modification">Cancellation and Modification Report</option>
                    <option value="gis-summary">GIS / Tax Mapping Report</option>
                    <option value="appeals">Assessment Appeal Report</option>
                  </select>
                </div>

                {reportType === 'semi-annual' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                      <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                        <option value="January-June">January-June</option>
                        <option value="July-December">July-December</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
                      <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                    </div>
                  </>
                )}

                <button onClick={handleGenerate} disabled={isLoading} className="w-full mt-4 flex justify-center items-center gap-2 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                  <Search size={18} />
                  {isLoading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>

            {reportData && (
              <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
                <button onClick={handlePrint} className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg font-medium transition-colors">
                  <Printer size={18} /> Print Document
                </button>
                <button onClick={handleSaveToHistory} className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                  <Save size={18} /> Save Official Report
                </button>
              </div>
            )}
          </div>

          {/* Report Preview */}
          <div className="lg:col-span-3 glass-panel p-8 md:p-12 rounded-2xl bg-white dark:bg-gray-900 min-h-[800px] text-gray-900 dark:text-gray-100 print:shadow-none print:border-none print:w-full print:absolute print:left-0 print:top-0 print:bg-white print:text-black print:p-0">
            {reportData ? (
              <div className="max-w-3xl mx-auto font-serif">
                {/* Official Header */}
                <div className="text-center mb-10 border-b-2 border-black dark:border-white pb-6">
                  <h2 className="text-xl font-bold uppercase tracking-wider">Republic of the Philippines</h2>
                  <h3 className="text-lg font-bold">Province of Misamis Oriental</h3>
                  <h3 className="text-lg font-bold">Municipality of Lagonglong</h3>
                  <br />
                  <h1 className="text-2xl font-black uppercase mt-4">Municipal Assessor's Office</h1>
                </div>

                {reportType === 'semi-annual' && reportData.type === 'semi-annual' && (
                  <div className="space-y-8">
                    <h2 className="text-xl font-bold text-center underline">SEMI-ANNUAL PROPERTY ASSESSMENT REPORT</h2>
                    <p className="text-center font-bold">Reporting Period: {reportData.data.period}</p>

                    <div className="mt-8 space-y-2 text-lg">
                      <p className="font-bold underline mb-4">I. SUMMARY OF ASSESSMENTS</p>
                      <div className="grid grid-cols-2 gap-4 ml-4">
                        <span>Total Properties in Database:</span> <span className="font-bold">{reportData.data.summary.total_properties}</span>
                        <span>Newly Assessed Properties:</span> <span className="font-bold">{reportData.data.summary.newly_assessed}</span>
                        <span>Modified Assessments:</span> <span className="font-bold">{reportData.data.summary.modified_assessments}</span>
                        <span>Cancelled Assessments:</span> <span className="font-bold">{reportData.data.summary.cancelled_assessments}</span>
                        <span>Pending Assessments:</span> <span className="font-bold text-green-600 print:text-black">{reportData.data.summary.pending_assessments}</span>
                        <span className="mt-2 font-bold">Total Assessed Value:</span> <span className="mt-2 font-bold text-xl">₱{Number(reportData.data.summary.total_assessed_value || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mt-8 text-lg">
                      <p className="font-bold underline mb-4">II. ASSESSMENT ACTIVITY BY BARANGAY</p>
                      <table className="w-full border-collapse border border-gray-400 dark:border-gray-600 print:border-black ml-4">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-400 dark:border-gray-600 print:border-black p-2 text-left">Barangay</th>
                            <th className="border border-gray-400 dark:border-gray-600 print:border-black p-2 text-right">Total Properties</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.barangayActivity?.map((b: any) => (
                            <tr key={b.barangay_name}>
                              <td className="border border-gray-400 dark:border-gray-600 print:border-black p-2">{b.barangay_name}</td>
                              <td className="border border-gray-400 dark:border-gray-600 print:border-black p-2 text-right">{b.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {reportType === 'property-summary' && reportData.type === 'property-summary' && (
                  <div className="space-y-8">
                    <h2 className="text-xl font-bold text-center underline">PROPERTY ASSESSMENT SUMMARY</h2>
                    <p className="text-center">As of {new Date().toLocaleDateString()}</p>

                    <div className="mt-8 space-y-2 text-lg">
                      <div className="grid grid-cols-2 gap-4 ml-4">
                        <span>Total Properties Registered:</span> <span className="font-bold">{reportData.data.total_properties}</span>
                        <span>Total Lots Registered:</span> <span className="font-bold">{reportData.data.total_lots}</span>
                        <span>Total Buildings Registered:</span> <span className="font-bold">{reportData.data.total_buildings}</span>
                        <br />
                        <span>Properties with Approved Assessments:</span> <span className="font-bold text-green-700 print:text-black">{reportData.data.assessed_properties}</span>
                        <span>Properties Pending Assessment:</span> <span className="font-bold text-green-600 print:text-black">{reportData.data.unassessed_properties}</span>
                      </div>
                    </div>
                  </div>
                )}

                {reportType === 'gis-summary' && reportData.type === 'gis-summary' && (
                  <div className="space-y-8">
                    <h2 className="text-xl font-bold text-center underline">GIS / TAX MAPPING SUMMARY REPORT</h2>
                    <p className="text-center">As of {new Date().toLocaleDateString()}</p>

                    <div className="mt-8 space-y-2 text-lg">
                      <div className="grid grid-cols-2 gap-4 ml-4">
                        <span>Total Mapped Properties:</span> <span className="font-bold">{reportData.data.total_mapped_properties}</span>
                        <span>Mapped Lots:</span> <span className="font-bold">{reportData.data.mapped_lots}</span>
                        <span>Mapped Buildings:</span> <span className="font-bold">{reportData.data.mapped_buildings}</span>
                        <br />
                        <span>Unmapped Properties (Missing Coordinates):</span> <span className="font-bold text-green-600 print:text-black">{reportData.data.unmapped_properties}</span>
                      </div>
                    </div>
                  </div>
                )}

                {reportType === 'assessed-value' && reportData.type === 'assessed-value' && (
                  <div className="space-y-8">
                    <h2 className="text-xl font-bold text-center underline">ASSESSED VALUE REPORT</h2>
                    <p className="text-center">As of {new Date().toLocaleDateString()}</p>
                    <div className="mt-8">
                      <table className="w-full text-sm border-collapse border border-gray-400">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-400 p-2 text-left">Property ID</th>
                            <th className="border border-gray-400 p-2 text-left">Owner</th>
                            <th className="border border-gray-400 p-2 text-left">Type/Class</th>
                            <th className="border border-gray-400 p-2 text-left">Location</th>
                            <th className="border border-gray-400 p-2 text-right">Market Value</th>
                            <th className="border border-gray-400 p-2 text-right">Assessed Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data?.map((r: any, idx: number) => (
                            <tr key={idx}>
                              <td className="border border-gray-400 p-2">{r.property_id}</td>
                              <td className="border border-gray-400 p-2">{r.owner_name}</td>
                              <td className="border border-gray-400 p-2">{r.property_type} - {r.classification}</td>
                              <td className="border border-gray-400 p-2">{r.location}</td>
                              <td className="border border-gray-400 p-2 text-right">₱{Number(r.market_value).toLocaleString()}</td>
                              <td className="border border-gray-400 p-2 text-right">₱{Number(r.assessed_value).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {reportType === 'new-assessments' && reportData.type === 'new-assessments' && (
                  <div className="space-y-8">
                    <h2 className="text-xl font-bold text-center underline">NEW ASSESSMENT REPORT</h2>
                    <p className="text-center">As of {new Date().toLocaleDateString()}</p>
                    <div className="mt-8">
                      <table className="w-full text-sm border-collapse border border-gray-400">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-400 p-2 text-left">Property ID</th>
                            <th className="border border-gray-400 p-2 text-left">Owner</th>
                            <th className="border border-gray-400 p-2 text-left">Barangay</th>
                            <th className="border border-gray-400 p-2 text-left">Assessor</th>
                            <th className="border border-gray-400 p-2 text-right">Assessed Value</th>
                            <th className="border border-gray-400 p-2 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data?.map((r: any, idx: number) => (
                            <tr key={idx}>
                              <td className="border border-gray-400 p-2">{r.property_id}</td>
                              <td className="border border-gray-400 p-2">{r.owner_name}</td>
                              <td className="border border-gray-400 p-2">{r.barangay}</td>
                              <td className="border border-gray-400 p-2">{r.assessor_name}</td>
                              <td className="border border-gray-400 p-2 text-right">₱{Number(r.assessed_value).toLocaleString()}</td>
                              <td className="border border-gray-400 p-2 text-right">{new Date(r.assessment_date).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {reportType === 'cancellation-modification' && reportData.type === 'cancellation-modification' && (
                  <div className="space-y-8">
                    <h2 className="text-xl font-bold text-center underline">CANCELLATION AND MODIFICATION REPORT</h2>
                    <p className="text-center">As of {new Date().toLocaleDateString()}</p>
                    <div className="mt-8">
                      <table className="w-full text-sm border-collapse border border-gray-400">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-400 p-2 text-left">Property ID</th>
                            <th className="border border-gray-400 p-2 text-left">Owner</th>
                            <th className="border border-gray-400 p-2 text-left">Action</th>
                            <th className="border border-gray-400 p-2 text-left">Performed By</th>
                            <th className="border border-gray-400 p-2 text-left">Status</th>
                            <th className="border border-gray-400 p-2 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data?.map((r: any, idx: number) => (
                            <tr key={idx}>
                              <td className="border border-gray-400 p-2">{r.property_id}</td>
                              <td className="border border-gray-400 p-2">{r.owner_name}</td>
                              <td className="border border-gray-400 p-2">{r.action_type}</td>
                              <td className="border border-gray-400 p-2">{r.performed_by}</td>
                              <td className="border border-gray-400 p-2">{r.approval_status}</td>
                              <td className="border border-gray-400 p-2 text-right">{new Date(r.date).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {reportType === 'appeals' && reportData.type === 'appeals' && (
                  <div className="space-y-8">
                    <h2 className="text-xl font-bold text-center underline">ASSESSMENT APPEAL REPORT</h2>
                    <p className="text-center">As of {new Date().toLocaleDateString()}</p>
                    <div className="mt-8">
                      <table className="w-full text-sm border-collapse border border-gray-400">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-gray-400 p-2 text-left">Property ID</th>
                            <th className="border border-gray-400 p-2 text-left">Owner</th>
                            <th className="border border-gray-400 p-2 text-left">Reason</th>
                            <th className="border border-gray-400 p-2 text-left">Status</th>
                            <th className="border border-gray-400 p-2 text-left">Officer</th>
                            <th className="border border-gray-400 p-2 text-right">Filed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data?.map((r: any, idx: number) => (
                            <tr key={idx}>
                              <td className="border border-gray-400 p-2">{r.property_id}</td>
                              <td className="border border-gray-400 p-2">{r.owner_name}</td>
                              <td className="border border-gray-400 p-2">{r.reason}</td>
                              <td className="border border-gray-400 p-2">{r.current_status}</td>
                              <td className="border border-gray-400 p-2">{r.responsible_officer || '-'}</td>
                              <td className="border border-gray-400 p-2 text-right">{new Date(r.date_filed).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Signatures */}
                <div className="mt-24 grid grid-cols-2 gap-8 text-center text-lg">
                  <div>
                    <p>Prepared by:</p>
                    <br /><br />
                    <p className="font-bold uppercase underline decoration-black dark:decoration-white underline-offset-4">{currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : '______________________'}</p>
                    <p>Municipal Assessor</p>
                    <p className="text-sm mt-2">Date: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p>Submitted to:</p>
                    <br /><br />
                    <p className="font-bold uppercase">Municipal Mayor</p>
                    <p>& Sangguniang Bayan</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText size={64} className="mb-4 opacity-50" />
                <p>Select a report type and click "Generate Report" to preview.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-2xl print:hidden">
          <DataTable
            columns={[
              { key: 'report_id', label: 'Report ID' },
              { key: 'report_type', label: 'Report Type' },
              { key: 'reporting_period', label: 'Period' },
              { key: 'record_count', label: 'Records' },
              { key: 'status', label: 'Status' },
              { key: 'generated_date', label: 'Generated Date', render: (val) => new Date(val).toLocaleString() },
              { key: 'first_name', label: 'Generated By', render: (_, row) => `${row.first_name} ${row.last_name}` }
            ]}
            data={historyData}
          />
        </div>
      )}
    </div>
  );
};
