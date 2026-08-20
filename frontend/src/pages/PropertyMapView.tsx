import { useState } from 'react'
import { MapPin, Plus, Layers } from 'lucide-react'
import type { Property } from '../types/property'
import { SearchBox } from '../components/common/SearchBox'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default leaflet marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export function PropertyMapView({ query, onQueryChange, rows, selected, onSelect }: { query: string; onQueryChange: (value: string) => void; rows: Property[]; selected: Property; onSelect: (property: Property) => void }) {
  const [mapMode, setMapMode] = useState<'street' | 'satellite'>('satellite')

  // Center around Lagonglong, Misamis Oriental
  const defaultCenter: [number, number] = [8.834, 124.786]

  return (
    <>
      <div className="title-row">
        <div>
          <p className="eyebrow">LAGONGLONG GIS PROPERTY DIRECTORY</p>
          <h1>Property Map</h1>
          <p className="subhead">Locate, filter, and review registered properties across Lagonglong, Misamis Oriental.</p>
        </div>
        <button type="button" onClick={() => window.alert('Location update is in development.')} className="primary"><Plus size={18}/> Update location</button>
      </div>

      <div className="map-layout">
        <section className="card map-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="map-tools" style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
            <SearchBox value={query} onChange={onQueryChange}/>
            <select>
              <option>All barangays</option>
              <option>Banglay</option>
              <option>Dampil</option>
              <option>Gaston</option>
              <option>Kabulawan</option>
              <option>Kauswagan</option>
              <option>Lumbo</option>
              <option>Manaol</option>
              <option>Poblacion</option>
              <option>Tabok</option>
              <option>Umagos</option>
            </select>
            <select>
              <option>All classifications</option>
              <option>Residential</option>
            </select>
            <button 
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
              onClick={() => setMapMode(m => m === 'street' ? 'satellite' : 'street')}
            >
              <Layers size={16}/> {mapMode === 'street' ? 'Satellite View' : 'Street View'}
            </button>
          </div>

          <div className="map-canvas" style={{ flex: 1, minHeight: '520px', borderRadius: '8px', overflow: 'hidden' }}>
            <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
              {mapMode === 'street' ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}
              
              {rows.map(p => {
                if (p.latitude != null && p.longitude != null) {
                  return (
                    <Marker 
                      key={p.id} 
                      position={[p.latitude, p.longitude]}
                      eventHandlers={{
                        click: () => onSelect(p)
                      }}
                    >
                      <Popup>
                        <strong>{p.id}</strong><br/>
                        {p.owner}<br/>
                        {p.type} - {p.status}
                      </Popup>
                    </Marker>
                  )
                }
                return null
              })}
            </MapContainer>
          </div>

          <div className="map-legend">
            <span><i className="res" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6', marginRight: '6px' }}/>Residential</span>
            <span><i className="com" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#8b5cf6', marginRight: '6px' }}/>Commercial</span>
            <span><i className="agri" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}/>Agricultural</span>
            <span>{rows.filter(r => r.latitude && r.longitude).length} mapped locations shown</span>
          </div>
        </section>

        <PropertyDetails property={selected}/>
      </div>
    </>
  )
}

function PropertyDetails({ property }: { property: Property }) { 
  if (!property) return null;
  return (
    <aside className="card map-detail">
      <p className="eyebrow">SELECTED PROPERTY</p>
      <h2>{property.id}</h2>
      <p className="owner">{property.owner}</p>
      <div className="detail-row">
        <MapPin/>
        <span>{property.location}</span>
      </div>
      <div className="detail-grid">
        <div><span>Property type</span><strong>{property.type}</strong></div>
        <div><span>GPS coordinates</span><strong>{property.latitude ? `${property.latitude.toFixed(4)}, ${property.longitude?.toFixed(4)}` : 'Unmapped'}</strong></div>
        <div><span>Market value</span><strong>{property.market}</strong></div>
        <div><span>Assessed value</span><strong>{property.assessed}</strong></div>
      </div>
      <button type="button" onClick={() => window.alert('Complete record view is in development.')} className="primary full">View complete record</button>
      <button type="button" onClick={() => window.alert('Routing is in development.')} className="outline">Get directions</button>
    </aside>
  )
}
