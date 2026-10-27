import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Printer, Download, Eye, ArrowLeft, 
  AlertCircle, CheckCircle2, AlertTriangle, 
  Building2, SquareDashed,
  FileText, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import api from '../lib/api';
import { useModal } from '../contexts/ModalContext';

export interface PropertyTaxRow {
  computation_id?: number | null;
  computation_number?: string;
  property_id: number;
  property_code: string;
  property_type: 'lot' | 'building' | 'property';
  target_id_int: number;
  target_id_str: string;
  owner_id?: number;
  owner_name: string;
  owner_email?: string;
  owner_contact?: string;
  property_address: string;
  barangay: string;
  classification: string;
  actual_use: string;
  land_area?: number | string | null;
  building_area?: number | string | null;
  tax_year: number;
  market_value: number;
  assessment_level: number;
  assessed_value: number;
  basic_tax_rate: number;
  basic_tax_amount: number;
  sef_tax_rate: number;
  sef_tax_amount: number;
  other_levies_amount: number;
  discount_amount: number;
  penalty_interest_amount: number;
  total_computed_tax: number;
  computation_status: string;
  assessment_approval_status: string;
  is_complete: boolean;
  incomplete_reason?: string | null;
  computation_date: string;
  rule_version_snapshot?: any;
  disclaimer: string;
}

export interface ReportStats {
  total_eligible_properties: number;
  approved_computed_count: number;
  incomplete_count: number;
  total_market_value: number;
  total_assessed_value: number;
  total_basic_tax: number;
  total_sef_tax: number;
  total_computed_tax: number;
  tax_year: number;
  generated_at: string;
}

export interface BreakdownItem {
  description: string;
  amount: number;
  formatted: string;
  is_total?: boolean;
}

export interface PropertyTaxReportsProps {
  preselectedDeclaration?: any;
  onClearPreselectedDeclaration?: () => void;
  hideStandaloneHeader?: boolean;
}

export function PropertyTaxReports({
  preselectedDeclaration,
  onClearPreselectedDeclaration,
  hideStandaloneHeader = false
}: PropertyTaxReportsProps = {}) {
  const { showError, showSuccess } = useModal();
  const printableRef = useRef<HTMLDivElement>(null);

  // View state: 'all' or 'specific'
  const [viewMode, setViewMode] = useState<'all' | 'specific'>('all');

  // Filters for All Properties
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [classificationFilter, setClassificationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('property_id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // All Properties Report State
  const [properties, setProperties] = useState<PropertyTaxRow[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  // Specific Property Report State
  const [selectedProperty, setSelectedProperty] = useState<PropertyTaxRow | null>(null);
  const [breakdownTable, setBreakdownTable] = useState<BreakdownItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Load All Properties Report
  const fetchAllPropertiesReport = async () => {
    try {
      setLoading(true);
      const params: any = {
        year: taxYear,
        page: currentPage,
        limit: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (barangayFilter !== 'ALL') params.barangay = barangayFilter;
      if (typeFilter !== 'ALL') params.property_type = typeFilter;
      if (classificationFilter !== 'ALL') params.classification = classificationFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get('/tax-computations/all-properties-report', { params });
      setProperties(res.data.properties || []);
      setStats(res.data.stats || null);
      setTotalPages(res.data.pagination?.total_pages || 1);
      setTotalRecords(res.data.pagination?.total_records || 0);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load property tax reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPropertiesReport();
  }, [taxYear, barangayFilter, typeFilter, classificationFilter, statusFilter, sortBy, sortDir, currentPage, pageSize]);

  // Debounced Search handler
  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      fetchAllPropertiesReport();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Handle cross-tab selection from Declarations
  useEffect(() => {
    if (preselectedDeclaration) {
      handleSelectPropertyByTarget(
        preselectedDeclaration.property_type || 'lot',
        preselectedDeclaration.target_id_str || preselectedDeclaration.property_id
      );
    }
  }, [preselectedDeclaration]);

  // Select a property for Individual Report
  const handleSelectProperty = async (prop: PropertyTaxRow) => {
    try {
      setLoadingDetail(true);
      setSelectedProperty(prop);
      setViewMode('specific');

      const res = await api.get(`/tax-computations/property-report/${prop.property_type}/${prop.target_id_str || prop.property_id}`, {
        params: { year: taxYear }
      });

      if (res.data.property) {
        setSelectedProperty(res.data.property);
      }
      setBreakdownTable(res.data.breakdown_table || []);
    } catch (err: any) {
      console.warn('Error loading property tax breakdown:', err);
      // Fallback to client-side calculated breakdown
      buildFallbackBreakdown(prop);
    } finally {
      setLoadingDetail(false);
      setIsSelectorOpen(false);
    }
  };

  const handleSelectPropertyByTarget = async (type: string, id: string | number) => {
    try {
      setLoadingDetail(true);
      setViewMode('specific');
      const res = await api.get(`/tax-computations/property-report/${type}/${id}`, {
        params: { year: taxYear }
      });
      setSelectedProperty(res.data.property);
      setBreakdownTable(res.data.breakdown_table || []);
    } catch (err: any) {
      showError(err.response?.data?.message || `Could not find property record for ${type} '${id}'.`);
    } finally {
      setLoadingDetail(false);
      setIsSelectorOpen(false);
      if (onClearPreselectedDeclaration) onClearPreselectedDeclaration();
    }
  };

  const buildFallbackBreakdown = (p: PropertyTaxRow) => {
    setBreakdownTable([
      { description: "Market Value", amount: p.market_value, formatted: `₱${p.market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { description: "Assessment Level", amount: p.assessment_level, formatted: `${(p.assessment_level * 100).toFixed(0)}%` },
      { description: "Assessed Value", amount: p.assessed_value, formatted: `₱${p.assessed_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { description: `Basic Real Property Tax (${(p.basic_tax_rate * 100).toFixed(1)}%)`, amount: p.basic_tax_amount, formatted: `₱${p.basic_tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { description: `SEF Tax (${(p.sef_tax_rate * 100).toFixed(1)}%)`, amount: p.sef_tax_amount, formatted: `₱${p.sef_tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { description: "Other Applicable Levies", amount: p.other_levies_amount, formatted: `₱${p.other_levies_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { description: "Discounts and Exemptions", amount: p.discount_amount, formatted: `₱${p.discount_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { description: "Penalties and Interest", amount: p.penalty_interest_amount, formatted: `₱${p.penalty_interest_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { description: "Total Computed Tax", amount: p.total_computed_tax, formatted: `₱${p.total_computed_tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, is_total: true }
    ]);
  };

  // Re-fetch individual report when tax year changes while in specific view
  useEffect(() => {
    if (viewMode === 'specific' && selectedProperty) {
      handleSelectPropertyByTarget(selectedProperty.property_type, selectedProperty.target_id_str || selectedProperty.property_id);
    }
  }, [taxYear]);

  // CSV Export: All Properties
  const handleExportAllCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.append('year', String(taxYear));
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (barangayFilter !== 'ALL') params.append('barangay', barangayFilter);
      if (typeFilter !== 'ALL') params.append('property_type', typeFilter);
      if (classificationFilter !== 'ALL') params.append('classification', classificationFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const token = localStorage.getItem('accessor_token');
      const response = await fetch(`http://localhost:5000/api/tax-computations/all-properties-report/export-csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate All Properties CSV export.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `All_Property_Tax_Reports_${taxYear}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('All property tax reports exported to CSV successfully.');
    } catch (err: any) {
      showError(err.message || 'CSV export failed.');
    }
  };

  // CSV Export: Specific Property
  const handleExportSpecificCSV = async () => {
    if (!selectedProperty) return;
    try {
      const token = localStorage.getItem('accessor_token');
      const type = selectedProperty.property_type;
      const id = selectedProperty.target_id_str || selectedProperty.property_id;
      const response = await fetch(`http://localhost:5000/api/tax-computations/property-report/${type}/${id}/export-csv?year=${taxYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to download Property Tax Report CSV.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Property_Tax_Report_${selectedProperty.target_id_str}_${taxYear}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSuccess(`Property tax report for ${selectedProperty.target_id_str} exported to CSV.`);
    } catch (err: any) {
      showError(err.message || 'Property CSV export failed.');
    }
  };

  // Print Handlers
  const handlePrintAll = () => {
    window.print();
  };

  const handlePrintSpecific = () => {
    window.print();
  };

  // Filter properties in property selector dropdown
  const selectorFilteredProperties = useMemo(() => {
    if (!selectorQuery.trim()) return properties.slice(0, 10);
    const q = selectorQuery.toLowerCase();
    return properties.filter(p => 
      String(p.property_id).includes(q) ||
      p.target_id_str?.toLowerCase().includes(q) ||
      p.property_code?.toLowerCase().includes(q) ||
      p.owner_name?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [properties, selectorQuery]);

  const barangayList = [
    'Balingasag Road', 'Dampias', 'Kibungsod', 'Lumbo', 'Poblacion', 
    'San Isidro', 'Tabok', 'Talusan', 'Umagos'
  ];

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '₱0.00';
    return `₱${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. Official Legal Reference Banner (Requirement 1 & 5)                    */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-xs print:hidden">
        <div className="flex items-start sm:items-center gap-3">
          <AlertCircle className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0" size={20} />
          <div>
            <div className="font-bold text-xs sm:text-sm tracking-wide uppercase">
              PROPERTY TAX COMPUTATION REPORT — FOR REFERENCE ONLY. NOT AN OFFICIAL TAX BILL OR RECEIPT.
            </div>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              This municipal assessor report computes statutory real property tax valuations in accordance with RA 7160 (Local Government Code) and RA 12001 (Real Property Valuation and Assessment Reform Act). Official tax billing, collection, and receipts are conducted exclusively by the Municipal Treasury.
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right hidden lg:block">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-amber-200/60 dark:bg-amber-900/60 font-bold uppercase tracking-wider">
            Valuation Reference Only
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Top Header & Primary Navigation                                        */}
      {/* ========================================================================= */}
      {!hideStandaloneHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="text-emerald-600" size={26} />
              Property Tax Reports
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Automated statutory tax computations for all completed and approved real property assessments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'specific' ? (
              <button
                onClick={() => setViewMode('all')}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Return to All Properties Report</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleExportAllCSV}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition cursor-pointer"
                  title="Export all filtered properties to CSV"
                >
                  <Download size={16} />
                  <span>Export All CSV</span>
                </button>

                <button
                  onClick={handlePrintAll}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
                  title="Print all property tax computations"
                >
                  <Printer size={16} />
                  <span>Print All Reports</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: ALL PROPERTIES TAX REPORT                                         */}
      {/* ========================================================================= */}
      {viewMode === 'all' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 print:hidden">
              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Eligible Properties</span>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.total_eligible_properties}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Assessed records in database</div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Computations</span>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {stats.approved_computed_count}
                </div>
                <div className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">Complete statutory calculations</div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Incomplete Computations</span>
                <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                  {stats.incomplete_count}
                  {stats.incomplete_count > 0 && <AlertTriangle size={18} className="text-amber-500" />}
                </div>
                <div className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">Excluded from tax total</div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Assessed Value</span>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
                  {formatCurrency(stats.total_assessed_value)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Approved assessed base</div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-800/80 shadow-xs bg-emerald-50/40 dark:bg-emerald-950/20 col-span-2 lg:col-span-1">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Total Computed Tax</span>
                <div className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
                  {formatCurrency(stats.total_computed_tax)}
                </div>
                <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">Basic RPT + SEF + Levies</div>
              </div>
            </div>
          )}

          {/* Search, Filter, and Property Selector Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-3 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by Property ID, Lot ID, Building ID, Owner name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Tax Year Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tax Year:</span>
                <select
                  value={taxYear}
                  onChange={e => setTaxYear(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white"
                >
                  <option value={2026}>2026 (Current)</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                  <option value={2023}>2023</option>
                </select>
              </div>

              {/* Quick Individual Property Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition"
                >
                  <Eye size={15} />
                  <span>Select Specific Property</span>
                </button>

                {isSelectorOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 z-30 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Search Assessed Properties</span>
                      <button onClick={() => setIsSelectorOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={15} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Type Lot #, Building Code, Owner..."
                      value={selectorQuery}
                      onChange={e => setSelectorQuery(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none"
                    />
                    <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                      {selectorFilteredProperties.length === 0 ? (
                        <div className="text-[11px] text-gray-400 text-center py-3">No matching property found</div>
                      ) : (
                        selectorFilteredProperties.map(p => (
                          <div
                            key={`${p.property_type}_${p.target_id_str}`}
                            onClick={() => handleSelectProperty(p)}
                            className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer text-xs transition border border-transparent hover:border-emerald-200"
                          >
                            <div className="flex items-center justify-between font-bold text-gray-900 dark:text-white">
                              <span>{p.target_id_str}</span>
                              <span className="text-[10px] uppercase font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                                {p.property_type}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 truncate">{p.owner_name} • Brgy. {p.barangay}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Barangay</label>
                <select
                  value={barangayFilter}
                  onChange={e => { setBarangayFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="ALL">All Barangays</option>
                  {barangayList.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Property Type</label>
                <select
                  value={typeFilter}
                  onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="ALL">All Types</option>
                  <option value="lot">Lot / Land</option>
                  <option value="building">Building</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Classification</label>
                <select
                  value={classificationFilter}
                  onChange={e => { setClassificationFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="ALL">All Classifications</option>
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Agricultural">Agricultural</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Computation Status</label>
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="approved">Approved & Complete</option>
                  <option value="incomplete">Incomplete Computation</option>
                </select>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Printable Office Header (Only visible when printing all reports)          */}
          {/* ========================================================================= */}
          <div className="hidden print:block mb-6 text-center space-y-1">
            <h2 className="text-base font-bold uppercase tracking-wider text-black">
              Republic of the Philippines • Province of Misamis Oriental
            </h2>
            <h1 className="text-xl font-black uppercase text-black">
              Municipality of Lagonglong — Office of the Municipal Assessor
            </h1>
            <h3 className="text-sm font-bold text-gray-800 underline uppercase mt-2">
              All Property Tax Computation Report — Reference Only
            </h3>
            <p className="text-xs text-gray-600">
              Tax Year: {taxYear} • Computation Date: {new Date().toLocaleDateString()} • In accordance with RA 7160 / RA 12001
            </p>
            <div className="p-2 border border-black text-xs font-bold uppercase mt-2">
              PROPERTY TAX COMPUTATION REPORT — FOR REFERENCE ONLY. NOT AN OFFICIAL TAX BILL OR RECEIPT.
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. All Property Tax Reports Table (17-18 Statutory Columns)              */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-800/80 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 sticky top-0">
                  <tr>
                    <th className="py-3 px-3 cursor-pointer hover:text-emerald-600" onClick={() => { setSortBy('property_id'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Property ID {sortBy === 'property_id' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-emerald-600" onClick={() => { setSortBy('target_id_str'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Lot / Bldg ID {sortBy === 'target_id_str' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-emerald-600" onClick={() => { setSortBy('owner_name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Property Owner {sortBy === 'owner_name' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2">Classification</th>
                    <th className="py-3 px-2">Barangay</th>
                    <th className="py-3 px-2">Tax Year</th>
                    <th className="py-3 px-3 text-right">Market Value</th>
                    <th className="py-3 px-2 text-center">AL %</th>
                    <th className="py-3 px-3 text-right">Assessed Value</th>
                    <th className="py-3 px-3 text-right">Basic RPT</th>
                    <th className="py-3 px-3 text-right">SEF Tax</th>
                    <th className="py-3 px-2 text-right">Other Levies</th>
                    <th className="py-3 px-2 text-right">Discounts</th>
                    <th className="py-3 px-2 text-right">Penalties</th>
                    <th className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">Total Tax</th>
                    <th className="py-3 px-2 text-center">Status</th>
                    <th className="py-3 px-2 text-center">Assessment</th>
                    <th className="py-3 px-3 text-right print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan={19} className="py-12 text-center text-gray-500">
                        <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Computing property taxes from approved database valuations...
                      </td>
                    </tr>
                  ) : properties.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="py-12 text-center text-gray-500">
                        <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        No eligible assessed properties match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    properties.map((p) => {
                      const alPct = `${(Number(p.assessment_level) * 100).toFixed(0)}%`;
                      return (
                        <tr 
                          key={`${p.property_type}_${p.target_id_str}_${p.tax_year}`}
                          className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition cursor-pointer ${
                            !p.is_complete ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                          }`}
                          onClick={() => handleSelectProperty(p)}
                        >
                          <td className="py-3 px-3 font-mono font-medium text-gray-900 dark:text-white">
                            {p.property_id}
                          </td>
                          <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              {p.property_type === 'lot' ? <SquareDashed size={13} className="text-emerald-600 shrink-0" /> : <Building2 size={13} className="text-indigo-600 shrink-0" />}
                              {p.target_id_str}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium text-gray-800 dark:text-gray-200 max-w-[160px] truncate" title={p.owner_name}>
                            {p.owner_name}
                          </td>
                          <td className="py-3 px-2 uppercase text-[10px] font-bold">
                            <span className={`px-1.5 py-0.5 rounded ${
                              p.property_type === 'lot' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                            }`}>
                              {p.property_type}
                            </span>
                          </td>
                          <td className="py-3 px-2 truncate max-w-[100px]">{p.classification}</td>
                          <td className="py-3 px-2 whitespace-nowrap">{p.barangay}</td>
                          <td className="py-3 px-2 font-mono">{p.tax_year}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(p.market_value)}
                          </td>
                          <td className="py-3 px-2 text-center font-mono">{alPct}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrency(p.assessed_value)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                            {p.is_complete ? formatCurrency(p.basic_tax_amount) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                            {p.is_complete ? formatCurrency(p.sef_tax_amount) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-2 text-right font-mono whitespace-nowrap">
                            {p.is_complete ? formatCurrency(p.other_levies_amount) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-emerald-600 whitespace-nowrap">
                            {p.is_complete && p.discount_amount > 0 ? `-${formatCurrency(p.discount_amount)}` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-rose-600 whitespace-nowrap">
                            {p.is_complete && p.penalty_interest_amount > 0 ? `+${formatCurrency(p.penalty_interest_amount)}` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">
                            {p.is_complete ? (
                              <span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(p.total_computed_tax)}</span>
                            ) : (
                              <span className="text-amber-600 font-normal italic">Incomplete</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            {p.is_complete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 size={10} /> Approved
                              </span>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                title={p.incomplete_reason || 'Incomplete Valuation'}
                              >
                                <AlertTriangle size={10} /> Incomplete
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              p.assessment_approval_status === 'approved' 
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' 
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {p.assessment_approval_status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap print:hidden" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleSelectProperty(p)}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 rounded-lg transition inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                              title="View individual tax calculation breakdown"
                            >
                              <Eye size={13} />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 print:hidden">
              <div className="flex items-center gap-2">
                <span>Showing {properties.length} of {totalRecords} eligible assessed properties</span>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs"
                >
                  <option value={15}>15 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 font-semibold flex items-center gap-1 transition"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="px-2 font-mono">Page {currentPage} of {totalPages}</span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 font-semibold flex items-center gap-1 transition"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SPECIFIC PROPERTY TAX REPORT                                      */}
      {/* ========================================================================= */}
      {viewMode === 'specific' && selectedProperty && (
        <div className="space-y-6">
          {/* Top Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs print:hidden">
            <button
              onClick={() => setViewMode('all')}
              className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Back to All Properties Report</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tax Year:</span>
              <select
                value={taxYear}
                onChange={e => setTaxYear(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white"
              >
                <option value={2026}>2026 (Current)</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
              </select>

              <button
                onClick={handleExportSpecificCSV}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handlePrintSpecific}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Printer size={15} />
                <span>Print Individual Report</span>
              </button>
            </div>
          </div>

          {/* Warning for Incomplete Computation */}
          {!selectedProperty.is_complete && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-xs flex items-start gap-3">
              <AlertTriangle className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-sm uppercase tracking-wide">
                  Incomplete Computation Warning
                </h4>
                <p className="text-xs mt-1 text-amber-800 dark:text-amber-300">
                  {selectedProperty.incomplete_reason || 'This property requires completed and approved valuation records before statutory tax computations can be finalized.'}
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">
                  Estimated tax amounts are not fabricated. Once approved by the Head Assessor or Admin, accurate statutory taxes will automatically compute.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* Printable Report Document (Clean municipal government format)             */}
          {/* ========================================================================= */}
          <div 
            ref={printableRef}
            className="p-6 sm:p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0"
          >
            {/* Government Office Letterhead */}
            <div className="border-b border-gray-200 dark:border-gray-800 pb-5 text-center space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Republic of the Philippines</p>
              <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Municipality of Lagonglong — Province of Misamis Oriental
              </h2>
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Office of the Municipal Assessor
              </h3>
              <div className="pt-2">
                <span className="inline-block px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                  Property Tax Computation Report (Tax Year {taxYear})
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Generated: {new Date().toLocaleDateString()} • Reference System: PARMS / Assessor Office System
              </p>
            </div>

            {/* Statutory Disclaimer Box */}
            <div className="p-3 bg-amber-50/80 border border-amber-300 text-amber-900 text-center rounded-lg text-xs font-bold uppercase tracking-wide">
              PROPERTY TAX COMPUTATION REPORT — FOR REFERENCE ONLY. NOT AN OFFICIAL TAX BILL OR RECEIPT.
            </div>

            {/* Property Details Panel */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Property Identification & Owner Record
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-gray-400 font-medium">Property ID</span>
                  <p className="font-bold font-mono text-gray-900 dark:text-white mt-0.5">{selectedProperty.property_id}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-gray-400 font-medium">Lot / Building ID</span>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{selectedProperty.target_id_str}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-gray-400 font-medium">Property Type</span>
                  <p className="font-bold uppercase text-gray-900 dark:text-white mt-0.5">{selectedProperty.property_type}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-gray-400 font-medium">Barangay</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">Brgy. {selectedProperty.barangay}</p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 col-span-2">
                  <span className="text-gray-400 font-medium">Registered Property Owner</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">{selectedProperty.owner_name}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-gray-400 font-medium">Classification</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">{selectedProperty.classification}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-gray-400 font-medium">Assessment Status</span>
                  <p className="font-bold uppercase text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {selectedProperty.assessment_approval_status}
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Breakdown Table (Matching Expected Format from Prompt Section 4) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Property Tax Computation Breakdown — Statutory Basis
                </h4>
                <span className="text-xs font-mono text-gray-400">
                  Formula: AV = MV × AL; Basic = AV × Rate; SEF = AV × SEF Rate
                </span>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {breakdownTable.length > 0 ? (
                      breakdownTable.map((item, idx) => (
                        <tr 
                          key={idx}
                          className={item.is_total 
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200' 
                            : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
                          }
                        >
                          <td className={`py-3 px-4 ${item.is_total ? 'text-base font-extrabold text-emerald-800 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-200'}`}>
                            {item.description}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono ${item.is_total ? 'text-lg font-black text-emerald-700 dark:text-emerald-300' : 'font-semibold text-gray-900 dark:text-white'}`}>
                            {selectedProperty.is_complete ? item.formatted : (item.is_total ? 'Incomplete' : item.formatted)}
                          </td>
                        </tr>
                      ))
                    ) : loadingDetail ? (
                      <tr>
                        <td colSpan={2} className="py-6 text-center text-gray-500">
                          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Computing statutory tax breakdown...
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={2} className="py-4 text-center text-gray-400">
                          No breakdown available for this property.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Official Certification and Signature Section for Printing */}
            <div className="pt-8 border-t border-gray-200 dark:border-gray-800 grid grid-cols-2 gap-8 text-xs text-gray-600 dark:text-gray-400">
              <div className="space-y-12">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">Prepared & Computed By:</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Municipal Assessor Staff / Valuation Engine</p>
                </div>
                <div className="border-t border-gray-400 dark:border-gray-600 pt-1.5 w-60">
                  <p className="font-bold text-gray-900 dark:text-white uppercase">OFFICE OF THE MUNICIPAL ASSESSOR</p>
                  <p className="text-[10px] text-gray-500">Authorized Valuation Officer</p>
                </div>
              </div>

              <div className="space-y-12 text-right flex flex-col items-end">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">Noted & Verified By:</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Municipal Assessor / Head of Office</p>
                </div>
                <div className="border-t border-gray-400 dark:border-gray-600 pt-1.5 w-60 text-right">
                  <p className="font-bold text-gray-900 dark:text-white uppercase">MUNICIPAL ASSESSOR</p>
                  <p className="text-[10px] text-gray-500">Republic of the Philippines</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default PropertyTaxReports;
