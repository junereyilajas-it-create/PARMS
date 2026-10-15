import { useState } from 'react'
import {
  X,
  MapPin,
  Building2,
  SquareDashed,
  User,
  Phone,
  Mail,
  Home,
  CheckCircle2,
  Eye,
  Compass,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  PencilRuler,
  Calendar,
  ShieldCheck,
  ExternalLink,
  Camera
} from 'lucide-react'
import type { GISFeature } from '../../types/gis'

interface PropertyDetailPanelProps {
  feature: GISFeature
  onClose: () => void
  onZoomTo: () => void
  onOpenStreetView: () => void
  onOpenFullDetails: () => void
  onStartMapping?: () => void
  canEditGis?: boolean
}

export function PropertyDetailPanel({
  feature,
  onClose,
  onZoomTo,
  onOpenStreetView,
  onOpenFullDetails,
  onStartMapping,
  canEditGis = false,
}: PropertyDetailPanelProps) {
  const [copiedCoords, setCopiedCoords] = useState(false)

  const isBuilding = feature.type === 'building'
  const isPending = feature.status === 'pending' || feature.property_status === 'pending'
  const hasGis = Boolean(feature.has_gis || (feature.coordinates && feature.coordinates !== 'null'))

  const lat = feature.latitude
  const lng = feature.longitude

  const copyCoordinates = () => {
    if (lat != null && lng != null) {
      navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      setCopiedCoords(true)
      setTimeout(() => setCopiedCoords(false), 2000)
    }
  }

  const formatCurrency = (val: string | number | null | undefined) => {
    const num = Number(val)
    if (Number.isNaN(num) || num === 0) return '₱0.00'
    return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Not recorded'
    try {
      const d = new Date(dateStr)
      if (Number.isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <aside className="w-full lg:w-96 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-fade-in transition-colors text-gray-900 dark:text-gray-100 max-h-[850px]">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
        <div className="flex items-center gap-2">
          {isBuilding ? (
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <Building2 size={20} />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <SquareDashed size={20} />
            </div>
          )}
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400">
              {isBuilding ? 'BUILDING STRUCTURE' : 'LAND PARCEL / LOT'}
            </span>
            <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[220px]">
              {feature.title}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          title="Close Panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
        {/* Mapping Status Badge */}
        <div>
          {hasGis ? (
            <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 size={16} />
                <span>GIS Boundary Mapped</span>
              </div>
              <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">
                {feature.area_sqm ? `${Number(feature.area_sqm).toFixed(2)} m²` : 'Polygon'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                <AlertTriangle size={16} />
                <span>Needs GIS Mapping</span>
              </div>
              {canEditGis && onStartMapping && (
                <button
                  type="button"
                  onClick={onStartMapping}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-[11px] transition shadow-sm"
                >
                  <PencilRuler size={12} /> Map Now
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Map Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onZoomTo}
            disabled={!hasGis && lat == null}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-40 transition"
          >
            <Compass size={14} className="text-blue-500" />
            <span>Center on Map</span>
          </button>

          <button
            type="button"
            onClick={onOpenStreetView}
            disabled={lat == null || lng == null}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm disabled:opacity-40 transition"
          >
            <Eye size={14} />
            <span>Street View</span>
          </button>
        </div>

        {/* Optional Property Photo Preview */}
        {feature.property_photo && (
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shadow-sm">
            <div className="py-1.5 px-2.5 bg-gray-100/70 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Camera size={12} className="text-emerald-500" /> {isBuilding ? 'Building Photo' : 'Lot Photo'}
              </span>
            </div>
            <div className="h-40 w-full overflow-hidden bg-black/5 dark:bg-black/30 flex items-center justify-center">
              <img
                src={feature.property_photo}
                alt={feature.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>
        )}

        {/* SECTION 1: Property Information */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-1">
            <FileText size={13} className="text-emerald-500" /> Property Information
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
              <span className="block text-gray-400 text-[10px] uppercase font-semibold">Property ID</span>
              <strong className="text-gray-900 dark:text-white font-mono text-[11px]">
                {feature.property_id ? `PROPERTY-${feature.property_id}` : '—'}
              </strong>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
              <span className="block text-gray-400 text-[10px] uppercase font-semibold">
                {isBuilding ? 'Building ID' : 'Lot ID'}
              </span>
              <strong className="text-gray-900 dark:text-white font-mono text-[11px]">
                {feature.id || '—'}
              </strong>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
              <span className="block text-gray-400 text-[10px] uppercase font-semibold">Classification</span>
              <strong className="text-gray-900 dark:text-white">
                {feature.classification_name || 'Unclassified'}
              </strong>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
              <span className="block text-gray-400 text-[10px] uppercase font-semibold">Status</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isPending
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                }`}
              >
                {feature.status || feature.property_status || 'active'}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
              <span className="block text-gray-400 text-[10px] uppercase font-semibold">
                {isBuilding ? 'Floor Area' : 'Lot Area'}
              </span>
              <strong className="text-gray-900 dark:text-white font-mono">
                {feature.area ? `${Number(feature.area).toFixed(2)} m²` : '—'}
              </strong>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
              <span className="block text-gray-400 text-[10px] uppercase font-semibold">
                {isBuilding ? 'GIS Footprint' : 'GIS Survey Area'}
              </span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                {feature.area_sqm ? `${Number(feature.area_sqm).toFixed(2)} m²` : 'Unmapped'}
              </strong>
            </div>
          </div>

          {/* Building Specifics */}
          {isBuilding && (
            <div className="grid grid-cols-2 gap-2 bg-purple-50/50 dark:bg-purple-950/20 p-2.5 rounded-lg border border-purple-100 dark:border-purple-900/30">
              <div>
                <span className="text-[10px] text-gray-400 block">Building Type</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {feature.building_type || 'Residential'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Floors</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {feature.floor_count != null ? `${feature.floor_count} Storey` : '1'}
                </span>
              </div>
              {feature.year_constructed && (
                <div>
                  <span className="text-[10px] text-gray-400 block">Year Built</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {feature.year_constructed}
                  </span>
                </div>
              )}
              {feature.construction_type && (
                <div className="col-span-2">
                  <span className="text-[10px] text-gray-400 block">Construction</span>
                  <span className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-2">
                    {feature.construction_type}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Location Address */}
          <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 space-y-1">
            <span className="block text-gray-400 text-[10px] uppercase font-semibold flex items-center gap-1">
              <MapPin size={11} className="text-red-500" /> Property Address
            </span>
            <p className="font-medium text-gray-900 dark:text-white leading-snug">
              {feature.full_address || `${feature.street || 'Poblacion'}, Lagonglong, Misamis Oriental`}
            </p>
            <div className="flex gap-4 text-[11px] text-gray-500 dark:text-gray-400 pt-0.5">
              <span>Barangay: <strong>{feature.barangay_name || 'Poblacion'}</strong></span>
              <span>Municipality: <strong>Lagonglong</strong></span>
            </div>
          </div>

          {/* Coordinates display */}
          {lat != null && lng != null && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800 text-[11px]">
              <span className="font-mono text-gray-600 dark:text-gray-300">
                Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
              </span>
              <button
                type="button"
                onClick={copyCoordinates}
                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {copiedCoords ? <Check size={12} /> : <Copy size={12} />}
                {copiedCoords ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>

        {/* SECTION 2: Property Owner Information */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-1">
            <User size={13} className="text-blue-500" /> Property Owner Information
          </p>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 space-y-2">
            <div>
              <span className="block text-gray-400 text-[10px] uppercase font-semibold">Owner's Full Name</span>
              <strong className="text-sm text-gray-900 dark:text-white block mt-0.5">
                {feature.owner || 'Unassigned / Not recorded'}
              </strong>
            </div>

            {feature.owner_address && (
              <div className="flex items-start gap-1.5 text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-100 dark:border-gray-800">
                <Home size={13} className="shrink-0 mt-0.5 text-gray-400" />
                <span>{feature.owner_address}</span>
              </div>
            )}

            {feature.owner_contact && (
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <Phone size={13} className="shrink-0 text-gray-400" />
                <span className="font-mono">{feature.owner_contact}</span>
              </div>
            )}

            {feature.owner_email && (
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <Mail size={13} className="shrink-0 text-gray-400" />
                <span>{feature.owner_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: Assessment Information */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-1">
            <ShieldCheck size={13} className="text-purple-500" /> Assessment & Valuation
          </p>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[10px] uppercase font-semibold">Assessment Status</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  feature.assessment_status === 'approved'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : feature.assessment_status === 'submitted' || feature.assessment_status === 'draft'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {feature.assessment_status || 'Unassessed'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              <div>
                <span className="block text-gray-400 text-[10px]">Market Value</span>
                <strong className="text-gray-900 dark:text-white font-mono text-[11px]">
                  {formatCurrency(feature.market_value)}
                </strong>
              </div>
              <div>
                <span className="block text-gray-400 text-[10px]">Assessed Value</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold">
                  {formatCurrency(feature.assessed_value)}
                </strong>
              </div>
            </div>

            {feature.assessment_date && (
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px] pt-1 border-t border-gray-100 dark:border-gray-800">
                <Calendar size={12} />
                <span>Assessed Date: <strong>{formatDate(feature.assessment_date)}</strong></span>
              </div>
            )}

            {(feature.assessor_name || feature.assigned_assessor_name) && (
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px]">
                <User size={12} />
                <span>
                  Assessor: <strong>{feature.assigned_assessor_name || feature.assessor_name}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel Footer */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onOpenFullDetails}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition"
        >
          <ExternalLink size={14} />
          <span>View Full Property Record</span>
        </button>
      </div>
    </aside>
  )
}
