import { useState, useEffect } from 'react'
import api from '../lib/api'
import { Search, MapPin } from 'lucide-react'

export function StaffPropertySearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length > 2) {
      setLoading(true)
      api.get(`/property-records?q=${query}`).then(res => {
        const filtered = (res.data as any[]).filter(p => 
          String(p.property_id).includes(query) || 
          String(p.owner).toLowerCase().includes(query.toLowerCase()) || 
          String(p.location).toLowerCase().includes(query.toLowerCase())
        )
        setResults(filtered)
      }).catch(console.error).finally(() => setLoading(false))
    } else {
      setResults([])
    }
  }, [query])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-white">Property Search</h1>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search by ID, Owner Name, or Address..." 
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {loading && <div className="text-gray-500">Searching...</div>}
      
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(p => (
            <div key={p.property_id} className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div className="font-bold text-lg dark:text-white">{p.owner || 'Unknown'}</div>
                <div className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">ID: {p.property_id}</div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <MapPin size={14}/> {p.location || 'No Address'}
              </div>
              <div className="mt-2 text-xs text-gray-500 flex justify-between">
                <span>{p.property_type}</span>
                <span>{p.classification_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && query.length > 2 && results.length === 0 && (
        <div className="text-gray-500">No properties found.</div>
      )}
    </div>
  )
}
