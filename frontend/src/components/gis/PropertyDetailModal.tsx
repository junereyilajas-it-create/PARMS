import { useState, useEffect } from 'react'
import {
  X,
  Building2,
  SquareDashed,
  MapPin,
  User,
  ArrowRight,
  Phone,
  Mail,
  Home,
  CheckCircle2,
  PencilRuler,
  Camera,
  Maximize2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import type { GISFeature } from '../../types/gis'

interface PropertyDetailModalProps {
  feature: GISFeature | null
  onClose: () => void
  onStartMapping?: () => void
  canEditGis?: boolean
}

export function PropertyDetailModal({
  feature,
  onClose,
  onStartMapping,
  canEditGis = false,
}: PropertyDetailModalProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'overview' | 'owner' | 'assessment' | 'gis'>('overview')
  const [photos, setPhotos] = useState<Array<{ photo_id?: number; file_path: string; file_name?: string | null; file_size?: number | null; is_primary?: number | boolean }>>([])
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null)

  useEffect(() => {
    if (!feature) return
    if (feature.photos && feature.photos.length > 0) {
      setPhotos(feature.photos)
    } else if (feature.property_id) {
      api.get(`/properties/${feature.property_id}/photos`)
        .then(res => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setPhotos(res.data)
          } else if (feature.property_photo) {
            setPhotos([{ file_path: feature.property_photo }])
          }
        })
        .catch(() => {
          if (feature.property_photo) {
            setPhotos([{ file_path: feature.property_photo }])
          }
        })
    } else if (feature.property_photo) {
      setPhotos([{ file_path: feature.property_photo }])
    }
  }, [feature])

  if (!feature) return null

  const isBuilding = feature.type === 'building'
  const isPending = feature.status === 'pending' || feature.property_status === 'pending'
  const hasGis = Boolean(feature.has_gis || (feature.coordinates && feature.coordinates !== 'null'))

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
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const navigateToDirectory = () => {
    onClose()
    if (isBuilding) {
      navigate('/buildings')
    } else {
      navigate('/lots')
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden text-gray-900 dark:text-gray-100 flex flex-col my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
          <div className="flex items-center gap-3">
            {isBuilding ? (
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                <Building2 size={24} />
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                <SquareDashed size={24} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400">
                  {isBuilding ? 'BUILDING RECORD' : 'LOT PARCEL RECORD'}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isPending
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }`}
                >
                  {feature.status || 'Active'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                {feature.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-5 gap-2 bg-gray-50/40 dark:bg-gray-800/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 font-semibold border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Property Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('owner')}
            className={`py-3 px-3 font-semibold border-b-2 transition ${
              activeTab === 'owner'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Owner Information
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assessment')}
            className={`py-3 px-3 font-semibold border-b-2 transition ${
              activeTab === 'assessment'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Assessment & Value
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gis')}
            className={`py-3 px-3 font-semibold border-b-2 transition ${
              activeTab === 'gis'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            GIS Geometry
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-xs">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-semibold block">Property ID</span>
                  <strong className="text-gray-900 dark:text-white font-mono text-sm">
                    {feature.property_id ? `PROPERTY-${feature.property_id}` : '—'}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-semibold block">
                    {isBuilding ? 'Building ID' : 'Lot ID'}
                  </span>
                  <strong className="text-gray-900 dark:text-white font-mono text-sm">
                    {feature.id || '—'}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-semibold block">Classification</span>
                  <strong className="text-gray-900 dark:text-white text-sm">
                    {feature.classification_name || 'Unclassified'}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-semibold block">
                    {isBuilding ? 'Floor Area' : 'Registered Lot Area'}
                  </span>
                  <strong className="text-gray-900 dark:text-white font-mono text-sm">
                    {feature.area ? `${Number(feature.area).toFixed(2)} m²` : '—'}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-semibold block">Property Type</span>
                  <strong className="text-gray-900 dark:text-white text-sm">
                    {feature.property_type_name || (isBuilding ? 'BUILDING' : 'LOT')}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-semibold block">Title Number</span>
                  <strong className="text-gray-900 dark:text-white font-mono text-sm">
                    {feature.title_number || 'None on record'}
                  </strong>
                </div>
              </div>

              {/* Building Specifics */}
              {isBuilding && (
                <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 space-y-3">
                  <h4 className="font-bold text-purple-900 dark:text-purple-300">Building Structure Specifications</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Building Type</span>
                      <strong className="text-gray-900 dark:text-white">{feature.building_type || 'Residential'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Number of Floors</span>
                      <strong className="text-gray-900 dark:text-white">{feature.floor_count != null ? `${feature.floor_count} Floors` : '1'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Year Constructed</span>
                      <strong className="text-gray-900 dark:text-white">{feature.year_constructed || 'Not recorded'}</strong>
                    </div>
                    <div className="col-span-full">
                      <span className="text-gray-400 text-[10px] block">Construction Materials</span>
                      <p className="text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">{feature.construction_type || 'Standard Mixed Materials'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Address details */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-2">
                <span className="text-gray-400 text-[10px] uppercase font-semibold flex items-center gap-1.5">
                  <MapPin size={13} className="text-red-500" /> Location & Jurisdiction
                </span>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  {feature.full_address || `${feature.street || 'Poblacion'}, Lagonglong, Misamis Oriental`}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-gray-600 dark:text-gray-300">
                  <div>Street / Purok: <strong>{feature.street || '—'}</strong></div>
                  <div>Barangay: <strong>{feature.barangay_name || 'Poblacion'}</strong></div>
                  <div>Municipality: <strong>Lagonglong</strong></div>
                  <div>Province: <strong>Misamis Oriental</strong></div>
                </div>
              </div>

              {photos.length > 0 && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-[10px] uppercase font-semibold flex items-center gap-1.5">
                      <Camera size={13} className="text-emerald-500" />
                      {isBuilding ? 'Building Photos' : 'Lot Photos'} ({photos.length})
                    </span>
                    <span className="text-[10px] text-gray-400">Click photo to enlarge</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {photos.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActivePhotoModal(p.file_path)}
                        className="group relative h-28 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 cursor-pointer shadow-sm hover:border-emerald-500 transition"
                      >
                        <img
                          src={p.file_path}
                          alt=""
                          className="w-full h-full object-cover transition group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        {idx === 0 && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold rounded shadow">
                            Primary
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Maximize2 size={16} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'owner' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <User size={20} />
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Registered Owner</span>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{feature.owner || 'Unassigned'}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-start gap-2">
                    <Home size={16} className="text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-gray-400 text-[10px] block">Owner Address</span>
                      <strong className="text-gray-900 dark:text-white">{feature.owner_address || 'Same as property address'}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-400 shrink-0" />
                    <div>
                      <span className="text-gray-400 text-[10px] block">Contact Number</span>
                      <strong className="text-gray-900 dark:text-white font-mono">{feature.owner_contact || 'None recorded'}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-400 shrink-0" />
                    <div>
                      <span className="text-gray-400 text-[10px] block">Email Address</span>
                      <strong className="text-gray-900 dark:text-white">{feature.owner_email || 'None recorded'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assessment' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-500">Official Assessment Status</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      feature.assessment_status === 'approved'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {feature.assessment_status || 'Unassessed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Market Value</span>
                    <strong className="text-base font-mono text-gray-900 dark:text-white">
                      {formatCurrency(feature.market_value)}
                    </strong>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Assessed Value</span>
                    <strong className="text-base font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatCurrency(feature.assessed_value)}
                    </strong>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span>Assessment Level:</span>
                    <strong>{feature.assessor_level ? `${feature.assessor_level}%` : '20.00%'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Latest Assessment Date:</span>
                    <strong>{formatDate(feature.assessment_date)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Assigned Assessor:</span>
                    <strong>{feature.assigned_assessor_name || feature.assessor_name || 'Unassigned'}</strong>
                  </div>
                  {feature.assignment_status && (
                    <div className="flex justify-between">
                      <span>Assignment Workflow:</span>
                      <span className="uppercase font-semibold text-blue-600 dark:text-blue-400">{feature.assignment_status}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gis' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">GIS Geometry Status</span>
                  {hasGis ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 size={16} /> Polygon Mapped
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                      Needs Survey Mapping
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-400 block">GIS Area</span>
                    <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                      {feature.area_sqm ? `${Number(feature.area_sqm).toFixed(2)} m²` : '—'}
                    </strong>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-400 block">Perimeter</span>
                    <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                      {feature.perimeter_m ? `${Number(feature.perimeter_m).toFixed(2)} m` : '—'}
                    </strong>
                  </div>
                </div>

                {feature.latitude != null && feature.longitude != null && (
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-400 block">Centroid Coordinates</span>
                    <strong className="text-xs font-mono text-gray-800 dark:text-gray-200">
                      Latitude: {feature.latitude.toFixed(6)}, Longitude: {feature.longitude.toFixed(6)}
                    </strong>
                  </div>
                )}

                {canEditGis && onStartMapping && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onStartMapping()
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition"
                  >
                    <PencilRuler size={14} />
                    <span>{hasGis ? 'Edit / Redraw GIS Boundary' : 'Draw New GIS Boundary'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={navigateToDirectory}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <span>Open in {isBuilding ? 'Building Directory' : 'Lots Directory'}</span>
            <ArrowRight size={14} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Lightbox zoom modal */}
      {activePhotoModal && (
        <div
          onClick={() => setActivePhotoModal(null)}
          className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div onClick={e => e.stopPropagation()} className="relative max-w-3xl max-h-[85vh] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-gray-700">
            <button
              type="button"
              onClick={() => setActivePhotoModal(null)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer"
            >
              <X size={18} />
            </button>
            <img src={activePhotoModal} alt="" className="max-h-[80vh] max-w-full object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  )
}
