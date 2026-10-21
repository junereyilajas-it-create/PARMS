import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, Polygon as LeafletPolygon, Marker, Tooltip, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import '@geoman-io/leaflet-geoman-free';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { parseLeafletPositions } from '../../lib/gisUtils';
import {
  RotateCw,
  Move,
  Undo2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Pencil,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Ruler,
  Check
} from 'lucide-react';

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Default center: Poblacion, Lagonglong, Misamis Oriental, Philippines
const LAGONGLONG_CENTER: [number, number] = [8.834, 124.786];

export interface SideMeasurement {
  side: number;
  entered: number;
  derived: number;
  diff: number;
}

export interface GISBoundaryDrawingModuleProps {
  initialGeometry?: GeoJSON.Feature<GeoJSON.Polygon> | null;
  initialCoordinates?: string;
  propertyType?: 'LOT' | 'BUILDING' | string;
  targetTitle?: string;
  lotAreaEntered?: number | string;
  centerOverride?: [number, number];
  onConfirmBoundary: (
    geometry: GeoJSON.Feature<GeoJSON.Polygon>,
    areaSqm: number,
    perimeterM: number,
    sideMeasurements?: SideMeasurement[]
  ) => void;
  onClose: () => void;
}

// Geometric construction helper for N sides
function constructInitialPolygonLocal(sides: number[]): [number, number][] {
  const n = sides.length;
  if (n < 3) return [];

  // Triangle construction
  if (n === 3) {
    const a = sides[0], b = sides[1], c = sides[2];
    if (a + b <= c || a + c <= b || b + c <= a) {
      // Fallback equilateral scaled
      const r = (a + b + c) / (3 * Math.sqrt(3));
      return [
        [0, r],
        [r * Math.cos(Math.PI / 6), -r * Math.sin(Math.PI / 6)],
        [-r * Math.cos(Math.PI / 6), -r * Math.sin(Math.PI / 6)]
      ];
    }
    const cosA = (a * a + c * c - b * b) / (2 * a * c);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    return [[0, 0], [a, 0], [c * cosA, c * sinA]];
  }

  // Quadrilateral construction
  if (n === 4) {
    const s0 = sides[0], s1 = sides[1], s2 = sides[2], s3 = sides[3];
    const d0 = Math.sqrt(s0 * s0 + s1 * s1);
    const minD = Math.abs(s2 - s3) + 0.05 * (s2 + s3);
    const maxD = (s2 + s3) - 0.05 * (s2 + s3);
    const d = Math.max(minD, Math.min(maxD, d0));

    const cosBeta = Math.max(-0.99, Math.min(0.99, (s0 * s0 + s1 * s1 - d * d) / (2 * s0 * s1)));
    const sinBeta = Math.sqrt(Math.max(0, 1 - cosBeta * cosBeta));
    const v0: [number, number] = [0, 0];
    const v1: [number, number] = [s0, 0];
    const v2: [number, number] = [s0 - s1 * cosBeta, s1 * sinBeta];

    const dx = v2[0] - v0[0];
    const dy = v2[1] - v0[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const a = (s3 * s3 - s2 * s2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, s3 * s3 - a * a));
    const xm = v0[0] + (a * dx) / dist;
    const ym = v0[1] + (a * dy) / dist;
    const rx = -dy / dist;
    const ry = dx / dist;
    const v3: [number, number] = [xm - h * rx, ym - h * ry];
    return [v0, v1, v2, v3];
  }

  // General n >= 5: proportional distribution on convex loop
  const totalPerimeter = sides.reduce((sum, s) => sum + s, 0);
  const angles = sides.map(s => (s / totalPerimeter) * 2 * Math.PI);
  let curAngle = 0;
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i < n - 1; i++) {
    curAngle += angles[i];
    const prev = pts[pts.length - 1];
    pts.push([prev[0] + sides[i] * Math.cos(curAngle), prev[1] + sides[i] * Math.sin(curAngle)]);
  }
  return pts;
}

// Convert local meters (x, y) to geographic (lat, lng) centered around center [lat, lng]
function localPointsToGeo(localPts: [number, number][], center: [number, number]): [number, number][] {
  if (!localPts.length) return [];
  const [cLat, cLng] = center;
  const meanX = localPts.reduce((acc, p) => acc + p[0], 0) / localPts.length;
  const meanY = localPts.reduce((acc, p) => acc + p[1], 0) / localPts.length;

  const metersPerDegLat = 111139;
  const metersPerDegLng = 111139 * Math.cos((cLat * Math.PI) / 180);

  return localPts.map(([x, y]) => {
    const dx = x - meanX;
    const dy = y - meanY;
    const lat = cLat + dy / metersPerDegLat;
    const lng = cLng + dx / metersPerDegLng;
    return [lat, lng];
  });
}

// Calculate centroid of [lat, lng] points
function computeCentroid(points: [number, number][]): [number, number] {
  if (!points.length) return LAGONGLONG_CENTER;
  const sumLat = points.reduce((acc, p) => acc + p[0], 0);
  const sumLng = points.reduce((acc, p) => acc + p[1], 0);
  return [sumLat / points.length, sumLng / points.length];
}

// Rotate points around centroid by angleDeg degrees
function rotatePoints(points: [number, number][], centroid: [number, number], angleDeg: number): [number, number][] {
  if (!points.length || angleDeg === 0) return points;
  const [cLat, cLng] = centroid;
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const metersPerDegLat = 111139;
  const metersPerDegLng = 111139 * Math.cos((cLat * Math.PI) / 180);

  return points.map(([lat, lng]) => {
    // Convert to meters relative to centroid
    const dx = (lng - cLng) * metersPerDegLng;
    const dy = (lat - cLat) * metersPerDegLat;

    // Rotate
    const rotX = dx * cosA - dy * sinA;
    const rotY = dx * sinA + dy * cosA;

    // Convert back
    const newLat = cLat + rotY / metersPerDegLat;
    const newLng = cLng + rotX / metersPerDegLng;
    return [newLat, newLng];
  });
}

// Map Controller component to handle programmatically zooming or Geoman freehand
function MapController({
  onMapClick,
  setMapInstance
}: {
  onMapClick?: (latlng: [number, number]) => void;
  setMapInstance: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    setMapInstance(map);
  }, [map, setMapInstance]);

  // Handle click on map for moving centroid
  useEffect(() => {
    if (!onMapClick) return;
    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);

  return null;
}

export function GISBoundaryDrawingModule({
  initialGeometry,
  initialCoordinates,
  propertyType = 'LOT',
  targetTitle = 'Property Parcel',
  lotAreaEntered,
  centerOverride,
  onConfirmBoundary,
  onClose,
}: GISBoundaryDrawingModuleProps) {
  // Map View Mode: Street Map vs Satellite / Bird's-Eye View (Default to Satellite)
  const [mapMode, setMapMode] = useState<'satellite' | 'street'>('satellite');

  // Input measurements state
  const [sidesCount, setSidesCount] = useState<number>(4);
  const [sideInputs, setSideInputs] = useState<string[]>(['15', '20', '15', '20']);
  const [presetType, setPresetType] = useState<'custom' | 'rectangle'>('rectangle');
  const [rectWidth, setRectWidth] = useState<string>('15');
  const [rectLength, setRectLength] = useState<string>('20');

  // Active Polygon Vertices [ [lat, lng], ... ]
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [history, setHistory] = useState<[number, number][][]>([]);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'auto' | 'tools' | 'measurements'>('auto');
  const [activeSideIndex, setActiveSideIndex] = useState<number | null>(null);
  const [moveMode, setMoveMode] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const mapRef = useRef<L.Map | null>(null);

  // Initialize from initialCoordinates or initialGeometry if existing
  useEffect(() => {
    const raw = initialCoordinates || initialGeometry;
    if (raw) {
      const parsed = parseLeafletPositions(raw);
      if (parsed.length >= 3) {
        let pts = [...parsed];
        // Strip duplicate closing point if present
        if (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) {
          pts = pts.slice(0, pts.length - 1);
        }
        setVertices(pts);
        setSidesCount(pts.length);
        setIsConfirmed(true);
        // Auto-fit to existing boundary
        setTimeout(() => {
          if (mapRef.current) {
            const bounds = L.latLngBounds(pts.map(([lat, lng]) => [lat, lng]));
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, { padding: [60, 60] });
            }
          }
        }, 300);
      }
    }
  }, [initialGeometry, initialCoordinates]);

  // Sync side inputs when sidesCount changes
  const handleSidesCountChange = (count: number) => {
    setSidesCount(count);
    setSideInputs(prev => {
      const next = [...prev];
      while (next.length < count) {
        next.push('15');
      }
      return next.slice(0, count);
    });
  };

  // Sync rectangle presets
  const handleRectangleChange = (w: string, l: string) => {
    setRectWidth(w);
    setRectLength(l);
    setSideInputs([w, l, w, l]);
  };

  // Generate initial polygon from side measurements
  const handleGenerateBoundary = (centerOverride?: [number, number]) => {
    setErrorMsg('');
    const parsedSides = sideInputs.map(s => Number(s));
    for (let i = 0; i < parsedSides.length; i++) {
      if (isNaN(parsedSides[i]) || parsedSides[i] <= 0) {
        setErrorMsg(`Please enter a valid positive length for Side ${i + 1}.`);
        return;
      }
    }

    // Check polygon feasibility: no single side >= sum of other sides
    const total = parsedSides.reduce((a, b) => a + b, 0);
    for (let i = 0; i < parsedSides.length; i++) {
      if (parsedSides[i] >= total - parsedSides[i]) {
        setErrorMsg(`Side ${i + 1} (${parsedSides[i]}m) is too long to close a polygon with the other sides.`);
        return;
      }
    }

    const localPts = constructInitialPolygonLocal(parsedSides);
    if (!localPts.length) {
      setErrorMsg('Unable to construct polygon with entered measurements.');
      return;
    }

    // Placement center: map center or Lagonglong center
    let center: [number, number] = LAGONGLONG_CENTER;
    if (centerOverride) {
      center = centerOverride;
    } else if (mapRef.current) {
      const c = mapRef.current.getCenter();
      center = [c.lat, c.lng];
    } else if (vertices.length > 0) {
      center = computeCentroid(vertices);
    }

    const geoPts = localPointsToGeo(localPts, center);
    saveHistory(vertices);
    setVertices(geoPts);
    setRotationAngle(0);
    setIsConfirmed(false);
    setActiveTab('tools');

    // Zoom and pan map to the generated polygon
    setTimeout(() => {
      if (mapRef.current) {
        const bounds = L.latLngBounds(geoPts.map(([lat, lng]) => [lat, lng]));
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [80, 80] });
        }
      }
    }, 150);
  };

  const saveHistory = (currentPts: [number, number][]) => {
    if (currentPts.length > 0) {
      setHistory(prev => [...prev.slice(-10), currentPts]);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, h.length - 1));
    setVertices(prev);
    setIsConfirmed(false);
  };

  // Move entire polygon by delta in meters
  const handleNudge = (deltaX: number, deltaY: number) => {
    if (!vertices.length) return;
    saveHistory(vertices);
    const cLat = vertices[0][0];
    const metersPerDegLat = 111139;
    const metersPerDegLng = 111139 * Math.cos((cLat * Math.PI) / 180);

    const dLat = deltaY / metersPerDegLat;
    const dLng = deltaX / metersPerDegLng;

    const shifted = vertices.map(([lat, lng]): [number, number] => [lat + dLat, lng + dLng]);
    setVertices(shifted);
    setIsConfirmed(false);
  };

  // Center polygon at clicked map point
  const handleMapClickToMove = (targetCenter: [number, number]) => {
    if (!moveMode || !vertices.length) return;
    saveHistory(vertices);
    const curCentroid = computeCentroid(vertices);
    const dLat = targetCenter[0] - curCentroid[0];
    const dLng = targetCenter[1] - curCentroid[1];

    const shifted = vertices.map(([lat, lng]): [number, number] => [lat + dLat, lng + dLng]);
    setVertices(shifted);
    setIsConfirmed(false);
  };

  // Rotate entire polygon
  const handleRotate = (newAngle: number) => {
    if (!vertices.length) return;
    const diff = newAngle - rotationAngle;
    const centroid = computeCentroid(vertices);
    const rotated = rotatePoints(vertices, centroid, diff);
    setVertices(rotated);
    setRotationAngle(newAngle);
    setIsConfirmed(false);
  };

  // Move individual corner vertex
  const handleVertexDrag = (index: number, newLat: number, newLng: number) => {
    saveHistory(vertices);
    const next = [...vertices];
    next[index] = [newLat, newLng];
    setVertices(next);
    setIsConfirmed(false);
  };

  // Calculate live measurements using turf
  const liveStats = useMemo(() => {
    if (vertices.length < 3) {
      return {
        areaSqm: 0,
        perimeterM: 0,
        sides: [] as SideMeasurement[],
        isValid: false,
        closedCoordinates: [] as [number, number][],
      };
    }

    const ring = [...vertices, vertices[0]];
    // Turf uses [lng, lat]
    const turfRing = ring.map(([lat, lng]) => [lng, lat]);
    const polyGeo = turf.polygon([turfRing]);

    let areaSqm = 0;
    let perimeterM = 0;
    try {
      areaSqm = Math.round(turf.area(polyGeo) * 100) / 100;
      const line = turf.lineString(turfRing);
      perimeterM = Math.round(turf.length(line, { units: 'meters' }) * 100) / 100;
    } catch {
      // geometry error
    }

    // Side lengths derived from geometry
    const sides: SideMeasurement[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const p1 = turf.point([vertices[i][1], vertices[i][0]]);
      const nextIdx = (i + 1) % vertices.length;
      const p2 = turf.point([vertices[nextIdx][1], vertices[nextIdx][0]]);
      const derivedLen = Math.round(turf.distance(p1, p2, { units: 'meters' }) * 100) / 100;
      const enteredLen = Number(sideInputs[i]) || derivedLen;
      const diff = Math.round((derivedLen - enteredLen) * 100) / 100;

      sides.push({
        side: i + 1,
        entered: enteredLen,
        derived: derivedLen,
        diff,
      });
    }

    return {
      areaSqm,
      perimeterM,
      sides,
      isValid: areaSqm > 0,
      closedCoordinates: ring,
    };
  }, [vertices, sideInputs]);

  // Handle final confirmation
  const handleConfirm = () => {
    if (vertices.length < 3 || liveStats.areaSqm <= 0) {
      setErrorMsg('Please generate or draw a valid polygon boundary first.');
      return;
    }

    // Turf polygon: ring with closed final point [lng, lat]
    const turfCoords = [...vertices, vertices[0]].map(([lat, lng]) => [lng, lat]);
    const geoJsonFeature = turf.polygon([turfCoords]);

    setIsConfirmed(true);
    onConfirmBoundary(geoJsonFeature, liveStats.areaSqm, liveStats.perimeterM, liveStats.sides);
  };

  // Centroid for marker / label
  const centroid = useMemo(() => computeCentroid(vertices), [vertices]);

  return (
    <div className="flex flex-col h-[78vh] min-h-[560px] w-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 animate-fade-in text-gray-900 dark:text-gray-100">
      {/* Top Header */}
      <div className="px-5 py-3.5 bg-gray-50/90 dark:bg-gray-850/90 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md">
            <Ruler size={19} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Bird’s-Eye Boundary Drawing & Measurements: {targetTitle}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                {propertyType} Satellite GIS
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Generate boundary from side lengths or draw over satellite imagery. Position, rotate, and adjust.
            </p>
          </div>
        </div>

        {/* View Switcher & Close */}
        <div className="flex items-center gap-2">
          {/* Map View Mode Selector */}
          <div className="flex items-center bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl border border-gray-300 dark:border-gray-700">
            <button
              type="button"
              id="map-mode-satellite-btn"
              onClick={() => setMapMode('satellite')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                mapMode === 'satellite'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>🛰️ Satellite / Bird’s-Eye</span>
            </button>
            <button
              type="button"
              id="map-mode-street-btn"
              onClick={() => setMapMode('street')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                mapMode === 'street'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>🗺️ Street Map</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
            title="Close boundary drawing tool"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Container: Sidebar + Map */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Control Panel / Tabs */}
        <div className="w-full md:w-96 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/60 overflow-y-auto shrink-0 custom-scrollbar text-xs">
          {/* Sub-Tabs */}
          <div className="grid grid-cols-3 border-b border-gray-200 dark:border-gray-800 p-2 gap-1 bg-white/60 dark:bg-gray-850/60">
            <button
              type="button"
              onClick={() => setActiveTab('auto')}
              className={`py-2 px-2 rounded-lg font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                activeTab === 'auto'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Ruler size={15} />
              <span>1. Enter Sides</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tools')}
              className={`py-2 px-2 rounded-lg font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                activeTab === 'tools'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Move size={15} />
              <span>2. Position & Rotate</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('measurements')}
              className={`py-2 px-2 rounded-lg font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                activeTab === 'measurements'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <CheckCircle2 size={15} />
              <span>3. Review & Verify</span>
            </button>
          </div>

          {/* TAB 1: ENTER SIDES & AUTO-GENERATE */}
          {activeTab === 'auto' && (
            <div className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-1">
                <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Info size={14} className="text-blue-600" />
                  Auto-Construct from Lot Survey
                </span>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                  Enter the number of sides and lengths in meters. An initial polygon will be generated immediately on the Bird’s-Eye satellite map.
                </p>
              </div>

              {/* Sides Count Selector */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Number of Sides
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[3, 4, 5, 6].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleSidesCountChange(num)}
                      className={`py-1.5 text-center font-bold rounded-lg border transition cursor-pointer ${
                        sidesCount === num
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-emerald-400'
                      }`}
                    >
                      {num} Sides {num === 4 ? '(Quad)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Presets for 4 sides */}
              {sidesCount === 4 && (
                <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-gray-800">
                  <span className="font-bold text-gray-700 dark:text-gray-300 block">Preset Format</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPresetType('rectangle');
                        handleRectangleChange(rectWidth, rectLength);
                      }}
                      className={`flex-1 py-1 px-2 rounded-lg font-bold text-[11px] border transition cursor-pointer ${
                        presetType === 'rectangle'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      Standard Box / Rectangle
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetType('custom')}
                      className={`flex-1 py-1 px-2 rounded-lg font-bold text-[11px] border transition cursor-pointer ${
                        presetType === 'custom'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      Custom 4 Sides
                    </button>
                  </div>

                  {presetType === 'rectangle' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[11px] text-gray-500 dark:text-gray-400 block mb-1">
                          Width (m) [Sides 1 & 3]
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={rectWidth}
                          onChange={e => handleRectangleChange(e.target.value, rectLength)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-mono font-bold text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 dark:text-gray-400 block mb-1">
                          Length (m) [Sides 2 & 4]
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={rectLength}
                          onChange={e => handleRectangleChange(rectWidth, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-mono font-bold text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Individual Side Inputs */}
              {(sidesCount !== 4 || presetType === 'custom') && (
                <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-gray-800">
                  <span className="font-bold text-gray-700 dark:text-gray-300 block">Side Lengths (Meters)</span>
                  <div className="grid grid-cols-2 gap-2">
                    {sideInputs.map((val, idx) => (
                      <div key={idx} className="space-y-1">
                        <label className="text-[11px] text-gray-600 dark:text-gray-400 font-semibold flex items-center justify-between">
                          <span>Side {idx + 1}</span>
                          <span className="text-[10px] text-gray-400">m</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          value={val}
                          onFocus={() => setActiveSideIndex(idx)}
                          onBlur={() => setActiveSideIndex(null)}
                          onMouseEnter={() => setActiveSideIndex(idx)}
                          onMouseLeave={() => setActiveSideIndex(null)}
                          onChange={e => {
                            const updated = [...sideInputs];
                            updated[idx] = e.target.value;
                            setSideInputs(updated);
                          }}
                          className={`w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border rounded-lg font-mono font-bold text-gray-900 dark:text-white transition ${
                            activeSideIndex === idx ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-300 dark:border-gray-700'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Generate Button */}
              <button
                type="button"
                id="generate-boundary-btn"
                onClick={() => handleGenerateBoundary()}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Ruler size={16} />
                Generate Boundary on Satellite Map
              </button>

              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
                <strong>Initial Layout Disclaimer:</strong> Side lengths alone do not uniquely specify angles. This generated polygon is an initial layout — adjust its position and orientation over actual imagery.
              </div>
            </div>
          )}

          {/* TAB 2: POSITION & ROTATE CONTROLS */}
          {activeTab === 'tools' && (
            <div className="p-4 space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Move size={14} />
                  Positioning Instruction
                </span>
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed font-medium">
                  "Position the boundary over the correct lot, adjust its orientation, verify the measurements, and confirm."
                </p>
              </div>

              {/* Rotation Slider & Buttons */}
              <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <RotateCw size={14} className="text-emerald-600" /> Rotate Polygon
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                    {Math.round(rotationAngle)}°
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={rotationAngle}
                  onChange={e => handleRotate(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />

                <div className="flex items-center justify-between gap-1 pt-1">
                  {[-45, -15, -5, 5, 15, 45].map(step => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => handleRotate((rotationAngle + step + 360) % 360)}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-[10px] font-bold text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      {step > 0 ? `+${step}°` : `${step}°`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleRotate(0)}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-600 dark:text-gray-400 rounded text-[10px] font-bold cursor-pointer"
                    title="Reset to 0°"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Whole-Polygon Movement Nudge Controls */}
              <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Move size={14} className="text-blue-600" /> Nudge Position (Preserves Dimensions)
                </span>
                <p className="text-[11px] text-gray-500">
                  Click arrows to shift boundary by 2 meters, or click anywhere on the satellite map to center it.
                </p>

                <div className="flex flex-col items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => handleNudge(0, 2)}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-gray-800 dark:text-gray-200 cursor-pointer"
                    title="Nudge North 2m"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNudge(-2, 0)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-gray-800 dark:text-gray-200 cursor-pointer"
                      title="Nudge West 2m"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoveMode(!moveMode)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                        moveMode
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {moveMode ? 'Click Map To Move (ON)' : 'Click Map Move'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNudge(2, 0)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-gray-800 dark:text-gray-200 cursor-pointer"
                      title="Nudge East 2m"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNudge(0, -2)}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-gray-800 dark:text-gray-200 cursor-pointer"
                    title="Nudge South 2m"
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>

              {/* Corner Handles Guide */}
              <div className="p-3 bg-gray-100/60 dark:bg-gray-800/50 rounded-xl space-y-1">
                <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Pencil size={13} className="text-emerald-500" /> Corner Vertex Dragging
                </span>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Drag any circular vertex pin on the satellite map to adjust specific corners to visible fences or roads. Live measurements will update automatically.
                </p>
              </div>

              {/* Undo and Reset Shape */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="flex-1 py-2 px-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                >
                  <Undo2 size={14} />
                  Undo Change
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateBoundary(centroid)}
                  className="flex-1 py-2 px-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw size={14} />
                  Reset Shape
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MEASUREMENTS & AREA COMPARISON */}
          {activeTab === 'measurements' && (
            <div className="p-4 space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold block mb-0.5">
                    Calculated Area
                  </span>
                  <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {liveStats.areaSqm.toFixed(2)} m²
                  </span>
                  {lotAreaEntered && Number(lotAreaEntered) > 0 && (
                    <div className="text-[10px] text-gray-500 mt-1 border-t border-gray-100 dark:border-gray-700 pt-1">
                      Step 1 Input: <strong>{Number(lotAreaEntered).toFixed(2)} m²</strong>
                      <span className={`block font-bold ${Math.abs(liveStats.areaSqm - Number(lotAreaEntered)) < 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        Δ {(liveStats.areaSqm - Number(lotAreaEntered)).toFixed(2)} m²
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold block mb-0.5">
                    Total Perimeter
                  </span>
                  <span className="font-mono text-base font-extrabold text-blue-600 dark:text-blue-400">
                    {liveStats.perimeterM.toFixed(2)} m
                  </span>
                  <div className="text-[10px] text-gray-500 mt-1 border-t border-gray-100 dark:border-gray-700 pt-1">
                    Sides: <strong>{vertices.length} vertices</strong>
                  </div>
                </div>
              </div>

              {/* Side Breakdown Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-3 py-2 bg-gray-100/70 dark:bg-gray-750 font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                  <span>Side Measurements vs Map</span>
                  <span className="text-[10px] text-gray-500">Meters</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto custom-scrollbar">
                  {liveStats.sides.map(s => {
                    const hasDiff = Math.abs(s.diff) > 0.1;
                    return (
                      <div
                        key={s.side}
                        onMouseEnter={() => setActiveSideIndex(s.side - 1)}
                        onMouseLeave={() => setActiveSideIndex(null)}
                        className={`px-3 py-2 flex items-center justify-between text-[11px] transition cursor-pointer ${
                          activeSideIndex === (s.side - 1)
                            ? 'bg-amber-100/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                            {s.side}
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            Side {s.side}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 font-mono">
                            Entered: {s.entered.toFixed(2)}m
                          </span>
                          <span className="font-mono font-bold text-gray-900 dark:text-white">
                            Map: {s.derived.toFixed(2)}m
                          </span>
                          {hasDiff && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                s.diff > 0
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              }`}
                              title="Diff between entered survey measurement and map geometry"
                            >
                              {s.diff > 0 ? `+${s.diff.toFixed(2)}m` : `${s.diff.toFixed(2)}m`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {liveStats.sides.some(s => Math.abs(s.diff) > 0.2) && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                  <strong>Measurement Variation Warning:</strong> One or more sides were adjusted away from their entered survey length. Original survey records will remain distinct from geometry measurements.
                </div>
              )}
            </div>
          )}

          {/* Bottom Action Footer in Control Panel */}
          <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-850/80 space-y-2">
            <button
              type="button"
              id="confirm-boundary-btn"
              onClick={handleConfirm}
              disabled={vertices.length < 3 || liveStats.areaSqm <= 0}
              className={`w-full py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                isConfirmed
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <CheckCircle2 size={16} />
              {isConfirmed ? 'Boundary Confirmed ✓' : 'Confirm Boundary & Return'}
            </button>
            <p className="text-[10px] text-center text-gray-500">
              Final boundary coordinates will be preserved in your property record.
            </p>
          </div>
        </div>

        {/* Right Map Canvas Area */}
        <div className="flex-1 relative h-full min-h-[420px]">
          {/* Overlay Status HUD Badge */}
          <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="bg-white/95 dark:bg-gray-850/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-xs flex items-center gap-2 pointer-events-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {liveStats.areaSqm > 0 ? `${liveStats.areaSqm.toFixed(2)} m²` : 'Draw Boundary'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 dark:text-gray-300 font-mono">
                {liveStats.perimeterM > 0 ? `${liveStats.perimeterM.toFixed(2)} m perim` : 'Lagonglong'}
              </span>
            </div>

            {isConfirmed && (
              <span className="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-lg flex items-center gap-1.5">
                <Check size={14} /> Confirmed
              </span>
            )}
          </div>

          {/* Leaflet Map Container */}
          <MapContainer
            center={centerOverride || LAGONGLONG_CENTER}
            zoom={16}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
          >
            {mapMode === 'satellite' ? (
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            ) : (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
            )}

            <MapController
              onMapClick={handleMapClickToMove}
              setMapInstance={map => {
                mapRef.current = map;
              }}
            />

            {/* Polygon Geometry Display */}
            {vertices.length >= 3 && (
              <>
                {/* 1. Base High-Contrast Dark Halo Outline (Visible over both Satellite & Street) */}
                <LeafletPolygon
                  positions={liveStats.closedCoordinates}
                  pathOptions={{
                    color: '#020617',
                    weight: 7,
                    opacity: 0.95,
                    fill: false,
                    interactive: false,
                  }}
                />

                {/* 2. Primary Vivid Property Boundary Line */}
                <LeafletPolygon
                  positions={liveStats.closedCoordinates}
                  pathOptions={{
                    color: isConfirmed ? '#10b981' : '#06b6d4',
                    weight: 3.5,
                    dashArray: isConfirmed ? undefined : '5, 5',
                    fillColor: isConfirmed ? '#10b981' : '#06b6d4',
                    fillOpacity: 0.25,
                  }}
                />

                {/* 3. Highlighted Active Side Segment */}
                {activeSideIndex !== null && vertices[activeSideIndex] && (
                  <>
                    <Polyline
                      positions={[
                        vertices[activeSideIndex],
                        vertices[(activeSideIndex + 1) % vertices.length]
                      ]}
                      pathOptions={{
                        color: '#ffffff',
                        weight: 8,
                        opacity: 0.95,
                        interactive: false
                      }}
                    />
                    <Polyline
                      positions={[
                        vertices[activeSideIndex],
                        vertices[(activeSideIndex + 1) % vertices.length]
                      ]}
                      pathOptions={{
                        color: '#f59e0b',
                        weight: 5,
                        opacity: 1,
                        interactive: false
                      }}
                    />
                  </>
                )}

                {/* 4. Corner Vertex Markers */}
                {vertices.map((pos, idx) => (
                  <Marker
                    key={`vertex-${idx}`}
                    position={pos}
                    draggable={true}
                    eventHandlers={{
                      dragend: e => {
                        const marker = e.target;
                        const latlng = marker.getLatLng();
                        handleVertexDrag(idx, latlng.lat, latlng.lng);
                      },
                    }}
                    icon={L.divIcon({
                      className: 'custom-vertex-marker',
                      html: `
                        <div style="
                          width: 24px; 
                          height: 24px; 
                          border-radius: 50%; 
                          background: linear-gradient(135deg, ${isConfirmed ? '#059669' : '#0284c7'}, ${isConfirmed ? '#10b981' : '#38bdf8'}); 
                          color: #ffffff; 
                          border: 2.5px solid #ffffff; 
                          box-shadow: 0 3px 8px rgba(0,0,0,0.55); 
                          display: flex; 
                          align-items: center; 
                          justify-content: center; 
                          font-size: 11px; 
                          font-weight: 800; 
                          cursor: grab;
                          user-select: none;
                        ">
                          ${idx + 1}
                        </div>
                      `,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12],
                    })}
                  >
                    <Tooltip direction="top" offset={[0, -12]}>
                      Vertex ${idx + 1} (Drag to adjust boundary)
                    </Tooltip>
                  </Marker>
                ))}

                {/* 5. Side-Length Labels Beside Their Respective Lines (Outward Offset) */}
                {liveStats.sides.map((sideItem, i) => {
                  const p1 = vertices[i];
                  const p2 = vertices[(i + 1) % vertices.length];
                  if (!p1 || !p2) return null;

                  const midLat = (p1[0] + p2[0]) / 2;
                  const midLng = (p1[1] + p2[1]) / 2;

                  // Geographic distance projection
                  const metersPerDegLat = 111139;
                  const metersPerDegLng = 111139 * Math.cos((midLat * Math.PI) / 180);
                  const dx = (p2[1] - p1[1]) * metersPerDegLng;
                  const dy = (p2[0] - p1[0]) * metersPerDegLat;
                  const segLen = Math.sqrt(dx * dx + dy * dy);

                  let labelLat = midLat;
                  let labelLng = midLng;

                  if (segLen > 0) {
                    // Normal vector perpendicular to segment
                    let nx = -dy / segLen;
                    let ny = dx / segLen;

                    // Centroid vector
                    const cdx = (midLng - centroid[1]) * metersPerDegLng;
                    const cdy = (midLat - centroid[0]) * metersPerDegLat;

                    // Dot product test to guarantee offset is on the exterior side
                    if (cdx * nx + cdy * ny < 0) {
                      nx = -nx;
                      ny = -ny;
                    }

                    // 6.5 meters outward perpendicular offset
                    const offsetMeters = 6.5;
                    labelLat = midLat + (ny * offsetMeters) / metersPerDegLat;
                    labelLng = midLng + (nx * offsetMeters) / metersPerDegLng;
                  }

                  const isActive = activeSideIndex === i;

                  return (
                    <Marker
                      key={`side-label-${i}`}
                      position={[labelLat, labelLng]}
                      interactive={false}
                      icon={L.divIcon({
                        className: 'edge-measurement-label-clean',
                        html: `
                          <div style="
                            display: inline-flex;
                            align-items: center;
                            gap: 4px;
                            background-color: ${isActive ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.90)'};
                            color: #ffffff;
                            border: 1.5px solid ${isActive ? '#f59e0b' : '#38bdf8'};
                            border-radius: 6px;
                            padding: 2.5px 7px;
                            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                            font-size: 11px;
                            font-weight: 700;
                            box-shadow: 0 3px 8px rgba(0,0,0,0.5);
                            white-space: nowrap;
                            pointer-events: none;
                            transform: translate(-50%, -50%);
                          ">
                            <span style="color: ${isActive ? '#fbbf24' : '#38bdf8'}; font-weight: 800;">S${sideItem.side}:</span>
                            <span>${sideItem.derived.toFixed(2)} m</span>
                          </div>
                        `,
                        iconSize: [80, 24],
                        iconAnchor: [40, 12],
                      })}
                    />
                  );
                })}
              </>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
