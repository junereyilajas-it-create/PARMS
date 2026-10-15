import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity, logPropertyHistory } from '../utils/logger.js'
import { notifyRole } from '../utils/notifications.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure multer storage for property photos
const uploadDir = path.join(__dirname, '..', 'uploads', 'properties')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase())
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (allowed.includes(file.mimetype.toLowerCase()) || file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP) are allowed for property photos.'))
    }
  }
})

const router = Router()

// Upload property photo (optional lot or building photo)
router.post('/properties/upload-photo', authenticate, allowRoles('admin', 'staff', 'super_admin', 'assessor'), (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Error uploading property photo.' })
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file uploaded.' })
    }
    const photoUrl = `/uploads/properties/${req.file.filename}`
    return res.json({ success: true, url: photoUrl, filename: req.file.filename })
  })
})

async function getOrInsertProvince(connection, provinceName) {
  if (!provinceName) return null
  const [rows] = await connection.query('SELECT province_id FROM provinces WHERE province_name = ?', [provinceName.trim()])
  if (rows.length > 0) return rows[0].province_id
  const [result] = await connection.query('INSERT INTO provinces (province_name) VALUES (?)', [provinceName.trim()])
  return result.insertId
}

async function getOrInsertMunicipality(connection, provinceId, municipalityName) {
  if (!municipalityName) return null
  const [rows] = await connection.query('SELECT municipality_id FROM municipalities WHERE municipality_name = ? AND province_id = ?', [municipalityName.trim(), provinceId])
  if (rows.length > 0) return rows[0].municipality_id
  const [result] = await connection.query('INSERT INTO municipalities (municipality_id, province_id, municipality_name) VALUES (NULL, ?, ?)', [provinceId, municipalityName.trim()])
  return result.insertId
}

async function getOrInsertBarangay(connection, municipalityId, barangayName) {
  if (!barangayName) return null
  const [rows] = await connection.query('SELECT barangay_id FROM barangays WHERE barangay_name = ? AND municipality_id = ?', [barangayName.trim(), municipalityId])
  if (rows.length > 0) return rows[0].barangay_id
  const [result] = await connection.query('INSERT INTO barangays (municipality_id, barangay_name) VALUES (?, ?)', [municipalityId, barangayName.trim()])
  return result.insertId
}

router.post('/properties/unified', authenticate, allowRoles('admin', 'staff', 'super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const data = req.body
    await connection.beginTransaction()

    // 1. Validate the request basic fields
    if (!data.propertyType || !['LOT', 'BUILDING'].includes(data.propertyType)) {
      throw Object.assign(new Error('Invalid or missing Property Type.'), { status: 400 })
    }
    // 2. Create Owner or Use Existing
    let ownerId = data.ownerId;
    if (!ownerId) {
      if (!data.ownerFirstName || !data.ownerLastName) {
        throw Object.assign(new Error('Owner First Name and Last Name are required.'), { status: 400 })
      }
      const [ownerResult] = await connection.query(
        'INSERT INTO property_owners (first_name, middle_name, last_name, contact_number) VALUES (?, ?, ?, ?)',
        [data.ownerFirstName.trim(), data.ownerMiddleName?.trim() || null, data.ownerLastName.trim(), data.ownerContactNumber?.trim() || null]
      )
      ownerId = ownerResult.insertId
    }

    // 3. Create/Resolve Owner Address
    const ownerProvId = await getOrInsertProvince(connection, data.ownerProvince || 'Misamis Oriental')
    const ownerMunId = await getOrInsertMunicipality(connection, ownerProvId, data.ownerMunicipality || 'Lagonglong')
    const ownerBrgyId = await getOrInsertBarangay(connection, ownerMunId, data.ownerBarangay || 'Unknown')

    const ownerStreet = [data.ownerPurok, data.ownerStreet].filter(Boolean).join(', ')
    const [ownerAddrResult] = await connection.query(
      'INSERT INTO addresses (house_number, street, barangay_id, postal_code) VALUES (?, ?, ?, ?)',
      [data.ownerHouseNumber?.trim() || null, ownerStreet || null, ownerBrgyId, data.ownerZipCode?.trim() || null]
    )
    const ownerAddressId = ownerAddrResult.insertId

    await connection.query('INSERT INTO owner_addresses (owner_id, address_id) VALUES (?, ?)', [ownerId, ownerAddressId])

    // 4 & 5. Create/Resolve Property Address
    const propProvId = await getOrInsertProvince(connection, 'Misamis Oriental')
    const propMunId = await getOrInsertMunicipality(connection, propProvId, 'Lagonglong')
    const propBrgyId = await getOrInsertBarangay(connection, propMunId, data.propertyBarangay || 'Unknown')
    const propStreet = [data.propertyPurok, data.propertyStreet].filter(Boolean).join(', ')

    const [propAddrResult] = await connection.query(
      'INSERT INTO addresses (house_number, street, barangay_id, postal_code) VALUES (NULL, ?, ?, NULL)',
      [propStreet || null, propBrgyId]
    )
    const propertyAddressId = propAddrResult.insertId

    // Duplicate checks
    if (data.propertyType === 'LOT') {
      if (data.lotNumber && data.lotNumber.trim()) {
        const [existingLot] = await connection.query(
          `SELECT l.lot_id FROM property_lots l 
           JOIN properties p ON l.property_id = p.property_id 
           JOIN addresses a ON p.address_id = a.address_id 
           WHERE l.lot_number = ? AND a.barangay_id = ?`,
          [data.lotNumber.trim(), propBrgyId]
        );
        if (existingLot.length > 0) {
          throw Object.assign(new Error(`Lot Number "${data.lotNumber.trim()}" is already registered in this barangay.`), { status: 400 });
        }
      }
      if (data.titleNumber && data.titleNumber.trim()) {
        const [existingTitle] = await connection.query(
          `SELECT lot_id FROM property_lots WHERE title_number = ? AND title_number IS NOT NULL AND title_number != ''`,
          [data.titleNumber.trim()]
        );
        if (existingTitle.length > 0) {
          throw Object.assign(new Error(`Title Number "${data.titleNumber.trim()}" is already registered.`), { status: 400 });
        }
      }
    } else if (data.propertyType === 'BUILDING') {
      if (data.buildingName && data.buildingName.trim()) {
        const [existingBldg] = await connection.query(
          `SELECT b.building_id FROM property_buildings b 
           JOIN properties p ON b.property_id = p.property_id 
           JOIN addresses a ON p.address_id = a.address_id 
           WHERE b.building_name = ? AND a.barangay_id = ?`,
          [data.buildingName.trim(), propBrgyId]
        );
        if (existingBldg.length > 0) {
          throw Object.assign(new Error(`Building "${data.buildingName.trim()}" already exists in this barangay.`), { status: 400 });
        }
      }
    }

    // Map Property Type & Classification
    let typeName = data.propertyType === 'LOT' ? 'LOT' : 'BUILDING';
    let [typeRows] = await connection.query('SELECT property_type_id FROM property_types WHERE property_type_name = ?', [typeName]);
    let propertyTypeId = typeRows.length > 0 ? typeRows[0].property_type_id : (data.propertyType === 'LOT' ? 1 : 2);

    let rawClass = (data.propertyType === 'LOT' ? data.lotClassification : data.buildingClassification) || 'Residential';
    let classificationName = 'Residential';
    if (rawClass.toLowerCase().includes('comm')) classificationName = 'Commercial';
    else if (rawClass.toLowerCase().includes('agri')) classificationName = 'Agricultural';
    else if (rawClass.toLowerCase().includes('indus')) classificationName = 'Industrial';

    let [classRows] = await connection.query('SELECT classification_id FROM property_classifications WHERE classification_name = ?', [classificationName]);
    let classificationId;
    if (classRows.length === 0) {
      const [insertClass] = await connection.query('INSERT INTO property_classifications (classification_name) VALUES (?)', [classificationName]);
      classificationId = insertClass.insertId;
    } else {
      classificationId = classRows[0].classification_id;
    }

    // Extract optional property photo
    const photoPath = data.propertyPhoto ? String(data.propertyPhoto).trim() : null;

    // Create Property
    const initialStatus = req.user.role === 'staff' ? 'pending' : 'active';
    const [propResult] = await connection.query(
      'INSERT INTO properties (owner_id, address_id, property_type_id, classification_id, property_status, property_photo) VALUES (?, ?, ?, ?, ?, ?)',
      [ownerId, propertyAddressId, propertyTypeId, classificationId, initialStatus, photoPath]
    );
    const propertyId = propResult.insertId;

    // 6 & 7. Create LOT or BUILDING
    let lotId = null;
    let lotNumber = null;
    let buildingId = null;
    let bldgName = null;

    if (data.propertyType === 'LOT') {
      lotNumber = data.lotNumber?.trim() || `LOT-T-${Date.now()}-${propertyId}`;
      const lotArea = Number(data.lotArea);
      const initialLotStatus = req.user.role === 'staff' ? 'pending' : (data.lotStatus || 'active').toLowerCase();

      const [lotResult] = await connection.query(
        'INSERT INTO property_lots (property_id, lot_number, title_number, lot_area, lot_status, property_photo) VALUES (?, ?, ?, ?, ?, ?)',
        [
          propertyId,
          lotNumber,
          data.titleNumber?.trim() || null,
          Number.isFinite(lotArea) ? lotArea : null,
          initialLotStatus,
          photoPath
        ]
      );
      lotId = lotResult.insertId;

      if (data.coordinates) {
        let coordData = data.coordinates;
        try { if (typeof coordData === 'string') coordData = JSON.parse(coordData); } catch (e) {}
        await connection.query(
          'INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m) VALUES (?, ?, ?, ?, ?, ?)',
          [propertyId, lotId, 'Polygon', JSON.stringify(coordData), Number(data.area_sqm) || 0, Number(data.perimeter_m) || 0]
        );
      }
    } else if (data.propertyType === 'BUILDING') {
      bldgName = data.buildingName?.trim() || `BLDG-T-${Date.now()}-${propertyId}`;
      const floorArea = Number(data.floorArea);
      const floorCount = Number(data.floorCount);
      const initialBldgStatus = req.user.role === 'staff' ? 'pending' : (data.buildingStatus || 'active').toLowerCase();

      // Compile construction materials summary into construction_type column safely
      const constructionSummary = [
        data.constructionType,
        data.structuralFrame && `Frame: ${data.structuralFrame}`,
        data.roofing && `Roof: ${data.roofing}`,
        data.exteriorWalls && `Walls: ${data.exteriorWalls}`,
        data.foundation && `Foundation: ${data.foundation}`
      ].filter(Boolean).join(', ') || data.constructionType || 'Mixed Materials';
      const safeConstructionType = constructionSummary.slice(0, 240);

      const rawYear = parseInt(data.yearConstructed, 10);
      const safeYear = Number.isInteger(rawYear) && rawYear >= 1901 && rawYear <= 2155 ? rawYear : null;

      const [bldgResult] = await connection.query(
        `INSERT INTO property_buildings (
          property_id, building_name, building_type, floor_area, floor_count, 
          construction_type, year_constructed, building_status, property_photo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyId,
          bldgName,
          data.buildingType || 'Residential',
          Number.isFinite(floorArea) ? floorArea : null,
          Number.isFinite(floorCount) ? floorCount : 1,
          safeConstructionType,
          safeYear,
          initialBldgStatus,
          photoPath
        ]
      );
      buildingId = bldgResult.insertId;

      // If assessed or market value provided
      if (Number(data.marketValue) > 0 || Number(data.assessedValue) > 0) {
        await connection.query(
          'INSERT INTO building_assessment_history (building_id, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date, assessment_reason, assessment_status, property_photo) VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?)',
          [buildingId, req.user.id, 20.00, Number(data.marketValue) || 0, Number(data.assessedValue) || 0, 'Initial registration', initialBldgStatus === 'active' ? 'approved' : 'submitted', photoPath]
        );
      }

      if (data.coordinates) {
        let coordData = data.coordinates;
        try { if (typeof coordData === 'string') coordData = JSON.parse(coordData); } catch (e) {}
        await connection.query(
          'INSERT INTO gis_locations (property_id, building_id, geometry_type, coordinates, area_sqm, perimeter_m) VALUES (?, ?, ?, ?, ?, ?)',
          [propertyId, buildingId, 'Polygon', JSON.stringify(coordData), Number(data.area_sqm) || 0, Number(data.perimeter_m) || 0]
        );
      }
    }

    // Log Activity & History
    await logActivity(connection, req, 'CREATE', 'Properties', `Property #${propertyId}`, `Registered ${data.propertyType} property for ${data.ownerFirstName} ${data.ownerLastName}`);
    await logPropertyHistory(connection, req, propertyId, 'Property Created', null, { owner: `${data.ownerFirstName} ${data.ownerLastName}`, type: data.propertyType });

    // Staff approval workflow
    if (req.user.role === 'staff') {
      const targetStr = data.propertyType === 'LOT' ? (lotNumber || `LOT-${lotId}`) : (bldgName || `BLDG-${buildingId}`);
      const targetInt = data.propertyType === 'LOT' ? lotId : buildingId;
      await connection.query(`
        INSERT INTO assessment_permission_requests 
        (property_type, target_id_str, target_id_int, requested_by_user_id, request_action, proposed_data, request_status, reason)
        VALUES (?, ?, ?, ?, 'ADDITION', ?, 'pending', ?)
      `, [
        data.propertyType.toLowerCase(),
        targetStr,
        targetInt,
        req.user.id,
        JSON.stringify(data),
        `New ${data.propertyType.toLowerCase()} registration submitted by staff awaiting admin approval.`
      ]);
      await notifyRole('admin', 'New Approval Request', `Staff ${req.user.first_name || 'Staff'} requested approval for a new ${data.propertyType.toLowerCase()}.`, 'PERMISSION_REQUEST', targetStr);
    }

    // Commit transaction
    await connection.commit();
    res.status(201).json({
      id: propertyId,
      propertyId,
      lotId,
      buildingId,
      lotNumber,
      buildingName: bldgName,
      message: req.user.role === 'staff'
        ? 'Property submitted successfully and is awaiting Admin approval.'
        : 'Property successfully added to records.',
      status: initialStatus,
      record: {
        property_id: propertyId,
        lot_id: lotId,
        building_id: buildingId,
        lot_number: lotNumber,
        building_name: bldgName,
        owner: `${data.ownerFirstName} ${data.ownerLastName}`,
        address: propStreet ? `${propStreet}, ${data.propertyBarangay || 'Lagonglong'}` : (data.propertyBarangay || 'Lagonglong'),
        type: data.propertyType,
        lot_area: data.lotArea || null,
        floor_area: data.floorArea || null
      }
    });
  } catch (e) {
    await connection.rollback();
    console.error('Unified Property Save Error:', e);
    if (e.status === 400) return res.status(400).json({ message: e.message, error: e.message });
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A record with that unique ID or reference already exists.', error: 'Duplicate entry detected.' });
    if (e.code === 'ER_DATA_TOO_LONG') return res.status(400).json({ message: 'One of the submitted fields exceeds the maximum allowable length in the database.', error: 'Input data exceeds maximum allowed length.' });
    return res.status(e.status || 500).json({ 
      message: e.message || 'An unexpected error occurred while saving the property.',
      error: e.message || 'Server error'
    });
  } finally {
    connection.release();
  }
});

// GET unified properties list for Assessor, Admin, Staff
router.get('/properties/overview', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { search, type, status, assigned } = req.query;

    const [rows] = await pool.query(`
      SELECT 
        p.property_id,
        p.property_status,
        p.property_photo,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        COALESCE(
          CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name),
          ad.street,
          br.barangay_name,
          'Address not yet mapped'
        ) AS property_address,
        COALESCE(br.barangay_name, 'Unknown') AS barangay,
        ad.street AS street,
        pt.property_type_name,
        pc.classification_name,
        -- Lot info
        COUNT(DISTINCT l.lot_id) AS lot_count,
        GROUP_CONCAT(DISTINCT l.lot_id) AS lot_ids,
        GROUP_CONCAT(DISTINCT l.lot_number SEPARATOR ', ') AS lot_numbers,
        COALESCE(MAX(l.lot_area), 0) AS lot_area,
        MAX(l.lot_id) AS primary_lot_id,
        MAX(l.lot_number) AS primary_lot_number,
        -- Building info
        COUNT(DISTINCT b.building_id) AS building_count,
        GROUP_CONCAT(DISTINCT b.building_id) AS building_ids,
        GROUP_CONCAT(DISTINCT b.building_name SEPARATOR ', ') AS building_names,
        COALESCE(MAX(b.floor_area), 0) AS floor_area,
        MAX(b.building_id) AS primary_building_id,
        MAX(b.building_name) AS primary_building_name,
        -- Calculated property category
        CASE
          WHEN COUNT(DISTINCT l.lot_id) > 0 AND COUNT(DISTINCT b.building_id) > 0 THEN 'Lot with Building'
          WHEN COUNT(DISTINCT l.lot_id) > 0 THEN 'Lot'
          WHEN COUNT(DISTINCT b.building_id) > 0 THEN 'Building'
          ELSE 'Lot'
        END AS calculated_property_type,
        -- Assessment status logic
        CASE
          WHEN (
            (SELECT COUNT(*) FROM lot_assessment_history lah WHERE lah.lot_id IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id) AND lah.assessment_status = 'approved') > 0
            OR (SELECT COUNT(*) FROM building_assessment_history bah WHERE bah.building_id IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id) AND bah.assessment_status = 'approved') > 0
            OR (SELECT COUNT(*) FROM property_assessments pa WHERE pa.property_id = p.property_id AND pa.assessment_status = 'approved') > 0
          ) THEN 'Approved'
          WHEN (
            (SELECT COUNT(*) FROM lot_assessment_history lah WHERE lah.lot_id IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id) AND lah.assessment_status = 'submitted') > 0
            OR (SELECT COUNT(*) FROM building_assessment_history bah WHERE bah.building_id IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id) AND bah.assessment_status = 'submitted') > 0
            OR (SELECT COUNT(*) FROM property_assessments pa WHERE pa.property_id = p.property_id AND pa.assessment_status = 'submitted') > 0
          ) THEN 'Pending Review'
          WHEN (
            (SELECT COUNT(*) FROM assessment_assignments aa WHERE (
              (aa.property_type = 'property' AND aa.target_id_int = p.property_id)
              OR (aa.property_type = 'lot' AND aa.target_id_int IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id))
              OR (aa.property_type = 'building' AND aa.target_id_int IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id))
            ) AND aa.assignment_status IN ('assigned', 'in_progress')) > 0
          ) THEN 'In Progress'
          ELSE 'Unassessed'
        END AS assessment_status,
        -- Assigned Assessor Info
        (
          SELECT CONCAT_WS(' ', u.first_name, u.last_name)
          FROM assessment_assignments aa
          JOIN users u ON aa.assigned_to_user_id = u.user_id
          WHERE (
            (aa.property_type = 'property' AND aa.target_id_int = p.property_id)
            OR (aa.property_type = 'lot' AND aa.target_id_int IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id))
            OR (aa.property_type = 'building' AND aa.target_id_int IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id))
          ) AND aa.assignment_status IN ('assigned', 'in_progress', 'submitted')
          ORDER BY aa.assignment_id DESC LIMIT 1
        ) AS assigned_assessor_name,
        (
          SELECT aa.assigned_to_user_id
          FROM assessment_assignments aa
          WHERE (
            (aa.property_type = 'property' AND aa.target_id_int = p.property_id)
            OR (aa.property_type = 'lot' AND aa.target_id_int IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id))
            OR (aa.property_type = 'building' AND aa.target_id_int IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id))
          ) AND aa.assignment_status IN ('assigned', 'in_progress', 'submitted')
          ORDER BY aa.assignment_id DESC LIMIT 1
        ) AS assigned_assessor_id,
        (
          SELECT aa.assignment_id
          FROM assessment_assignments aa
          WHERE (
            (aa.property_type = 'property' AND aa.target_id_int = p.property_id)
            OR (aa.property_type = 'lot' AND aa.target_id_int IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id))
            OR (aa.property_type = 'building' AND aa.target_id_int IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id))
          ) AND aa.assignment_status IN ('assigned', 'in_progress', 'submitted')
          ORDER BY aa.assignment_id DESC LIMIT 1
        ) AS active_assignment_id,
        -- Check if current user has an approved permission request
        EXISTS (
          SELECT 1 FROM assessment_permission_requests apr
          WHERE apr.requested_by_user_id = ? 
            AND apr.request_status = 'approved'
            AND (
              (apr.property_type = 'property' AND (apr.target_id_int = p.property_id OR apr.target_id_str = CAST(p.property_id AS CHAR)))
              OR (apr.property_type = 'lot' AND apr.target_id_int IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id))
              OR (apr.property_type = 'building' AND apr.target_id_int IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id))
            )
        ) AS has_approved_permission,
        -- Check if current user has a pending permission request
        EXISTS (
          SELECT 1 FROM assessment_permission_requests apr
          WHERE apr.requested_by_user_id = ? 
            AND apr.request_status = 'pending'
            AND (
              (apr.property_type = 'property' AND (apr.target_id_int = p.property_id OR apr.target_id_str = CAST(p.property_id AS CHAR)))
              OR (apr.property_type = 'lot' AND apr.target_id_int IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id))
              OR (apr.property_type = 'building' AND apr.target_id_int IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id))
            )
        ) AS has_pending_request,
        -- Latest assessment figures
        COALESCE(
          (SELECT lah.market_value FROM lot_assessment_history lah WHERE lah.lot_id IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id) ORDER BY lah.assessment_date DESC, lah.lot_assessment_history_id DESC LIMIT 1),
          (SELECT bah.market_value FROM building_assessment_history bah WHERE bah.building_id IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id) ORDER BY bah.assessment_date DESC, bah.building_assessment_history_id DESC LIMIT 1),
          (SELECT pa.market_value FROM property_assessments pa WHERE pa.property_id = p.property_id ORDER BY pa.assessment_date DESC, pa.assessment_id DESC LIMIT 1),
          0
        ) AS latest_market_value,
        COALESCE(
          (SELECT lah.assessed_value FROM lot_assessment_history lah WHERE lah.lot_id IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id) ORDER BY lah.assessment_date DESC, lah.lot_assessment_history_id DESC LIMIT 1),
          (SELECT bah.assessed_value FROM building_assessment_history bah WHERE bah.building_id IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id) ORDER BY bah.assessment_date DESC, bah.building_assessment_history_id DESC LIMIT 1),
          (SELECT pa.assessed_value FROM property_assessments pa WHERE pa.property_id = p.property_id ORDER BY pa.assessment_date DESC, pa.assessment_id DESC LIMIT 1),
          0
        ) AS latest_assessed_value,
        COALESCE(
          (SELECT lah.assessment_date FROM lot_assessment_history lah WHERE lah.lot_id IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id) ORDER BY lah.assessment_date DESC, lah.lot_assessment_history_id DESC LIMIT 1),
          (SELECT bah.assessment_date FROM building_assessment_history bah WHERE bah.building_id IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id) ORDER BY bah.assessment_date DESC, bah.building_assessment_history_id DESC LIMIT 1),
          (SELECT pa.assessment_date FROM property_assessments pa WHERE pa.property_id = p.property_id ORDER BY pa.assessment_date DESC, pa.assessment_id DESC LIMIT 1)
        ) AS latest_assessment_date,
        COALESCE(
          (SELECT lah.remarks FROM lot_assessment_history lah WHERE lah.lot_id IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id) ORDER BY lah.assessment_date DESC, lah.lot_assessment_history_id DESC LIMIT 1),
          (SELECT bah.remarks FROM building_assessment_history bah WHERE bah.building_id IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id) ORDER BY bah.assessment_date DESC, bah.building_assessment_history_id DESC LIMIT 1),
          (SELECT pa.remarks FROM property_assessments pa WHERE pa.property_id = p.property_id ORDER BY pa.assessment_date DESC, pa.assessment_id DESC LIMIT 1)
        ) AS latest_remarks,
        COALESCE(
          (SELECT lah.property_photo FROM lot_assessment_history lah WHERE lah.lot_id IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id) ORDER BY lah.assessment_date DESC, lah.lot_assessment_history_id DESC LIMIT 1),
          (SELECT bah.property_photo FROM building_assessment_history bah WHERE bah.building_id IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id) ORDER BY bah.assessment_date DESC, bah.building_assessment_history_id DESC LIMIT 1),
          (SELECT pa.property_photo FROM property_assessments pa WHERE pa.property_id = p.property_id ORDER BY pa.assessment_date DESC, pa.assessment_id DESC LIMIT 1)
        ) AS latest_property_photo
      FROM properties p
      LEFT JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN addresses ad ON p.address_id = ad.address_id
      LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
      LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
      LEFT JOIN property_types pt ON p.property_type_id = pt.property_type_id
      LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
      LEFT JOIN property_lots l ON l.property_id = p.property_id
      LEFT JOIN property_buildings b ON b.property_id = p.property_id
      GROUP BY p.property_id, p.property_status, o.first_name, o.middle_name, o.last_name, ad.street, br.barangay_name, mu.municipality_name, pt.property_type_name, pc.classification_name
      ORDER BY p.property_id ASC
    `, [currentUserId, currentUserId]);

    // Format & calculate permissions for each record
    let records = rows.map(r => {
      const isAssignedToMe = Number(r.assigned_assessor_id) === Number(currentUserId);
      const hasApprovedPerm = Boolean(r.has_approved_permission);
      const hasPendingReq = Boolean(r.has_pending_request);
      const canAssess = isAssignedToMe || hasApprovedPerm;

      // Determine primary target for assessment / permission request
      let targetType = 'property';
      let targetId = r.property_id;
      let targetStr = `PROPERTY-${r.property_id}`;

      if (r.calculated_property_type === 'Lot' && r.primary_lot_id) {
        targetType = 'lot';
        targetId = r.primary_lot_id;
        targetStr = r.primary_lot_number || `LOT-${r.primary_lot_id}`;
      } else if (r.calculated_property_type === 'Building' && r.primary_building_id) {
        targetType = 'building';
        targetId = r.primary_building_id;
        targetStr = r.primary_building_name || `BLDG-${r.primary_building_id}`;
      } else if (r.primary_lot_id) {
        targetType = 'lot';
        targetId = r.primary_lot_id;
        targetStr = r.primary_lot_number || `LOT-${r.primary_lot_id}`;
      }

      return {
        ...r,
        lot_area: Number(r.lot_area || 0),
        floor_area: Number(r.floor_area || 0),
        assigned_to_me: isAssignedToMe,
        has_approved_permission: hasApprovedPerm,
        has_pending_request: hasPendingReq,
        can_assess: canAssess,
        target_type: targetType,
        target_id: targetId,
        target_id_str: targetStr
      };
    });

    // Apply SQL/API level filtering if requested
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter(r => 
        String(r.property_id).toLowerCase().includes(q) ||
        (r.lot_numbers && r.lot_numbers.toLowerCase().includes(q)) ||
        (r.building_names && r.building_names.toLowerCase().includes(q)) ||
        (r.owner_name && r.owner_name.toLowerCase().includes(q)) ||
        (r.calculated_property_type && r.calculated_property_type.toLowerCase().includes(q)) ||
        (r.barangay && r.barangay.toLowerCase().includes(q)) ||
        (r.property_address && r.property_address.toLowerCase().includes(q)) ||
        (r.assessment_status && r.assessment_status.toLowerCase().includes(q))
      );
    }

    if (type && type !== 'all') {
      const t = type.toLowerCase().replace(/_/g, ' ');
      records = records.filter(r => r.calculated_property_type.toLowerCase() === t);
    }

    if (status && status !== 'all') {
      const s = status.toLowerCase().replace(/_/g, ' ');
      records = records.filter(r => r.assessment_status.toLowerCase() === s);
    }

    if (assigned === 'me' || assigned === 'true') {
      records = records.filter(r => r.assigned_to_me);
    }

    res.json(records);
  } catch (err) {
    console.error('Error fetching properties overview:', err);
    next(err);
  }
});

export default router
