import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import { createNotification, notifyRole } from '../utils/notifications.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer storage for optional property photo upload
const uploadDir = path.join(__dirname, '..', 'uploads', 'assessments');
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
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP) are allowed for property photos.'));
    }
  }
});

// Middleware to handle multer optional upload without failing on JSON payloads
const handleOptionalPhoto = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Error uploading property photo.' });
    }
    next();
  });
};

const router = Router();

// Helper to resolve property/lot/building and check if assessor is authorized
export async function resolveAndVerifyPermission(connection, type, target_id, assessor_id) {
  let resolvedIntId = null;
  let resolvedStrId = String(target_id).trim();

  const isPureNum = /^\d+$/.test(resolvedStrId);
  const possibleInt = isPureNum ? parseInt(resolvedStrId, 10) : null;

  if (type === 'lot') {
    const [lots] = await connection.query(
      'SELECT lot_id, lot_number FROM property_lots WHERE (? = 1 AND lot_id = ?) OR lot_number = ? OR CAST(lot_id AS CHAR) = ? LIMIT 1',
      [possibleInt !== null ? 1 : 0, possibleInt || 0, resolvedStrId, resolvedStrId]
    );
    if (lots.length > 0) {
      resolvedIntId = lots[0].lot_id;
      resolvedStrId = lots[0].lot_number || `LOT_${lots[0].lot_id}`;
    }
  } else if (type === 'building') {
    const [bldgs] = await connection.query(
      'SELECT building_id, building_code, building_name FROM property_buildings WHERE (? = 1 AND building_id = ?) OR building_code = ? OR building_name = ? OR CAST(building_id AS CHAR) = ? LIMIT 1',
      [possibleInt !== null ? 1 : 0, possibleInt || 0, resolvedStrId, resolvedStrId, resolvedStrId]
    );
    if (bldgs.length > 0) {
      resolvedIntId = bldgs[0].building_id;
      resolvedStrId = bldgs[0].building_code || bldgs[0].building_name || `BUILDING_${bldgs[0].building_id}`;
    }
  } else { // property
    const [props] = await connection.query(
      'SELECT property_id, property_code FROM properties WHERE (? = 1 AND property_id = ?) OR property_code = ? OR CAST(property_id AS CHAR) = ? LIMIT 1',
      [possibleInt !== null ? 1 : 0, possibleInt || 0, resolvedStrId, resolvedStrId]
    );
    if (props.length > 0) {
      resolvedIntId = props[0].property_id;
      resolvedStrId = props[0].property_code || `PROP_${props[0].property_id}`;
    }
  }

  if (!resolvedIntId) {
    return { authorized: false, error: `Property of type '${type}' with ID '${target_id}' was not found in the database.` };
  }

  // Check 1: active assignment in assessment_assignments
  const [assignments] = await connection.query(`
    SELECT assignment_id FROM assessment_assignments 
    WHERE property_type = ? 
      AND (
        (? = 1 AND target_id_int = ?) 
        OR target_id_str = ? 
        OR target_id_str = ?
      )
      AND assigned_to_user_id = ?
      AND assignment_status IN ('assigned', 'in_progress', 'returned', 'submitted', 'pending', 'returned_for_correction')
  `, [type, resolvedIntId ? 1 : 0, resolvedIntId || 0, resolvedStrId, String(target_id).trim(), assessor_id]);

  if (assignments.length > 0) {
    return { authorized: true, intId: resolvedIntId, strId: resolvedStrId, assignmentId: assignments[0].assignment_id };
  }

  // Check 2: approved permission request in assessment_permission_requests
  const [requests] = await connection.query(`
    SELECT request_id FROM assessment_permission_requests
    WHERE property_type = ?
      AND (
        (? = 1 AND target_id_int = ?) 
        OR target_id_str = ? 
        OR target_id_str = ?
      )
      AND requested_by_user_id = ?
      AND request_status = 'approved'
  `, [type, resolvedIntId ? 1 : 0, resolvedIntId || 0, resolvedStrId, String(target_id).trim(), assessor_id]);

  if (requests.length > 0) {
    return { authorized: true, intId: resolvedIntId, strId: resolvedStrId };
  }

  return { 
    authorized: false, 
    error: 'You are not authorized to assess this property. It is not assigned to your account and has no approved permission request.' 
  };
}

// Helper query for unified assessments
export const getUnifiedAssessmentsQuery = (whereClause = '', includeAssignments = true) => `
  SELECT 
    'property' AS type, 
    pa.assessment_id, 
    pa.property_id AS target_id, 
    pa.property_id,
    p.property_code,
    (SELECT l.lot_number FROM property_lots l WHERE l.property_id = p.property_id LIMIT 1) AS lot_number,
    (SELECT COALESCE(b.building_code, b.building_name) FROM property_buildings b WHERE b.property_id = p.property_id LIMIT 1) AS building_code,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
    COALESCE(brgy.barangay_name, 'Unknown') AS barangay,
    pa.assessor_user_id, pa.assessor_level, pa.market_value, pa.assessed_value, pa.assessment_date, pa.remarks, pa.assessment_status, pa.rejection_reason,
    pa.property_photo,
    p.property_status, u.first_name, u.last_name
  FROM property_assessments pa
  JOIN properties p ON pa.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN addresses a ON p.address_id = a.address_id
  LEFT JOIN barangays brgy ON a.barangay_id = brgy.barangay_id
  JOIN users u ON pa.assessor_user_id = u.user_id
  ${whereClause ? `WHERE pa.${whereClause}` : ''}

  UNION ALL

  SELECT 
    'lot' AS type, 
    la.lot_assessment_history_id AS assessment_id, 
    la.lot_id AS target_id, 
    l.property_id,
    p.property_code,
    l.lot_number,
    NULL AS building_code,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
    COALESCE(brgy.barangay_name, 'Unknown') AS barangay,
    la.assessor_user_id, la.assessor_level, la.market_value, la.assessed_value, la.assessment_date, la.remarks, la.assessment_status, la.rejection_reason,
    la.property_photo,
    l.lot_status AS property_status, u.first_name, u.last_name
  FROM lot_assessment_history la
  JOIN property_lots l ON la.lot_id = l.lot_id
  JOIN properties p ON l.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN addresses a ON p.address_id = a.address_id
  LEFT JOIN barangays brgy ON a.barangay_id = brgy.barangay_id
  JOIN users u ON la.assessor_user_id = u.user_id
  ${whereClause ? `WHERE la.${whereClause}` : ''}

  UNION ALL

  SELECT 
    'building' AS type, 
    ba.building_assessment_history_id AS assessment_id, 
    ba.building_id AS target_id, 
    b.property_id,
    p.property_code,
    (SELECT l.lot_number FROM property_lots l WHERE l.property_id = b.property_id LIMIT 1) AS lot_number,
    COALESCE(b.building_code, b.building_name) AS building_code,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
    COALESCE(brgy.barangay_name, 'Unknown') AS barangay,
    ba.assessor_user_id, ba.assessor_level, ba.market_value, ba.assessed_value, ba.assessment_date, ba.remarks, ba.assessment_status, ba.rejection_reason,
    ba.property_photo,
    b.building_status AS property_status, u.first_name, u.last_name
  FROM building_assessment_history ba
  JOIN property_buildings b ON ba.building_id = b.building_id
  JOIN properties p ON b.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN addresses a ON p.address_id = a.address_id
  LEFT JOIN barangays brgy ON a.barangay_id = brgy.barangay_id
  JOIN users u ON ba.assessor_user_id = u.user_id
  ${whereClause ? `WHERE ba.${whereClause}` : ''}

  ${includeAssignments ? `
  UNION ALL

  SELECT 
    aa.property_type AS type, 
    aa.assignment_id AS assessment_id, 
    aa.target_id_str AS target_id, 
    COALESCE(
      (SELECT l.property_id FROM property_lots l WHERE l.lot_id = aa.target_id_int OR l.lot_number = aa.target_id_str LIMIT 1),
      (SELECT b.property_id FROM property_buildings b WHERE b.building_id = aa.target_id_int OR b.building_code = aa.target_id_str OR b.building_name = aa.target_id_str LIMIT 1),
      aa.target_id_int
    ) AS property_id,
    (
      SELECT p.property_code FROM properties p 
      WHERE p.property_id = COALESCE(
        (SELECT l.property_id FROM property_lots l WHERE l.lot_id = aa.target_id_int OR l.lot_number = aa.target_id_str LIMIT 1),
        (SELECT b.property_id FROM property_buildings b WHERE b.building_id = aa.target_id_int OR b.building_code = aa.target_id_str OR b.building_name = aa.target_id_str LIMIT 1),
        aa.target_id_int
      ) LIMIT 1
    ) AS property_code,
    (
      CASE 
        WHEN aa.property_type = 'lot' THEN aa.target_id_str
        ELSE (SELECT l.lot_number FROM property_lots l WHERE l.property_id = (SELECT b.property_id FROM property_buildings b WHERE b.building_id = aa.target_id_int OR b.building_code = aa.target_id_str OR b.building_name = aa.target_id_str LIMIT 1) LIMIT 1)
      END
    ) AS lot_number,
    (
      CASE 
        WHEN aa.property_type = 'building' THEN aa.target_id_str
        ELSE NULL
      END
    ) AS building_code,
    (
      SELECT CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name)
      FROM properties p
      LEFT JOIN property_owners o ON p.owner_id = o.owner_id
      WHERE p.property_id = COALESCE(
        (SELECT l.property_id FROM property_lots l WHERE l.lot_id = aa.target_id_int OR l.lot_number = aa.target_id_str LIMIT 1),
        (SELECT b.property_id FROM property_buildings b WHERE b.building_id = aa.target_id_int OR b.building_code = aa.target_id_str OR b.building_name = aa.target_id_str LIMIT 1),
        aa.target_id_int
      ) LIMIT 1
    ) AS owner_name,
    (
      SELECT COALESCE(brgy.barangay_name, 'Unknown')
      FROM properties p
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays brgy ON a.barangay_id = brgy.barangay_id
      WHERE p.property_id = COALESCE(
        (SELECT l.property_id FROM property_lots l WHERE l.lot_id = aa.target_id_int OR l.lot_number = aa.target_id_str LIMIT 1),
        (SELECT b.property_id FROM property_buildings b WHERE b.building_id = aa.target_id_int OR b.building_code = aa.target_id_str OR b.building_name = aa.target_id_str LIMIT 1),
        aa.target_id_int
      ) LIMIT 1
    ) AS barangay,
    aa.assigned_to_user_id AS assessor_user_id, 
    20.00 AS assessor_level, 
    0.00 AS market_value, 
    0.00 AS assessed_value, 
    CAST(aa.created_at AS DATE) AS assessment_date, 
    COALESCE(NULLIF(aa.instructions, ''), 'Assigned Property for Assessment') AS remarks, 
    aa.assignment_status AS assessment_status, 
    NULL AS rejection_reason,
    NULL AS property_photo,
    'assigned' AS property_status, 
    u.first_name, 
    u.last_name
  FROM assessment_assignments aa
  JOIN users u ON aa.assigned_to_user_id = u.user_id
  WHERE aa.assignment_status IN ('assigned', 'in_progress')
    AND (
      (aa.property_type = 'lot' AND NOT EXISTS (
        SELECT 1 FROM lot_assessment_history lah 
        WHERE (lah.lot_id = aa.target_id_int OR lah.lot_id = (SELECT lot_id FROM property_lots WHERE lot_number = aa.target_id_str LIMIT 1))
        AND lah.assessor_user_id = aa.assigned_to_user_id
      ))
      OR
      (aa.property_type = 'building' AND NOT EXISTS (
        SELECT 1 FROM building_assessment_history bah 
        WHERE (bah.building_id = aa.target_id_int OR bah.building_id = (SELECT building_id FROM property_buildings WHERE building_code = aa.target_id_str OR building_name = aa.target_id_str LIMIT 1))
        AND bah.assessor_user_id = aa.assigned_to_user_id
      ))
      OR
      (aa.property_type = 'property' AND NOT EXISTS (
        SELECT 1 FROM property_assessments pa 
        WHERE (pa.property_id = aa.target_id_int OR pa.property_id = (SELECT property_id FROM properties WHERE property_code = aa.target_id_str LIMIT 1))
        AND pa.assessor_user_id = aa.assigned_to_user_id
      ))
    )
    ${whereClause && whereClause.includes('assessor_user_id') ? `AND aa.assigned_to_user_id = ?` : ''}
  ` : ''}
`;

// Get pending assessments for admin review
router.get('/assessments/pending', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const query = getUnifiedAssessmentsQuery("assessment_status = 'submitted'", false);
    const finalQuery = `SELECT * FROM (${query}) AS combined ORDER BY assessment_date DESC`;
    const [assessments] = await pool.query(finalQuery);
    res.json({ properties: assessments, lots: [], buildings: [] });
  } catch (err) {
    console.error('Error in /assessments/pending:', err);
    next(err);
  }
});

// Get all assessments (filtered for assessor, or all for admin)
router.get('/assessments', authenticate, allowRoles('admin', 'super_admin', 'assessor', 'staff'), async (req, res, next) => {
  try {
    let query;
    let params = [];
    if (['assessor'].includes(req.user.role)) {
      query = getUnifiedAssessmentsQuery("assessor_user_id = ?", true);
      params = [req.user.id, req.user.id, req.user.id, req.user.id];
    } else {
      query = getUnifiedAssessmentsQuery("", true);
    }
    
    const finalQuery = `SELECT * FROM (${query}) AS combined ORDER BY assessment_date DESC`;
    const [assessments] = await pool.query(finalQuery, params);
    res.json(assessments);
  } catch (err) {
    console.error('Error in /assessments:', err);
    next(err);
  }
});

// Create and submit assessment (Sets status to 'submitted' for Admin review)
router.post('/assessments', authenticate, allowRoles('assessor'), handleOptionalPhoto, async (req, res, next) => {
  const { type, target_id, market_value, assessed_value, remarks, assessor_level } = req.body;
  
  if (!['property', 'lot', 'building'].includes(type)) {
    return res.status(400).json({ message: 'Invalid property type. Must be lot, building, or property.' });
  }

  if (!target_id) {
    return res.status(400).json({ message: 'Property Target ID is required.' });
  }

  const numMarket = parseFloat(market_value);
  const numAssessed = parseFloat(assessed_value);
  if (isNaN(numMarket) || numMarket <= 0) {
    return res.status(400).json({ message: 'Market Value is required and must be a positive number.' });
  }
  if (isNaN(numAssessed) || numAssessed <= 0) {
    return res.status(400).json({ message: 'Assessed Value is required and must be a positive number.' });
  }

  const photoPath = req.file ? `/uploads/assessments/${req.file.filename}` : (req.body.property_photo || null);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const check = await resolveAndVerifyPermission(connection, type, target_id, req.user.id);
    if (!check.authorized) {
      await connection.rollback();
      return res.status(403).json({ message: check.error });
    }

    const { intId, strId } = check;
    const table = type === 'lot' ? 'lot_assessment_history' : type === 'building' ? 'building_assessment_history' : 'property_assessments';
    const idColumn = type === 'lot' ? 'lot_id' : type === 'building' ? 'building_id' : 'property_id';
    const pkColumn = type === 'lot' ? 'lot_assessment_history_id' : type === 'building' ? 'building_assessment_history_id' : 'assessment_id';

    // Check if an assessment already exists for this assessor and property
    const [existing] = await connection.query(
      `SELECT ${pkColumn} AS id, assessment_status FROM ${table} WHERE ${idColumn} = ? AND assessor_user_id = ?`,
      [intId, req.user.id]
    );

    // Fetch active assessment level from tax_configurations database
    let effectiveAssessorLevel = assessor_level ? parseFloat(assessor_level) : null;
    if (!effectiveAssessorLevel || isNaN(effectiveAssessorLevel)) {
      const [alConfig] = await connection.query(`
        SELECT value_numeric FROM tax_configurations 
        WHERE category = 'assessment_level' AND verification_status IN ('approved', 'active')
        ORDER BY config_id ASC LIMIT 1
      `);
      effectiveAssessorLevel = alConfig.length ? Number(alConfig[0].value_numeric) * 100 : 20.00;
    }

    if (existing.length > 0) {
      const currentStatus = existing[0].assessment_status;
      if (currentStatus === 'approved') {
        await connection.rollback();
        return res.status(400).json({ message: 'This property has already been officially approved by the Head Assessor.' });
      }

      // Update existing record and set status to submitted (Pending Review)
      await connection.query(
        `UPDATE ${table} 
         SET market_value = ?, assessed_value = ?, assessor_level = ?, remarks = ?, 
             property_photo = COALESCE(?, property_photo),
             assessment_date = CURDATE(), assessment_status = 'submitted', rejection_reason = NULL
         WHERE ${pkColumn} = ?`,
        [numMarket, numAssessed, effectiveAssessorLevel, remarks || null, photoPath, existing[0].id]
      );
    } else {
      // Insert new assessment with submitted status (Pending Review)
      await connection.query(
        `INSERT INTO ${table} 
         (${idColumn}, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date, remarks, property_photo, assessment_status) 
         VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, 'submitted')`,
        [intId, req.user.id, effectiveAssessorLevel, numMarket, numAssessed, remarks || null, photoPath]
      );
    }

    // Sync status to assessment_assignments
    await connection.query(
      `UPDATE assessment_assignments 
       SET assignment_status = 'submitted' 
       WHERE property_type = ? AND (target_id_int = ? OR target_id_str = ?) AND assigned_to_user_id = ?`,
      [type, intId, strId, req.user.id]
    );

    await logActivity(connection, req, 'SUBMIT', 'Assessments', `${type.toUpperCase()} ${strId}`, `Assessor submitted ${type} assessment for Head Assessor review`);
    await notifyRole('admin', 'New Assessment Submitted', `Assessor ${req.user.first_name || ''} submitted ${type} assessment for ${strId} awaiting your review.`, 'ASSESSMENT_SUBMITTED', strId);

    await connection.commit();
    res.status(201).json({ 
      message: 'Assessment submitted successfully for Head Assessor review.',
      target_id: strId,
      status: 'submitted'
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Update assessment (for returned assessments being corrected & resubmitted)
router.put('/assessments/:type/:id', authenticate, allowRoles('assessor'), handleOptionalPhoto, async (req, res, next) => {
  const { type, id } = req.params;
  const { market_value, assessed_value, remarks } = req.body;
  
  if (!['property', 'lot', 'building'].includes(type)) return res.status(400).json({ message: 'Invalid assessment type' });

  const numMarket = parseFloat(market_value);
  const numAssessed = parseFloat(assessed_value);
  if (isNaN(numMarket) || numMarket <= 0) {
    return res.status(400).json({ message: 'Market Value must be a positive number.' });
  }
  if (isNaN(numAssessed) || numAssessed <= 0) {
    return res.status(400).json({ message: 'Assessed Value must be a positive number.' });
  }

  const photoPath = req.file ? `/uploads/assessments/${req.file.filename}` : (req.body.property_photo || null);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const table = type === 'lot' ? 'lot_assessment_history' : type === 'building' ? 'building_assessment_history' : 'property_assessments';
    const pkColumn = type === 'lot' ? 'lot_assessment_history_id' : type === 'building' ? 'building_assessment_history_id' : 'assessment_id';
    const targetColumn = type === 'lot' ? 'lot_id' : type === 'building' ? 'building_id' : 'property_id';
    
    const [existing] = await connection.query(
      `SELECT assessment_status, ${targetColumn} AS target_id FROM ${table} WHERE ${pkColumn} = ? AND assessor_user_id = ?`,
      [id, req.user.id]
    );
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Assessment record not found or unauthorized.' });
    }
    if (existing[0].assessment_status === 'approved') {
      await connection.rollback();
      return res.status(403).json({ message: 'Cannot edit an assessment that is already approved.' });
    }

    await connection.query(
      `UPDATE ${table} 
       SET market_value = ?, assessed_value = ?, remarks = ?, 
           property_photo = COALESCE(?, property_photo),
           assessment_status = 'submitted', assessment_date = CURDATE(), rejection_reason = NULL
       WHERE ${pkColumn} = ?`,
      [numMarket, numAssessed, remarks || null, photoPath, id]
    );

    // Sync status to assessment_assignments
    await connection.query(
      `UPDATE assessment_assignments 
       SET assignment_status = 'submitted' 
       WHERE property_type = ? AND target_id_int = ? AND assigned_to_user_id = ?`,
      [type, existing[0].target_id, req.user.id]
    );

    await logActivity(connection, req, 'RESUBMIT', 'Assessments', `ID ${id}`, 'Assessor resubmitted corrected assessment for review');
    await notifyRole('admin', 'Assessment Resubmitted', `Assessor ${req.user.first_name || ''} resubmitted corrected assessment for review.`, 'ASSESSMENT_SUBMITTED', String(id));

    await connection.commit();
    res.json({ message: 'Assessment corrected and submitted for Head Assessor review.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Assessor manually submits an existing draft for review
router.post('/assessments/:type/:id/submit', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const { type, id } = req.params;
  const connection = await pool.getConnection();
  try {
    const check = await resolveAndVerifyPermission(connection, type, id, req.user.id);
    if (!check.authorized) {
      connection.release();
      return res.status(403).json({ message: check.error });
    }

    await connection.beginTransaction();
    const table = type === 'lot' ? 'lot_assessment_history' : type === 'building' ? 'building_assessment_history' : 'property_assessments';
    const idColumn = type === 'lot' ? 'lot_id' : type === 'building' ? 'building_id' : 'property_id';
    
    await connection.query(
      `UPDATE ${table} SET assessment_status = 'submitted' WHERE ${idColumn} = ? AND assessor_user_id = ? AND assessment_status IN ('draft', 'returned')`,
      [check.intId, req.user.id]
    );

    await connection.query(
      `UPDATE assessment_assignments 
       SET assignment_status = 'submitted' 
       WHERE property_type = ? AND (target_id_int = ? OR target_id_str = ?) AND assigned_to_user_id = ?`,
      [type, check.intId, check.strId, req.user.id]
    );

    await logActivity(connection, req, 'SUBMIT', 'Assessments', `ID ${id}`, `Assessor submitted ${type} assessment for review`);
    await connection.commit();
    res.json({ message: 'Assessment submitted for review.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Admin reviews/approves/returns/rejects an assessment (Admin Only)
router.post('/assessments/:type/:id/review', authenticate, allowRoles('admin'), async (req, res, next) => {
  const { type, id } = req.params;
  const { status, reason } = req.body;
  
  if (!['approved', 'rejected', 'returned'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be approved, rejected, or returned.' });
  }

  if ((status === 'returned' || status === 'rejected') && (!reason || !reason.trim())) {
    return res.status(400).json({ message: `A reason is required to ${status === 'returned' ? 'return for correction' : 'reject'} an assessment.` });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const table = type === 'lot' ? 'lot_assessment_history' : type === 'building' ? 'building_assessment_history' : 'property_assessments';
    const idColumn = type === 'lot' ? 'lot_id' : type === 'building' ? 'building_id' : 'property_id';
    const pkColumn = type === 'lot' ? 'lot_assessment_history_id' : type === 'building' ? 'building_assessment_history_id' : 'assessment_id';
    
    let cleanId = null;
    if (typeof id === 'number') {
      cleanId = id;
    } else if (typeof id === 'string') {
      const match = id.match(/(?:BLDG|LOT|PROP)?[-_]?(\d+)$/i);
      if (match) cleanId = parseInt(match[1], 10);
      else if (/^\d+$/.test(id.trim())) cleanId = parseInt(id.trim(), 10);
    }

    // Resolve target assessment row safely without comparing text to integer columns
    let existingRows = [];
    if (cleanId) {
      [existingRows] = await connection.query(
        `SELECT ${pkColumn} AS id, ${idColumn} AS target_id, assessor_user_id, market_value, assessed_value 
         FROM ${table} 
         WHERE (${idColumn} = ? OR ${pkColumn} = ?) AND assessment_status = 'submitted'`,
        [cleanId, cleanId]
      );
    }
    if (existingRows.length === 0) {
      // If not resolved by numeric ID, resolve via property/lot/building table using code/name
      let resolvedTargetInt = null;
      if (type === 'building') {
        const [b] = await connection.query('SELECT building_id FROM property_buildings WHERE building_code = ? OR building_name = ? LIMIT 1', [id, id]);
        if (b[0]) resolvedTargetInt = b[0].building_id;
      } else if (type === 'lot') {
        const [l] = await connection.query('SELECT lot_id FROM property_lots WHERE lot_number = ? LIMIT 1', [id]);
        if (l[0]) resolvedTargetInt = l[0].lot_id;
      } else {
        const [p] = await connection.query('SELECT property_id FROM properties WHERE property_code = ? LIMIT 1', [id]);
        if (p[0]) resolvedTargetInt = p[0].property_id;
      }
      if (resolvedTargetInt) {
        [existingRows] = await connection.query(
          `SELECT ${pkColumn} AS id, ${idColumn} AS target_id, assessor_user_id, market_value, assessed_value 
           FROM ${table} 
           WHERE ${idColumn} = ? AND assessment_status = 'submitted'`,
          [resolvedTargetInt]
        );
      }
    }

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'No submitted assessment awaiting review was found with this ID.' });
    }

    const assessmentRow = existingRows[0];
    const actualTargetId = assessmentRow.target_id;
    const assessorId = assessmentRow.assessor_user_id;

    // Update assessment table
    await connection.query(
      `UPDATE ${table} 
       SET assessment_status = ?, head_assessor_id = ?, approval_date = CURRENT_TIMESTAMP, rejection_reason = ? 
       WHERE ${pkColumn} = ?`,
      [status, req.user.id, reason ? reason.trim() : null, assessmentRow.id]
    );

    // Sync status to assessment_assignments
    const mapAssignmentStatus = (s) => s === 'returned' ? 'returned_for_correction' : s;
    await connection.query(
      `UPDATE assessment_assignments 
       SET assignment_status = ? 
       WHERE property_type = ? AND (target_id_int = ? OR target_id_str = ?)`,
      [mapAssignmentStatus(status), type, actualTargetId, actualTargetId]
    );

    // If approved, update property and lot/building status and values to active
    if (status === 'approved') {
      if (type === 'lot') {
        await connection.query('UPDATE property_lots SET lot_status = "active" WHERE lot_id = ?', [actualTargetId]);
        await connection.query('UPDATE properties SET property_status = "active" WHERE property_id = (SELECT property_id FROM property_lots WHERE lot_id = ?)', [actualTargetId]);
      } else if (type === 'building') {
        await connection.query('UPDATE property_buildings SET building_status = "active" WHERE building_id = ?', [actualTargetId]);
        await connection.query('UPDATE properties SET property_status = "active" WHERE property_id = (SELECT property_id FROM property_buildings WHERE building_id = ?)', [actualTargetId]);
      } else {
        await connection.query('UPDATE properties SET property_status = "active" WHERE property_id = ?', [actualTargetId]);
      }

      await createNotification(
        assessorId,
        'Assessment Approved',
        `Your assessment for ${type.toUpperCase()} #${actualTargetId} has been officially approved by Head Assessor.`,
        'ASSESSMENT_APPROVED',
        String(actualTargetId)
      );
    } else if (status === 'returned') {
      await createNotification(
        assessorId,
        'Assessment Returned for Correction',
        `Your assessment for ${type.toUpperCase()} #${actualTargetId} was returned for correction: ${reason.trim()}`,
        'ASSESSMENT_RETURNED',
        String(actualTargetId)
      );
    } else if (status === 'rejected') {
      await createNotification(
        assessorId,
        'Assessment Rejected',
        `Your assessment for ${type.toUpperCase()} #${actualTargetId} was rejected: ${reason.trim()}`,
        'ASSESSMENT_REJECTED',
        String(actualTargetId)
      );
    }

    const activityMsg = status === 'returned' 
      ? `Admin ${req.user.first_name || ''} returned Assessment ${id} for correction. Note: ${reason}`
      : status === 'rejected'
      ? `Admin ${req.user.first_name || ''} rejected Assessment ${id}. Reason: ${reason}`
      : `Admin ${req.user.first_name || ''} approved Assessment ${id}.`;

    await logActivity(connection, req, status.toUpperCase(), 'Assessments', `ID ${id}`, activityMsg);
    await connection.commit();
    res.json({ message: `Assessment ${status === 'returned' ? 'returned for correction' : status} successfully.` });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

export default router;
