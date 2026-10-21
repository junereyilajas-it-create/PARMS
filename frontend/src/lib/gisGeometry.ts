/**
 * Accurate GIS Geometry and Technical Survey Calculation Engine for PARMS
 * Handles polygon construction, numbered corner points (1–2, 2–3, etc.),
 * rectangular / square / irregular lot generation from total area or side measurements,
 * Shoelace area calculation, and robust self-intersection detection.
 */

export type LotShapeType = 'rectangle' | 'square' | 'irregular';

export interface PointPairInfo {
  index: number;
  from: number;
  to: number;
  label: string; // e.g. "1–2"
  fullText: string; // e.g. "Point 1 → Point 2"
  distance: number;
}

export interface GeometryValidationResult {
  isValid: boolean;
  isRectangle: boolean;
  isSquare: boolean;
  hasSelfIntersection: boolean;
  intersectingSegments?: [string, string];
  warnings: string[];
  errors: string[];
  calculatedArea: number;
  perimeter: number;
}

/**
 * Returns formatted labels for consecutive point pairs.
 * E.g., index 0 of 4 sides returns: { from: 1, to: 2, label: "1–2", fullText: "Point 1 → Point 2" }
 * index 3 of 4 sides returns: { from: 4, to: 1, label: "4–1", fullText: "Point 4 → Point 1" }
 */
export function formatPointPair(index: number, totalSides: number, distance: number = 0): PointPairInfo {
  const from = index + 1;
  const to = ((index + 1) % totalSides) + 1;
  return {
    index,
    from,
    to,
    label: `${from}–${to}`,
    fullText: `Point ${from} → Point ${to}`,
    distance,
  };
}

/**
 * Calculates polygon area in square meters using the 2D Shoelace formula
 */
export function calculateShoelaceArea(pts: [number, number][]): number {
  const n = pts.length;
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n];
    a += pts[i][0] * next[1] - next[0] * pts[i][1];
  }
  return Math.round((Math.abs(a) / 2) * 100) / 100;
}

/**
 * Calculates polygon perimeter by summing Euclidean distances between consecutive vertices
 */
export function calculatePerimeter(pts: [number, number][]): number {
  const n = pts.length;
  if (n < 2) return 0;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n];
    p += Math.hypot(next[0] - pts[i][0], next[1] - pts[i][1]);
  }
  return Math.round(p * 100) / 100;
}

/**
 * Tests counter-clockwise orientation for 3 points
 */
function ccw(p1: [number, number], p2: [number, number], p3: [number, number]): boolean {
  return (p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
}

/**
 * Tests whether line segment p1-p2 intersects line segment p3-p4
 */
export function segmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const minX1 = Math.min(p1[0], p2[0]), maxX1 = Math.max(p1[0], p2[0]);
  const minY1 = Math.min(p1[1], p2[1]), maxY1 = Math.max(p1[1], p2[1]);
  const minX2 = Math.min(p3[0], p4[0]), maxX2 = Math.max(p3[0], p4[0]);
  const minY2 = Math.min(p3[1], p4[1]), maxY2 = Math.max(p3[1], p4[1]);

  // Bounding box collision check
  if (maxX1 < minX2 || maxX2 < minX1 || maxY1 < minY2 || maxY2 < minY1) return false;

  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * Checks if a polygon contains any self-intersecting boundary lines (bow-tie polygon)
 */
export function detectSelfIntersection(pts: [number, number][]): {
  hasIntersection: boolean;
  seg1?: string;
  seg2?: string;
} {
  const n = pts.length;
  if (n < 4) return { hasIntersection: false };

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Exclude adjacent segments sharing a corner vertex
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const p3 = pts[j];
      const p4 = pts[(j + 1) % n];

      if (segmentsIntersect(p1, p2, p3, p4)) {
        const seg1 = `${i + 1}–${((i + 1) % n) + 1}`;
        const seg2 = `${j + 1}–${((j + 1) % n) + 1}`;
        return { hasIntersection: true, seg1, seg2 };
      }
    }
  }

  return { hasIntersection: false };
}

/**
 * Constructs a strict rectangle with corner vertices 1, 2, 3, 4
 * Point 1 -> Point 2 = Length (1-2)
 * Point 2 -> Point 3 = Width (2-3)
 * Point 3 -> Point 4 = Length (3-4)
 * Point 4 -> Point 1 = Width (4-1)
 */
export function constructRectangle(length: number, width: number): [number, number][] {
  const l = Math.max(0.1, length);
  const w = Math.max(0.1, width);
  return [
    [0, 0], // Point 1
    [l, 0], // Point 2 (1-2 = length)
    [l, w], // Point 3 (2-3 = width)
    [0, w], // Point 4 (3-4 = length, 4-1 = width)
  ];
}

/**
 * Constructs a strict square with side length s
 */
export function constructSquare(side: number): [number, number][] {
  const s = Math.max(0.1, side);
  return constructRectangle(s, s);
}

/**
 * Constructs a valid convex quadrilateral from 4 consecutive measured side lengths
 * s0 = Point 1–2
 * s1 = Point 2–3
 * s2 = Point 3–4
 * s3 = Point 4–1
 * Prioritizes actual survey measurements without forcing into a rectangle.
 */
export function constructQuadrilateral(
  s0: number,
  s1: number,
  s2: number,
  s3: number
): [number, number][] {
  // Check quadrilateral polygon feasibility: no single side >= sum of other three sides
  const sum = s0 + s1 + s2 + s3;
  if (s0 >= sum - s0 || s1 >= sum - s1 || s2 >= sum - s2 || s3 >= sum - s3) {
    return [];
  }

  // Desired diagonal from p1 to p3
  const d0 = Math.hypot(s0, s1);
  const minD = Math.abs(s2 - s3) + 0.05;
  const maxD = (s2 + s3) - 0.05;
  const d = Math.max(minD, Math.min(maxD, d0));

  // Law of cosines for angle at p2
  const cosBeta = Math.max(-0.999, Math.min(0.999, (s0 * s0 + s1 * s1 - d * d) / (2 * s0 * s1)));
  const sinBeta = Math.sqrt(Math.max(0, 1 - cosBeta * cosBeta));

  const p1: [number, number] = [0, 0];
  const p2: [number, number] = [s0, 0];
  const p3: [number, number] = [s0 - s1 * cosBeta, s1 * sinBeta];

  // Circle-circle intersection to find p4 such that dist(p1, p4) = s3 and dist(p3, p4) = s2
  const dx = p3[0] - p1[0];
  const dy = p3[1] - p1[1];
  const dist = Math.hypot(dx, dy);

  if (dist === 0) return [];

  const a = (s3 * s3 - s2 * s2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, s3 * s3 - a * a));
  const xm = p1[0] + (a * dx) / dist;
  const ym = p1[1] + (a * dy) / dist;

  // Two intersection candidates:
  const candA: [number, number] = [xm - (h * dy) / dist, ym + (h * dx) / dist];
  const candB: [number, number] = [xm + (h * dy) / dist, ym - (h * dx) / dist];

  const polyA: [number, number][] = [p1, p2, p3, candA];
  const polyB: [number, number][] = [p1, p2, p3, candB];

  const areaA = calculateShoelaceArea(polyA);
  const areaB = calculateShoelaceArea(polyB);

  // Return the non-self-intersecting candidate with positive area
  const selfA = detectSelfIntersection(polyA).hasIntersection;
  const selfB = detectSelfIntersection(polyB).hasIntersection;

  if (!selfA && areaA > 0) return polyA;
  if (!selfB && areaB > 0) return polyB;
  return areaA >= areaB ? polyA : polyB;
}

/**
 * Constructs an initial polygon in local coordinates (meters) for N sides
 */
export function constructInitialPolygonLocal(sides: number[]): [number, number][] {
  const n = sides.length;
  if (n < 3) return [];

  if (n === 3) {
    const a = sides[0], b = sides[1], c = sides[2];
    if (a + b <= c || a + c <= b || b + c <= a) {
      const r = (a + b + c) / (3 * Math.sqrt(3));
      return [
        [0, r],
        [r * Math.cos(Math.PI / 6), -r * Math.sin(Math.PI / 6)],
        [-r * Math.cos(Math.PI / 6), -r * Math.sin(Math.PI / 6)],
      ];
    }
    const cosA = (a * a + c * c - b * b) / (2 * a * c);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    return [[0, 0], [a, 0], [c * cosA, c * sinA]];
  }

  if (n === 4) {
    return constructQuadrilateral(sides[0], sides[1], sides[2], sides[3]);
  }

  // General N >= 5: proportional distribution on convex loop
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

/**
 * Validates measurements and checks shape geometry constraints.
 * E.g., checks if 4 sides form an exact rectangle or square, detects self-intersections,
 * and warns if calculated area differs from stated area.
 */
export function validateMeasurements(options: {
  sidesCount: number;
  sideLengths: number[];
  shapeType: LotShapeType;
  statedArea?: number;
}): GeometryValidationResult {
  const { sidesCount, sideLengths, shapeType, statedArea } = options;
  const warnings: string[] = [];
  const errors: string[] = [];

  const parsedSides = sideLengths.slice(0, sidesCount).map(s => Number(s) || 0);

  // Check positive lengths
  for (let i = 0; i < parsedSides.length; i++) {
    const pair = formatPointPair(i, sidesCount);
    if (parsedSides[i] <= 0) {
      errors.push(`Please enter a valid positive length for ${pair.fullText} (${pair.label}).`);
    }
  }

  // Check polygon feasibility: no single side >= sum of other sides
  const totalPerim = parsedSides.reduce((a, b) => a + b, 0);
  for (let i = 0; i < parsedSides.length; i++) {
    const pair = formatPointPair(i, sidesCount);
    if (parsedSides[i] >= totalPerim - parsedSides[i] && parsedSides[i] > 0) {
      errors.push(`${pair.fullText} (${pair.label} = ${parsedSides[i]}m) is too long to close a polygon with the other sides.`);
    }
  }

  let isRectangle = false;
  let isSquare = false;

  if (sidesCount === 4 && parsedSides.length === 4) {
    const s0 = parsedSides[0]; // 1-2
    const s1 = parsedSides[1]; // 2-3
    const s2 = parsedSides[2]; // 3-4
    const s3 = parsedSides[3]; // 4-1

    const diffOpposite1 = Math.abs(s0 - s2);
    const diffOpposite2 = Math.abs(s1 - s3);

    // Opposite sides must be equal within 0.05m tolerance
    if (diffOpposite1 <= 0.05 && diffOpposite2 <= 0.05) {
      isRectangle = true;
      if (Math.abs(s0 - s1) <= 0.05) {
        isSquare = true;
      }
    } else {
      if (shapeType === 'rectangle') {
        warnings.push('The entered side lengths do not form a rectangle.');
      } else if (shapeType === 'square') {
        warnings.push('The entered side lengths do not form a square (all four sides must be equal).');
      }
    }
  }

  // Construct polygon to check geometry and self-intersection
  let pts: [number, number][] = [];
  if (errors.length === 0) {
    if (shapeType === 'rectangle' && sidesCount === 4 && isRectangle) {
      pts = constructRectangle(parsedSides[0], parsedSides[1]);
    } else if (shapeType === 'square' && sidesCount === 4 && isSquare) {
      pts = constructSquare(parsedSides[0]);
    } else {
      pts = constructInitialPolygonLocal(parsedSides);
    }
  }

  const selfCheck = detectSelfIntersection(pts);
  if (selfCheck.hasIntersection) {
    errors.push('The polygon contains intersecting boundary lines.');
  }

  const calculatedArea = calculateShoelaceArea(pts);
  const perimeter = calculatePerimeter(pts);

  if (statedArea && statedArea > 0 && calculatedArea > 0) {
    const diff = Math.abs(calculatedArea - statedArea);
    if (diff > 1.5) {
      warnings.push(
        `Calculated area (${calculatedArea.toFixed(2)} m²) differs from the recorded property area (${statedArea.toFixed(2)} m²).`
      );
    }
  }

  const isValid = errors.length === 0 && pts.length >= 3 && calculatedArea > 0;

  return {
    isValid,
    isRectangle,
    isSquare,
    hasSelfIntersection: selfCheck.hasIntersection,
    intersectingSegments: selfCheck.hasIntersection ? [selfCheck.seg1!, selfCheck.seg2!] : undefined,
    warnings,
    errors,
    calculatedArea,
    perimeter,
  };
}
