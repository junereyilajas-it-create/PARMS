import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  RotateCcw,
  RotateCw,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Compass,
  MapPin,
  ExternalLink,
  Layers,
  Map as MapIcon,
  Settings,
  AlertCircle,
  Maximize2,
  Minimize2,
  Eye,
  Info
} from 'lucide-react'
import type { GISFeature } from '../../types/gis'

interface StreetViewViewerProps {
  lat: number
  lng: number
  feature: GISFeature | null
  onClose: () => void
  onSwitchToSatellite: () => void
  onSwitchToStreetMap: () => void
  miniMapComponent?: React.ReactNode
}

export function StreetViewViewer({
  lat,
  lng,
  feature,
  onClose,
  onSwitchToSatellite,
  onSwitchToStreetMap,
  miniMapComponent,
}: StreetViewViewerProps) {
  const [heading, setHeading] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [fov, setFov] = useState(90) // Field of view (zoom)
  const [showMiniMap, setShowMiniMap] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('parms_google_maps_key') || (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '')
  const [tempKey, setTempKey] = useState(apiKey)
  const [isUnavailable, setIsUnavailable] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  // Check Google Street View metadata availability when lat/lng changes
  useEffect(() => {
    let cancelled = false
    setIsChecking(true)
    setIsUnavailable(false)

    // Check availability via Google Maps metadata API if API key is present
    if (apiKey) {
      fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`)
        .then(res => res.json())
        .then(data => {
          if (!cancelled) {
            setIsChecking(false)
            if (data.status === 'ZERO_RESULTS' || data.status === 'NOT_FOUND') {
              setIsUnavailable(true)
            }
          }
        })
        .catch(() => {
          if (!cancelled) setIsChecking(false)
        })
    } else {
      // Small delay to simulate smooth inspection
      const timer = setTimeout(() => {
        if (!cancelled) setIsChecking(false)
      }, 400)
      return () => clearTimeout(timer)
    }

    return () => {
      cancelled = true
    }
  }, [lat, lng, apiKey])

  const handleRotate = (delta: number) => {
    setHeading(h => {
      let next = (h + delta) % 360
      if (next < 0) next += 360
      return Math.round(next)
    })
  }

  const handleTilt = (delta: number) => {
    setPitch(p => Math.max(-85, Math.min(85, p + delta)))
  }

  const handleZoom = (deltaFov: number) => {
    setFov(f => Math.max(30, Math.min(120, f + deltaFov)))
  }

  const resetOrientation = () => {
    setHeading(0)
    setPitch(0)
    setFov(90)
  }

  const saveApiKey = () => {
    localStorage.setItem('parms_google_maps_key', tempKey.trim())
    setApiKey(tempKey.trim())
    setShowSettings(false)
  }

  // Construct Google Street View URL
  const embedUrl = apiKey
    ? `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}`
    : `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,${heading},0,${pitch},0&output=svembed`

  const googleMapsWebUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=${heading}&pitch=${pitch}`

  return (
    <div className="relative w-full h-full flex flex-col bg-gray-900 text-white rounded-xl overflow-hidden select-none">
      {/* Top Street View Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition border border-gray-700"
            title="Return to Main Interactive Map"
          >
            <ArrowLeft size={16} /> Return to Map
          </button>

          <div className="h-5 w-px bg-gray-700" />

          {/* Property badge */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Eye size={12} /> Street View
            </span>
            <span className="text-xs font-bold text-gray-100 truncate max-w-[200px] sm:max-w-[280px]">
              {feature?.title || `Coordinate: ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            </span>
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              ({lat.toFixed(6)}, {lng.toFixed(6)})
            </span>
          </div>
        </div>

        {/* View Switchers & Settings */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center bg-gray-800 p-0.5 rounded-lg border border-gray-700 text-xs">
            <button
              type="button"
              onClick={onSwitchToStreetMap}
              className="px-2.5 py-1 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition"
            >
              Street Map
            </button>
            <button
              type="button"
              onClick={onSwitchToSatellite}
              className="px-2.5 py-1 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition"
            >
              Satellite
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium"
            >
              Street View
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition border border-gray-700"
            title="Street View API & Provider Settings"
          >
            <Settings size={16} />
          </button>

          <a
            href={googleMapsWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition border border-gray-700"
            title="Open in Full Google Maps Panorama"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {/* Main Street View Viewport */}
      <div className="relative flex-1 w-full bg-black overflow-hidden flex items-center justify-center">
        {isChecking && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {isUnavailable ? (
          /* Friendly Unavailable State */
          <div className="max-w-md mx-4 p-6 bg-gray-800/90 backdrop-blur border border-amber-500/40 rounded-2xl text-center shadow-2xl z-10 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Street View Unavailable Here</h3>
            <p className="text-xs text-gray-300 mb-4 leading-relaxed">
              Ground-level 360° street imagery has not been captured along this specific lot boundary or rural road in Lagonglong, Misamis Oriental.
            </p>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              You can switch to <strong>Satellite / Bird’s-Eye View</strong> to view the real terrain, rooftop, and surrounding boundaries from above.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={onSwitchToSatellite}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-md transition"
              >
                <Layers size={14} /> Switch to Satellite View
              </button>
              <button
                type="button"
                onClick={onSwitchToStreetMap}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-xs font-medium transition"
              >
                <MapIcon size={14} /> Return to Street Map
              </button>
            </div>
          </div>
        ) : (
          /* Actual Google Maps Street View iframe */
          <iframe
            key={`${lat}-${lng}-${heading}-${pitch}`}
            title="Google Maps Street View Ground Imagery"
            src={embedUrl}
            className="w-full h-full border-none"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}

        {/* Floating Rotation, Pitch & Zoom Controls (Overlay on the left) */}
        {!isUnavailable && (
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 bg-gray-900/80 backdrop-blur-md p-2 rounded-xl border border-gray-700/80 shadow-xl">
            {/* Compass / Heading */}
            <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-mono text-gray-300 border-b border-gray-800 pb-1">
              <div className="flex items-center gap-1 text-emerald-400">
                <Compass
                  size={14}
                  style={{ transform: `rotate(${heading}deg)`, transition: 'transform 0.2s ease' }}
                />
                <span>{heading}°</span>
              </div>
              <button
                type="button"
                onClick={resetOrientation}
                className="text-[10px] text-gray-400 hover:text-white uppercase tracking-wider"
                title="Reset to North"
              >
                Reset
              </button>
            </div>

            {/* Rotation buttons */}
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => handleRotate(-30)}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition"
                title="Rotate Left 30°"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleRotate(30)}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition"
                title="Rotate Right 30°"
              >
                <RotateCw size={14} />
              </button>
            </div>

            {/* Pitch / Tilt buttons */}
            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-800">
              <button
                type="button"
                onClick={() => handleTilt(15)}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition"
                title="Tilt Up"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleTilt(-15)}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition"
                title="Tilt Down"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Zoom / FOV buttons */}
            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-800">
              <button
                type="button"
                onClick={() => handleZoom(-15)}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(15)}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Floating Mini-Map / Picture-in-Picture preserving Property Polygon */}
        {miniMapComponent && (
          <div
            className={`absolute bottom-4 right-4 z-10 transition-all duration-300 rounded-xl overflow-hidden border border-gray-700 shadow-2xl bg-gray-900 ${
              showMiniMap ? 'w-64 h-52 sm:w-80 sm:h-60' : 'w-auto h-auto'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/90 border-b border-gray-800 text-[11px] font-semibold text-gray-200">
              <span className="flex items-center gap-1.5">
                <MapPin size={12} className="text-emerald-400" /> Boundary Overview
              </span>
              <button
                type="button"
                onClick={() => setShowMiniMap(!showMiniMap)}
                className="text-gray-400 hover:text-white"
                title={showMiniMap ? 'Minimize Boundary Map' : 'Expand Boundary Map'}
              >
                {showMiniMap ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
            {showMiniMap && <div className="w-full h-[calc(100%-29px)]">{miniMapComponent}</div>}
          </div>
        )}

        {/* Bottom Attribution Notice */}
        <div className="absolute bottom-2 left-4 z-10 text-[10px] text-gray-400/80 bg-black/60 px-2 py-0.5 rounded backdrop-blur pointer-events-none flex items-center gap-2">
          <span>Imagery &copy; Google Maps Street View</span>
          <span>•</span>
          <span>Lagonglong, Misamis Oriental</span>
        </div>
      </div>

      {/* API Key & Provider Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Settings size={18} className="text-emerald-600" /> Street View Provider Settings
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs leading-relaxed">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg flex items-start gap-2 border border-blue-200 dark:border-blue-800/40">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>
                  PARMS uses Google Maps Street View to provide ground-level 360° panoramas. You can use standard embed mode or enter a custom Google Maps API Key.
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Google Maps API Key (Optional)
                </label>
                <input
                  type="text"
                  value={tempKey}
                  onChange={e => setTempKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Enable the <strong>Maps Embed API</strong> and <strong>Street View Static API</strong> in your Google Cloud Console.
                </p>
              </div>

              <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg border border-gray-100 dark:border-gray-700/60">
                <p className="font-semibold text-gray-700 dark:text-gray-300">Provider Requirements:</p>
                <p>• <strong>Website Restrictions:</strong> Configure HTTP referrer restrictions for your domain in Google Cloud.</p>
                <p>• <strong>Billing:</strong> Google provides $200 free monthly credit for Maps APIs.</p>
                <p>• <strong>Attribution:</strong> Google Maps logo and copyright notices are preserved according to Google's terms of service.</p>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveApiKey}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
