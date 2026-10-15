import { useState, useEffect, useMemo, useRef } from 'react'
import {
  MapPin,
  Layers,
  Building2,
  SquareDashed,
  Search,
  RefreshCw,
  Eye,
  Ruler,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react'
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import api, { ensureSession } from '../lib/api'
import { useModal } from '../contexts/ModalContext'
import type { GISFeature, MapMode } from '../types/gis'
import {
  parseLeafletPositions,
  getGeometryDetails,
  createCustomMarkerIcon,
  createSideLengthIcon,
} from '../lib/gisUtils'
import { StreetViewViewer } from '../components/gis/StreetViewViewer'
import { PropertyDetailPanel } from '../components/gis/PropertyDetailPanel'
import { PropertyDetailModal } from '../components/gis/PropertyDetailModal'
import { GISDrawModal } from '../components/gis/GISDrawModal'

// Lagonglong, Misamis Oriental coordinates
const LAGONGLONG_CENTER: [number, number] = [8.8062, 124.7900]

// Leaflet Map Controller for programmatic flyTo and fitBounds
function MapFlyController({
  targetCenter,
  targetBounds,
}: {
  targetCenter: [number, number] | null
  targetBounds: [[number, number], [number, number]] | null
}) {
  const map = useMap()
  useEffect(() => {
    if (targetBounds) {
      map.flyToBounds(targetBounds, { padding: [60, 60], maxZoom: 18, duration: 1.2 })
    } else if (targetCenter) {
      map.flyTo(targetCenter, 17, { duration: 1.2 })
    }
  }, [map, targetCenter, targetBounds])
  return null
}

export function PropertyMapView() {
  const { showError, showSuccess } = useModal()

  // State
  const [mapMode, setMapMode] = useState<MapMode>('street')
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [filterType, setFilterType] = useState<'All' | 'Lots' | 'Buildings' | 'Unmapped'>('All')
  const [showMeasurements, setShowMeasurements] = useState(true)
  const [showSatelliteLabels, setShowSatelliteLabels] = useState(true)

  const [features, setFeatures] = useState<GISFeature[]>([])
  const [selectedFeature, setSelectedFeature] = useState<GISFeature | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Map Navigation targets
  const [flyTargetCenter, setFlyTargetCenter] = useState<[number, number] | null>(null)
  const [flyTargetBounds, setFlyTargetBounds] = useState<[[number, number], [number, number]] | null>(null)

  // Modals
  const [isFullDetailModalOpen, setIsFullDetailModalOpen] = useState(false)
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false)

  // Current user role
  const [userRole] = useState(() => localStorage.getItem('accessor_role') || '')
  const canEditGis = ['admin', 'assessor', 'super_admin'].includes(userRole)

  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load GIS Property Data from Backend
  const loadGISData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true)
    else setIsLoading(true)
    setErrorMessage('')

    try {
      await ensureSession()
      const { data } = await api.get('/gis/properties')
      const lots = (data.lots || []).map((l: any) => ({
        ...l,
        type: 'lot',
        has_gis: Boolean(l.gis_id && l.coordinates),
      }))
      const bldgs = (data.buildings || []).map((b: any) => ({
        ...b,
        type: 'building',
        has_gis: Boolean(b.gis_id && b.coordinates),
      }))

      // Combine lots and buildings without duplicates
      const combined = [...lots, ...bldgs]
      setFeatures(combined)

      // If a feature was previously selected, update its reference with latest data
      if (selectedFeature) {
        const updated = combined.find(f => f.type === selectedFeature.type && f.id === selectedFeature.id)
        if (updated) setSelectedFeature(updated)
      }

      if (isManualRefresh) {
        showSuccess('GIS property records successfully refreshed from database.')
      }
    } catch {
      setErrorMessage('Unable to connect to the PARMS API or MySQL database. Please verify the backend server.')
      showError('Failed to load GIS data from the database.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadGISData()
  }, [])

  // Parse geometries for all features that have GIS coordinates
  const featuresWithGeometry = useMemo(() => {
    return features.map(f => {
      const positions = parseLeafletPositions(f.coordinates)
      const geomDetails = positions.length >= 3 ? getGeometryDetails(positions) : null

      // Determine marker position
      let markerPos: [number, number] | null = null
      if (geomDetails?.centroid) {
        markerPos = geomDetails.centroid
      } else if (f.latitude != null && f.longitude != null) {
        markerPos = [Number(f.latitude), Number(f.longitude)]
      }

      return {
        ...f,
        latitude: markerPos ? markerPos[0] : f.latitude,
        longitude: markerPos ? markerPos[1] : f.longitude,
        parsedPositions: positions,
        geomDetails,
        markerPos,
      }
    })
  }, [features])

  // Filter features according to selected tab and search query
  const filteredFeatures = useMemo(() => {
    const q = query.trim().toLowerCase()
    return featuresWithGeometry.filter(f => {
      // Type & Mapping filter
      if (filterType === 'Lots' && f.type !== 'lot') return false
      if (filterType === 'Buildings' && f.type !== 'building') return false
      if (filterType === 'Unmapped' && f.has_gis) return false
      if (filterType === 'All' && !f.has_gis && q === '') return true

      return true
    })
  }, [featuresWithGeometry, filterType, query])

  // Search results for real-time dropdown
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return featuresWithGeometry.filter(f => {
      const matchTitle = (f.title || '').toLowerCase().includes(q)
      const matchOwner = (f.owner || '').toLowerCase().includes(q)
      const matchPropId = `property-${f.property_id}`.toLowerCase().includes(q) || String(f.property_id).includes(q)
      const matchEntityId = String(f.id).toLowerCase().includes(q)
      const matchBarangay = (f.barangay_name || '').toLowerCase().includes(q)
      const matchAddress = (f.full_address || '').toLowerCase().includes(q)
      return matchTitle || matchOwner || matchPropId || matchEntityId || matchBarangay || matchAddress
    }).slice(0, 12)
  }, [featuresWithGeometry, query])

  // Select feature and center map
  const handleSelectFeature = (feature: typeof featuresWithGeometry[0]) => {
    setSelectedFeature(feature)
    setIsSearchOpen(false)

    if (feature.geomDetails?.bounds) {
      setFlyTargetBounds(feature.geomDetails.bounds)
      setFlyTargetCenter(null)
    } else if (feature.markerPos) {
      setFlyTargetCenter(feature.markerPos)
      setFlyTargetBounds(null)
    }
  }

  // Street View Target Coordinates
  const streetViewCoords = useMemo<[number, number]>(() => {
    if (selectedFeature?.latitude != null && selectedFeature?.longitude != null) {
      return [selectedFeature.latitude, selectedFeature.longitude]
    }
    // Default to first mapped property or Lagonglong center
    const firstMapped = featuresWithGeometry.find(f => f.markerPos != null)
    if (firstMapped?.markerPos) return firstMapped.markerPos
    return LAGONGLONG_CENTER
  }, [selectedFeature, featuresWithGeometry])

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Title & Stats Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase mb-1">
            MUNICIPALITY OF LAGONGLONG • GIS PROPERTY PORTAL
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Property Mapping & Street View
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            High-precision cadastral mapping, actual satellite bird’s-eye imagery, and street-level exploration.
          </p>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>{features.filter(f => f.has_gis).length} Mapped</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5">
            <AlertCircle size={14} className="text-amber-600" />
            <span>{features.filter(f => !f.has_gis).length} Needs Mapping</span>
          </div>
        </div>
      </div>

      {/* Main Map Container & Panel Layout */}
      <div className="flex flex-col lg:flex-row gap-5 min-h-[640px]">
        {/* Left Map Viewport Container */}
        <section className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
          {/* GIS Mapping Toolbar */}
          <div className="relative z-30 flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur">
            {/* Search Box with Real-time Dropdown */}
            <div ref={searchContainerRef} className="relative flex-1 min-w-[240px] max-w-md">
              <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition shadow-sm">
                <Search size={16} className="text-gray-400 shrink-0" />
                <input
                  id="input-gis-search"
                  type="text"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value)
                    setIsSearchOpen(true)
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Search by Property ID, Lot #, Owner, Barangay..."
                  className="w-full bg-transparent border-none outline-none text-xs text-gray-900 dark:text-white placeholder:text-gray-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setIsSearchOpen(false)
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Real-time search dropdown list */}
              {isSearchOpen && query.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden z-50 max-h-72 overflow-y-auto animate-fade-in text-xs">
                  {searchResults.length > 0 ? (
                    searchResults.map(result => (
                      <div
                        key={`${result.type}-${result.id}`}
                        onMouseDown={e => {
                          e.preventDefault()
                          handleSelectFeature(result)
                        }}
                        onClick={() => handleSelectFeature(result)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-b border-gray-100 dark:border-gray-800 last:border-b-0 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          {result.type === 'building' ? (
                            <Building2 size={16} className="text-purple-600 shrink-0" />
                          ) : (
                            <SquareDashed size={16} className="text-emerald-600 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{result.title}</span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                (P-{result.property_id})
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {result.owner} • {result.barangay_name || 'Lagonglong'}
                            </div>
                          </div>
                        </div>

                        <div>
                          {result.has_gis ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <CheckCircle2 size={11} /> Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              <AlertCircle size={11} /> Needs Mapping
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      No matching properties found for "{query}".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filter Tabs (All, Lots, Buildings, Needs Mapping) */}
            <div className="flex items-center bg-gray-200/80 dark:bg-gray-700/80 p-0.5 rounded-xl text-xs font-semibold">
              {(['All', 'Lots', 'Buildings', 'Unmapped'] as const).map(tab => (
                <button
                  key={tab}
                  id={`tab-filter-${tab.toLowerCase()}`}
                  type="button"
                  onClick={() => setFilterType(tab)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filterType === tab
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab === 'All'
                    ? 'All'
                    : tab === 'Lots'
                      ? 'Lots'
                      : tab === 'Buildings'
                        ? 'Buildings'
                        : 'Needs Mapping'}
                </button>
              ))}
            </div>

            {/* View Mode Selector: Street Map | Satellite / Bird's-Eye | Street View */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-emerald-50 dark:bg-emerald-950/40 p-0.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-xs font-semibold">
                <button
                  id="btn-map-view-street"
                  type="button"
                  onClick={() => setMapMode('street')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                    mapMode === 'street'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  }`}
                >
                  <MapPin size={13} />
                  <span>Street Map</span>
                </button>

                <button
                  id="btn-map-view-satellite"
                  type="button"
                  onClick={() => setMapMode('satellite')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                    mapMode === 'satellite'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  }`}
                >
                  <Layers size={13} />
                  <span>Satellite</span>
                </button>

                <button
                  id="btn-map-view-streetview"
                  type="button"
                  onClick={() => setMapMode('streetview')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                    mapMode === 'streetview'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  }`}
                >
                  <Eye size={13} />
                  <span>Street View</span>
                </button>
              </div>

              {/* Satellite Labels Toggle */}
              {mapMode === 'satellite' && (
                <button
                  id="btn-gis-satellite-labels"
                  type="button"
                  onClick={() => setShowSatelliteLabels(l => !l)}
                  className={`p-2 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                    showSatelliteLabels
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                  title={showSatelliteLabels ? 'Hide Street Labels' : 'Show Street Labels'}
                >
                  <Layers size={14} />
                  <span className="hidden sm:inline">Labels</span>
                </button>
              )}

              {/* Measurements Toggle */}
              {mapMode !== 'streetview' && (
                <button
                  id="btn-gis-measurements"
                  type="button"
                  onClick={() => setShowMeasurements(m => !m)}
                  className={`p-2 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                    showMeasurements
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                  title={showMeasurements ? 'Hide Side Measurements' : 'Show Side Measurements'}
                >
                  <Ruler size={15} />
                  <span className="hidden sm:inline">Measurements</span>
                </button>
              )}

              {/* Refresh Database Records */}
              <button
                id="btn-gis-refresh"
                type="button"
                onClick={() => loadGISData(true)}
                disabled={isRefreshing}
                className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                title="Refresh GIS properties from database"
              >
                <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
              </button>
            </div>
          </div>

          {/* Database error banner */}
          {errorMessage && (
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800 text-xs font-medium">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => loadGISData(true)}
                className="px-3 py-1 bg-red-600 text-white rounded font-semibold text-[11px] hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {/* Map Body Canvas */}
          <div className="relative flex-1 w-full h-[520px] sm:h-[580px] bg-gray-100 dark:bg-gray-950 overflow-hidden">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur z-30">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Retrieving Cadastral GIS Records from Database...
                </p>
                <p className="text-[11px] text-gray-400 mt-1">Lagonglong, Misamis Oriental</p>
              </div>
            ) : null}

            {mapMode === 'streetview' ? (
              /* Street View Viewport Mode */
              <StreetViewViewer
                lat={streetViewCoords[0]}
                lng={streetViewCoords[1]}
                feature={selectedFeature}
                onClose={() => setMapMode('street')}
                onSwitchToSatellite={() => setMapMode('satellite')}
                onSwitchToStreetMap={() => setMapMode('street')}
                miniMapComponent={
                  /* Mini-Map overview rendered in Street View corner */
                  <MapContainer
                    center={streetViewCoords}
                    zoom={17}
                    zoomControl={false}
                    attributionControl={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    {featuresWithGeometry.map(f => {
                      if (!f.parsedPositions.length) return null
                      const isSelected = selectedFeature?.id === f.id && selectedFeature?.type === f.type
                      const color = f.type === 'building' ? '#a855f7' : '#10b981'
                      return (
                        <Polygon
                          key={`mini-${f.type}-${f.id}`}
                          positions={f.parsedPositions}
                          pathOptions={{
                            color: isSelected ? '#06b6d4' : color,
                            fillColor: color,
                            fillOpacity: 0.4,
                            weight: isSelected ? 3 : 1.5,
                          }}
                        />
                      )
                    })}
                    <Marker
                      position={streetViewCoords}
                      icon={createCustomMarkerIcon(
                        selectedFeature?.type || 'lot',
                        true,
                        selectedFeature?.status === 'pending'
                      )}
                    />
                  </MapContainer>
                }
              />
            ) : (
              /* Interactive 2D Leaflet Map (Street Map or Satellite Bird's-Eye View) */
              <MapContainer
                center={LAGONGLONG_CENTER}
                zoom={15}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                {/* Programmatic fly-to controller */}
                <MapFlyController
                  targetCenter={flyTargetCenter}
                  targetBounds={flyTargetBounds}
                />

                {/* Base Tile Layer */}
                {mapMode === 'street' ? (
                  <TileLayer
                    key="tile-street"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />
                ) : (
                  <>
                    {/* Esri World Imagery Satellite / Bird's-Eye */}
                    <TileLayer
                      key="tile-satellite"
                      attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      maxZoom={19}
                    />
                    {/* Optional Reference Hybrid Roads & Place Labels */}
                    {showSatelliteLabels && (
                      <TileLayer
                        key="tile-satellite-labels"
                        attribution='Labels &copy; Esri'
                        url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                        opacity={0.85}
                      />
                    )}
                  </>
                )}

                {/* Render Mapped Features */}
                {filteredFeatures.map(f => {
                  const hasPolygon = f.parsedPositions.length >= 3
                  if (!hasPolygon && !f.markerPos) return null

                  const isBuilding = f.type === 'building'
                  const isPending = f.status === 'pending' || f.property_status === 'pending'
                  const isSelected = selectedFeature?.id === f.id && selectedFeature?.type === f.type

                  // Colors: Emerald for Lot, Purple for Building, Amber for Pending, Cyan for Selected
                  let strokeColor = isBuilding ? '#8b5cf6' : '#10b981'
                  if (isPending) strokeColor = '#f59e0b'
                  if (isSelected) strokeColor = '#06b6d4'

                  const fillColor = isBuilding ? '#8b5cf6' : '#10b981'

                  return (
                    <div key={`${f.type}-${f.id}`}>
                      {/* Polygon Footprint */}
                      {hasPolygon && (
                        <Polygon
                          positions={f.parsedPositions}
                          pathOptions={{
                            color: strokeColor,
                            fillColor,
                            fillOpacity: isSelected ? 0.6 : isPending ? 0.5 : 0.35,
                            weight: isSelected ? 4 : 2,
                            dashArray: isPending ? '6, 6' : undefined,
                          }}
                          eventHandlers={{
                            click: () => handleSelectFeature(f),
                          }}
                        >
                          <Popup>
                            <div className="p-1 space-y-1 text-xs">
                              <div className="font-bold text-gray-900 flex items-center gap-1">
                                {isBuilding ? <Building2 size={13} className="text-purple-600" /> : <SquareDashed size={13} className="text-emerald-600" />}
                                <span>{f.title}</span>
                              </div>
                              <div className="text-gray-600">Owner: <strong>{f.owner}</strong></div>
                              <div className="text-gray-600">Area: <strong>{f.area_sqm || f.area} m²</strong></div>
                              <div className="text-gray-600">Barangay: <strong>{f.barangay_name || 'Lagonglong'}</strong></div>
                              <button
                                type="button"
                                onClick={() => handleSelectFeature(f)}
                                className="w-full mt-2 py-1 px-2 bg-emerald-600 text-white rounded font-semibold text-[11px] hover:bg-emerald-700 transition"
                              >
                                View Property Details
                              </button>
                            </div>
                          </Popup>
                        </Polygon>
                      )}

                      {/* Property Centroid Marker Pin */}
                      {f.markerPos && (
                        <Marker
                          position={f.markerPos}
                          icon={createCustomMarkerIcon(f.type, isSelected, isPending)}
                          eventHandlers={{
                            click: () => handleSelectFeature(f),
                          }}
                        />
                      )}

                      {/* Side Lengths & Measurements Labels */}
                      {showMeasurements && f.geomDetails?.sideLengths && (
                        <>
                          {f.geomDetails.sideLengths.map((side, idx) => (
                            <Marker
                              key={`edge-${f.type}-${f.id}-${idx}`}
                              position={side.midPoint}
                              icon={createSideLengthIcon(side.lengthMeters)}
                              interactive={false}
                            />
                          ))}
                        </>
                      )}
                    </div>
                  )
                })}
              </MapContainer>
            )}
          </div>

          {/* Map Footer & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm" />
                Land Parcels / Lots
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-purple-500 inline-block shadow-sm" />
                Building Footprints
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-amber-500 border border-dashed border-amber-700 inline-block" />
                Pending Approval
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block shadow-sm ring-2 ring-cyan-200" />
                Active Selection
              </span>
            </div>

            <div className="text-gray-500 dark:text-gray-400 font-medium">
              Lagonglong, Misamis Oriental • {features.filter(f => f.has_gis).length} Mapped Properties Loaded
            </div>
          </div>
        </section>

        {/* Right Property Details Panel */}
        {selectedFeature && (
          <PropertyDetailPanel
            feature={selectedFeature}
            onClose={() => setSelectedFeature(null)}
            onZoomTo={() => {
              if (selectedFeature.latitude != null && selectedFeature.longitude != null) {
                setFlyTargetCenter([selectedFeature.latitude, selectedFeature.longitude])
                setFlyTargetBounds(null)
              }
            }}
            onOpenStreetView={() => {
              setMapMode('streetview')
            }}
            onOpenFullDetails={() => setIsFullDetailModalOpen(true)}
            onStartMapping={() => setIsDrawModalOpen(true)}
            canEditGis={canEditGis}
          />
        )}
      </div>

      {/* Comprehensive Full Property Record Modal */}
      {isFullDetailModalOpen && selectedFeature && (
        <PropertyDetailModal
          feature={selectedFeature}
          onClose={() => setIsFullDetailModalOpen(false)}
          onStartMapping={() => setIsDrawModalOpen(true)}
          canEditGis={canEditGis}
        />
      )}

      {/* GIS Boundary Drawing Modal for Mapping Unmapped Properties */}
      {isDrawModalOpen && selectedFeature && (
        <GISDrawModal
          feature={selectedFeature}
          onClose={() => setIsDrawModalOpen(false)}
          onSaved={() => {
            loadGISData(true)
          }}
        />
      )}
    </div>
  )
}
