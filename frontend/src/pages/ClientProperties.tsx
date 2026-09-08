import { useEffect, useState } from 'react'
import { Building2, ChevronLeft, MapPin } from 'lucide-react'
import api from '../lib/api'

export function ClientProperties() {
  const [properties, setProperties] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [details, setDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/client/my-properties')
        setProperties(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (selectedId) {
      async function loadDetails() {
        try {
          const { data } = await api.get(`/client/my-properties/${selectedId}`)
          setDetails(data)
        } catch (e) {
          console.error(e)
        }
      }
      loadDetails()
    } else {
      setDetails(null)
    }
  }, [selectedId])

  if (loading) return <div className="p-8 text-center text-gray-500">Loading properties...</div>

  if (selectedId && details) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ChevronLeft size={16} /> Back to My Properties
        </button>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="text-green-600 dark:text-green-500" />
              Property {details.property_id}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <MapPin size={14} /> {details.location}
            </p>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-4">General Information</h3>
              <dl className="space-y-3">
                <div className="grid grid-cols-3 gap-2"><dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt><dd className="text-sm text-gray-900 dark:text-white col-span-2">{details.property_type}</dd></div>
                <div className="grid grid-cols-3 gap-2"><dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Classification</dt><dd className="text-sm text-gray-900 dark:text-white col-span-2">{details.classification_name}</dd></div>
                <div className="grid grid-cols-3 gap-2"><dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt><dd className="text-sm text-gray-900 dark:text-white col-span-2"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">{details.property_status}</span></dd></div>
              </dl>
            </div>
            
            {details.lot_id && (
              <div>
                <h3 className="text-sm font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-4">Lot Information</h3>
                <dl className="space-y-3">
                  <div className="grid grid-cols-3 gap-2"><dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Lot Number</dt><dd className="text-sm text-gray-900 dark:text-white col-span-2">{details.lot_number}</dd></div>
                  <div className="grid grid-cols-3 gap-2"><dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Title Number</dt><dd className="text-sm text-gray-900 dark:text-white col-span-2">{details.title_number || 'N/A'}</dd></div>
                  <div className="grid grid-cols-3 gap-2"><dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Area</dt><dd className="text-sm text-gray-900 dark:text-white col-span-2">{details.lot_area} sq.m.</dd></div>
                </dl>
              </div>
            )}
            
            <div className="md:col-span-2">
              <h3 className="text-sm font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-4 border-t border-gray-200 dark:border-gray-700 pt-6">Assessment Information</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Market Value</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">₱{Number(details.market_value).toLocaleString()}</dd>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-900/30">
                  <dt className="text-sm font-medium text-green-700 dark:text-green-500 mb-1">Assessed Value</dt>
                  <dd className="text-xl font-bold text-green-800 dark:text-green-400">₱{Number(details.assessed_value).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">My Properties</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {properties.map(p => (
          <div key={p.property_id} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedId(p.property_id)}>
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center"><Building2 size={20}/></div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.property_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{p.property_status}</span>
            </div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">{p.property_type}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-3 line-clamp-1"><MapPin size={14}/> {p.location}</p>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">Assessed Value</span>
              <strong className="text-sm text-gray-900 dark:text-white">₱{Number(p.assessed_value).toLocaleString()}</strong>
            </div>
          </div>
        ))}
        {properties.length === 0 && (
          <div className="col-span-full p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Properties Found</h3>
            <p className="text-sm text-gray-500 mt-1">You do not have any registered properties linked to your account.</p>
          </div>
        )}
      </div>
    </div>
  )
}
