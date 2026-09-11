import { useState } from 'react'
import { MapPin, Plus, Layers } from 'lucide-react'
import type { Property } from '../types/property'
import { SearchBox } from '../components/common/SearchBox'
import { CrudModal } from '../components/common/CrudModal'
import { useModal } from '../contexts/ModalContext'
import api, { ensureSession } from '../lib/api'
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
  const { showSuccess, showError } = useModal()
  const [mapMode, setMapMode] = useState<'street' | 'satellite'>('satellite')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; record?: any } | null>(null)
  
  // Center around Lagonglong, Misamis Oriental
  const defaultCenter: [number, number] = [8.834, 124.786]

  const saveLocation = async (values: Record<string, string>) => {
    try {
      await ensureSession()
      if (modal?.mode === 'create') {
        await api.post('/locations', values)
      } else if (modal?.record) {
        await api.put(`/locations/${modal.record.location_id}`, values)
      }
      setModal(null)
      showSuccess('Location updated! Please reload properties to see changes on map.')
    } catch {
      showError('Failed to update location. Please ensure property_id is correct.')
    }
  }

  return (
    <>
      <div className="title-row">
        <div>
          <p className="eyebrow">LAGONGLONG GIS PROPERTY DIRECTORY</p>
          <h1>Property Map</h1>
          <p className="subhead">Locate, filter, and review registered properties across Lagonglong, Misamis Oriental.</p>
        </div>
        <button type="button" onClick={() => setModal({ mode: 'create' })} className="primary"><Plus size={18}/> Update location</button>
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
                        <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                          <strong>Lot No. {p.id.replace('PROPERTY-', '')}</strong><br/>
                          Owner: {p.owner}<br/>
                          Property Type: {p.type}<br/>
                          Area: 500 sqm<br/>
                          Assessment: {p.assessed}<br/>
                          <button style={{marginTop: '8px', width: '100%'}} className="btn-edit" onClick={() => onSelect(p)}>View Details</button>
                        </div>
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
      {modal && <CrudModal title="Update Location" fields={[{ key: 'property_id', label: 'Property ID', type: 'number' }, { key: 'latitude', label: 'Latitude', type: 'number' }, { key: 'longitude', label: 'Longitude', type: 'number' }, { key: 'gps_accuracy', label: 'GPS Accuracy (m)', type: 'number' }]} record={modal.record} onClose={() => setModal(null)} onSave={saveLocation} />}
    </>
  )
}

function PropertyDetails({ property }: { property: Property }) { 
  const { showInfo } = useModal();
  if (!property) return null;
  return (
    <aside className="card map-detail">
      <p className="eyebrow">PROPERTY DETAILS</p>
      <h2>Lot No. {property.id.replace('PROPERTY-', '')}</h2>
      <p className="owner">Owner:<br/><strong>{property.owner}</strong></p>
      <div className="detail-row">
        <MapPin/>
        <span>{property.location}</span>
      </div>
      <div className="detail-grid">
        <div><span>Property Type</span><strong>{property.type}</strong></div>
        <div><span>Area</span><strong>500 sqm</strong></div>
        <div><span>Assessment</span><strong>{property.assessed}</strong></div>
        <div><span>Status</span><strong className={`badge-${property.status.toLowerCase()}`}>{property.status}</strong></div>
      </div>
      <button type="button" onClick={() => showInfo('Complete record view is in development.')} className="btn-edit full" style={{marginTop: '16px'}}>View Details</button>
    </aside>
  )
}
