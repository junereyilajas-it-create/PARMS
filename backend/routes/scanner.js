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
    const statedAreaMatch = text.match(/area of\s*([\d,.]+)\s*(?:Sq|sq\.?\s*m\.?)/i);
    const stated_area = statedAreaMatch ? parseFloat(statedAreaMatch[1].replace(/,/g, '')) : null;
    const survey_date = extractField(/Date of Survey,\s*([^\n]+)/i);

    // OCR Corrections based on known Philippine administrative places
    if (municipality && (/LANGLONG/i.test(municipality) || /AGONGLONG/i.test(municipality))) municipality = 'LAGONGLONG';
    if (!municipality && /LANGLONG|AGONGLONG/i.test(text)) municipality = 'LAGONGLONG';
    
    if (province && (/PIE AMIA/i.test(province) || /ENTA/i.test(province) || /MISAMIS/i.test(province))) province = 'MISAMIS ORIENTAL';
    if (!province && /PIE AMIA|ENTA|MISAMIS/i.test(text)) province = 'MISAMIS ORIENTAL';

    // Extract table rows (Bearings and Distances)
    // We look for lines that match: number-number Direction Deg Min Direction Distance
    // e.g. "1-2 S 14 50 E 39.76"
    const segments = [];
    const lines = text.split('\n');
    let segmentNum = 1;
    for (let line of lines) {
      const regex = /(\d+)\s*-\s*(\d+)\s+([NnSs])\s+(\d{1,2})[\s°]+(\d{1,2})[\s']+([EeWw])\s+([\d,.]+)/;
      const match = line.match(regex);
      if (match) {
        const [ , fromP, toP, dir1, deg, min, dir2, distRaw ] = match;
        const bearing = `${dir1.toUpperCase()} ${deg} ${min} ${dir2.toUpperCase()}`;
        const distance = parseFloat(distRaw.replace(/,/g, ''));
        segments.push({
          segment_number: segmentNum++,
          from_point: fromP,
          to_point: toP,
          bearing,
          distance,
          distance_raw: distRaw,
          ocr_confidence: 85.0 // dummy confidence for now
        });
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

// Math for calculating polygons from bearings/distances
function calculateGeometry(segments) {
  if (!segments || segments.length === 0) return { area: 0, closureError: 0, polygon: null };
  
  let currentX = 0;
  let currentY = 0;
  const coords = [[currentX, currentY]];
  
  for (let seg of segments) {
    const bearingMatch = seg.bearing.match(/([NS])\s*(\d+)\s*(\d+)\s*([EW])/i);
    if (!bearingMatch) continue;
    
    const ns = bearingMatch[1].toUpperCase();
    const deg = parseInt(bearingMatch[2], 10);
    const min = parseInt(bearingMatch[3], 10);
    const ew = bearingMatch[4].toUpperCase();
    const dist = seg.distance;
    
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
  
  // Closure error: distance from start (0,0) to end (currentX, currentY)
  const closureError = Math.sqrt(currentX * currentX + currentY * currentY);
  
  // Shoelace area
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
      coordinates: [coords] // In local coordinates (not geo coords yet)
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
  const { segments } = req.body;
  const scanId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let seg of segments) {
      if (seg.segment_id) {
        await conn.query(
          `UPDATE scanned_segments SET bearing = ?, distance = ?, distance_raw = ?, is_corrected = 1 WHERE segment_id = ? AND scan_id = ?`,
          [seg.bearing, seg.distance, seg.distance, seg.segment_id, scanId]
        );
      } else {
        await conn.query(
          `INSERT INTO scanned_segments (scan_id, segment_number, from_point, to_point, bearing, distance, distance_raw, is_corrected) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [scanId, seg.segment_number, seg.from_point, seg.to_point, seg.bearing, seg.distance, seg.distance]
        );
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
    res.json({ message: 'Segments updated', calculated_area: geometryResult.area, closure_error: geometryResult.closureError, gis_geometry: geometryResult.polygon, segments: updatedSegments });
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
      const ownerName = proposedData.owner;
      const brgy = proposedData.barangay || '';
      const muni = proposedData.municipality || '';
      const prov = proposedData.province || '';
      const area = proposedData.stated_area || 0;
      const lotNum = proposedData.lot_number;

      // 1. Create or get owner
      const [ownerRows] = await conn.query('SELECT owner_id FROM property_owners WHERE full_name = ?', [ownerName]);
      let ownerId;
      if (ownerRows.length > 0) {
        ownerId = ownerRows[0].owner_id;
      } else {
        const [ownerResult] = await conn.query('INSERT INTO property_owners (full_name) VALUES (?)', [ownerName]);
        ownerId = ownerResult.insertId;
      }

      // 2. Create address
      const [addressResult] = await conn.query('INSERT INTO property_addresses (street_address, barangay, municipality, province, region, zip_code) VALUES (?, ?, ?, ?, ?, ?)', 
        ['', brgy, muni, prov, 'Region X', '9000']);
      const addressId = addressResult.insertId;

      // 3. Generate property ID
      const purokStr = `${muni.toUpperCase()}-${brgy.toUpperCase().replace(/\s+/g, '')}`;
      const [pRows] = await conn.query(
        "SELECT property_id FROM properties WHERE property_id LIKE ? ORDER BY CAST(SUBSTRING_INDEX(property_id, '-A', -1) AS UNSIGNED) DESC LIMIT 1",
        [`LP-${purokStr}-A%`]
      );
      let nextPropSeq = 1;
      if (pRows.length > 0) {
        const match = pRows[0].property_id.match(/-A(\d+)$/);
        if (match) nextPropSeq = parseInt(match[1]) + 1;
      }
      const propertyIdStr = `LP-${purokStr}-A${nextPropSeq}`;

      // 4. Create property
      await conn.query('INSERT INTO properties (property_id, owner_id, address_id, property_type_id, classification_id, property_status) VALUES (?, ?, ?, ?, ?, ?)', 
        [propertyIdStr, ownerId, addressId, 1, 1, 'active']);

      // 5. Generate lot ID
      const [lRows] = await conn.query(
        "SELECT lot_id FROM property_lots WHERE lot_id LIKE ? ORDER BY CAST(SUBSTRING_INDEX(lot_id, '-L', -1) AS UNSIGNED) DESC LIMIT 1",
        [`LP-${purokStr}-L%`]
      );
      let nextLotSeq = 1;
      if (lRows.length > 0) {
        const match = lRows[0].lot_id.match(/-L(\d+)$/);
        if (match) nextLotSeq = parseInt(match[1]) + 1;
      }
      const lotIdStr = `LP-${purokStr}-L${nextLotSeq}`;

      // 6. Create lot
      await conn.query('INSERT INTO property_lots (lot_id, property_id, lot_number, lot_area, lot_status) VALUES (?, ?, ?, ?, ?)', 
        [lotIdStr, propertyIdStr, lotNum, area, 'active']);

      // 7. Insert GIS location
      if (blueprint.gis_geometry) {
        await conn.query('INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m) VALUES (?, ?, ?, ?, ?, ?)', 
          [propertyIdStr, lotIdStr, 'Polygon', blueprint.gis_geometry, blueprint.calculated_area || 0, 0]);
      }

      await conn.query(`UPDATE scanned_blueprints SET status = 'approved' WHERE scan_id = ?`, [scanId]);
      await logActivity(conn, req, 'CREATE', 'Scanner', `Scan ${scanId}`, `Admin directly saved blueprint for lot ${lotNum}.`);
      
      await conn.commit();
      return res.json({ message: 'Property record saved successfully' });
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
