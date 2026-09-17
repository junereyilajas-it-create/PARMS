import { useState, useEffect } from 'react'
import { MapPin, Layers, Building2, SquareDashed, Check } from 'lucide-react'
import api from '../lib/api'
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default leaflet marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

type GISFeature = {
  id: string; // lot_id or building_id
  property_id: string;
  title: string;
  area: string; // from lot_area or floor_area
  status: string;
  gis_id: number;
  geometry_type: string;
  coordinates: any; // GeoJSON Polygon
  area_sqm: number;
  perimeter_m: number;
  owner: string;
  property_status: string;
  type: 'lot' | 'building';
}

export function ClientGISMap() {
  const [mapMode, setMapMode] = useState<'street' | 'satellite'>('satellite')
  const [features, setFeatures] = useState<GISFeature[]>([])
  const [selectedFeature, setSelectedFeature] = useState<GISFeature | null>(null)
  
  // Center around Lagonglong, Misamis Oriental
  const defaultCenter: [number, number] = [8.834, 124.786]

  useEffect(() => {
    const loadGISData = async () => {
      try {
        const { data } = await api.get('/gis/client-properties')
        const allLots = (data.lots || []).map((l: any) => ({ ...l, type: 'lot' }))
        const allBldgs = (data.buildings || []).map((b: any) => ({ ...b, type: 'building' }))
        const allFeatures = [...allLots, ...allBldgs]
        setFeatures(allFeatures)
        if (allFeatures.length > 0) setSelectedFeature(allFeatures[0])
      } catch (e) {
        console.error(e)
      }
    }
    loadGISData()
  }, [])

  // Convert GeoJSON coords (lng, lat) to Leaflet coords (lat, lng)
  const getLeafletCoords = (coords: any) => {
    if (!coords || !coords.geometry || !coords.geometry.coordinates || !coords.geometry.coordinates[0]) return []
    return coords.geometry.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number])
  }

  return (
    <>
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-xs font-bold tracking-wider text-green-600 dark:text-green-500 uppercase mb-1">My Property Locations</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GIS Map</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View the geographical boundaries of your registered properties.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
        <section className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{features.filter(f => f.coordinates).length} mapped features shown</span>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              onClick={() => setMapMode(m => m === 'street' ? 'satellite' : 'street')}
            >
              <Layers size={16}/> {mapMode === 'street' ? 'Satellite View' : 'Street View'}
            </button>
          </div>

          <div className="flex-1 w-full h-full relative z-0">
            <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
              {mapMode === 'street' ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='Tiles &copy; Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}
              
              {features.map(f => {
                if (!f.coordinates) return null
                const positions = getLeafletCoords(f.coordinates)
                if (positions.length === 0) return null
                
                const isBuilding = f.type === 'building'
                const color = isBuilding ? '#8b5cf6' : '#10b981'

                return (
                  <Polygon 
                    key={`${f.type}-${f.id}`} 
                    positions={positions}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.4 }}
                    eventHandlers={{
                      click: () => setSelectedFeature(f)
                    }}
                  >
                    <Popup>
                      <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                        <strong>{f.title}</strong><br/>
                        Owner: {f.owner}<br/>
                        Type: {f.type === 'lot' ? 'Land/Lot' : 'Building'}<br/>
                        GIS Area: {f.area_sqm} sqm<br/>
                      </div>
                    </Popup>
                  </Polygon>
                )
              })}
            </MapContainer>
          </div>
          
          <div className="flex gap-4 p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm">
            <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-full bg-green-500 inline-block"/>Lots</span>
            <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-full bg-purple-500 inline-block"/>Buildings</span>
          </div>
        </section>

        {selectedFeature && (
          <aside className="w-full lg:w-80 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 h-fit">
            <p className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-2">GIS {selectedFeature.type.toUpperCase()} DETAILS</p>
            
            <div className="flex items-center gap-2 mb-4">
              {selectedFeature.type === 'building' ? <Building2 size={24} className="text-purple-600" /> : <SquareDashed size={24} className="text-green-600" />}
              <h2 className="text-lg font-bold text-gray-900 dark:text-white m-0">{selectedFeature.title}</h2>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Owner:</p>
            <strong className="text-sm text-gray-900 dark:text-white block mb-4">{selectedFeature.owner}</strong>
            
            <div className="flex items-start gap-2 mb-6 text-sm text-gray-600 dark:text-gray-300">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              <span>Property: {selectedFeature.property_id}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm border-t border-gray-100 dark:border-gray-700 pt-4">
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Entity ID</span><strong className="text-gray-900 dark:text-white">{selectedFeature.id}</strong></div>
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Status</span><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase ${selectedFeature.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{selectedFeature.status}</span></div>
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Registered Area</span><strong className="text-gray-900 dark:text-white">{selectedFeature.area} sqm</strong></div>
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">GIS Area</span><strong className="text-green-600 dark:text-green-400">{selectedFeature.area_sqm} m²</strong></div>
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">GIS Perimeter</span><strong className="text-green-600 dark:text-green-400">{selectedFeature.perimeter_m} m</strong></div>
            </div>
            
            <div className="mt-6 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm border border-green-100 dark:border-green-800/30">
              <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-semibold mb-1">
                <Check size={14} /> GIS Boundary Mapped
              </div>
              <p className="text-gray-600 dark:text-gray-400 m-0">
                Geometry Type: {selectedFeature.geometry_type}<br/>
                Vertices: {selectedFeature.coordinates?.geometry?.coordinates?.[0]?.length - 1 || 0}
              </p>
            </div>
          </aside>
        )}
      </div>
    </>
  )
}
