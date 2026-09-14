import { useEffect, useState } from 'react'
import { MapPin, Layers } from 'lucide-react'
import api from '../lib/api'
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

export function ClientGISMap() {
  const [mapMode, setMapMode] = useState<'street' | 'satellite'>('satellite')
  const [properties, setProperties] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  
  // Center around Lagonglong, Misamis Oriental
  const defaultCenter: [number, number] = [8.834, 124.786]

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/client/my-gis')
        setProperties(data)
        if (data.length > 0) setSelected(data[0])
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  return (
    <>
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-xs font-bold tracking-wider text-green-600 dark:text-green-500 uppercase mb-1">My Property Locations</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GIS Map</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View the geographical locations of your registered properties.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
        <section className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{properties.length} mapped locations shown</span>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              onClick={() => setMapMode(m => m === 'street' ? 'satellite' : 'street')}
            >
              <Layers size={16}/> {mapMode === 'street' ? 'Satellite View' : 'Street View'}
            </button>
          </div>

          <div className="flex-1 w-full h-full relative z-0">
            <MapContainer center={properties[0] && properties[0].latitude ? [properties[0].latitude, properties[0].longitude] as [number, number] : defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
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
              
              {properties.map(p => {
                if (p.latitude != null && p.longitude != null) {
                  return (
                    <Marker 
                      key={p.property_id} 
                      position={[p.latitude, p.longitude]}
                      eventHandlers={{
                        click: () => setSelected(p)
                      }}
                    >
                      <Popup>
                        <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                          <strong>{p.property_type}</strong><br/>
                          Owner: {p.owner}<br/>
                          Area: {p.lot_area || 0} sqm<br/>
                          Assessment: {Number(p.assessed_value) > 0 ? `₱${Number(p.assessed_value).toLocaleString()}` : 'UNASSESSED'}<br/>
                        </div>
                      </Popup>
                    </Marker>
                  )
                }
                return null
              })}
            </MapContainer>
          </div>
        </section>

        {selected && (
          <aside className="w-full lg:w-80 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 h-fit">
            <p className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-2">PROPERTY DETAILS</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Lot No. {selected.lot_number || `PROPERTY-${selected.property_id}`}</h2>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Owner:</p>
            <strong className="text-sm text-gray-900 dark:text-white block mb-4">{selected.owner}</strong>
            
            <div className="flex items-start gap-2 mb-6 text-sm text-gray-600 dark:text-gray-300">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              <span>{selected.location}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm border-t border-gray-100 dark:border-gray-700 pt-4">
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Property Type</span><strong className="text-gray-900 dark:text-white">{selected.property_type}</strong></div>
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Area</span><strong className="text-gray-900 dark:text-white">{selected.lot_area || 0} sqm</strong></div>
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Assessment</span><strong className="text-gray-900 dark:text-white">{Number(selected.assessed_value) > 0 ? `₱${Number(selected.assessed_value).toLocaleString()}` : 'UNASSESSED'}</strong></div>
              <div><span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Status</span><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase ${selected.property_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{selected.property_status}</span></div>
            </div>
          </aside>
        )}
      </div>
    </>
  )
}
