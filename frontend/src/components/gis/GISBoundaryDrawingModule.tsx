import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, Polygon as LeafletPolygon, Marker, Tooltip, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import '@geoman-io/leaflet-geoman-free';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { parseLeafletPositions } from '../../lib/gisUtils';
import {
  formatPointPair,
  detectSelfIntersection,
  constructRectangle,
  constructSquare,
  constructQuadrilateral,
  constructInitialPolygonLocal,
  validateMeasurements,
  type LotShapeType,
} from '../../lib/gisGeometry';
import { validateGISBoundary, adjustFourSidedDimensions } from '../../lib/gisValidationService';
import {
  RotateCw,
  Move,
  Undo2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Ruler,
  Check,
  Shapes,
  ShieldAlert,
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
  fromPoint: number;
  toPoint: number;
  pointPair: string; // e.g. "1–2"
  fullDescription: string; // e.g. "Point 1 → Point 2"
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
    const dx = (lng - cLng) * metersPerDegLng;
    const dy = (lat - cLat) * metersPerDegLat;

    const rotX = dx * cosA - dy * sinA;
    const rotY = dx * sinA + dy * cosA;

    const newLat = cLat + rotY / metersPerDegLat;
    const newLng = cLng + rotX / metersPerDegLng;
    return [newLat, newLng];
  });
}

// Map Controller component to handle programmatically zooming or click repositioning
function MapController({
  onMapClick,
  setMapInstance,
}: {
  onMapClick?: (latlng: [number, number]) => void;
  setMapInstance: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    setMapInstance(map);
  }, [map, setMapInstance]);

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

  // Question 1: Total Lot Area (m²)
  const initialAreaValue = lotAreaEntered && Number(lotAreaEntered) > 0 ? String(lotAreaEntered) : '350';
  const [lotAreaInput, setLotAreaInput] = useState<string>(initialAreaValue);

  // Question 2: Number of Sides (default: 4 sides)
  const [sidesCount, setSidesCount] = useState<number>(4);

  // Question 3: Are side lengths available from technical description or survey?
  const [inputMode, setInputMode] = useState<'area_auto' | 'survey_measurements'>('area_auto');

  // Question 4: Expected shape: Rectangle, Square, or Irregular Polygon
  const [shapeType, setShapeType] = useState<LotShapeType>('rectangle');

  // Rectangle dimension controls: default for 350 m² -> 20m length x 17.5m width
  const [rectLength, setRectLength] = useState<string>('20');
  const [rectWidth, setRectWidth] = useState<string>('17.5');

  // Consecutive point pairs side inputs: [ 1-2, 2-3, 3-4, 4-1 ... ]
  const [sideInputs, setSideInputs] = useState<string[]>(['20', '17.5', '20', '17.5']);

  // Active Polygon Vertices [ [lat, lng], ... ]
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [history, setHistory] = useState<[number, number][][]>([]);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'auto' | 'tools' | 'measurements'>('auto');
  const [activeSideIndex, setActiveSideIndex] = useState<number | null>(null);
  const [moveMode, setMoveMode] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [adjustmentNotice, setAdjustmentNotice] = useState<string>('');

  const officialAreaNum = useMemo(() => {
    return Number(lotAreaEntered) || parseFloat(lotAreaInput) || 0;
  }, [lotAreaEntered, lotAreaInput]);

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

  // Synchronize area and dimensions when user changes total lot area
  const handleAreaChange = (val: string) => {
    setLotAreaInput(val);
    const area = parseFloat(val);
    if (!isNaN(area) && area > 0) {
      if (shapeType === 'rectangle') {
        // Reasonable starting rectangle: length = 20 (or proportional), width = area / length
        let l = 20;
        if (area < 100) l = Math.round(Math.sqrt(area * 1.5) * 10) / 10;
        else if (area > 1000) l = Math.round(Math.sqrt(area * 1.5) * 10) / 10;
        const w = Math.round((area / l) * 100) / 100;
        setRectLength(String(l));
        setRectWidth(String(w));
        setSideInputs([String(l), String(w), String(l), String(w)]);
      } else if (shapeType === 'square') {
        const side = Math.round(Math.sqrt(area) * 100) / 100;
        setSideInputs([String(side), String(side), String(side), String(side)]);
      }
    }
  };

  // Synchronize shape type
  const handleShapeTypeChange = (newShape: LotShapeType) => {
    setShapeType(newShape);
    const area = parseFloat(lotAreaInput) || 350;

    if (newShape === 'rectangle') {
      const l = parseFloat(rectLength) || 20;
      const w = Math.round((area / l) * 100) / 100;
      setRectWidth(String(w));
      setSideInputs([String(l), String(w), String(l), String(w)]);
    } else if (newShape === 'square') {
      const side = Math.round(Math.sqrt(area) * 100) / 100;
      setSideInputs([String(side), String(side), String(side), String(side)]);
    }
  };

  // Synchronize rectangle length/width with automatic adjustment
  const handleRectangleChange = (l: string, w: string, editedSide?: 'length' | 'width') => {
    const officialArea = officialAreaNum;

    if (editedSide && officialArea > 0) {
      try {
        const val = editedSide === 'length' ? parseFloat(l) : parseFloat(w);
        if (!isNaN(val) && val > 0) {
          const sideIndex = editedSide === 'length' ? 0 : 1;
          const adjusted = adjustFourSidedDimensions(sideIndex, val, officialArea);
          setRectLength(String(adjusted.length));
          setRectWidth(String(adjusted.width));
          setSideInputs([
            String(adjusted.length),
            String(adjusted.width),
            String(adjusted.length),
            String(adjusted.width),
          ]);
          setAdjustmentNotice(adjusted.message);
          return;
        }
      } catch (err: any) {
        setAdjustmentNotice(err.message);
      }
    }

    setRectLength(l);
    setRectWidth(w);
    setSideInputs([l, w, l, w]);
  };

  // Synchronize number of sides
  const handleSidesCountChange = (count: number) => {
    setSidesCount(count);
    if (count !== 4 && shapeType !== 'irregular') {
      setShapeType('irregular');
    }
    setSideInputs(prev => {
      const next = [...prev];
      while (next.length < count) {
        next.push('15');
      }
      return next.slice(0, count);
    });
  };

  // Validate measurements continuously
  useEffect(() => {
    const parsed = sideInputs.map(s => Number(s) || 0);
    const statedArea = parseFloat(lotAreaInput) || undefined;
    const result = validateMeasurements({
      sidesCount,
      sideLengths: parsed,
      shapeType,
      statedArea,
    });
    setValidationWarnings(result.warnings);
  }, [sideInputs, sidesCount, shapeType, lotAreaInput]);

  // Generate polygon boundary on the map
  const handleGenerateBoundary = (customCenter?: [number, number]) => {
    setErrorMsg('');
    const parsed = sideInputs.slice(0, sidesCount).map(s => Number(s) || 0);
    const statedArea = parseFloat(lotAreaInput) || undefined;

    // Run geometric validation
    const validation = validateMeasurements({
      sidesCount,
      sideLengths: parsed,
      shapeType,
      statedArea,
    });

    if (validation.errors.length > 0) {
      setErrorMsg(validation.errors[0]);
      return;
    }

    setValidationWarnings(validation.warnings);

    let localPts: [number, number][] = [];

    if (sidesCount === 4) {
      if (shapeType === 'rectangle' && validation.isRectangle) {
        localPts = constructRectangle(parsed[0], parsed[1]);
      } else if (shapeType === 'square' && validation.isSquare) {
        localPts = constructSquare(parsed[0]);
      } else {
        // Construct irregular quadrilateral preserving exact measured side lengths
        localPts = constructQuadrilateral(parsed[0], parsed[1], parsed[2], parsed[3]);
      }
    } else {
      localPts = constructInitialPolygonLocal(parsed);
    }

    if (!localPts.length) {
      setErrorMsg('Unable to construct closed polygon with entered measurements.');
      return;
    }

    // Check self-intersection on generated geometry
    const selfCheck = detectSelfIntersection(localPts);
    if (selfCheck.hasIntersection) {
      setErrorMsg(`The polygon contains intersecting boundary lines between segment ${selfCheck.seg1} and ${selfCheck.seg2}.`);
      return;
    }

    // Determine placement center
    let center: [number, number] = LAGONGLONG_CENTER;
    if (customCenter) {
      center = customCenter;
    } else if (centerOverride) {
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

  // Nudge entire boundary in meters
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

  // Center polygon at clicked map position
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

  // Calculate live measurements and validate self-intersections
  const liveStats = useMemo(() => {
    if (vertices.length < 3) {
      return {
        areaSqm: 0,
        perimeterM: 0,
        sides: [] as SideMeasurement[],
        isValid: false,
        closedCoordinates: [] as [number, number][],
        selfIntersection: { hasIntersection: false },
      };
    }

    const ring = [...vertices, vertices[0]];
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

    // Check self-intersection
    const selfIntersection = detectSelfIntersection(vertices);

    // Side lengths derived from live geometry with 1–2 point pair notation
    const sides: SideMeasurement[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const p1 = turf.point([vertices[i][1], vertices[i][0]]);
      const nextIdx = (i + 1) % vertices.length;
      const p2 = turf.point([vertices[nextIdx][1], vertices[nextIdx][0]]);
      const derivedLen = Math.round(turf.distance(p1, p2, { units: 'meters' }) * 100) / 100;
      const enteredLen = Number(sideInputs[i]) || derivedLen;
      const diff = Math.round((derivedLen - enteredLen) * 100) / 100;
      const pair = formatPointPair(i, vertices.length, enteredLen);

      sides.push({
        side: i + 1,
        fromPoint: pair.from,
        toPoint: pair.to,
        pointPair: pair.label,
        fullDescription: `${pair.fullText} = ${derivedLen.toFixed(2)} meters`,
        entered: enteredLen,
        derived: derivedLen,
        diff,
      });
    }

    return {
      areaSqm,
      perimeterM,
      sides,
      isValid: areaSqm > 0 && !selfIntersection.hasIntersection,
      closedCoordinates: ring,
      selfIntersection,
    };
  }, [vertices, sideInputs]);

  // Handle final confirmation
  const handleConfirm = () => {
    if (vertices.length < 3 || liveStats.areaSqm <= 0) {
      setErrorMsg('Please generate or draw a valid polygon boundary first.');
      return;
    }

    if (liveStats.selfIntersection.hasIntersection) {
      setErrorMsg('Cannot confirm boundary: The polygon contains intersecting boundary lines.');
      return;
    }

    if (officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05) {
      setErrorMsg(`Cannot confirm boundary: Mapped survey area (${liveStats.areaSqm.toFixed(2)} m²) exceeds the recorded official property area (${officialAreaNum.toFixed(2)} m²). Mapped area must not exceed official area.`);
      return;
    }

    const turfCoords = [...vertices, vertices[0]].map(([lat, lng]) => [lng, lat]);
    const geoJsonFeature = turf.polygon([turfCoords]);

    const validation = validateGISBoundary(geoJsonFeature, officialAreaNum > 0 ? officialAreaNum : undefined);
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'Boundary validation failed.');
      return;
    }

    setIsConfirmed(true);
    onConfirmBoundary(geoJsonFeature, liveStats.areaSqm, liveStats.perimeterM, liveStats.sides);
  };

  const centroid = useMemo(() => computeCentroid(vertices), [vertices]);

  return (
    <div className="flex flex-col h-[82vh] min-h-[600px] w-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 animate-fade-in text-gray-900 dark:text-gray-100">
      {/* Top Header */}
      <div className="px-5 py-3 bg-gray-50/95 dark:bg-gray-850/95 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md">
            <Ruler size={19} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Cadastral Lot Boundary Drawing & Survey Placement: {targetTitle}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                {propertyType} Accurate GIS
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Numbered corner points (1–2, 2–3), area calculations, and high-contrast survey plotting.
            </p>
          </div>
        </div>

        {/* View Switcher & Close */}
        <div className="flex items-center gap-2">
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
              <span>🛰️ Satellite</span>
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
              <span>🗺️ Street</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition cursor-pointer"
            title="Close boundary drawing tool"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Container: Sidebar + Map */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Control Panel */}
        <div className="w-full md:w-[410px] flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/60 overflow-y-auto shrink-0 custom-scrollbar text-xs">
          {/* Sub-Tabs */}
          <div className="grid grid-cols-3 border-b border-gray-200 dark:border-gray-800 p-2 gap-1 bg-white/60 dark:bg-gray-850/60">
            <button
              type="button"
              onClick={() => setActiveTab('auto')}
              className={`py-2 px-1.5 rounded-lg font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                activeTab === 'auto'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Shapes size={15} />
              <span>1. Lot & Sides</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tools')}
              className={`py-2 px-1.5 rounded-lg font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
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
              className={`py-2 px-1.5 rounded-lg font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                activeTab === 'measurements'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <CheckCircle2 size={15} />
              <span>3. Technical Review</span>
            </button>
          </div>

          {/* TAB 1: LOT AREA, SIDES & NUMBERED CORNER POINTS */}
          {activeTab === 'auto' && (
            <div className="p-4 space-y-4">
              {/* Question 1: Total Lot Area */}
              <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-1.5">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  1. What is the total lot area?
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={lotAreaInput}
                      onChange={e => handleAreaChange(e.target.value)}
                      placeholder="e.g. 350"
                      className="w-full pl-3 pr-10 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-mono font-bold text-gray-900 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">m²</span>
                  </div>
                </div>
              </div>

              {/* Question 2: How many sides does the property have? */}
              <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  2. How many sides or boundary segments does the property have?
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
                          : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-emerald-400'
                      }`}
                    >
                      {num} Sides {num === 4 ? '(Quad)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 3: Shape selection (Rectangle, Square, or Irregular Polygon) */}
              {sidesCount === 4 && (
                <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                  <label className="block font-bold text-gray-700 dark:text-gray-300">
                    3. Expected geometric shape
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleShapeTypeChange('rectangle')}
                      className={`py-1.5 px-1 rounded-lg font-bold text-[11px] border transition cursor-pointer text-center ${
                        shapeType === 'rectangle'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400'
                          : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      🔲 Rectangle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShapeTypeChange('square')}
                      className={`py-1.5 px-1 rounded-lg font-bold text-[11px] border transition cursor-pointer text-center ${
                        shapeType === 'square'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400'
                          : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      ⏹️ Square
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShapeTypeChange('irregular')}
                      className={`py-1.5 px-1 rounded-lg font-bold text-[11px] border transition cursor-pointer text-center ${
                        shapeType === 'irregular'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400'
                          : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      📐 Irregular
                    </button>
                  </div>
                </div>
              )}

              {/* Question 4: Are side lengths available from technical description or blueprint? */}
              <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    4. Technical description measurements
                  </label>
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setInputMode('area_auto')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        inputMode === 'area_auto'
                          ? 'bg-emerald-600 text-white'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      Auto from Area
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('survey_measurements')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        inputMode === 'survey_measurements'
                          ? 'bg-emerald-600 text-white'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      Enter Distances
                    </button>
                  </div>
                </div>

                {/* Sub-mode: Rectangle dimensions */}
                {inputMode === 'area_auto' && shapeType === 'rectangle' && sidesCount === 4 && (
                  <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-gray-500 dark:text-gray-400 block mb-1">
                          Length: <strong>Point 1–2 & 3–4</strong>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={rectLength}
                          onChange={e => handleRectangleChange(e.target.value, rectWidth, 'length')}
                          className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-mono font-bold text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 dark:text-gray-400 block mb-1">
                          Width: <strong>Point 2–3 & 4–1</strong>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={rectWidth}
                          onChange={e => handleRectangleChange(rectLength, e.target.value, 'width')}
                          className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-mono font-bold text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Area = {rectLength} m × {rectWidth} m = {(Number(rectLength) * Number(rectWidth)).toFixed(2)} m²
                    </p>
                    {adjustmentNotice && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-800 dark:text-blue-300 text-[11px] flex items-start gap-1.5">
                        <CheckCircle2 size={13} className="shrink-0 mt-0.5 text-blue-600" />
                        <span>{adjustmentNotice}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-mode: Numbered Point Pair Distance Inputs (Point 1 → Point 2, Point 2 → Point 3, etc.) */}
                {(inputMode === 'survey_measurements' || shapeType === 'irregular' || sidesCount !== 4) && (
                  <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <span className="font-bold text-gray-700 dark:text-gray-300 block text-[11px]">
                      Boundary Distances by Consecutive Numbered Points:
                    </span>
                    <div className="space-y-2">
                      {Array.from({ length: sidesCount }).map((_, idx) => {
                        const pair = formatPointPair(idx, sidesCount);
                        const val = sideInputs[idx] || '15';
                        return (
                          <div
                            key={idx}
                            onMouseEnter={() => setActiveSideIndex(idx)}
                            onMouseLeave={() => setActiveSideIndex(null)}
                            className={`p-2 rounded-lg border transition ${
                              activeSideIndex === idx
                                ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-400'
                                : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                                  {pair.from}
                                </span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                  {pair.fullText} ({pair.label})
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.1"
                                  value={val}
                                  onFocus={() => setActiveSideIndex(idx)}
                                  onBlur={() => setActiveSideIndex(null)}
                                  onChange={e => {
                                    const next = [...sideInputs];
                                    next[idx] = e.target.value;
                                    setSideInputs(next);
                                  }}
                                  className="w-24 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md font-mono font-bold text-right text-gray-900 dark:text-white"
                                />
                                <span className="text-gray-400 font-bold">m</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Validation Warnings (e.g. Not an exact rectangle, area mismatch) */}
              {validationWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                    <span>Survey Validation Notice</span>
                  </div>
                  {validationWarnings.map((warn, i) => (
                    <p key={i} className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                      • {warn}
                    </p>
                  ))}
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-2">
                  <ShieldAlert size={16} className="shrink-0 text-rose-500" />
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

              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                <strong>Preliminary Visualization:</strong> Automatically generated dimensions are an initial layout and must be verified against the property's actual technical description or survey.
              </div>
            </div>
          )}

          {/* TAB 2: POSITION & ROTATE CONTROLS */}
          {activeTab === 'tools' && (
            <div className="p-4 space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Move size={14} />
                  Positioning Workflow
                </span>
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed font-medium">
                  Position the boundary over the correct lot, adjust its orientation, verify the measurements, and confirm.
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
                  <Move size={14} className="text-blue-600" /> Nudge Position (Preserves Geometry)
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
                  <Pencil size={13} className="text-emerald-500" /> Numbered Corner Vertex Dragging
                </span>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Drag any circular corner marker (1, 2, 3, 4) on the map to adjust specific lot corners. All connected boundary lines stay attached to their endpoints.
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

          {/* TAB 3: MEASUREMENTS & TECHNICAL DESCRIPTION */}
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
                  {lotAreaInput && Number(lotAreaInput) > 0 && (
                    <div className="text-[10px] text-gray-500 mt-1 border-t border-gray-100 dark:border-gray-700 pt-1">
                      Recorded Area: <strong>{Number(lotAreaInput).toFixed(2)} m²</strong>
                      <span
                        className={`block font-bold ${
                          Math.abs(liveStats.areaSqm - Number(lotAreaInput)) < 1 ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        Δ {(liveStats.areaSqm - Number(lotAreaInput)).toFixed(2)} m²
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
                    Corners: <strong>{vertices.length} numbered points</strong>
                  </div>
                </div>
              </div>

              {/* Technical Description Format Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-3 py-2 bg-gray-100/70 dark:bg-gray-750 font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                  <span>Technical Description (Survey Format)</span>
                  <span className="text-[10px] text-gray-500 font-mono">Meters</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-56 overflow-y-auto custom-scrollbar">
                  {liveStats.sides.map((s, idx) => {
                    const hasDiff = Math.abs(s.diff) > 0.1;
                    return (
                      <div
                        key={s.side}
                        onMouseEnter={() => setActiveSideIndex(idx)}
                        onMouseLeave={() => setActiveSideIndex(null)}
                        className={`px-3 py-2.5 flex items-center justify-between text-[11px] transition cursor-pointer ${
                          activeSideIndex === idx
                            ? 'bg-amber-100/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-[10px]">
                            {s.pointPair}
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            Point {s.fromPoint} → Point {s.toPoint}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-gray-900 dark:text-white">
                            = {s.derived.toFixed(2)} meters
                          </span>
                          {hasDiff && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
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

              {/* Self-intersection Warning */}
              {liveStats.selfIntersection.hasIntersection && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-[11px] space-y-1">
                  <strong>Boundary Error:</strong> The polygon contains intersecting boundary lines between segment {liveStats.selfIntersection.seg1} and {liveStats.selfIntersection.seg2}. Please adjust corners to remove the crossing lines.
                </div>
              )}
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-850/80 space-y-2">
            {officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05 && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                <span>
                  <strong>Area Limit Exceeded:</strong> Mapped survey area ({liveStats.areaSqm.toFixed(2)} m²) exceeds the recorded official property area ({officialAreaNum.toFixed(2)} m²) by {(liveStats.areaSqm - officialAreaNum).toFixed(2)} m². Boundary cannot be saved until adjusted to not exceed {officialAreaNum.toFixed(2)} m².
                </span>
              </div>
            )}
            <button
              type="button"
              id="confirm-boundary-btn"
              onClick={handleConfirm}
              disabled={vertices.length < 3 || liveStats.areaSqm <= 0 || liveStats.selfIntersection.hasIntersection || (officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05)}
              className={`w-full py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                liveStats.selfIntersection.hasIntersection || (officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05)
                  ? 'bg-gray-400 text-white cursor-not-allowed opacity-60'
                  : isConfirmed
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <CheckCircle2 size={16} />
              {liveStats.selfIntersection.hasIntersection
                ? 'Cannot Confirm (Intersecting Lines)'
                : (officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05)
                ? 'Cannot Confirm (Exceeds Official Area)'
                : isConfirmed
                ? 'Boundary Confirmed ✓'
                : 'Confirm Boundary & Save Coordinates'}
            </button>
            <p className="text-[10px] text-center text-gray-500">
              Technical survey measurements and corner coordinates are preserved in the property record.
            </p>
          </div>
        </div>

        {/* Right Map Canvas Area */}
        <div className="flex-1 relative h-full min-h-[440px]">
          {/* Overlay Status HUD Badge */}
          <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="bg-white/95 dark:bg-gray-850/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-xs flex items-center gap-2 pointer-events-auto">
              <span className={`w-2.5 h-2.5 rounded-full ${
                liveStats.selfIntersection.hasIntersection || (officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05)
                  ? 'bg-rose-500 animate-ping'
                  : 'bg-emerald-500 animate-pulse'
              }`} />
              {officialAreaNum > 0 && (
                <>
                  <span className="text-gray-500 dark:text-gray-400">Official: <strong>{officialAreaNum.toFixed(2)} m²</strong></span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                </>
              )}
              <span className={`font-bold ${
                officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05
                  ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                  : 'text-gray-800 dark:text-gray-200'
              }`}>
                Mapped: {liveStats.areaSqm > 0 ? `${liveStats.areaSqm.toFixed(2)} m²` : '0 m²'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 dark:text-gray-300 font-mono">
                {liveStats.perimeterM > 0 ? `${liveStats.perimeterM.toFixed(2)} m perim` : 'Lagonglong'}
              </span>
            </div>

            {officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05 && (
              <span className="bg-rose-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-lg flex items-center gap-1.5 pointer-events-auto">
                <AlertTriangle size={14} /> Exceeds Official Area (+{(liveStats.areaSqm - officialAreaNum).toFixed(2)} m²)
              </span>
            )}

            {liveStats.selfIntersection.hasIntersection && (
              <span className="bg-rose-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-lg flex items-center gap-1.5 pointer-events-auto">
                <AlertTriangle size={14} /> Intersecting Lines Detected
              </span>
            )}

            {isConfirmed && !liveStats.selfIntersection.hasIntersection && !(officialAreaNum > 0 && liveStats.areaSqm > officialAreaNum + 0.05) && (
              <span className="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-lg flex items-center gap-1.5 pointer-events-auto">
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
                {/* 1. Base High-Contrast Dark Halo Outline */}
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
                    color: liveStats.selfIntersection.hasIntersection
                      ? '#ef4444'
                      : isConfirmed
                      ? '#10b981'
                      : '#06b6d4',
                    weight: 3.5,
                    dashArray: isConfirmed ? undefined : '5, 5',
                    fillColor: liveStats.selfIntersection.hasIntersection
                      ? '#ef4444'
                      : isConfirmed
                      ? '#10b981'
                      : '#06b6d4',
                    fillOpacity: 0.25,
                  }}
                />

                {/* 3. Highlighted Active Side Segment */}
                {activeSideIndex !== null && vertices[activeSideIndex] && (
                  <>
                    <Polyline
                      positions={[
                        vertices[activeSideIndex],
                        vertices[(activeSideIndex + 1) % vertices.length],
                      ]}
                      pathOptions={{
                        color: '#ffffff',
                        weight: 8,
                        opacity: 0.95,
                        interactive: false,
                      }}
                    />
                    <Polyline
                      positions={[
                        vertices[activeSideIndex],
                        vertices[(activeSideIndex + 1) % vertices.length],
                      ]}
                      pathOptions={{
                        color: '#f59e0b',
                        weight: 5,
                        opacity: 1,
                        interactive: false,
                      }}
                    />
                  </>
                )}

                {/* 4. Numbered Corner Vertex Markers (Point 1, Point 2, Point 3, Point 4) */}
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
                          width: 26px; 
                          height: 26px; 
                          border-radius: 50%; 
                          background: linear-gradient(135deg, ${
                            liveStats.selfIntersection.hasIntersection
                              ? '#dc2626, #ef4444'
                              : isConfirmed
                              ? '#059669, #10b981'
                              : '#0284c7, #38bdf8'
                          }); 
                          color: #ffffff; 
                          border: 2.5px solid #ffffff; 
                          box-shadow: 0 3px 8px rgba(0,0,0,0.6); 
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
                      iconSize: [26, 26],
                      iconAnchor: [13, 13],
                    })}
                  >
                    <Tooltip direction="top" offset={[0, -13]}>
                      Point {idx + 1} (Corner {idx + 1}) — Drag to adjust boundary
                    </Tooltip>
                  </Marker>
                ))}

                {/* 5. Consecutive Side-Length Labels: 1–2, 2–3, 3–4, 4–1 (Outward Perpendicular Offset) */}
                {liveStats.sides.map((sideItem, i) => {
                  const p1 = vertices[i];
                  const p2 = vertices[(i + 1) % vertices.length];
                  if (!p1 || !p2) return null;

                  const midLat = (p1[0] + p2[0]) / 2;
                  const midLng = (p1[1] + p2[1]) / 2;

                  const metersPerDegLat = 111139;
                  const metersPerDegLng = 111139 * Math.cos((midLat * Math.PI) / 180);
                  const dx = (p2[1] - p1[1]) * metersPerDegLng;
                  const dy = (p2[0] - p1[0]) * metersPerDegLat;
                  const segLen = Math.sqrt(dx * dx + dy * dy);

                  let labelLat = midLat;
                  let labelLng = midLng;

                  if (segLen > 0) {
                    let nx = -dy / segLen;
                    let ny = dx / segLen;

                    const cdx = (midLng - centroid[1]) * metersPerDegLng;
                    const cdy = (midLat - centroid[0]) * metersPerDegLat;

                    if (cdx * nx + cdy * ny < 0) {
                      nx = -nx;
                      ny = -ny;
                    }

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
                            background-color: ${isActive ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.92)'};
                            color: #ffffff;
                            border: 1.5px solid ${isActive ? '#f59e0b' : '#38bdf8'};
                            border-radius: 6px;
                            padding: 2.5px 7px;
                            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                            font-size: 11px;
                            font-weight: 700;
                            box-shadow: 0 3px 8px rgba(0,0,0,0.55);
                            white-space: nowrap;
                            pointer-events: none;
                            transform: translate(-50%, -50%);
                          ">
                            <span style="color: ${isActive ? '#fbbf24' : '#38bdf8'}; font-weight: 800;">${sideItem.pointPair}:</span>
                            <span>${sideItem.derived.toFixed(2)} m</span>
                          </div>
                        `,
                        iconSize: [85, 24],
                        iconAnchor: [42, 12],
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
