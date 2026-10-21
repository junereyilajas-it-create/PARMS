import { useState, useEffect, useMemo } from 'react'
import {
  MapPin,
  Layers,
  Eye,
  Ruler
} from 'lucide-react'
import api from '../lib/api'
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { GISFeature, MapMode } from '../types/gis'
import {
  parseLeafletPositions,
  getGeometryDetails,
  createCustomMarkerIcon,
  createSideLengthIcon,
  createCornerPointIcon,
} from '../lib/gisUtils'
import { StreetViewViewer } from '../components/gis/StreetViewViewer'
import { PropertyDetailPanel } from '../components/gis/PropertyDetailPanel'
import { PropertyDetailModal } from '../components/gis/PropertyDetailModal'

const LAGONGLONG_CENTER: [number, number] = [8.8062, 124.7900]

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

export function ClientGISMap() {
  const [mapMode, setMapMode] = useState<MapMode>('street')
  const [features, setFeatures] = useState<GISFeature[]>([])
  const [selectedFeature, setSelectedFeature] = useState<GISFeature | null>(null)
  const [showMeasurements, setShowMeasurements] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isFullDetailModalOpen, setIsFullDetailModalOpen] = useState(false)

  const [flyTargetCenter, setFlyTargetCenter] = useState<[number, number] | null>(null)
  const [flyTargetBounds, setFlyTargetBounds] = useState<[[number, number], [number, number]] | null>(null)

  useEffect(() => {
    const loadGISData = async () => {
      setIsLoading(true)
      try {
        const { data } = await api.get('/gis/client-properties')
        const allLots = (data.lots || []).map((l: any) => ({
          ...l,
          type: 'lot',
          has_gis: Boolean(l.gis_id && l.coordinates),
        }))
        const allBldgs = (data.buildings || []).map((b: any) => ({
          ...b,
          type: 'building',
          has_gis: Boolean(b.gis_id && b.coordinates),
        }))
        const allFeatures = [...allLots, ...allBldgs]
        setFeatures(allFeatures)
        if (allFeatures.length > 0) setSelectedFeature(allFeatures[0])
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    loadGISData()
  }, [])

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

  const handleSelectFeature = (f: typeof featuresWithGeometry[0]) => {
    setSelectedFeature(f)
    if (f.geomDetails?.bounds) {
      setFlyTargetBounds(f.geomDetails.bounds)
      setFlyTargetCenter(null)
    } else if (f.markerPos) {
      setFlyTargetCenter(f.markerPos)
      setFlyTargetBounds(null)
    }
  }

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
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase mb-1">
            My Registered Locations
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GIS Property Map</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Explore the cadastral boundaries, satellite view, and street imagery of your registered properties.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 min-h-[600px]">
        <section className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="relative z-30 flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {features.filter(f => f.has_gis).length} of {features.length} properties mapped
            </span>

            <div className="flex items-center gap-2">
              {/* View Mode Selector */}
              <div className="flex items-center bg-emerald-50 dark:bg-emerald-950/40 p-0.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-xs font-semibold">
                <button
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

              {mapMode !== 'streetview' && (
                <button
                  type="button"
                  onClick={() => setShowMeasurements(m => !m)}
                  className={`p-2 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                    showMeasurements
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                  title={showMeasurements ? 'Hide Side Measurements' : 'Show Side Measurements'}
                >
                  <Ruler size={14} />
                  <span className="hidden sm:inline">Measurements</span>
                </button>
              )}
            </div>
          </div>

          {/* Map Body */}
          <div className="relative flex-1 w-full h-[540px] bg-gray-100 dark:bg-gray-950 overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 backdrop-blur z-30">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {mapMode === 'streetview' ? (
              <StreetViewViewer
                lat={streetViewCoords[0]}
                lng={streetViewCoords[1]}
                feature={selectedFeature}
                onClose={() => setMapMode('street')}
                onSwitchToSatellite={() => setMapMode('satellite')}
                onSwitchToStreetMap={() => setMapMode('street')}
              />
            ) : (
              <MapContainer
                center={LAGONGLONG_CENTER}
                zoom={15}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <MapFlyController
                  targetCenter={flyTargetCenter}
                  targetBounds={flyTargetBounds}
                />

                {mapMode === 'street' ? (
                  <TileLayer
                    key="client-tile-street"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />
                ) : (
                  <>
                    <TileLayer
                      key="client-tile-satellite"
                      attribution='Tiles &copy; Esri'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      maxZoom={19}
                    />
                    <TileLayer
                      key="client-tile-labels"
                      attribution='Labels &copy; Esri'
                      url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                      maxZoom={19}
                      opacity={0.85}
                    />
                  </>
                )}

                {featuresWithGeometry.map(f => {
                  const hasPolygon = f.parsedPositions.length >= 3
                  if (!hasPolygon && !f.markerPos) return null

                  const isBuilding = f.type === 'building'
                  const isSelected = selectedFeature?.id === f.id && selectedFeature?.type === f.type
                  const strokeColor = isSelected ? '#06b6d4' : isBuilding ? '#8b5cf6' : '#10b981'
                  const fillColor = isBuilding ? '#8b5cf6' : '#10b981'

                  return (
                    <div key={`${f.type}-${f.id}`}>
                      {hasPolygon && (
                        <Polygon
                          positions={f.parsedPositions}
                          pathOptions={{
                            color: strokeColor,
                            fillColor,
                            fillOpacity: isSelected ? 0.6 : 0.4,
                            weight: isSelected ? 4 : 2,
                          }}
                          eventHandlers={{
                            click: () => handleSelectFeature(f),
                          }}
                        >
                          <Popup>
                            <div className="p-1 space-y-1 text-xs">
                              <div className="font-bold text-gray-900">{f.title}</div>
                              <div>Area: {f.area_sqm || f.area} m²</div>
                              <button
                                type="button"
                                onClick={() => handleSelectFeature(f)}
                                className="w-full mt-2 py-1 px-2 bg-emerald-600 text-white rounded font-medium text-[11px]"
                              >
                                View Details
                              </button>
                            </div>
                          </Popup>
                        </Polygon>
                      )}

                      {f.markerPos && (
                        <Marker
                          position={f.markerPos}
                          icon={createCustomMarkerIcon(f.type, isSelected, false)}
                          eventHandlers={{
                            click: () => handleSelectFeature(f),
                          }}
                        />
                      )}

                      {showMeasurements && f.geomDetails?.sideLengths && (
                        <>
                          {f.geomDetails.sideLengths.map((side, idx) => (
                            <Marker
                              key={`client-edge-${f.type}-${f.id}-${idx}`}
                              position={side.midPoint}
                              icon={createSideLengthIcon(side.lengthMeters, side.label)}
                              interactive={false}
                            />
                          ))}
                          {f.parsedPositions.map((pos, idx) => (
                            <Marker
                              key={`client-corner-${f.type}-${f.id}-${idx}`}
                              position={pos}
                              icon={createCornerPointIcon(idx + 1, true)}
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

          {/* Footer Legend */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"/>Land Lots</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block"/>Buildings</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cyan-400 inline-block ring-2 ring-cyan-200"/>Selected</span>
          </div>
        </section>

        {/* Property Detail Panel */}
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
            onOpenStreetView={() => setMapMode('streetview')}
            onOpenFullDetails={() => setIsFullDetailModalOpen(true)}
            canEditGis={false}
          />
        )}
      </div>

      {isFullDetailModalOpen && selectedFeature && (
        <PropertyDetailModal
          feature={selectedFeature}
          onClose={() => setIsFullDetailModalOpen(false)}
          canEditGis={false}
        />
      )}
    </div>
  )
}
