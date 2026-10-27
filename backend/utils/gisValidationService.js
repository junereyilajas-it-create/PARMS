import * as turf from '@turf/turf';

/**
 * Normalizes coordinates into a closed GeoJSON Polygon coordinate ring [[lng, lat], ...]
 */
export function normalizeCoordinates(coords) {
  if (!coords) return null;
  let parsed = coords;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  // Handle Feature or Geometry objects
  if (parsed.type === 'Feature' && parsed.geometry) {
    parsed = parsed.geometry.coordinates;
  } else if (parsed.type === 'Polygon' && parsed.coordinates) {
    parsed = parsed.coordinates;
  }

  // Handle array of rings or single ring
  let ring = Array.isArray(parsed[0]) && Array.isArray(parsed[0][0]) ? parsed[0] : parsed;
  if (!Array.isArray(ring) || ring.length < 3) return null;

  // Ensure [lng, lat] coordinate format (Leaflet usually supplies [lat, lng])
  // If first point latitude is likely in Misamis Oriental (~8.8° N) and lng is (~124.8° E):
  const sample = ring[0];
  let isLatLng = false;
  if (sample.length === 2) {
    const [val0, val1] = sample;
    // Philippines latitude is around 4-21, longitude is around 116-127
    if (val0 >= 4 && val0 <= 21 && val1 >= 116 && val1 <= 127) {
      isLatLng = true;
    }
  }

  const normalizedRing = ring.map(pt => {
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
export function calculatePolygonAreaSqm(coords) {
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
export function calculatePolygonPerimeterM(coords) {
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
export function detectSelfIntersection(coords) {
  const ring = normalizeCoordinates(coords);
  if (!ring || ring.length < 4) return { hasIntersection: false };

  try {
    const poly = turf.polygon([ring]);
    const kinks = turf.kinks(poly);
    if (kinks.features && kinks.features.length > 0) {
      return {
        hasIntersection: true,
        count: kinks.features.length,
        points: kinks.features.map(f => f.geometry.coordinates)
      };
    }
  } catch {
    // If Turf throws on invalid polygon topology, consider it invalid
    return { hasIntersection: true, error: 'Invalid polygon topology' };
  }

  return { hasIntersection: false };
}

/**
 * Authoritative GIS Boundary Validation
 * Enforces:
 * 1. Valid closed geometry
 * 2. No self-intersections
 * 3. Actual calculated area must NOT exceed official recorded property area
 */
export function validateGISBoundary(coordinates, officialArea, options = {}) {
  const toleranceSqm = options.allowToleranceSqm !== undefined ? options.allowToleranceSqm : 0.20; // 0.20 sqm projection/curvature rounding tolerance
  const ring = normalizeCoordinates(coordinates);

  if (!ring || ring.length < 4) {
    return {
      isValid: false,
      error: 'Invalid polygon geometry: A minimum of 3 unique boundary coordinates is required.',
      calculatedArea: 0,
      perimeter: 0,
      officialArea: Number(officialArea) || 0
    };
  }

  const selfInter = detectSelfIntersection(ring);
  if (selfInter.hasIntersection) {
    return {
      isValid: false,
      error: 'Invalid property boundary: The polygon contains self-intersecting or overlapping lines.',
      hasSelfIntersection: true,
      calculatedArea: 0,
      perimeter: 0,
      officialArea: Number(officialArea) || 0
    };
  }

  const calculatedArea = calculatePolygonAreaSqm(ring);
  const perimeter = calculatePolygonPerimeterM(ring);
  const officialNum = Number(officialArea) || 0;

  if (calculatedArea <= 0) {
    return {
      isValid: false,
      error: 'Invalid property boundary: Calculated area is zero.',
      calculatedArea: 0,
      perimeter,
      officialArea: officialNum
    };
  }

  // Check official area constraint
  if (officialNum > 0) {
    const excess = calculatedArea - officialNum;
    if (excess > toleranceSqm) {
      return {
        isValid: false,
        error: `Strict Area Validation Failed: Mapped survey area (${calculatedArea.toFixed(2)} m²) exceeds official property area (${officialNum.toFixed(2)} m²) by ${excess.toFixed(2)} m². The GIS boundary must not exceed the recorded property area.`,
        calculatedArea,
        perimeter,
        officialArea: officialNum,
        difference: Math.round(excess * 100) / 100,
        exceedsOfficialArea: true
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
    normalizedCoordinates: ring
  };
}

/**
 * Automatically adjusts rectangle dimensions to maintain exact official area (Area = Length × Width)
 */
export function adjustFourSidedDimensions(sideIndex, newDimension, officialArea) {
  const official = Number(officialArea);
  const dim = Number(newDimension);

  if (!official || official <= 0) {
    throw new Error('Valid official property area is required for automatic adjustment.');
  }
  if (!dim || dim <= 0) {
    throw new Error('Side dimension must be a positive number greater than 0.');
  }

  // For rectangle: sideIndex 0 or 2 is Length, sideIndex 1 or 3 is Width
  const dependentDim = Math.round((official / dim) * 100) / 100;
  if (dependentDim <= 0 || !Number.isFinite(dependentDim)) {
    throw new Error('Requested dimension cannot produce a valid rectangular property.');
  }

  let length, width;
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
    message: `Adjusted dependent dimension to ${dependentDim.toFixed(2)} m to maintain official area of ${official.toFixed(2)} m².`
  };
}
