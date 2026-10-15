import { useState } from 'react'
import { X, Check, PencilRuler, AlertCircle } from 'lucide-react'
import { GISDrawMap } from '../common/GISDrawMap'
import api from '../../lib/api'
import type { GISFeature } from '../../types/gis'

interface GISDrawModalProps {
  feature: GISFeature
  onClose: () => void
  onSaved: () => void
}

export function GISDrawModal({ feature, onClose, onSaved }: GISDrawModalProps) {
  const [geometry, setGeometry] = useState<any>(null)
  const [areaSqm, setAreaSqm] = useState(0)
  const [perimeterM, setPerimeterM] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const isBuilding = feature.type === 'building'

  // Prepare initial geometry if feature already has coordinates
  let initialGeoJSON: GeoJSON.Feature<GeoJSON.Polygon> | null = null
  if (feature.coordinates) {
    try {
      let parsed = feature.coordinates
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
      if (parsed.type === 'Feature') {
        initialGeoJSON = parsed
      } else if (parsed.type === 'Polygon') {
        initialGeoJSON = { type: 'Feature', properties: {}, geometry: parsed }
      } else if (Array.isArray(parsed)) {
        let ring = parsed
        if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) ring = parsed[0]
        initialGeoJSON = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] },
        }
      }
    } catch {
      // ignore
    }
  }

  const handleSave = async () => {
    if (!geometry) {
      setError('Please draw a polygon boundary on the map first.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const endpoint = isBuilding
        ? `/gis/buildings/${feature.id}`
        : `/gis/lots/${feature.id}`

      await api.post(endpoint, {
        property_id: feature.property_id,
        coordinates: geometry,
        area_sqm: areaSqm,
        perimeter_m: perimeterM,
      })

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save GIS boundary. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <PencilRuler size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Map GIS Boundary: {feature.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Draw or adjust the parcel boundary vertices. Side lengths and area will calculate automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800 flex items-center gap-2 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* GIS Drawing Map Canvas */}
        <div className="p-4 bg-gray-100 dark:bg-gray-900 relative flex-1 min-h-[460px]">
          <GISDrawMap
            entityType={isBuilding ? 'building' : 'lot'}
            initialGeometry={initialGeoJSON}
            onGeometryChange={(geom, area, perim) => {
              setGeometry(geom)
              setAreaSqm(area)
              setPerimeterM(perim)
            }}
          />

          {/* Floating Measurement badge */}
          {areaSqm > 0 && (
            <div className="absolute bottom-7 left-7 z-[500] bg-white/95 dark:bg-gray-800/95 backdrop-blur p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100">
              <p className="font-bold mb-1 text-gray-700 dark:text-gray-300">Live Boundary Measurements</p>
              <div className="flex gap-4">
                <span>Calculated Area: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{areaSqm.toFixed(2)} m²</strong></span>
                <span>Perimeter: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{perimeterM.toFixed(2)} m</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Click points on the map to draw the boundary. Double click to finish polygon.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
            >
              <Check size={16} />
              <span>{isSaving ? 'Saving GIS...' : 'Save Boundary to Database'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
