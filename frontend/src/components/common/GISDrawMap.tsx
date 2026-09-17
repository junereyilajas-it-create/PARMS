import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import '@geoman-io/leaflet-geoman-free'
import L from 'leaflet'
import * as turf from '@turf/turf'
import { Layers } from 'lucide-react'

// Fix default leaflet marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface GISDrawMapProps {
  initialGeometry?: GeoJSON.Feature<GeoJSON.Polygon> | null
  onGeometryChange?: (geometry: GeoJSON.Feature<GeoJSON.Polygon> | null, area: number, perimeter: number) => void
  readOnly?: boolean
  entityType?: 'lot' | 'building'
}

function GeomanControls({
  initialGeometry,
  onGeometryChange,
  readOnly,
  entityType
}: GISDrawMapProps) {
  const map = useMap()
  const featureGroupRef = useRef<L.FeatureGroup>(new L.FeatureGroup())
  const labelsGroupRef = useRef<L.FeatureGroup>(new L.FeatureGroup())

  useEffect(() => {
    map.addLayer(featureGroupRef.current)
    map.addLayer(labelsGroupRef.current)
    
    if (!readOnly) {
      map.pm.addControls({
        position: 'topleft',
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: true,
        drawPolygon: true,
        drawCircle: false,
        drawText: false,
        editMode: true,
        dragMode: true,
        cutPolygon: false,
        removalMode: true,
      })

      map.pm.setGlobalOptions({
        pathOptions: {
          color: entityType === 'building' ? '#8b5cf6' : '#10b981',
          fillColor: entityType === 'building' ? '#8b5cf6' : '#10b981',
          fillOpacity: 0.4
        }
      })
    } else {
      map.pm.removeControls()
    }

    return () => {
      map.removeLayer(featureGroupRef.current)
      map.removeLayer(labelsGroupRef.current)
      map.pm.removeControls()
    }
  }, [map, readOnly, entityType])

  const calculateAndRenderMeasurements = (layer: L.Polygon) => {
    labelsGroupRef.current.clearLayers()
    const geojson = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>
    
    // Calculate Area and Perimeter
    const area = turf.area(geojson) // square meters
    // Fix: create a LineString from the polygon coordinates to calculate length
    const lineString = turf.lineString(geojson.geometry.coordinates[0])
    const perimeter = turf.length(lineString, { units: 'meters' }) 

    // Render Side Length Labels
    const coords = geojson.geometry.coordinates[0]
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i]
      const p2 = coords[i + 1]
      const sideLength = turf.distance(turf.point(p1), turf.point(p2), { units: 'meters' })
      
      const midPoint = [
        (p1[1] + p2[1]) / 2, // lat
        (p1[0] + p2[0]) / 2  // lng
      ]

      const label = L.divIcon({
        className: 'bg-white/90 text-xs font-bold text-gray-800 px-1 py-0.5 rounded shadow-sm border border-gray-300 pointer-events-none whitespace-nowrap',
        html: `${sideLength.toFixed(2)} m`,
        iconAnchor: [20, 10]
      })
      
      L.marker(midPoint as [number, number], { icon: label }).addTo(labelsGroupRef.current)
    }

    if (onGeometryChange) {
      onGeometryChange(geojson, Math.round(area * 100) / 100, Math.round(perimeter * 100) / 100)
    }
  }

  useEffect(() => {
    if (initialGeometry && featureGroupRef.current.getLayers().length === 0) {
      const layer = L.geoJSON(initialGeometry, {
        style: {
          color: entityType === 'building' ? '#8b5cf6' : '#10b981',
          fillColor: entityType === 'building' ? '#8b5cf6' : '#10b981',
          fillOpacity: 0.4
        }
      })
      layer.eachLayer((l: any) => {
        featureGroupRef.current.addLayer(l)
        calculateAndRenderMeasurements(l)
      })
      if (layer.getBounds().isValid()) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] })
      }
    }
  }, [initialGeometry, map, entityType])

  useEffect(() => {
    if (readOnly) return

    map.on('pm:create', (e: any) => {
      // Allow only one polygon per property/entity
      featureGroupRef.current.clearLayers()
      const layer = e.layer
      featureGroupRef.current.addLayer(layer)
      calculateAndRenderMeasurements(layer)
      
      layer.on('pm:edit', () => calculateAndRenderMeasurements(layer))
      layer.on('pm:drag', () => calculateAndRenderMeasurements(layer))
      layer.on('pm:update', () => calculateAndRenderMeasurements(layer))
    })

    map.on('pm:remove', () => {
      featureGroupRef.current.clearLayers()
      labelsGroupRef.current.clearLayers()
      if (onGeometryChange) onGeometryChange(null, 0, 0)
    })

  }, [map, readOnly, onGeometryChange])

  return null
}

export function GISDrawMap(props: GISDrawMapProps) {
  const [mapMode, setMapMode] = useState<'street' | 'satellite'>('satellite')
  const defaultCenter: [number, number] = [8.834, 124.786]

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 shadow-inner group">
      <button 
        type="button"
        className="absolute top-3 right-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-md transition-colors"
        onClick={(e) => {
          e.preventDefault()
          setMapMode(m => m === 'street' ? 'satellite' : 'street')
        }}
      >
        <Layers size={16}/> {mapMode === 'street' ? 'Satellite' : 'Street'}
      </button>

      <MapContainer center={defaultCenter} zoom={15} style={{ height: '100%', width: '100%', zIndex: 0 }}>
        {mapMode === 'street' ? (
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        <GeomanControls {...props} />
      </MapContainer>
    </div>
  )
}
