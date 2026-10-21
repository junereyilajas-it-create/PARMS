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
  X,
  Maximize2,
  PencilRuler,
  ListFilter,
  Map as MapIcon,
  Table,
  Clock,
  Send
} from 'lucide-react'
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import api, { ensureSession } from '../lib/api'
import { useModal } from '../contexts/ModalContext'
import type { GISFeature, MapMode, GISMappingRequest } from '../types/gis'
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
import { GISPropertyDirectoryTable } from '../components/gis/GISPropertyDirectoryTable'
import { GISMappingRequestsTable } from '../components/gis/GISMappingRequestsTable'
import { GISMappingRequestModal } from '../components/gis/GISMappingRequestModal'
import { GISReviewRequestModal } from '../components/gis/GISReviewRequestModal'

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
      map.flyToBounds(targetBounds, { padding: [50, 50], maxZoom: 18, duration: 1.2 })
    } else if (targetCenter) {
      map.flyTo(targetCenter, 17, { duration: 1.2 })
    }
  }, [map, targetCenter, targetBounds])
  return null
}

type FilterType = 'All' | 'Lots' | 'Buildings' | 'Assessed' | 'Unassessed' | 'Unmapped'

export function PropertyMapView() {
  const { showError, showSuccess } = useModal()

  // State
  type GISViewTab = 'map' | 'directory' | 'requests'
  const [gisViewTab, setGisViewTab] = useState<GISViewTab>('map')
  const [mapMode, setMapMode] = useState<MapMode>('street')
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [filterType, setFilterType] = useState<FilterType>('All')
  const [showMeasurements, setShowMeasurements] = useState(true)
  const [showSatelliteLabels, setShowSatelliteLabels] = useState(true)

  // Needs Mapping Queue local filter state
  const [unmappedBarangayFilter, setUnmappedBarangayFilter] = useState<string>('all')

  const [features, setFeatures] = useState<GISFeature[]>([])
  const [selectedFeature, setSelectedFeature] = useState<GISFeature | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Map Navigation targets
  const [flyTargetCenter, setFlyTargetCenter] = useState<[number, number] | null>(null)
  const [flyTargetBounds, setFlyTargetBounds] = useState<[[number, number], [number, number]] | null>(null)
  const hasAutoFittedRef = useRef(false)

  // Modals
  const [isFullDetailModalOpen, setIsFullDetailModalOpen] = useState(false)
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false)
  const [requestTargetFeature, setRequestTargetFeature] = useState<GISFeature | null>(null)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [reviewTargetRequest, setReviewTargetRequest] = useState<GISMappingRequest | null>(null)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [requestsRefreshTrigger, setRequestsRefreshTrigger] = useState(0)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

  // Current user role
  const [userRole] = useState(() => localStorage.getItem('accessor_role') || '')
  const isAdminOrSuper = ['admin', 'super_admin', 'assessor'].includes(userRole)
  const isStaff = userRole === 'staff'
  const canEditGis = isAdminOrSuper || isStaff

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
        has_gis: Boolean(l.is_mapped || (l.gis_id && l.coordinates && l.coordinates !== 'null' && l.coordinates !== '[]')),
      }))
      const bldgs = (data.buildings || []).map((b: any) => ({
        ...b,
        type: 'building',
        has_gis: Boolean(b.is_mapped || (b.gis_id && b.coordinates && b.coordinates !== 'null' && b.coordinates !== '[]')),
      }))

      const combined = [...lots, ...bldgs]
      setFeatures(combined)
      setPendingRequestsCount(combined.filter(f => f.latest_request_status === 'pending').length)

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

  const handleInitiateMapping = (feature: GISFeature) => {
    setSelectedFeature(feature)
    if (isAdminOrSuper) {
      setIsDrawModalOpen(true)
    } else if (isStaff) {
      if (feature.latest_request_status === 'approved') {
        setIsDrawModalOpen(true)
      } else {
        setRequestTargetFeature(feature)
        setIsRequestModalOpen(true)
      }
    }
  }

  const handleOpenRequest = (feature: GISFeature) => {
    setRequestTargetFeature(feature)
    setIsRequestModalOpen(true)
  }

  const handleOpenReview = (request: GISMappingRequest) => {
    setReviewTargetRequest(request)
    setIsReviewModalOpen(true)
  }

  const handleOpenDrawForRequest = (propertyId: number, propertyType: 'lot' | 'building') => {
    const target = features.find(f => f.property_id === propertyId && f.type === propertyType)
    if (target) {
      setSelectedFeature(target)
      setIsDrawModalOpen(true)
    }
  }

  const handleViewPropertyFromRequest = (propertyId: number, propertyType: 'lot' | 'building') => {
    const target = features.find(f => f.property_id === propertyId && f.type === propertyType)
    if (target) {
      setSelectedFeature(target)
      setIsFullDetailModalOpen(true)
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

  // Filter counts
  const filterCounts = useMemo(() => {
    const lots = features.filter(f => f.type === 'lot').length
    const buildings = features.filter(f => f.type === 'building').length
    const assessed = features.filter(f => Boolean(f.is_assessed || f.status === 'assessed' || f.property_status === 'approved')).length
    const unassessed = features.length - assessed
    const unmapped = features.filter(f => !f.has_gis).length
    const mapped = features.filter(f => f.has_gis).length

    return {
      all: features.length,
      lots,
      buildings,
      assessed,
      unassessed,
      unmapped,
      mapped
    }
  }, [features])

  // Filter features according to selected tab and search query
  const filteredFeatures = useMemo(() => {
    const q = query.trim().toLowerCase()
    return featuresWithGeometry.filter(f => {
      // Search matching
      if (q) {
        const matchTitle = (f.title || '').toLowerCase().includes(q)
        const matchOwner = (f.owner || '').toLowerCase().includes(q)
        const matchPropId = `property-${f.property_id}`.toLowerCase().includes(q) || String(f.property_id).includes(q)
        const matchEntityId = String(f.id).toLowerCase().includes(q)
        const matchBarangay = (f.barangay_name || '').toLowerCase().includes(q)
        const matchAddress = (f.full_address || '').toLowerCase().includes(q)
        if (!matchTitle && !matchOwner && !matchPropId && !matchEntityId && !matchBarangay && !matchAddress) {
          return false
        }
      }

      const isAssessed = Boolean(f.is_assessed || f.status === 'assessed' || f.property_status === 'approved')

      // Filter types
      if (filterType === 'Lots' && f.type !== 'lot') return false
      if (filterType === 'Buildings' && f.type !== 'building') return false
      if (filterType === 'Assessed' && !isAssessed) return false
      if (filterType === 'Unassessed' && isAssessed) return false
      if (filterType === 'Unmapped' && f.has_gis) return false

      return true
    }).sort((a, b) => {
      // Lots rendered first, buildings rendered second (on top of lots)
      if (a.type === 'lot' && b.type === 'building') return -1
      if (a.type === 'building' && b.type === 'lot') return 1
      return 0
    })
  }, [featuresWithGeometry, filterType, query])

  // List of unmapped properties specifically for the Needs Mapping Queue
  const unmappedPropertiesList = useMemo(() => {
    const q = query.trim().toLowerCase()
    return features.filter(f => !f.has_gis).filter(f => {
      if (unmappedBarangayFilter !== 'all') {
        const brgy = (f.barangay_name || '').toLowerCase().trim()
        if (brgy !== unmappedBarangayFilter.toLowerCase().trim()) return false
      }
      if (q) {
        const matchTitle = (f.title || '').toLowerCase().includes(q)
        const matchOwner = (f.owner || '').toLowerCase().includes(q)
        const matchPropId = `property-${f.property_id}`.toLowerCase().includes(q) || String(f.property_id).includes(q)
        const matchBarangay = (f.barangay_name || '').toLowerCase().includes(q)
        return matchTitle || matchOwner || matchPropId || matchBarangay
      }
      return true
    })
  }, [features, unmappedBarangayFilter, query])

  // Fit bounds to all mapped features
  const fitAllBounds = () => {
    const mapped = featuresWithGeometry.filter(f => f.has_gis && f.parsedPositions.length > 0)
    if (mapped.length === 0) {
      setFlyTargetCenter(LAGONGLONG_CENTER)
      setFlyTargetBounds(null)
      return
    }
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
    mapped.forEach(f => {
      f.parsedPositions.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
      })
    })
    if (minLat <= maxLat && minLng <= maxLng) {
      setFlyTargetBounds([[minLat, minLng], [maxLat, maxLng]])
      setFlyTargetCenter(null)
    }
  }

  // Auto-fit on initial load when mapped features exist
  useEffect(() => {
    if (!hasAutoFittedRef.current && featuresWithGeometry.some(f => f.has_gis && f.parsedPositions.length > 0)) {
      hasAutoFittedRef.current = true
      fitAllBounds()
    }
  }, [featuresWithGeometry])

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
  const handleSelectFeature = (feature: GISFeature | typeof featuresWithGeometry[0]) => {
    setSelectedFeature(feature)
    setIsSearchOpen(false)

    const withGeom = 'parsedPositions' in feature
      ? (feature as typeof featuresWithGeometry[0])
      : featuresWithGeometry.find(f => f.property_id === feature.property_id && f.type === feature.type)

    if (withGeom?.geomDetails?.bounds) {
      setFlyTargetBounds(withGeom.geomDetails.bounds)
      setFlyTargetCenter(null)
    } else if (withGeom?.markerPos) {
      setFlyTargetCenter(withGeom.markerPos)
      setFlyTargetBounds(null)
    }
  }

  // Street View Target Coordinates
  const streetViewCoords = useMemo<[number, number]>(() => {
    if (selectedFeature?.latitude != null && selectedFeature?.longitude != null) {
      return [selectedFeature.latitude, selectedFeature.longitude]
    }
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
            Property Cadastral GIS & Mapping
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            High-precision cadastral boundary mapping, property directory registry, and workflow approvals.
          </p>
        </div>

        {/* View Switcher Tabs: Map View | Property Directory (36) | Mapping Requests */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <div className="flex items-center bg-gray-200/90 dark:bg-gray-800 p-1 rounded-2xl border border-gray-300/70 dark:border-gray-700 shadow-sm text-xs font-semibold">
            <button
              type="button"
              id="btn-gis-tab-map"
              onClick={() => setGisViewTab('map')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition ${
                gisViewTab === 'map'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <MapPin size={15} />
              <span>Cadastral Map</span>
            </button>

            <button
              type="button"
              id="btn-gis-tab-directory"
              onClick={() => setGisViewTab('directory')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition ${
                gisViewTab === 'directory'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Table size={15} />
              <span>Property Directory</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                gisViewTab === 'directory' ? 'bg-emerald-800 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                {features.length}
              </span>
            </button>

            <button
              type="button"
              id="btn-gis-tab-requests"
              onClick={() => setGisViewTab('requests')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition ${
                gisViewTab === 'requests'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Clock size={15} />
              <span>Mapping Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500 text-white animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>{filterCounts.mapped} Mapped</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setGisViewTab('map');
                setFilterType('Unmapped');
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                filterType === 'Unmapped' && gisViewTab === 'map'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
              }`}
              title="View properties requiring cadastral boundary mapping"
            >
              <AlertCircle size={14} className={filterType === 'Unmapped' && gisViewTab === 'map' ? 'text-white' : 'text-amber-600'} />
              <span>{filterCounts.unmapped} Needs Mapping</span>
            </button>
          </div>
        </div>
      </div>

      {gisViewTab === 'directory' ? (
        <GISPropertyDirectoryTable
          features={features}
          userRole={userRole}
          onSelectFeature={handleSelectFeature}
          onOpenDrawModal={handleInitiateMapping}
          onOpenRequestModal={handleOpenRequest}
          onOpenDetailModal={(feat) => {
            setSelectedFeature(feat);
            setIsFullDetailModalOpen(true);
          }}
        />
      ) : gisViewTab === 'requests' ? (
        <GISMappingRequestsTable
          userRole={userRole}
          onOpenReviewModal={handleOpenReview}
          onOpenDrawModalForRequest={handleOpenDrawForRequest}
          onViewProperty={handleViewPropertyFromRequest}
          refreshTrigger={requestsRefreshTrigger}
        />
      ) : (
        /* Main Map Container & Panel Layout */
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
                  placeholder="Search by ID, Lot #, Building, Owner, Barangay..."
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

            {/* Filter Tabs (All, Lots, Buildings, Assessed, Unassessed, Needs Mapping) */}
            <div className="flex items-center bg-gray-200/80 dark:bg-gray-700/80 p-0.5 rounded-xl text-xs font-semibold overflow-x-auto max-w-full">
              {(
                [
                  { id: 'All', label: 'All', count: filterCounts.all },
                  { id: 'Lots', label: 'Lots', count: filterCounts.lots },
                  { id: 'Buildings', label: 'Buildings', count: filterCounts.buildings },
                  { id: 'Assessed', label: 'Assessed', count: filterCounts.assessed },
                  { id: 'Unassessed', label: 'Unassessed', count: filterCounts.unassessed },
                  { id: 'Unmapped', label: 'Needs Mapping', count: filterCounts.unmapped },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  id={`tab-filter-${tab.id.toLowerCase()}`}
                  type="button"
                  onClick={() => setFilterType(tab.id as FilterType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                    filterType === tab.id
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    filterType === tab.id
                      ? tab.id === 'Unmapped' ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200' : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                      : 'bg-gray-300/60 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* View Mode Selector: Street Map | Satellite / Bird's-Eye | Street View & Tools */}
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

              {/* Fit All Mapped Boundaries Button */}
              {mapMode !== 'streetview' && (
                <button
                  id="btn-gis-fit-bounds"
                  type="button"
                  onClick={fitAllBounds}
                  className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-1 text-xs font-medium"
                  title="Fit all mapped properties to view"
                >
                  <Maximize2 size={14} className="text-emerald-600" />
                  <span className="hidden xl:inline">Fit Bounds</span>
                </button>
              )}

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

          {/* Map Body Canvas / Needs Mapping Queue Display */}
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

            {filterType === 'Unmapped' ? (
              /* Dedicated Interactive "Needs Mapping Queue" View */
              <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 overflow-y-auto p-4 z-20 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                        <AlertCircle size={18} />
                      </span>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Cadastral Needs Mapping Queue
                      </h2>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {unmappedPropertiesList.length} properties in Lagonglong, Misamis Oriental require boundary drawing or cadastral survey placement.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Barangay Filter */}
                    <div className="flex items-center gap-1.5 text-xs bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700">
                      <ListFilter size={14} className="text-gray-400" />
                      <select
                        aria-label="Filter unmapped properties by barangay"
                        value={unmappedBarangayFilter}
                        onChange={e => setUnmappedBarangayFilter(e.target.value)}
                        className="bg-transparent text-xs text-gray-800 dark:text-gray-200 outline-none font-medium cursor-pointer"
                      >
                        <option value="all">All Barangays</option>
                        <option value="poblacion">Poblacion</option>
                        <option value="kauswagan">Kauswagan</option>
                        <option value="gaston">Gaston</option>
                        <option value="tabok">Tabok</option>
                        <option value="mabini">Mabini</option>
                        <option value="dampil">Dampil</option>
                        <option value="lumbo">Lumbo</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFilterType('All')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                    >
                      <MapIcon size={14} />
                      <span>Back to Map</span>
                    </button>
                  </div>
                </div>

                {/* Queue Cards Grid */}
                {unmappedPropertiesList.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                    <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      No unmapped properties match this filter!
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      All properties in this selection have cadastral boundary coordinates saved.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {unmappedPropertiesList.map(prop => {
                      const isBuilding = prop.type === 'building'
                      const isAssessed = Boolean(prop.is_assessed || prop.status === 'assessed' || prop.property_status === 'approved')

                      return (
                        <div
                          key={`unmapped-${prop.type}-${prop.id}`}
                          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3.5 hover:shadow-md transition flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                isBuilding
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              }`}>
                                {isBuilding ? <Building2 size={11} /> : <SquareDashed size={11} />}
                                {isBuilding ? 'Building' : 'Lot Parcel'}
                              </span>

                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isAssessed
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                              }`}>
                                {isAssessed ? 'Assessed' : 'Unassessed'}
                              </span>
                            </div>

                            <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                              {prop.title}
                            </h3>
                            <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                              ID: P-{prop.property_id} • {prop.type === 'building' ? `Bldg #${prop.id}` : `Lot #${prop.id}`}
                            </p>

                            <div className="mt-2.5 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-gray-400">Owner:</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{prop.owner}</span>
                              </div>
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-gray-400">Location:</span>
                                <span>{prop.barangay_name || 'Poblacion'}, Lagonglong</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-400">Declared Area:</span>
                                <span className="font-mono">{prop.area || '0'} m²</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                            {isAdminOrSuper ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFeature(prop)
                                  setIsDrawModalOpen(true)
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                              >
                                <PencilRuler size={13} />
                                <span>Locate & Draw</span>
                              </button>
                            ) : isStaff ? (
                              prop.latest_request_status === 'approved' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFeature(prop)
                                    setIsDrawModalOpen(true)
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition animate-pulse"
                                >
                                  <PencilRuler size={13} />
                                  <span>Locate & Draw (Approved)</span>
                                </button>
                              ) : prop.latest_request_status === 'pending' ? (
                                <span className="flex-1 text-center py-1.5 px-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-semibold">
                                  Pending Approval
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFeature(prop)
                                    setRequestTargetFeature(prop)
                                    setIsRequestModalOpen(true)
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                                >
                                  <Send size={13} />
                                  <span>Request to Map</span>
                                </button>
                              )
                            ) : null}

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFeature(prop)
                                setIsFullDetailModalOpen(true)
                              }}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : mapMode === 'streetview' ? (
              /* Street View Viewport Mode */
              <StreetViewViewer
                lat={streetViewCoords[0]}
                lng={streetViewCoords[1]}
                feature={selectedFeature}
                onClose={() => setMapMode('street')}
                onSwitchToSatellite={() => setMapMode('satellite')}
                onSwitchToStreetMap={() => setMapMode('street')}
                miniMapComponent={
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
                      const color = f.type === 'building' ? '#8b5cf6' : '#10b981'
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
                  const isAssessed = Boolean(f.is_assessed || f.status === 'assessed' || f.property_status === 'approved')
                  const isSelected = selectedFeature?.id === f.id && selectedFeature?.type === f.type
                  const isApproximate = f.mapping_status === 'approximate' || f.mapping_status === 'draft'

                  // Colors: Emerald for Lot, Purple for Building, Amber for Unassessed/Pending, Cyan for Selected
                  let strokeColor = isBuilding ? '#8b5cf6' : '#10b981'
                  if (!isAssessed) strokeColor = '#f59e0b'
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
                            fillOpacity: isSelected ? 0.6 : isAssessed ? 0.4 : 0.3,
                            weight: isSelected ? 4 : isBuilding ? 3 : 2,
                            dashArray: isApproximate ? '6, 6' : undefined,
                          }}
                          eventHandlers={{
                            click: (e) => {
                              e.originalEvent?.stopPropagation()
                              handleSelectFeature(f)
                            },
                          }}
                        >
                          <Popup>
                            <div className="p-1 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isBuilding ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isBuilding ? <Building2 size={11} /> : <SquareDashed size={11} />}
                                  {isBuilding ? 'Building Footprint' : 'Land Parcel'}
                                </span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  isAssessed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {isAssessed ? 'Assessed' : 'Unassessed'}
                                </span>
                              </div>

                              <div className="font-bold text-gray-900 flex items-center justify-between">
                                <span>{f.title}</span>
                                <span className="text-[10px] text-gray-400 font-mono">P-{f.property_id}</span>
                              </div>

                              <div className="text-gray-600">Owner: <strong>{f.owner}</strong></div>
                              <div className="text-gray-600">Area: <strong>{f.area_sqm || f.area} m²</strong></div>
                              <div className="text-gray-600">Barangay: <strong>{f.barangay_name || 'Lagonglong'}</strong></div>
                              <div className="text-[11px] text-gray-500">
                                Boundary: <strong>{isApproximate ? 'Manual / Approximate' : 'Cadastral Survey Boundary'}</strong>
                              </div>

                              <div className="pt-1 flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSelectFeature(f)}
                                  className="w-full py-1 px-2 bg-emerald-600 text-white rounded font-semibold text-[11px] hover:bg-emerald-700 transition"
                                >
                                  View Property Details
                                </button>
                                {isAdminOrSuper ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedFeature(f)
                                      setIsDrawModalOpen(true)
                                    }}
                                    className="w-full py-1 px-2 bg-amber-600 text-white rounded font-semibold text-[11px] hover:bg-amber-700 transition"
                                  >
                                    Edit Boundary
                                  </button>
                                ) : isStaff ? (
                                  f.latest_request_status === 'approved' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFeature(f)
                                        setIsDrawModalOpen(true)
                                      }}
                                      className="w-full py-1 px-2 bg-green-600 text-white rounded font-semibold text-[11px] hover:bg-green-700 transition animate-pulse"
                                    >
                                      Edit Boundary (Approved)
                                    </button>
                                  ) : f.latest_request_status === 'pending' ? (
                                    <span className="text-center py-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 rounded">
                                      Pending Update Approval
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFeature(f)
                                        setRequestTargetFeature(f)
                                        setIsRequestModalOpen(true)
                                      }}
                                      className="w-full py-1 px-2 bg-blue-600 text-white rounded font-semibold text-[11px] hover:bg-blue-700 transition"
                                    >
                                      Request Boundary Update
                                    </button>
                                  )
                                ) : null}
                              </div>
                            </div>
                          </Popup>
                        </Polygon>
                      )}

                      {/* Property Centroid Marker Pin */}
                      {f.markerPos && (
                        <Marker
                          position={f.markerPos}
                          icon={createCustomMarkerIcon(f.type, isSelected, !isAssessed)}
                          eventHandlers={{
                            click: (e) => {
                              e.originalEvent?.stopPropagation()
                              handleSelectFeature(f)
                            },
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

          {/* Map Footer & Comprehensive Legend */}
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
                <span className="w-3 h-3 rounded-full border-2 border-emerald-500 inline-block" />
                Verified Survey
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full border-2 border-dashed border-amber-500 inline-block" />
                Unassessed / Approx
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block shadow-sm ring-2 ring-cyan-200" />
                Active Selection
              </span>
            </div>

            <div className="text-gray-500 dark:text-gray-400 font-medium">
              Lagonglong, Misamis Oriental • {filterCounts.mapped} Mapped • {filterCounts.unmapped} Needs Mapping
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
            onStartMapping={() => handleInitiateMapping(selectedFeature)}
            onRequestMapping={() => handleOpenRequest(selectedFeature)}
            canEditGis={canEditGis}
            userRole={userRole}
          />
        )}
      </div>
      )}

      {/* Comprehensive Full Property Record Modal */}
      {isFullDetailModalOpen && selectedFeature && (
        <PropertyDetailModal
          feature={selectedFeature}
          onClose={() => setIsFullDetailModalOpen(false)}
          onStartMapping={() => handleInitiateMapping(selectedFeature)}
          onRequestMapping={() => handleOpenRequest(selectedFeature)}
          canEditGis={canEditGis}
          userRole={userRole}
        />
      )}

      {/* GIS Boundary Drawing Modal for Mapping Unmapped Properties */}
      {isDrawModalOpen && selectedFeature && (
        <GISDrawModal
          feature={selectedFeature}
          onClose={() => setIsDrawModalOpen(false)}
          onSaved={() => {
            loadGISData(true)
            setRequestsRefreshTrigger(t => t + 1)
          }}
        />
      )}

      {/* Staff GIS Mapping Request Modal */}
      {isRequestModalOpen && requestTargetFeature && (
        <GISMappingRequestModal
          feature={requestTargetFeature}
          onClose={() => {
            setIsRequestModalOpen(false)
            setRequestTargetFeature(null)
          }}
          onSubmitted={() => {
            loadGISData(true)
            setRequestsRefreshTrigger(t => t + 1)
            showSuccess('Mapping request submitted successfully and is pending review.')
          }}
        />
      )}

      {/* Admin Review Request Modal */}
      {isReviewModalOpen && reviewTargetRequest && (
        <GISReviewRequestModal
          request={reviewTargetRequest}
          onClose={() => {
            setIsReviewModalOpen(false)
            setReviewTargetRequest(null)
          }}
          onReviewed={() => {
            loadGISData(true)
            setRequestsRefreshTrigger(t => t + 1)
            showSuccess('Mapping request review completed.')
          }}
          onViewProperty={(propId, propType) => {
            const feat = features.find(f => f.property_id === propId && f.type === propType)
            if (feat) {
              setSelectedFeature(feat)
              setIsFullDetailModalOpen(true)
            }
          }}
        />
      )}
    </div>
  )
}
