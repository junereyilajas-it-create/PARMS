import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Building2, 
  SquareDashed, 
  Search, 
  Filter, 
  RotateCcw, 
  Eye, 
  ClipboardCheck, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  Calendar, 
  X,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api, { ensureSession } from '../lib/api';
import { useModal } from '../contexts/ModalContext';
import { AssessmentSubmissionModal, type AssessmentTarget } from '../components/common/AssessmentSubmissionModal';

export interface PropertyRecord {
  property_id: number | string;
  property_status: string;
  owner_name: string;
  property_address: string;
  barangay: string;
  street?: string;
  property_type_name?: string;
  classification_name?: string;
  lot_count: number;
  lot_ids?: string;
  lot_numbers?: string;
  lot_area: number;
  primary_lot_id?: number;
  primary_lot_number?: string;
  building_count: number;
  building_ids?: string;
  building_names?: string;
  floor_area: number;
  primary_building_id?: number;
  primary_building_name?: string;
  calculated_property_type: 'Lot' | 'Building' | 'Lot with Building';
  assessment_status: 'Unassessed' | 'In Progress' | 'Pending Review' | 'Approved';
  assigned_assessor_name?: string | null;
  assigned_assessor_id?: number | null;
  active_assignment_id?: number | null;
  has_approved_permission?: boolean;
  has_pending_request?: boolean;
  assigned_to_me?: boolean;
  can_assess?: boolean;
  target_type: 'lot' | 'building' | 'property';
  target_id: number | string;
  target_id_str: string;
  latest_market_value?: number | string;
  latest_assessed_value?: number | string;
  latest_assessment_date?: string | null;
  latest_remarks?: string | null;
  latest_property_photo?: string | null;
}

export const AssessorPropertiesView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSuccess, showError } = useModal();

  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [assignedOnly, setAssignedOnly] = useState(searchParams.get('filter') === 'assigned');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [selectedProperty, setSelectedProperty] = useState<PropertyRecord | null>(null);
  const [submissionTarget, setSubmissionTarget] = useState<AssessmentTarget | null>(null);
  const [requestPermissionTarget, setRequestPermissionTarget] = useState<PropertyRecord | null>(null);
  const [permissionReason, setPermissionReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Load properties from Express API
  const loadProperties = async () => {
    setLoading(true);
    try {
      await ensureSession();
      const res = await api.get('/properties/overview');
      setProperties(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to load properties:', err);
      showError(err.response?.data?.message || 'Unable to load property records from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  // Sync state if URL query params change
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const filterParam = searchParams.get('filter');
    const typeParam = searchParams.get('type');
    const searchParam = searchParams.get('search');

    if (statusParam) {
      setStatusFilter(statusParam.toLowerCase());
    }
    if (filterParam === 'assigned') {
      setAssignedOnly(true);
    }
    if (typeParam) {
      setTypeFilter(typeParam.toLowerCase());
    }
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

  // Combined client filtering
  const filteredProperties = useMemo(() => {
    return properties.filter(prop => {
      // Search matching (partial text, multi-character)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const propIdStr = String(prop.property_id).toLowerCase();
        const lotNumStr = (prop.lot_numbers || '').toLowerCase();
        const bldgNameStr = (prop.building_names || '').toLowerCase();
        const ownerStr = (prop.owner_name || '').toLowerCase();
        const typeStr = (prop.calculated_property_type || '').toLowerCase();
        const brgyStr = (prop.barangay || '').toLowerCase();
        const addrStr = (prop.property_address || '').toLowerCase();
        const statusStr = (prop.assessment_status || '').toLowerCase();

        const matches = 
          propIdStr.includes(q) ||
          lotNumStr.includes(q) ||
          bldgNameStr.includes(q) ||
          ownerStr.includes(q) ||
          typeStr.includes(q) ||
          brgyStr.includes(q) ||
          addrStr.includes(q) ||
          statusStr.includes(q);

        if (!matches) return false;
      }

      // Property Type filter
      if (typeFilter !== 'all') {
        const tf = typeFilter.toLowerCase().replace(/_/g, ' ');
        if (prop.calculated_property_type.toLowerCase() !== tf) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const sf = statusFilter.toLowerCase().replace(/_/g, ' ');
        if (prop.assessment_status.toLowerCase() !== sf) {
          return false;
        }
      }

      // Assigned to me filter
      if (assignedOnly && !prop.assigned_to_me) {
        return false;
      }

      return true;
    });
  }, [properties, searchTerm, typeFilter, statusFilter, assignedOnly]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter, assignedOnly]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage) || 1;
  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProperties.slice(start, start + itemsPerPage);
  }, [filteredProperties, currentPage]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setStatusFilter('all');
    setAssignedOnly(false);
    setSearchParams({});
  };

  const getStatusBadge = (status: PropertyRecord['assessment_status']) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'Pending Review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <Clock size={12} /> Pending Review
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            <Clock size={12} /> In Progress
          </span>
        );
      case 'Unassessed':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <AlertCircle size={12} /> Unassessed
          </span>
        );
    }
  };

  const getTypeIcon = (type: PropertyRecord['calculated_property_type']) => {
    switch (type) {
      case 'Building':
        return <Building2 size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />;
      case 'Lot with Building':
        return <Layers size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'Lot':
      default:
        return <SquareDashed size={16} className="text-green-600 dark:text-green-400 shrink-0" />;
    }
  };

  // Assessment action trigger
  const handleStartAssessment = (prop: PropertyRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedProperty(null);
    setSubmissionTarget({
      type: prop.target_type,
      target_id: prop.target_id,
      property_id: prop.property_id,
      owner_name: prop.owner_name,
      market_value: prop.latest_market_value || '',
      assessed_value: prop.latest_assessed_value || '',
      remarks: prop.latest_remarks || '',
      property_photo: prop.latest_property_photo || null,
      assessment_status: prop.assessment_status.toLowerCase()
    });
  };

  // Request permission action
  const handleOpenPermissionModal = (prop: PropertyRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRequestPermissionTarget(prop);
    setPermissionReason('');
  };

  const handleConfirmPermissionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestPermissionTarget) return;
    if (!permissionReason.trim()) {
      showError('Please provide a reason for requesting assessment permission.');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await ensureSession();
      await api.post('/assessments/requests', {
        property_type: requestPermissionTarget.target_type,
        target_id_int: typeof requestPermissionTarget.target_id === 'number' ? requestPermissionTarget.target_id : parseInt(String(requestPermissionTarget.target_id).replace(/\D/g, '') || '1', 10),
        target_id_str: requestPermissionTarget.target_id_str,
        reason: permissionReason.trim()
      });

      showSuccess(`Permission requested to assess ${requestPermissionTarget.target_id_str}. Pending Admin review.`);
      setRequestPermissionTarget(null);
      await loadProperties();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to submit permission request.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-700 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
            Properties
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Comprehensive directory of lots, buildings, and unified properties with assessment statuses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAssignedOnly(v => !v);
              setCurrentPage(1);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 ${
              assignedOnly 
                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <User size={14} />
            {assignedOnly ? 'Assigned to Me (Active)' : 'Show Assigned to Me'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center flex-wrap">
        {/* Search Input */}
        <div className="flex-1 min-w-[260px] w-full md:w-auto flex items-center gap-2 bg-gray-50 dark:bg-gray-800/80 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, lot #, owner, barangay, address, type..."
            className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Property Type Dropdown */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/80 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
          <Filter size={14} className="text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent border-none text-xs sm:text-sm font-medium outline-none text-gray-800 dark:text-gray-200 cursor-pointer w-full"
          >
            <option value="all">All Properties</option>
            <option value="lot">Lots</option>
            <option value="building">Buildings</option>
            <option value="lot_with_building">Lot with Building</option>
          </select>
        </div>

        {/* Assessment Status Dropdown */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/80 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent border-none text-xs sm:text-sm font-medium outline-none text-gray-800 dark:text-gray-200 cursor-pointer w-full"
          >
            <option value="all">All Statuses</option>
            <option value="unassessed">Unassessed</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        {/* Reset / Clear Button */}
        {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all' || assignedOnly) && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            title="Reset filters"
          >
            <RotateCcw size={13} />
            Clear
          </button>
        )}
      </div>

      {/* Properties Table Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400 animate-pulse">
            Loading property records from database...
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
              <Search size={22} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No properties found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              No properties match your current search criteria or filter options.
            </p>
            <button
              onClick={handleClearFilters}
              className="mt-4 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-900 dark:bg-gray-950 text-white dark:text-gray-200 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap">Property ID</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Property / Lot #</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Owner</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Barangay & Address</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Land Area</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Floor Area</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Assessment Status</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Assigned Assessor</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                {paginatedProperties.map((prop) => (
                  <tr
                    key={prop.property_id}
                    onClick={() => setSelectedProperty(prop)}
                    className="cursor-pointer hover:bg-green-50/70 dark:hover:bg-gray-800/80 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-green-700 dark:text-green-400">
                        PROPERTY-{prop.property_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {getTypeIcon(prop.calculated_property_type)}
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {prop.calculated_property_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                        {prop.lot_numbers || prop.building_names || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {prop.owner_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="flex flex-col truncate" title={prop.property_address}>
                        <span className="font-medium text-xs text-gray-900 dark:text-gray-200 truncate">{prop.barangay}</span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{prop.property_address}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-800 dark:text-gray-200">
                        {prop.lot_area > 0 ? `${prop.lot_area.toLocaleString()} sqm` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-800 dark:text-gray-200">
                        {prop.floor_area > 0 ? `${prop.floor_area.toLocaleString()} sqm` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(prop.assessment_status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {prop.assigned_assessor_name ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium ${prop.assigned_to_me ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                            {prop.assigned_assessor_name} {prop.assigned_to_me && '(You)'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedProperty(prop)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded text-xs font-medium transition flex items-center gap-1"
                          title="View property details"
                        >
                          <Eye size={13} />
                          Details
                        </button>

                        {prop.can_assess && (prop.assessment_status === 'Unassessed' || prop.assessment_status === 'In Progress') && (
                          <button
                            onClick={(e) => handleStartAssessment(prop, e)}
                            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold shadow-sm transition flex items-center gap-1"
                            title="Start or Continue Assessment"
                          >
                            <ClipboardCheck size={13} />
                            Assess
                          </button>
                        )}

                        {!prop.can_assess && prop.has_pending_request && (
                          <span className="px-2 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800">
                            Requested
                          </span>
                        )}

                        {!prop.can_assess && !prop.has_pending_request && prop.assessment_status !== 'Approved' && (
                          <button
                            onClick={(e) => handleOpenPermissionModal(prop, e)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 rounded text-xs font-medium border border-teal-200 dark:border-teal-800 transition flex items-center gap-1"
                            title="Request permission to assess this property"
                          >
                            <Send size={12} />
                            Request
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Showing page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span> ({filteredProperties.length} total properties)
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    currentPage === page
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- PROPERTY DETAILS MODAL ---------------- */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800/80 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  {getTypeIcon(selectedProperty.calculated_property_type)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    PROPERTY-{selectedProperty.property_id} Details
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Category: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedProperty.calculated_property_type}</span> • Status: {selectedProperty.assessment_status}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProperty(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-sm">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Owner Information</span>
                  <div className="font-semibold text-gray-900 dark:text-white text-base">
                    {selectedProperty.owner_name}
                  </div>
                  <span className="text-xs text-gray-500">Registered Real Property Owner</span>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Assessment Status</span>
                  <div className="mt-1">{getStatusBadge(selectedProperty.assessment_status)}</div>
                  <span className="text-xs text-gray-500 block mt-1">
                    {selectedProperty.assigned_assessor_name 
                      ? `Assigned: ${selectedProperty.assigned_assessor_name} ${selectedProperty.assigned_to_me ? '(You)' : ''}`
                      : 'Unassigned Assessor'}
                  </span>
                </div>
              </div>

              {/* Property Details Grid */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 bg-white dark:bg-gray-900">
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                  Property Identification & Location
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Property ID:</span>
                    <span className="ml-2 font-mono font-semibold text-gray-900 dark:text-white">PROPERTY-{selectedProperty.property_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Classification:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedProperty.classification_name || 'General Real Property'}</span>
                  </div>
                  {selectedProperty.lot_numbers && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Lot Number(s):</span>
                      <span className="ml-2 font-mono font-semibold text-gray-900 dark:text-white">{selectedProperty.lot_numbers}</span>
                    </div>
                  )}
                  {selectedProperty.building_names && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Building Name(s):</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">{selectedProperty.building_names}</span>
                    </div>
                  )}
                  {selectedProperty.lot_area > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Lot Land Area:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">{selectedProperty.lot_area.toLocaleString()} sqm</span>
                    </div>
                  )}
                  {selectedProperty.floor_area > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Building Floor Area:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">{selectedProperty.floor_area.toLocaleString()} sqm</span>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Address:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedProperty.property_address}</span>
                  </div>
                </div>
              </div>

              {/* Assessment History / Value Summary */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 bg-white dark:bg-gray-900">
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                  Assessment History & Valuation
                </h4>
                {Number(selectedProperty.latest_market_value || 0) > 0 || Number(selectedProperty.latest_assessed_value || 0) > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-[11px] text-gray-500 block">Market Value</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          ₱{Number(selectedProperty.latest_market_value).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 bg-green-50/60 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900/50">
                        <span className="text-[11px] text-green-700 dark:text-green-400 block font-medium">Assessed Value (20%)</span>
                        <span className="text-lg font-bold text-green-700 dark:text-green-400">
                          ₱{Number(selectedProperty.latest_assessed_value).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {selectedProperty.latest_assessment_date && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Calendar size={13} />
                        Assessed on: {new Date(selectedProperty.latest_assessment_date).toLocaleDateString()}
                      </div>
                    )}
                    {selectedProperty.latest_remarks && (
                      <div className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                        <span className="font-semibold block mb-0.5">Remarks / Notes:</span>
                        {selectedProperty.latest_remarks}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    This property has not yet been assessed. No valuation records currently recorded.
                  </p>
                )}
              </div>

              {/* Assessment Permissions & Actions Notice */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center shrink-0">
                    <ClipboardCheck size={16} />
                  </div>
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-gray-900 dark:text-white block mb-0.5">
                      Assessment Workflow Status
                    </span>
                    {selectedProperty.can_assess ? (
                      <p className="text-gray-600 dark:text-gray-300">
                        {selectedProperty.assessment_status === 'Approved'
                          ? 'This property is already assessed and approved by the Municipal Assessor.'
                          : selectedProperty.assessment_status === 'Pending Review'
                          ? 'Assessment has been completed and submitted. Waiting for Admin approval.'
                          : 'You are authorized to conduct assessment for this property.'}
                      </p>
                    ) : selectedProperty.has_pending_request ? (
                      <p className="text-amber-700 dark:text-amber-400">
                        Your permission request to assess this property has been submitted and is waiting for Admin approval.
                      </p>
                    ) : (
                      <p className="text-gray-600 dark:text-gray-400">
                        This property is not currently assigned to your account. You can request permission from the Municipal Assessor to assess it.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={() => setSelectedProperty(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {selectedProperty.can_assess && (selectedProperty.assessment_status === 'Unassessed' || selectedProperty.assessment_status === 'In Progress') && (
                  <button
                    onClick={() => handleStartAssessment(selectedProperty)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                  >
                    <ClipboardCheck size={15} />
                    {selectedProperty.assessment_status === 'In Progress' ? 'Continue Assessment' : 'Start Assessment'}
                  </button>
                )}

                {!selectedProperty.can_assess && !selectedProperty.has_pending_request && selectedProperty.assessment_status !== 'Approved' && (
                  <button
                    onClick={() => handleOpenPermissionModal(selectedProperty)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                  >
                    <Send size={14} />
                    Request Permission
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- REQUEST PERMISSION MODAL ---------------- */}
      {requestPermissionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-teal-50 to-green-50 dark:from-gray-800 dark:to-gray-900">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                  <Send size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Request Assessment Permission
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Property: <span className="font-semibold text-gray-700 dark:text-gray-300">{requestPermissionTarget.target_id_str}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRequestPermissionTarget(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmPermissionRequest} className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-1">
                <div><span className="text-gray-500">Property Type:</span> <strong className="text-gray-900 dark:text-white capitalize">{requestPermissionTarget.calculated_property_type}</strong></div>
                <div><span className="text-gray-500">Owner:</span> <strong className="text-gray-900 dark:text-white">{requestPermissionTarget.owner_name}</strong></div>
                <div><span className="text-gray-500">Location:</span> <span className="text-gray-700 dark:text-gray-300">{requestPermissionTarget.property_address}</span></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Reason for Request <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={permissionReason}
                  onChange={(e) => setPermissionReason(e.target.value)}
                  placeholder="e.g. Scheduled field inspection, boundary appraisal, property tax reassessment..."
                  className="w-full text-xs p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestPermissionTarget(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send size={13} />
                  {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- ASSESSMENT SUBMISSION MODAL ---------------- */}
      <AssessmentSubmissionModal
        isOpen={Boolean(submissionTarget)}
        onClose={() => setSubmissionTarget(null)}
        target={submissionTarget}
        onSuccess={loadProperties}
      />
    </div>
  );
};

export default AssessorPropertiesView;
