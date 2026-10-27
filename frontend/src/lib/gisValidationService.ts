import * as turf from '@turf/turf';

export interface GISValidationOutput {
  isValid: boolean;
  error?: string;
  warning?: string;
  calculatedArea: number;
  perimeter: number;
  officialArea: number;
  difference: number;
  exceedsOfficialArea: boolean;
  hasSelfIntersection: boolean;
  normalizedCoordinates?: [number, number][];
}

/**
 * Normalizes input coordinates into a closed GeoJSON Polygon coordinate ring [[lng, lat], ...]
 */
export function normalizeCoordinates(coords: any): [number, number][] | null {
  if (!coords) return null;
  let parsed = coords;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (parsed.type === 'Feature' && parsed.geometry) {
    parsed = parsed.geometry.coordinates;
  } else if (parsed.type === 'Polygon' && parsed.coordinates) {
    parsed = parsed.coordinates;
  }

  let ring = Array.isArray(parsed[0]) && Array.isArray(parsed[0][0]) ? parsed[0] : parsed;
  if (!Array.isArray(ring) || ring.length < 3) return null;

  const sample = ring[0];
  let isLatLng = false;
  if (Array.isArray(sample) && sample.length === 2) {
    const [val0, val1] = sample;
    // Philippines latitude ~4-21, longitude ~116-127
    if (val0 >= 4 && val0 <= 21 && val1 >= 116 && val1 <= 127) {
      isLatLng = true;
    }
  }

  const normalizedRing: [number, number][] = ring.map((pt: any) => {
    if (isLatLng) {
      return [Number(pt[1]), Number(pt[0])]; // [lng, lat]
    }
    return [Number(pt[0]), Number(pt[1])];
  });

  // Ensure closed polygon
  const first = normalizedRing[0];
  const last = normalizedRing[normalizedRing.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalizedRing.push([first[0], first[1]]);
  }

  return normalizedRing;
}

/**
 * Calculates geodesic polygon area in square meters using Turf.js
 */
export function calculatePolygonAreaSqm(coords: any): number {
  const ring = normalizeCoordinates(coords);
  if (!ring || ring.length < 4) return 0;

  try {
    const poly = turf.polygon([ring]);
    const area = turf.area(poly);
    return Math.round(area * 100) / 100;
  } catch (err) {
    console.error('Error calculating turf polygon area:', err);
    return 0;
  }
}

/**
 * Calculates perimeter in meters using Turf.js
 */
export function calculatePolygonPerimeterM(coords: any): number {
  const ring = normalizeCoordinates(coords);
  if (!ring || ring.length < 4) return 0;

  try {
    const line = turf.lineString(ring);
    const len = turf.length(line, { units: 'meters' });
    return Math.round(len * 100) / 100;
  } catch {
    return 0;
  }
}

/**
 * Detects self-intersecting boundary lines
 */
export function detectSelfIntersection(coords: any): { hasIntersection: boolean; count?: number } {
  const ring = normalizeCoordinates(coords);
  if (!ring || ring.length < 4) return { hasIntersection: false };

  try {
    const poly = turf.polygon([ring]);
    const kinks = turf.kinks(poly);
    if (kinks.features && kinks.features.length > 0) {
      return {
        hasIntersection: true,
        count: kinks.features.length
      };
    }
  } catch {
    return { hasIntersection: true };
  }

  return { hasIntersection: false };
}

/**
 * Authoritative GIS Boundary Validation
 * Strict rule: Mapped survey area cannot exceed official property area
 */
export function validateGISBoundary(
  coordinates: any,
  officialArea?: number | string,
  options: { allowToleranceSqm?: number } = {}
): GISValidationOutput {
  const toleranceSqm = options.allowToleranceSqm !== undefined ? options.allowToleranceSqm : 0.20;
  const ring = normalizeCoordinates(coordinates);
  const officialNum = Number(officialArea) || 0;

  if (!ring || ring.length < 4) {
    return {
      isValid: false,
      error: 'A minimum of 3 boundary points is required to form a polygon.',
      calculatedArea: 0,
      perimeter: 0,
      officialArea: officialNum,
      difference: 0,
      exceedsOfficialArea: false,
      hasSelfIntersection: false
    };
  }

  const selfInter = detectSelfIntersection(ring);
  if (selfInter.hasIntersection) {
    return {
      isValid: false,
      error: 'The property boundary contains intersecting or crossing lines.',
      hasSelfIntersection: true,
      calculatedArea: 0,
      perimeter: 0,
      officialArea: officialNum,
      difference: 0,
      exceedsOfficialArea: false
    };
  }

  const calculatedArea = calculatePolygonAreaSqm(ring);
  const perimeter = calculatePolygonPerimeterM(ring);

  if (calculatedArea <= 0) {
    return {
      isValid: false,
      error: 'Calculated polygon area is 0 m².',
      calculatedArea: 0,
      perimeter,
      officialArea: officialNum,
      difference: 0,
      exceedsOfficialArea: false,
      hasSelfIntersection: false
    };
  }

  if (officialNum > 0) {
    const excess = calculatedArea - officialNum;
    if (excess > toleranceSqm) {
      return {
        isValid: false,
        error: `Survey area (${calculatedArea.toFixed(2)} m²) exceeds official property area (${officialNum.toFixed(2)} m²) by ${excess.toFixed(2)} m². Mapped survey area cannot exceed recorded official area.`,
        calculatedArea,
        perimeter,
        officialArea: officialNum,
        difference: Math.round(excess * 100) / 100,
        exceedsOfficialArea: true,
        hasSelfIntersection: false,
        normalizedCoordinates: ring
      };
    }
  }

  return {
    isValid: true,
    calculatedArea,
    perimeter,
    officialArea: officialNum,
    difference: officialNum > 0 ? Math.round((calculatedArea - officialNum) * 100) / 100 : 0,
    exceedsOfficialArea: false,
    hasSelfIntersection: false,
    normalizedCoordinates: ring
  };
}

/**
 * Automatically adjusts rectangle dimensions to maintain exact official area (Area = Length × Width)
 */
export function adjustFourSidedDimensions(sideIndex: number, newDimension: number, officialArea: number) {
  const official = Number(officialArea);
  const dim = Number(newDimension);

  if (!official || official <= 0) {
    throw new Error('Valid official property area is required for automatic adjustment.');
  }
  if (!dim || dim <= 0) {
    throw new Error('Side dimension must be greater than 0.');
  }

  const dependentDim = Math.round((official / dim) * 100) / 100;
  if (dependentDim <= 0 || !Number.isFinite(dependentDim)) {
    throw new Error('Requested dimension cannot produce a valid rectangular property.');
  }

  let length: number;
  let width: number;
  if (sideIndex === 0 || sideIndex === 2) {
    length = dim;
    width = dependentDim;
  } else {
    width = dim;
    length = dependentDim;
  }

  return {
    length,
    width,
    sideLengths: [length, width, length, width],
    calculatedArea: Math.round(length * width * 100) / 100,
    officialArea: official,
    message: `Dependent dimension automatically adjusted to ${dependentDim.toFixed(2)} m to maintain official area of ${official.toFixed(2)} m².`
  };
}
