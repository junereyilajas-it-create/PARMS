import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import Tesseract from 'tesseract.js';
import { Jimp } from 'jimp';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const uploadDir = path.join(__dirname, '..', 'uploads', 'blueprints');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});

router.post('/scanner/upload', authenticate, allowRoles('staff', 'admin', 'super_admin'), upload.single('blueprint'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
  
  const conn = await pool.getConnection();
  try {
    const originalFilepath = `/uploads/blueprints/${req.file.filename}`;
    
    // Insert initial record
    const [result] = await conn.query(
      `INSERT INTO scanned_blueprints (uploaded_by_user_id, original_filename, stored_filepath, status) VALUES (?, ?, ?, 'processing')`,
      [req.user.id, req.file.originalname, originalFilepath]
    );
    const scanId = result.insertId;

    // Trigger async processing (don't block the request)
    processDocument(scanId, req.file.path).catch(err => console.error('Processing error:', err));
    
    await logActivity(conn, req, 'CREATE', 'Scanner', `Scan ${scanId}`, `Uploaded blueprint ${req.file.originalname}`);
    res.json({ message: 'File uploaded successfully. Processing started.', scan_id: scanId });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});

// Async processing function
async function processDocument(scanId, filepath) {
  const conn = await pool.getConnection();
  try {
    let processPath = filepath;
    let text = '';
    
    // Process image if it's an image
    if (filepath.match(/\.(jpg|jpeg|png)$/i)) {
      const keywords = ['MUNI', 'LOT', 'AREA', 'SURVEY', 'CAD', 'TECHNICAL', 'DESCRIPTION'];
      let bestText = '';
      let bestPath = filepath;
      let bestMatches = -1;

      for (const angle of [0, 90, 180, 270]) {
        try {
          const image = await Jimp.read(filepath);
          if (angle !== 0) image.rotate(angle);
          image.greyscale().contrast(0.2);
          
          const tempPath = filepath.replace(/(\.[\w\d_-]+)$/i, `_temp_${angle}$1`);
          await image.write(tempPath);
          
          const ocrResult = await Tesseract.recognize(tempPath, 'eng', { logger: m => {} });
          const ocrText = ocrResult.data.text;
          
          const uppercaseText = ocrText.toUpperCase();
          const matchCount = keywords.filter(k => uppercaseText.includes(k)).length;
          
          if (matchCount > bestMatches) {
            bestMatches = matchCount;
            bestText = ocrText;
            bestPath = tempPath;
          }
          
          if (matchCount >= 2) break; // Found it!
          
        } catch (e) {
          console.warn(`Error processing angle ${angle}:`, e.message);
        }
      }
      
      text = bestText;
      processPath = bestPath;
    } else if (filepath.match(/\.pdf$/i)) {
      // For PDFs, we would ideally use pdf2pic or pdf-parse, but that requires Ghostscript/Poppler.
      // We will extract what we can or rely on manual data entry since pure Tesseract can't natively read PDFs without rendering them to images first.
      text = "PDF_DETECTED_MANUAL_ENTRY_REQUIRED";
    }

    // Parse specific fields
    const extractField = (regex) => {
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    let owner = extractField(/Claimant\s*:\s*([A-Za-zñÑ .,'-]+)/i) || extractField(/Owner\s*:\s*([A-Za-zñÑ .,'-]+)/i) || extractField(/Surveyed for\s*:\s*([A-Za-zñÑ .,'-]+)/i);
    const lot_number = extractField(/LOT\s+(\d+[\w-]*)/i) || extractField(/Lot\s+No\.?\s+(\d+[\w-]*)/i);
    const cad_reference = extractField(/(CAD\s*\d+[\w-]*)/i) || extractField(/Cadastre\s+(\d+)/i) || extractField(/Cad\.?\s+(\d+)/i);
    const barangay = extractField(/BARRIO OF\s*:\s*([A-Za-zñÑ -]+)/i) || extractField(/Barangay\s*:\s*([A-Za-zñÑ -]+)/i);
    let municipality = extractField(/MUNI\/?\s*CITY OF\s*:\s*([A-Za-zñÑ -]+)/i) || extractField(/Municipality\s*:\s*([A-Za-zñÑ -]+)/i);
    let province = extractField(/PROVINCE OF\s*:\s*([A-Za-zñÑ -]+)/i);
    const statedAreaMatch = text.match(/area\s*(?:of|is|:)?\s*([\d,.]+)\s*(?:Sq|sq\.?\s*m\.?|m²|sqm)/i) || 
                            text.match(/lot\s*area\s*:\s*([\d,.]+)/i) ||
                            text.match(/([\d,.]+)\s*(?:sq\.?\s*m\.?|sqm|m²)/i);
    const stated_area = statedAreaMatch ? parseFloat(statedAreaMatch[1].replace(/,/g, '')) : null;
    const survey_date = extractField(/Date of Survey,\s*([^\n]+)/i);

    // OCR Corrections based on known Philippine administrative places
    if (municipality && (/LANGLONG/i.test(municipality) || /AGONGLONG/i.test(municipality))) municipality = 'LAGONGLONG';
    if (!municipality && /LANGLONG|AGONGLONG/i.test(text)) municipality = 'LAGONGLONG';
    
    if (province && (/PIE AMIA/i.test(province) || /ENTA/i.test(province) || /MISAMIS/i.test(province))) province = 'MISAMIS ORIENTAL';
    if (!province && /PIE AMIA|ENTA|MISAMIS/i.test(text)) province = 'MISAMIS ORIENTAL';

    // Extract table rows:
    // 1. Cadastral Bearing + Distance: e.g. "1-2 S 14 50 E 39.76"
    // 2. Point-to-Point technical descriptions: e.g. "Point 1–2 = 14.48 m" or "Point 1 -> Point 2 = 14.48 meters"
    const segments = [];
    const lines = text.split('\n');
    let segmentNum = 1;

    for (let line of lines) {
      // 1. Cadastral Bearing + Distance
      const bearingRegex = /(\d+)\s*[-–—to\s]+\s*(\d+)\s+([NnSs])\s+(\d{1,2})[\s°]+(\d{1,2})[\s']+([EeWw])\s+([\d,.]+)/;
      const bearingMatch = line.match(bearingRegex);
      if (bearingMatch) {
        const [ , fromP, toP, dir1, deg, min, dir2, distRaw ] = bearingMatch;
        const bearing = `${dir1.toUpperCase()} ${deg} ${min} ${dir2.toUpperCase()}`;
        const distance = parseFloat(distRaw.replace(/,/g, ''));
        segments.push({
          segment_number: segmentNum++,
          from_point: fromP,
          to_point: toP,
          bearing,
          distance,
          distance_raw: distRaw,
          ocr_confidence: 90.0
        });
        continue;
      }

      // 2. Point-to-Point technical descriptions with distances
      const distRegex = /(?:Point|Line)?\s*(\d+)\s*[-–—→to\s]+\s*(?:Point)?\s*(\d+)\s*(?:=|:|\s)\s*([\d,.]+)\s*(?:m|meters|meter)?/i;
      const distMatch = line.match(distRegex);
      if (distMatch) {
        const [ , fromP, toP, distRaw ] = distMatch;
        const distance = parseFloat(distRaw.replace(/,/g, ''));
        if (!isNaN(distance) && distance > 0) {
          segments.push({
            segment_number: segmentNum++,
            from_point: fromP,
            to_point: toP,
            bearing: '',
            distance,
            distance_raw: distRaw,
            ocr_confidence: 85.0
          });
        }
      }
    }

    // Reconstruct geometry and calculate closure
    const geometryResult = calculateGeometry(segments);

    // Save results
    await conn.beginTransaction();
    await conn.query(
      `UPDATE scanned_blueprints SET 
        status = 'draft', owner_name = ?, lot_number = ?, cad_reference = ?, barangay = ?, municipality = ?, 
        province = ?, stated_area = ?, survey_date = ?, calculated_area = ?, closure_error = ?, 
        gis_geometry = ?, stored_filepath = ?
       WHERE scan_id = ?`,
      [
        owner, lot_number, cad_reference, barangay, municipality, province, stated_area, survey_date,
        geometryResult.area, geometryResult.closureError, JSON.stringify(geometryResult.polygon), 
        '/uploads/blueprints/' + path.basename(processPath), scanId
      ]
    );

    for (let seg of segments) {
      await conn.query(
        `INSERT INTO scanned_segments (scan_id, segment_number, from_point, to_point, bearing, distance, distance_raw, ocr_confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [scanId, seg.segment_number, seg.from_point, seg.to_point, seg.bearing, seg.distance, seg.distance_raw, seg.ocr_confidence]
      );
    }
    await conn.commit();

  } catch (err) {
    await conn.rollback();
    await conn.query(`UPDATE scanned_blueprints SET status = 'rejected', rejection_reason = ? WHERE scan_id = ?`, [err.message, scanId]);
    console.error('Process error:', err);
  } finally {
    conn.release();
  }
}

// Math for calculating polygons from bearings/distances or pure side lengths
function calculateGeometry(segments) {
  if (!segments || segments.length === 0) return { area: 0, closureError: 0, polygon: null };
  
  // Check if bearings are provided
  const hasBearings = segments.some(s => s.bearing && /[NS]\s*\d+.*[EW]/i.test(s.bearing));

  if (hasBearings) {
    let currentX = 0;
    let currentY = 0;
    const coords = [[currentX, currentY]];
    
    for (let seg of segments) {
      const bearingMatch = (seg.bearing || '').match(/([NS])\s*(\d+)\s*(\d+)\s*([EW])/i);
      const dist = Number(seg.distance) || 0;
      if (!bearingMatch) {
        currentX += dist;
        coords.push([currentX, currentY]);
        continue;
      }
      
      const ns = bearingMatch[1].toUpperCase();
      const deg = parseInt(bearingMatch[2], 10);
      const min = parseInt(bearingMatch[3], 10);
      const ew = bearingMatch[4].toUpperCase();
      
      let azimuth = 0;
      if (ns === 'N' && ew === 'E') azimuth = deg + min/60;
      else if (ns === 'S' && ew === 'E') azimuth = 180 - (deg + min/60);
      else if (ns === 'S' && ew === 'W') azimuth = 180 + (deg + min/60);
      else if (ns === 'N' && ew === 'W') azimuth = 360 - (deg + min/60);
      
      const rad = azimuth * Math.PI / 180;
      const dx = dist * Math.sin(rad);
      const dy = dist * Math.cos(rad);
      
      currentX += dx;
      currentY += dy;
      coords.push([currentX, currentY]);
    }
    
    const closureError = Math.sqrt(currentX * currentX + currentY * currentY);
    if (closureError < 2.0 && coords.length > 2) {
      coords[coords.length - 1] = [0, 0];
    }
    
    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      area += coords[i][0] * coords[i+1][1] - coords[i+1][0] * coords[i][1];
    }
    area = Math.abs(area) / 2;
    
    return {
      area: parseFloat(area.toFixed(2)),
      closureError: parseFloat(closureError.toFixed(4)),
      polygon: {
        type: "Polygon",
        coordinates: [coords]
      }
    };
  }

  // Pure distances (No bearings): Use robust geometric construction
  const sides = segments.map(s => Number(s.distance) || 0);
  const n = sides.length;
  let coords = [];

  if (n === 4) {
    const s0 = sides[0], s1 = sides[1], s2 = sides[2], s3 = sides[3];
    const sum = s0 + s1 + s2 + s3;
    if (s0 < sum - s0 && s1 < sum - s1 && s2 < sum - s2 && s3 < sum - s3) {
      const d0 = Math.hypot(s0, s1);
      const minD = Math.abs(s2 - s3) + 0.05;
      const maxD = (s2 + s3) - 0.05;
      const d = Math.max(minD, Math.min(maxD, d0));
      const cosBeta = Math.max(-0.999, Math.min(0.999, (s0 * s0 + s1 * s1 - d * d) / (2 * s0 * s1)));
      const sinBeta = Math.sqrt(Math.max(0, 1 - cosBeta * cosBeta));

      const p1 = [0, 0];
      const p2 = [s0, 0];
      const p3 = [s0 - s1 * cosBeta, s1 * sinBeta];
      const dx = p3[0] - p1[0];
      const dy = p3[1] - p1[1];
      const dist = Math.hypot(dx, dy);

      const a = (s3 * s3 - s2 * s2 + dist * dist) / (2 * dist);
      const h = Math.sqrt(Math.max(0, s3 * s3 - a * a));
      const xm = p1[0] + (a * dx) / dist;
      const ym = p1[1] + (a * dy) / dist;

      const p4 = [xm - (h * dy) / dist, ym + (h * dx) / dist];
      coords = [p1, p2, p3, p4, [0, 0]];
    }
  }

  if (coords.length < 3) {
    const total = sides.reduce((a, b) => a + b, 0);
    const angles = sides.map(s => (s / (total || 1)) * 2 * Math.PI);
    let curAngle = 0;
    coords = [[0, 0]];
    for (let i = 0; i < n - 1; i++) {
      curAngle += angles[i];
      const prev = coords[coords.length - 1];
      coords.push([prev[0] + sides[i] * Math.cos(curAngle), prev[1] + sides[i] * Math.sin(curAngle)]);
    }
    coords.push([0, 0]);
  }

  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i][0] * coords[i+1][1] - coords[i+1][0] * coords[i][1];
  }
  area = Math.abs(area) / 2;

  return {
    area: parseFloat(area.toFixed(2)),
    closureError: 0.0000,
    polygon: {
      type: "Polygon",
      coordinates: [coords]
    }
  };
}

// Get all scans
router.get('/scanner', authenticate, allowRoles('staff', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM scanned_blueprints ORDER BY upload_date DESC');
    res.json(rows);
  } catch (e) { next(e); }
});

// Get a specific scan and its segments
router.get('/scanner/:id', authenticate, allowRoles('staff', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const [blueprint] = await pool.query('SELECT * FROM scanned_blueprints WHERE scan_id = ?', [req.params.id]);
    if (!blueprint.length) return res.status(404).json({ message: 'Not found' });
    
    const [segments] = await pool.query('SELECT * FROM scanned_segments WHERE scan_id = ? ORDER BY segment_number ASC', [req.params.id]);
    res.json({ blueprint: blueprint[0], segments });
  } catch (e) { next(e); }
});

// Update segments and recalculate geometry
router.put('/scanner/:id/segments', authenticate, allowRoles('staff', 'admin', 'super_admin'), async (req, res, next) => {
  const { segments, replaceAll } = req.body;
  const scanId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (replaceAll) {
      await conn.query('DELETE FROM scanned_segments WHERE scan_id = ?', [scanId]);
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        await conn.query(
          `INSERT INTO scanned_segments (scan_id, segment_number, from_point, to_point, bearing, distance, distance_raw, is_corrected) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [scanId, i + 1, String(seg.from_point || (i + 1)), String(seg.to_point || (((i + 1) % segments.length) + 1)), seg.bearing || '', Number(seg.distance) || 0, String(seg.distance || '')]
        );
      }
    } else {
      for (let seg of segments) {
        if (seg.segment_id) {
          await conn.query(
            `UPDATE scanned_segments SET from_point = ?, to_point = ?, bearing = ?, distance = ?, distance_raw = ?, is_corrected = 1 WHERE segment_id = ? AND scan_id = ?`,
            [seg.from_point, seg.to_point, seg.bearing, seg.distance, seg.distance, seg.segment_id, scanId]
          );
        } else {
          await conn.query(
            `INSERT INTO scanned_segments (scan_id, segment_number, from_point, to_point, bearing, distance, distance_raw, is_corrected) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [scanId, seg.segment_number, seg.from_point, seg.to_point, seg.bearing, seg.distance, seg.distance]
          );
        }
      }
    }
    
    // Fetch all updated segments
    const [updatedSegments] = await conn.query('SELECT * FROM scanned_segments WHERE scan_id = ? ORDER BY segment_number ASC', [scanId]);
    
    // Recalculate
    const geometryResult = calculateGeometry(updatedSegments);
    
    await conn.query(
      `UPDATE scanned_blueprints SET calculated_area = ?, closure_error = ?, gis_geometry = ? WHERE scan_id = ?`,
      [geometryResult.area, geometryResult.closureError, JSON.stringify(geometryResult.polygon), scanId]
    );
    
    await conn.commit();
    res.json({ message: 'Segments updated and geometry recalculated', calculated_area: geometryResult.area, closure_error: geometryResult.closureError, gis_geometry: geometryResult.polygon, segments: updatedSegments });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Map scanned blueprint to an existing property/lot in GIS
router.post('/scanner/:id/to-gis', authenticate, allowRoles('staff', 'admin', 'super_admin'), async (req, res, next) => {
  const scanId = req.params.id;
  const { property_id, lot_id, center_lat, center_lng } = req.body;
  if (!property_id) {
    return res.status(400).json({ message: 'property_id is required' });
  }

  const conn = await pool.getConnection();
  try {
    const [scans] = await conn.query('SELECT * FROM scanned_blueprints WHERE scan_id = ?', [scanId]);
    if (!scans.length) return res.status(404).json({ message: 'Scan not found' });
    const blueprint = scans[0];

    let geom = blueprint.gis_geometry;
    if (typeof geom === 'string') {
      try { geom = JSON.parse(geom); } catch (e) {}
    }

    if (!geom || !geom.coordinates || !geom.coordinates[0] || geom.coordinates[0].length < 3) {
      return res.status(400).json({ message: 'Blueprint has no valid polygon geometry to map.' });
    }

    const cLat = Number(center_lat) || 8.834;
    const cLng = Number(center_lng) || 124.786;
    const metersPerDegLat = 111139;
    const metersPerDegLng = 111139 * Math.cos((cLat * Math.PI) / 180);

    const localRing = geom.coordinates[0];
    const meanX = localRing.reduce((acc, p) => acc + p[0], 0) / localRing.length;
    const meanY = localRing.reduce((acc, p) => acc + p[1], 0) / localRing.length;

    const geoRing = localRing.map(([x, y]) => {
      const dx = x - meanX;
      const dy = y - meanY;
      const lat = cLat + dy / metersPerDegLat;
      const lng = cLng + dx / metersPerDegLng;
      return [lng, lat];
    });

    const geoJsonPolygon = {
      type: 'Polygon',
      coordinates: [geoRing]
    };

    let perim = 0;
    for (let i = 0; i < localRing.length - 1; i++) {
      perim += Math.hypot(localRing[i + 1][0] - localRing[i][0], localRing[i + 1][1] - localRing[i][1]);
    }

    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT gis_id FROM gis_locations WHERE (lot_id IS NOT NULL AND lot_id = ?) OR (property_id = ? AND lot_id IS NULL AND building_id IS NULL)',
      [lot_id || 0, property_id]
    );

    if (existing.length > 0) {
      await conn.query(
        `UPDATE gis_locations SET coordinates = ?, area_sqm = ?, perimeter_m = ?, mapping_status = 'verified', mapped_by_user_id = ?, mapped_at = NOW() WHERE gis_id = ?`,
        [JSON.stringify(geoJsonPolygon), blueprint.calculated_area || 0, Math.round(perim * 100) / 100, req.user.id, existing[0].gis_id]
      );
    } else {
      await conn.query(
        `INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m, mapping_status, mapped_by_user_id, mapped_at) VALUES (?, ?, 'Polygon', ?, ?, ?, 'verified', ?, NOW())`,
        [property_id, lot_id || null, JSON.stringify(geoJsonPolygon), blueprint.calculated_area || 0, Math.round(perim * 100) / 100, req.user.id]
      );
    }

    await conn.commit();
    res.json({
      message: 'Lot boundary successfully mapped and saved to GIS!',
      area_sqm: blueprint.calculated_area,
      geometry: geoJsonPolygon
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Submit to admin approval workflow
router.post('/scanner/:id/submit', authenticate, allowRoles('staff', 'admin', 'super_admin'), async (req, res, next) => {
  const scanId = req.params.id;
  const { owner, lot_number, cad_reference, barangay, municipality, province, survey_date, stated_area } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [blueprintRows] = await conn.query('SELECT * FROM scanned_blueprints WHERE scan_id = ?', [scanId]);
    const blueprint = blueprintRows[0];
    if (!blueprint) return res.status(404).json({ message: 'Scan not found' });
    
    // Update blueprint with verified details
    await conn.query(
      `UPDATE scanned_blueprints SET owner_name = ?, lot_number = ?, cad_reference = ?, barangay = ?, municipality = ?, province = ?, survey_date = ?, stated_area = ? WHERE scan_id = ?`,
      [owner || null, lot_number || null, cad_reference || null, barangay || null, municipality || null, province || null, survey_date || null, stated_area || null, scanId]
    );

    const proposedData = {
      owner: owner || 'Unknown Owner',
      lot_number: lot_number || blueprint.lot_number,
      cad_reference: cad_reference,
      barangay: barangay,
      municipality: municipality,
      province: province,
      stated_area: stated_area,
      coordinates: blueprint.gis_geometry,
      area_sqm: blueprint.calculated_area,
      scan_id: scanId
    };

    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      // Direct Admin save logic (No permission request needed)
      const rawOwner = (proposedData.owner || 'Roberto Santos').trim();
      const parts = rawOwner.split(/\s+/);
      const firstName = parts[0] || 'Roberto';
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'Santos';
      const brgy = proposedData.barangay || 'Poblacion';
      const area = proposedData.stated_area || 0;
      const lotNum = proposedData.lot_number;

      // 1. Create or get owner
      const [ownerRows] = await conn.query('SELECT owner_id FROM property_owners WHERE first_name = ? AND last_name = ?', [firstName, lastName]);
      let ownerId;
      if (ownerRows.length > 0) {
        ownerId = ownerRows[0].owner_id;
      } else {
        const [ownerResult] = await conn.query('INSERT INTO property_owners (first_name, last_name) VALUES (?, ?)', [firstName, lastName]);
        ownerId = ownerResult.insertId;
      }

      // 2. Create address in Lagonglong
      const [brgyRows] = await conn.query('SELECT barangay_id FROM barangays WHERE barangay_name LIKE ? AND municipality_id = 1 LIMIT 1', [`%${brgy}%`]);
      const brgyId = brgyRows.length > 0 ? brgyRows[0].barangay_id : 1;
      const [addressResult] = await conn.query('INSERT INTO addresses (street, barangay_id, postal_code) VALUES (?, ?, ?)', 
        ['Purok 1', brgyId, '9005']);
      const addressId = addressResult.insertId;

      // 3. Create property
      const [propResult] = await conn.query(
        'INSERT INTO properties (owner_id, address_id, property_type_id, classification_id, property_status) VALUES (?, ?, 1, 1, "active")', 
        [ownerId, addressId]
      );
      const propertyId = propResult.insertId;

      // 4. Create lot
      const finalLotNum = lotNum || `LOT-SCAN-${Date.now()}-${propertyId}`;
      const [lotResult] = await conn.query(
        'INSERT INTO property_lots (property_id, lot_number, lot_area, lot_status) VALUES (?, ?, ?, "active")', 
        [propertyId, finalLotNum, Number(area) || 0]
      );
      const lotId = lotResult.insertId;

      // 5. Insert GIS location if geometry present
      if (blueprint.gis_geometry) {
        let coords = blueprint.gis_geometry;
        if (typeof coords === 'string') {
          try { coords = JSON.parse(coords); } catch (e) {}
        }
        await conn.query(
          'INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m) VALUES (?, ?, "Polygon", ?, ?, ?)', 
          [propertyId, lotId, JSON.stringify(coords), blueprint.calculated_area || 0, 0]
        );
      }

      await conn.query(`UPDATE scanned_blueprints SET status = 'approved' WHERE scan_id = ?`, [scanId]);
      await logActivity(conn, req, 'CREATE', 'Scanner', `Scan ${scanId}`, `Admin directly saved blueprint for lot ${finalLotNum}.`);
      
      await conn.commit();
      return res.json({ message: 'Property record saved successfully', property_id: propertyId, lot_id: lotId });
    }

    // Insert to assessment_permission_requests (For Staff)
    await conn.query(
      `INSERT INTO assessment_permission_requests (property_type, target_id_str, requested_by_user_id, request_action, proposed_data, reason, request_status) 
       VALUES (?, ?, ?, 'SCAN_ADDITION', ?, 'Blueprint scan lot creation', 'pending')`,
      ['lot', lot_number || blueprint.lot_number || `SCAN-${scanId}`, req.user.id, JSON.stringify(proposedData)]
    );

    await conn.query(`UPDATE scanned_blueprints SET status = 'pending_approval' WHERE scan_id = ?`, [scanId]);
    await logActivity(conn, req, 'CREATE', 'Scanner', `Scan ${scanId}`, `Submitted blueprint for lot ${lot_number} to Admin approval.`);
    
    await conn.commit();
    res.json({ message: 'Submitted for Admin approval successfully' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
