import { useState, useEffect } from 'react'
import { MapPin, Layers, Building2, SquareDashed, Check } from 'lucide-react'
import { SearchBox } from '../components/common/SearchBox'
import { useModal } from '../contexts/ModalContext'
import api, { ensureSession } from '../lib/api'
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

export function PropertyMapView() {
  const { showError, showInfo } = useModal()
  const [mapMode, setMapMode] = useState<'street' | 'satellite'>('satellite')
  const [query, setQuery] = useState('')
  const [features, setFeatures] = useState<GISFeature[]>([])
  const [selectedFeature, setSelectedFeature] = useState<GISFeature | null>(null)
  const [filterType, setFilterType] = useState('All')
  
  // Center around Lagonglong, Misamis Oriental
  const defaultCenter: [number, number] = [8.834, 124.786]

  useEffect(() => {
    const loadGISData = async () => {
      try {
        await ensureSession()
        const { data } = await api.get('/gis/properties')
        const allLots = (data.lots || []).map((l: any) => ({ ...l, type: 'lot' }))
        const allBldgs = (data.buildings || []).map((b: any) => ({ ...b, type: 'building' }))
        setFeatures([...allLots, ...allBldgs])
      } catch {
        showError('Failed to load GIS data from the server.')
      }
    }
    loadGISData()
  }, [])

  const filteredFeatures = features.filter(f => {
    const searchMatch = !query || `${f.title} ${f.owner} ${f.id} ${f.property_id}`.toLowerCase().includes(query.toLowerCase());
    const typeMatch = filterType === 'All' || 
                      (filterType === 'Lots' && f.type === 'lot') ||
                      (filterType === 'Buildings' && f.type === 'building');
    return searchMatch && typeMatch;
  })

  // Convert GeoJSON coords (lng, lat) to Leaflet coords (lat, lng)
  const getLeafletCoords = (coords: any) => {
    if (!coords || !coords.geometry || !coords.geometry.coordinates || !coords.geometry.coordinates[0]) return []
    return coords.geometry.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number])
  }

  return (
    <>
      <div className="title-row">
        <div>
          <p className="eyebrow">LAGONGLONG GIS PROPERTY DIRECTORY</p>
          <h1>Property Map</h1>
          <p className="subhead">Locate, filter, and review registered properties across Lagonglong, Misamis Oriental.</p>
        </div>
      </div>

      <div className="map-layout">
        <section className="card map-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="map-tools" style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
            <SearchBox value={query} onChange={setQuery}/>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option>All</option>
              <option>Lots</option>
              <option>Buildings</option>
            </select>
            <button 
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
              onClick={() => setMapMode(m => m === 'street' ? 'satellite' : 'street')}
            >
              <Layers size={16}/> {mapMode === 'street' ? 'Satellite View' : 'Street View'}
            </button>
          </div>

          <div className="map-canvas" style={{ flex: 1, minHeight: '520px', borderRadius: '8px', overflow: 'hidden' }}>
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
              
              {filteredFeatures.map(f => {
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
                        <button style={{marginTop: '8px', width: '100%'}} className="btn-edit" onClick={() => setSelectedFeature(f)}>View Details</button>
                      </div>
                    </Popup>
                  </Polygon>
                )
              })}
            </MapContainer>
          </div>

          <div className="map-legend" style={{ display: 'flex', gap: '16px', padding: '12px', background: 'var(--card-bg)', borderTop: '1px solid var(--border)' }}>
            <span><i className="res" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}/>Lots</span>
            <span><i className="com" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#8b5cf6', marginRight: '6px' }}/>Buildings</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{filteredFeatures.filter(r => r.coordinates).length} mapped features shown</span>
          </div>
        </section>

        {selectedFeature && (
          <aside className="card map-detail">
            <p className="eyebrow">GIS {selectedFeature.type.toUpperCase()} DETAILS</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {selectedFeature.type === 'building' ? <Building2 size={24} className="text-purple-600" /> : <SquareDashed size={24} className="text-green-600" />}
              <h2 style={{ margin: 0 }}>{selectedFeature.title}</h2>
            </div>
            
            <p className="owner">Owner:<br/><strong>{selectedFeature.owner}</strong></p>
            
            <div className="detail-row">
              <MapPin/>
              <span>Property: {selectedFeature.property_id}</span>
            </div>
            
            <div className="detail-grid" style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={{ fontSize: '11px', color: 'gray', display: 'block' }}>Entity ID</span><strong>{selectedFeature.id}</strong></div>
              <div><span style={{ fontSize: '11px', color: 'gray', display: 'block' }}>Status</span><strong className={`badge-${selectedFeature.status.toLowerCase()}`}>{selectedFeature.status}</strong></div>
              <div><span style={{ fontSize: '11px', color: 'gray', display: 'block' }}>Registered Area</span><strong>{selectedFeature.area} sqm</strong></div>
              <div><span style={{ fontSize: '11px', color: 'gray', display: 'block' }}>GIS Area</span><strong className="text-green-600">{selectedFeature.area_sqm} sqm</strong></div>
              <div><span style={{ fontSize: '11px', color: 'gray', display: 'block' }}>GIS Perimeter</span><strong className="text-green-600">{selectedFeature.perimeter_m} m</strong></div>
            </div>
            
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: 600, marginBottom: '4px' }}>
                <Check size={14} /> GIS Boundary Mapped
              </div>
              <p style={{ margin: 0, color: 'var(--text)' }}>
                Geometry Type: {selectedFeature.geometry_type}<br/>
                Vertices: {selectedFeature.coordinates?.geometry?.coordinates?.[0]?.length - 1 || 0}
              </p>
            </div>
            
            <button type="button" onClick={() => showInfo('Complete record view is in development.')} className="btn-edit full" style={{marginTop: '16px'}}>Open Full Record</button>
          </aside>
        )}
      </div>
    </>
  )
}
