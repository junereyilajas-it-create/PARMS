import { useEffect, useState, useMemo } from 'react'
import { 
  Building2, 
  MapPin, 
  Search, 
  Filter, 
  RotateCcw, 
  Map as MapIcon, 
  ShieldCheck, 
  FileText, 
  X, 
  Grid, 
  List as ListIcon, 
  ChevronRight,
  Camera,
  BadgeCheck,
  Clock
} from 'lucide-react'
import api from '../lib/api'
import { MapContainer, TileLayer, Polygon, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { parseLeafletPositions } from '../lib/gisUtils'
import { useNavigate } from 'react-router-dom'

const LAGONGLONG_BARANGAYS = [
  'Dampil',
  'Gaston',
  'Kauswagan',
  'Lumbo',
  'Mabini',
  'Poblacion',
  'Tabok'
]

const LAGONGLONG_CENTER: [number, number] = [8.8062, 124.7900]

export function ClientProperties() {
  const navigate = useNavigate()
  const [properties, setProperties] = useState<any[]>([])
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null)
  const [details, setDetails] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [barangayFilter, setBarangayFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  useEffect(() => {
    async function loadProperties() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get('/client/my-properties')
        setProperties(Array.isArray(data) ? data : [])
      } catch (e: any) {
        console.error('Error loading properties:', e)
        setError('Failed to load your registered properties. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    loadProperties()
  }, [])

  const handleOpenDetails = async (property: any) => {
    setSelectedProperty(property)
    setLoadingDetails(true)
    try {
      const { data } = await api.get(`/client/my-properties/${property.property_id}`)
      setDetails(data)
    } catch (e) {
      console.error('Failed to load property details:', e)
      setDetails(property) // fallback to card data
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleCloseDetails = () => {
    setSelectedProperty(null)
    setDetails(null)
  }

  const handleResetFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setBarangayFilter('all')
    setStatusFilter('all')
  }

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesId = String(p.property_id).includes(q)
        const matchesLot = String(p.lot_number || '').toLowerCase().includes(q)
        const matchesBldg = String(p.building_name || '').toLowerCase().includes(q)
        const matchesLoc = String(p.location || '').toLowerCase().includes(q)
        const matchesTax = String(p.tax_declaration_no || '').toLowerCase().includes(q)
        if (!matchesId && !matchesLot && !matchesBldg && !matchesLoc && !matchesTax) return false
      }

      // Type filter
      if (typeFilter !== 'all') {
        const type = String(p.property_type || '').toLowerCase()
        if (typeFilter === 'lot' && !type.includes('lot')) return false
        if (typeFilter === 'building' && !type.includes('building')) return false
      }

      // Barangay filter
      if (barangayFilter !== 'all') {
        const loc = String(p.location || '').toLowerCase()
        if (!loc.includes(barangayFilter.toLowerCase())) return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'assessed' && p.assessment_status !== 'ASSESSED') return false
        if (statusFilter === 'unassessed' && p.assessment_status !== 'UNASSESSED') return false
      }

      return true
    })
  }, [properties, search, typeFilter, barangayFilter, statusFilter])

  // Polygon positions for detail modal
  const polygonPositions = useMemo(() => {
    if (!details?.gis?.coordinates) return null
    try {
      return parseLeafletPositions(details.gis.coordinates)
    } catch (e) {
      return null
    }
  }, [details])

  const mapCenter = useMemo((): [number, number] => {
    if (polygonPositions && polygonPositions.length > 0) {
      // Calculate simple centroid
      const lats = polygonPositions.map(p => p[0])
      const lngs = polygonPositions.map(p => p[1])
      return [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lngs) + Math.max(...lngs)) / 2
      ]
    }
    return LAGONGLONG_CENTER
  }, [polygonPositions])

  return (
    <div className="space-y-6 fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-500">
            My Registered Properties
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse and inspect official property declarations, tax records, and GIS boundaries registered under your name.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-green-700 dark:text-green-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Card Grid View"
            >
              <Grid size={15} />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-700 text-green-700 dark:text-green-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Table View"
            >
              <ListIcon size={15} />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            onClick={() => navigate('/client/gis-map')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm cursor-pointer"
          >
            <MapIcon size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>Interactive Map</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-center gap-3 flex-wrap bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search by Property ID, Lot #, Building, or Address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
          <Filter size={14} className="text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
          >
            <option value="all">All Types</option>
            <option value="lot">Lots Only</option>
            <option value="building">Buildings Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
          <select
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
          >
            <option value="all">All Barangays</option>
            {LAGONGLONG_BARANGAYS.map(b => (
              <option key={b} value={b}>Brgy. {b}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
          >
            <option value="all">All Assessment Statuses</option>
            <option value="assessed">Assessed</option>
            <option value="unassessed">Unassessed</option>
          </select>
        </div>

        {(search || typeFilter !== 'all' || barangayFilter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={handleResetFilters}
            className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading property inventory...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      ) : filteredProperties.length === 0 ? (
        /* Empty State */
        <div className="p-16 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mb-3">
            <Building2 size={32} />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">No matching properties found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            {search || typeFilter !== 'all' || barangayFilter !== 'all' || statusFilter !== 'all'
              ? 'Try resetting your search query or filter options to see all records.'
              : 'You do not have any registered real properties under this account.'}
          </p>
          {(search || typeFilter !== 'all' || barangayFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((p) => {
            const isAssessed = p.assessment_status === 'ASSESSED'
            return (
              <div
                key={p.property_id}
                onClick={() => handleOpenDetails(p)}
                className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-green-500/50 dark:hover:border-green-500/50 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
              >
                <div className="p-6">
                  {/* Card Header Badges */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      PROPERTY #{p.property_id}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      isAssessed
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    }`}>
                      {isAssessed ? <BadgeCheck size={12} /> : <Clock size={12} />}
                      {p.assessment_status}
                    </span>
                  </div>

                  {/* Title & Classification */}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                    {p.property_type || 'Property'} {p.lot_number || p.building_name || ''}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {p.classification_name || 'Standard'}
                    </span>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {p.area ? `${Number(p.area).toLocaleString()} sq.m.` : 'Area on file'}
                    </span>
                  </div>

                  {/* Address */}
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 flex items-start gap-1.5 leading-relaxed">
                    <MapPin size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <span>{p.location || 'Lagonglong, Misamis Oriental'}</span>
                  </p>

                  {/* Valuation preview */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Market Value</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {Number(p.market_value) > 0 ? `₱${Number(p.market_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '₱0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Assessed Value</span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {Number(p.assessed_value) > 0 ? `₱${Number(p.assessed_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Unassessed'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer action bar */}
                <div className="px-6 py-3 bg-gray-50/80 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {p.has_gis ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <MapIcon size={12} /> GIS Available
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[11px]">No map geometry</span>
                    )}
                  </div>
                  <span className="text-green-700 dark:text-green-400 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                    <span>Inspect</span>
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-[11px] uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="px-6 py-3.5">Property ID</th>
                  <th className="px-6 py-3.5">Type & Ref</th>
                  <th className="px-6 py-3.5">Classification</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Area</th>
                  <th className="px-6 py-3.5">Assessed Value</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredProperties.map((p) => (
                  <tr
                    key={p.property_id}
                    onClick={() => handleOpenDetails(p)}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-xs text-gray-700 dark:text-gray-300">
                      #{p.property_id}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      <div>{p.property_type || 'Property'}</div>
                      <div className="text-[11px] font-mono text-gray-400">{p.lot_number || p.building_name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300">
                      {p.classification_name || 'Standard'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate" title={p.location}>
                      {p.location}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300">
                      {p.area ? `${Number(p.area).toLocaleString()} sq.m.` : '-'}
                    </td>
                    <td className="px-6 py-4 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                      {Number(p.assessed_value) > 0 ? `₱${Number(p.assessed_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Unassessed'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        p.assessment_status === 'ASSESSED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {p.assessment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDetails(p)
                        }}
                        className="text-xs font-bold text-green-700 dark:text-green-400 hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Property Details Modal with GIS Preview */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-3xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-600/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  <Building2 size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>Property #{selectedProperty.property_id}</span>
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {selectedProperty.property_type}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} />
                    <span>{selectedProperty.location}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDetails}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg font-bold p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {loadingDetails ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading full property records...</span>
                </div>
              ) : (
                <>
                  {/* Read-Only Notice */}
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                    <span>
                      Official property assessment and title records are registered with the Office of the Municipal Assessor. This information is read-only for verified property owners.
                    </span>
                  </div>

                  {/* Property Specifications Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                      Property Specifications
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs">
                      <div>
                        <span className="text-gray-400 block">Classification:</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {details?.classification_name || selectedProperty.classification_name || 'Standard'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Lot / Survey Number:</span>
                        <span className="font-bold text-gray-900 dark:text-white font-mono">
                          {details?.lot_number || selectedProperty.lot_number || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Title Number (OCT/TCT):</span>
                        <span className="font-bold text-gray-900 dark:text-white font-mono">
                          {details?.title_number || selectedProperty.title_number || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Land / Floor Area:</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {details?.area ? `${Number(details.area).toLocaleString()} sq.m.` : 'Recorded on file'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Tax Declaration Number:</span>
                        <span className="font-bold text-gray-900 dark:text-white font-mono">
                          {details?.tax_declaration_no || selectedProperty.tax_declaration_no || 'Pending Assignment'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Property Status:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                          {details?.property_status || selectedProperty.property_status || 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Valuation Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                      Assessment & Official Valuation
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-1">
                          Market Value
                        </span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {Number(details?.market_value || selectedProperty.market_value) > 0
                            ? `₱${Number(details?.market_value || selectedProperty.market_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : '₱0.00'}
                        </span>
                        <p className="text-[11px] text-gray-400 mt-1">Appraised property market valuation</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase block mb-1">
                          Assessed Value (Taxable)
                        </span>
                        <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                          {Number(details?.assessed_value || selectedProperty.assessed_value) > 0
                            ? `₱${Number(details?.assessed_value || selectedProperty.assessed_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : 'UNASSESSED'}
                        </span>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-1">Official taxable assessment basis</p>
                      </div>
                    </div>
                  </div>

                  {/* GIS Map Boundary Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <MapIcon size={14} className="text-emerald-600" />
                        <span>GIS Map & Boundary Preview</span>
                      </h4>
                      {details?.gis && (
                        <span className="text-xs font-mono text-emerald-600 font-semibold">
                          Area: {details.gis.area_sqm ? `${Number(details.gis.area_sqm).toLocaleString()} m²` : 'Mapped'}
                        </span>
                      )}
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 h-56 relative z-0">
                      <MapContainer
                        center={mapCenter}
                        zoom={polygonPositions ? 17 : 14}
                        scrollWheelZoom={false}
                        className="w-full h-full"
                      >
                        <TileLayer
                          attribution='&copy; OpenStreetMap contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {polygonPositions && polygonPositions.length > 0 ? (
                          <Polygon
                            positions={polygonPositions}
                            pathOptions={{
                              color: '#059669',
                              fillColor: '#10b981',
                              fillOpacity: 0.35,
                              weight: 2
                            }}
                          >
                            <Popup>
                              <div className="text-xs font-sans">
                                <strong>Property #{selectedProperty.property_id}</strong>
                                <p>{selectedProperty.location}</p>
                              </div>
                            </Popup>
                          </Polygon>
                        ) : (
                          <Marker position={LAGONGLONG_CENTER}>
                            <Popup>
                              <div className="text-xs font-sans">
                                <strong>{selectedProperty.location}</strong>
                                <p>Lagonglong, Misamis Oriental</p>
                              </div>
                            </Popup>
                          </Marker>
                        )}
                      </MapContainer>
                    </div>
                  </div>

                  {/* Property Photos (if available) */}
                  {details?.photos && details.photos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                        <Camera size={14} className="text-emerald-600" />
                        <span>Property Photos</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {details.photos.map((ph: any) => (
                          <div key={ph.photo_id} className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 h-28 relative group">
                            <img
                              src={ph.file_path}
                              alt={ph.caption || 'Property photograph'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            {ph.caption && (
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] p-1 truncate">
                                {ph.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs text-gray-500">
                Need an official certified true copy of this property?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseDetails}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleCloseDetails()
                    navigate('/client/certificate-requests', { state: { propertyId: selectedProperty.property_id } })
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Request Certificate for this Property</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
