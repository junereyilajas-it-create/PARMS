import L from 'leaflet'
import * as turf from '@turf/turf'
import type { ParsedGeometry } from '../types/gis'

// Fix default leaflet marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

/**
 * Robustly parses coordinates stored in database or GeoJSON formats into Leaflet [lat, lng] tuples.
 * Supports:
 * - Direct array of rings: [[[lng, lat], ...]]
 * - Direct array of points: [[lng, lat], ...]
 * - GeoJSON Feature: { type: 'Feature', geometry: { coordinates: [...] } }
 * - GeoJSON Geometry: { type: 'Polygon', coordinates: [...] }
 * - Stringified JSON of any of the above
 */
export function parseLeafletPositions(raw: any): [number, number][] {
  if (!raw) return []

  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }

  let ring: any[] | null = null

  if (parsed?.geometry?.coordinates?.[0]) {
    ring = parsed.geometry.coordinates[0]
  } else if (parsed?.coordinates?.[0]) {
    ring = parsed.coordinates[0]
  } else if (Array.isArray(parsed)) {
    if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
      // [[[lng, lat], ...]]
      ring = parsed[0]
    } else if (Array.isArray(parsed[0]) && typeof parsed[0][0] === 'number') {
      // [[lng, lat], ...]
      ring = parsed
    }
  }

  if (!ring || !Array.isArray(ring)) return []

  const result: [number, number][] = []
  for (const pt of ring) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lng = Number(pt[0])
      const lat = Number(pt[1])
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        result.push([lat, lng])
      }
    }
  }

  return result
}

/**
 * Computes centroid, bounds, side lengths, and area measurements from polygon positions
 */
export function getGeometryDetails(positions: [number, number][]): ParsedGeometry | null {
  if (!positions || positions.length < 3) return null

  // Ensure ring is closed for GeoJSON
  const closed = [...positions]
  const first = closed[0]
  const last = closed[closed.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closed.push([first[0], first[1]])
  }

  // GeoJSON uses [lng, lat]
  const geojsonRing = closed.map(p => [p[1], p[0]])
  let areaSqm = 0
  let perimeterMeters = 0
  let centroid: [number, number] = [0, 0]

  try {
    const poly = turf.polygon([geojsonRing])
    areaSqm = Math.round(turf.area(poly) * 100) / 100
    const line = turf.lineString(geojsonRing)
    perimeterMeters = Math.round(turf.length(line, { units: 'meters' }) * 100) / 100
    const centerPoint = turf.centroid(poly)
    centroid = [centerPoint.geometry.coordinates[1], centerPoint.geometry.coordinates[0]]
  } catch {
    // Fallback arithmetic center if polygon is self-intersecting
    const latSum = positions.reduce((acc, p) => acc + p[0], 0)
    const lngSum = positions.reduce((acc, p) => acc + p[1], 0)
    centroid = [latSum / positions.length, lngSum / positions.length]
  }

  // Calculate side lengths for each edge
  const sideLengths: ParsedGeometry['sideLengths'] = []
  for (let i = 0; i < closed.length - 1; i++) {
    const p1 = closed[i]
    const p2 = closed[i + 1]
    const midPoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
    try {
      const dist = turf.distance(
        turf.point([p1[1], p1[0]]),
        turf.point([p2[1], p2[0]]),
        { units: 'meters' }
      )
      sideLengths.push({
        start: p1,
        end: p2,
        midPoint,
        lengthMeters: Math.round(dist * 100) / 100,
      })
    } catch {
      // skip invalid edge
    }
  }

  // Compute bounds
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const [lat, lng] of positions) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  const bounds: [[number, number], [number, number]] | null =
    Number.isFinite(minLat) && Number.isFinite(maxLat)
      ? [[minLat, minLng], [maxLat, maxLng]]
      : null

  return {
    positions,
    centroid,
    bounds,
    sideLengths,
    areaSqm,
    perimeterMeters,
  }
}

/**
 * Creates modern, high-contrast Leaflet marker icons for lots and buildings
 */
export function createCustomMarkerIcon(type: 'lot' | 'building', isSelected: boolean = false, isPending: boolean = false) {
  const isBldg = type === 'building'
  const bgGrad = isPending 
    ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
    : isBldg 
      ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' 
      : 'linear-gradient(135deg, #10b981, #059669)'
  
  const ringColor = isSelected ? '#06b6d4' : 'rgba(255,255,255,0.9)'
  const shadow = isSelected ? '0 0 16px rgba(6,182,212,0.8), 0 4px 10px rgba(0,0,0,0.3)' : '0 3px 8px rgba(0,0,0,0.25)'
  const scale = isSelected ? 'scale(1.15)' : 'scale(1)'

  const iconSvg = isBldg 
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>'

  return L.divIcon({
    className: 'custom-gis-pin',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: ${bgGrad};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg) ${scale};
        box-shadow: ${shadow};
        border: 2px solid ${ringColor};
        transition: transform 0.2s ease;
        cursor: pointer;
      ">
        <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
          ${iconSvg}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

/**
 * Creates side-length measurement badge divIcon
 */
export function createSideLengthIcon(meters: number) {
  return L.divIcon({
    className: 'gis-measurement-label',
    html: `
      <div style="
        background: rgba(15, 23, 42, 0.85);
        color: #f8fafc;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 1px 5px;
        font-size: 10px;
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        pointer-events: none;
        backdrop-filter: blur(2px);
      ">
        ${meters.toFixed(2)} m
      </div>
    `,
    iconAnchor: [24, 8],
  })
}
