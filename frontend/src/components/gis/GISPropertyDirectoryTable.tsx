import { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  PencilRuler,
  Eye,
  Building2,
  SquareDashed,
  Send,
  X
} from 'lucide-react';
import type { GISFeature } from '../../types/gis';

interface GISPropertyDirectoryTableProps {
  features: GISFeature[];
  userRole: string;
  onSelectFeature: (feature: GISFeature) => void;
  onOpenDrawModal: (feature: GISFeature) => void;
  onOpenRequestModal: (feature: GISFeature) => void;
  onOpenDetailModal: (feature: GISFeature) => void;
}

type TableFilter = 'all' | 'mapped' | 'unmapped' | 'pending';
type TypeFilter = 'all' | 'lot' | 'building';

export function GISPropertyDirectoryTable({
  features,
  userRole,
  onSelectFeature,
  onOpenDrawModal,
  onOpenRequestModal,
  onOpenDetailModal,
}: GISPropertyDirectoryTableProps) {
  const [tableFilter, setTableFilter] = useState<TableFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdminOrSuper = ['admin', 'super_admin', 'assessor'].includes(userRole);
  const isStaff = userRole === 'staff';

  // Counts
  const counts = useMemo(() => {
    const total = features.length;
    const mapped = features.filter(f => Boolean(f.has_gis || (f.coordinates && f.coordinates !== 'null'))).length;
    const unmapped = total - mapped;
    const pending = features.filter(f => f.latest_request_status === 'pending').length;
    const lots = features.filter(f => f.type === 'lot').length;
    const buildings = features.filter(f => f.type === 'building').length;

    return { total, mapped, unmapped, pending, lots, buildings };
  }, [features]);

  // Filtered properties
  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return features.filter(f => {
      const isMapped = Boolean(f.has_gis || (f.coordinates && f.coordinates !== 'null'));

      // Table filter
      if (tableFilter === 'mapped' && !isMapped) return false;
      if (tableFilter === 'unmapped' && isMapped) return false;
      if (tableFilter === 'pending' && f.latest_request_status !== 'pending') return false;

      // Type filter
      if (typeFilter !== 'all' && f.type !== typeFilter) return false;

      // Search query
      if (q) {
        const matchTitle = (f.title || '').toLowerCase().includes(q);
        const matchOwner = (f.owner || '').toLowerCase().includes(q);
        const matchPropId = `property-${f.property_id}`.toLowerCase().includes(q) || String(f.property_id).includes(q);
        const matchLotId = f.type === 'lot' && String(f.id).toLowerCase().includes(q);
        const matchBldgId = f.type === 'building' && String(f.id).toLowerCase().includes(q);
        const matchBrgy = (f.barangay_name || '').toLowerCase().includes(q);
        const matchAddr = (f.full_address || '').toLowerCase().includes(q);

        if (!matchTitle && !matchOwner && !matchPropId && !matchLotId && !matchBldgId && !matchBrgy && !matchAddr) {
          return false;
        }
      }

      return true;
    });
  }, [features, tableFilter, typeFilter, searchQuery]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
      {/* Top Filter and Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition shadow-sm text-xs">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              id="input-gis-table-search"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Property ID, Lot #, Building, Owner, Barangay..."
              className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Status Filters */}
          <div className="flex items-center bg-gray-200/80 dark:bg-gray-700/80 p-0.5 rounded-xl text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              id="btn-filter-all"
              onClick={() => setTableFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                tableFilter === 'all'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-gray-300/60 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                {counts.total}
              </span>
            </button>

            <button
              type="button"
              id="btn-filter-mapped"
              onClick={() => setTableFilter('mapped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                tableFilter === 'mapped'
                  ? 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Mapped</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                {counts.mapped}
              </span>
            </button>

            <button
              type="button"
              id="btn-filter-unmapped"
              onClick={() => setTableFilter('unmapped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                tableFilter === 'unmapped'
                  ? 'bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <AlertCircle size={13} className="text-amber-500" />
              <span>Unmapped</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                {counts.unmapped}
              </span>
            </button>

            <button
              type="button"
              id="btn-filter-pending"
              onClick={() => setTableFilter('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                tableFilter === 'pending'
                  ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Clock size={13} className="text-purple-500" />
              <span>Pending Requests</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300">
                {counts.pending}
              </span>
            </button>
          </div>

          {/* Type Filter Select */}
          <div className="flex items-center text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-2.5 py-1.5 font-medium">
            <span className="text-gray-400 mr-1.5">Type:</span>
            <select
              aria-label="Filter properties by type"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as TypeFilter)}
              className="bg-transparent text-xs text-gray-800 dark:text-gray-200 outline-none cursor-pointer"
            >
              <option value="all">All Types ({counts.total})</option>
              <option value="lot">Lots ({counts.lots})</option>
              <option value="building">Buildings ({counts.buildings})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto min-h-[420px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3.5">Property ID</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3.5">Identifier / Name</th>
              <th className="py-3 px-3.5">Owner</th>
              <th className="py-3 px-3.5">Address / Barangay</th>
              <th className="py-3 px-3 text-center">GIS Status</th>
              <th className="py-3 px-3.5">Mapped By</th>
              <th className="py-3 px-3.5">Date Mapped</th>
              <th className="py-3 px-3 text-center">Request Status</th>
              <th className="py-3 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {filteredFeatures.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <CheckCircle2 size={32} className="text-gray-400" />
                    <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                      No property records match your current filter.
                    </p>
                    <p className="text-xs text-gray-400">
                      Try resetting your search query or selecting "All".
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFeatures.map(prop => {
                const isBuilding = prop.type === 'building';
                const isMapped = Boolean(prop.has_gis || (prop.coordinates && prop.coordinates !== 'null'));
                const latestStatus = prop.latest_request_status;

                return (
                  <tr
                    key={`table-row-${prop.type}-${prop.id}`}
                    className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition group"
                  >
                    {/* Property ID */}
                    <td className="py-3 px-3.5 font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      P-{prop.property_id}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isBuilding
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {isBuilding ? <Building2 size={11} /> : <SquareDashed size={11} />}
                        {isBuilding ? 'Building' : 'Lot'}
                      </span>
                    </td>

                    {/* Identifier */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-gray-900 dark:text-white leading-tight">
                        {prop.title}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {isBuilding ? `Bldg #${prop.id}` : `Lot #${prop.id}`} • {prop.area ? `${prop.area} m²` : 'N/A'}
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="py-3 px-3.5">
                      <div className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[140px]" title={prop.owner}>
                        {prop.owner || 'Unknown'}
                      </div>
                      {prop.owner_contact && (
                        <div className="text-[10px] text-gray-400 truncate max-w-[140px]">
                          {prop.owner_contact}
                        </div>
                      )}
                    </td>

                    {/* Address / Barangay */}
                    <td className="py-3 px-3.5 text-gray-600 dark:text-gray-300">
                      <div className="font-medium truncate max-w-[150px]">
                        {prop.barangay_name || 'Lagonglong'}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[150px]">
                        Misamis Oriental
                      </div>
                    </td>

                    {/* GIS Mapping Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {isMapped ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                          <CheckCircle2 size={11} /> Mapped
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                          <AlertCircle size={11} /> Unmapped
                        </span>
                      )}
                    </td>

                    {/* Mapped By */}
                    <td className="py-3 px-3.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {isMapped ? (
                        <span className="font-medium">
                          {prop.mapped_by_name || 'Assessor Admin'}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Date Mapped */}
                    <td className="py-3 px-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {isMapped ? formatDate(prop.mapped_at) : '—'}
                    </td>

                    {/* Mapping Request Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {latestStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200">
                          <Clock size={10} /> Pending Review
                        </span>
                      ) : latestStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200">
                          <CheckCircle2 size={10} /> Approved
                        </span>
                      ) : latestStatus === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200" title={prop.latest_rejection_reason || undefined}>
                          <AlertCircle size={10} /> Rejected
                        </span>
                      ) : latestStatus === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200">
                          <CheckCircle2 size={10} /> Completed
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">None</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Admin / Super Admin Direct Mapping / Editing */}
                        {isAdminOrSuper && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectFeature(prop);
                              onOpenDrawModal(prop);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm transition ${
                              isMapped
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title={isMapped ? 'Edit GIS Boundary' : 'Map Property Directly'}
                          >
                            <PencilRuler size={12} />
                            <span>{isMapped ? 'Edit Boundary' : 'Map Property'}</span>
                          </button>
                        )}

                        {/* Staff Role Actions */}
                        {isStaff && (
                          <>
                            {latestStatus === 'approved' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectFeature(prop);
                                  onOpenDrawModal(prop);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition animate-pulse"
                                title="Admin approved! Click to draw and save boundary"
                              >
                                <PencilRuler size={12} />
                                <span>Map (Approved)</span>
                              </button>
                            ) : latestStatus === 'pending' ? (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-[10px] font-semibold">
                                Pending Approval
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectFeature(prop);
                                  onOpenRequestModal(prop);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                                title={isMapped ? 'Request permission to update boundary' : 'Submit request to map boundary'}
                              >
                                <Send size={12} />
                                <span>{isMapped ? 'Request Update' : 'Request to Map'}</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* View Full Property Details */}
                        <button
                          type="button"
                          onClick={() => {
                            onSelectFeature(prop);
                            onOpenDetailModal(prop);
                          }}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition"
                          title="View Full Property Record"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <div>
          Showing <strong>{filteredFeatures.length}</strong> of <strong>{features.length}</strong> verified properties
          ({counts.lots} Lots, {counts.buildings} Buildings)
        </div>
        <div>
          Municipality of Lagonglong • Real Property Tax Cadastral Records
        </div>
      </div>
    </div>
  );
}
