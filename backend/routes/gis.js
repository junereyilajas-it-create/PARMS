import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

const LOT_GIS_QUERY = `
  SELECT 
    l.lot_id AS id,
    l.lot_id,
    l.property_id,
    l.lot_number AS title,
    l.title_number,
    l.lot_area AS area,
    l.lot_status AS status,
    'lot' AS type,
    p.property_status,
    pc.classification_name,
    pt.property_type_name,
    COALESCE(l.property_photo, p.property_photo, lah.property_photo) AS property_photo,
    o.owner_id,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name, NULLIF(o.suffix, '')) AS owner,
    o.suffix AS owner_suffix,
    o.contact_number AS owner_contact,
    o.email AS owner_email,
    CONCAT_WS(', ', NULLIF(oad.street, ''), obr.barangay_name, omu.municipality_name, opr.province_name) AS owner_address,
    ad.house_number,
    ad.street,
    br.barangay_name,
    mu.municipality_name,
    pr.province_name,
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS full_address,
    g.gis_id,
    g.geometry_type,
    g.coordinates,
    g.area_sqm,
    g.perimeter_m,
    g.mapped_by_user_id,
    g.mapped_at,
    CONCAT_WS(' ', map_u.first_name, map_u.last_name) AS mapped_by_name,
    CASE 
      WHEN g.gis_id IS NOT NULL 
           AND g.coordinates IS NOT NULL 
           AND g.coordinates != '' 
           AND g.coordinates != 'null' 
           AND g.coordinates != '[]' 
      THEN 1 
      ELSE 0 
    END AS is_mapped,
    CASE 
      WHEN g.gis_id IS NOT NULL 
           AND g.coordinates IS NOT NULL 
           AND g.coordinates != '' 
           AND g.coordinates != 'null' 
           AND g.coordinates != '[]' 
      THEN COALESCE(g.mapping_status, 'verified')
      ELSE 'unmapped' 
    END AS mapping_status,
    COALESCE(lah.assessment_status, pa.assessment_status, 'unassessed') AS assessment_status,
    CASE 
      WHEN COALESCE(lah.assessment_status, pa.assessment_status, 'unassessed') NOT IN ('unassessed', 'pending') 
           OR COALESCE(lah.assessed_value, pa.assessed_value, 0) > 0 THEN 1 
      ELSE 0 
    END AS is_assessed,
    COALESCE(lah.assessor_level, pa.assessor_level) AS assessor_level,
    COALESCE(lah.market_value, pa.market_value, 0) AS market_value,
    COALESCE(lah.assessed_value, pa.assessed_value, 0) AS assessed_value,
    COALESCE(lah.assessment_date, pa.assessment_date) AS assessment_date,
    CONCAT_WS(' ', u.first_name, u.last_name) AS assessor_name,
    aa.assignment_id,
    aa.assignment_status,
    aa.due_date AS assignment_due_date,
    CONCAT_WS(' ', assign_u.first_name, assign_u.last_name) AS assigned_assessor_name,
    mr.request_id AS latest_request_id,
    mr.request_type AS latest_request_type,
    mr.request_status AS latest_request_status,
    mr.reason AS latest_request_reason,
    mr.notes AS latest_request_notes,
    mr.rejection_reason AS latest_rejection_reason,
    mr.requested_by_user_id AS latest_requested_by_user_id,
    CONCAT_WS(' ', req_u.first_name, req_u.last_name) AS latest_requested_by_name,
    mr.created_at AS latest_request_created_at,
    mr.reviewed_at AS latest_request_reviewed_at,
    CONCAT_WS(' ', rev_u.first_name, rev_u.last_name) AS latest_reviewed_by_name
  FROM property_lots l
  JOIN properties p ON l.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN owner_addresses oa ON oa.owner_address_id = (
    SELECT oa2.owner_address_id FROM owner_addresses oa2 WHERE oa2.owner_id = o.owner_id LIMIT 1
  )
  LEFT JOIN addresses oad ON oad.address_id = oa.address_id
  LEFT JOIN barangays obr ON obr.barangay_id = oad.barangay_id
  LEFT JOIN municipalities omu ON omu.municipality_id = obr.municipality_id
  LEFT JOIN provinces opr ON opr.province_id = omu.province_id
  LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
  LEFT JOIN property_types pt ON p.property_type_id = pt.property_type_id
  LEFT JOIN addresses ad ON p.address_id = ad.address_id
  LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
  LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
  LEFT JOIN provinces pr ON mu.province_id = pr.province_id
  LEFT JOIN gis_locations g ON g.gis_id = (
    SELECT g2.gis_id FROM gis_locations g2 
    WHERE g2.lot_id = l.lot_id OR (g2.property_id = p.property_id AND g2.lot_id IS NULL AND g2.building_id IS NULL)
    ORDER BY g2.gis_id DESC LIMIT 1
  )
  LEFT JOIN users map_u ON map_u.user_id = g.mapped_by_user_id
  LEFT JOIN lot_assessment_history lah ON lah.lot_assessment_history_id = (
    SELECT h.lot_assessment_history_id FROM lot_assessment_history h 
    WHERE h.lot_id = l.lot_id 
    ORDER BY h.assessment_date DESC, h.lot_assessment_history_id DESC LIMIT 1
  )
  LEFT JOIN property_assessments pa ON pa.assessment_id = (
    SELECT a.assessment_id FROM property_assessments a 
    WHERE a.property_id = p.property_id 
    ORDER BY a.assessment_date DESC, a.assessment_id DESC LIMIT 1
  )
  LEFT JOIN users u ON u.user_id = COALESCE(lah.assessor_user_id, pa.assessor_user_id)
  LEFT JOIN assessment_assignments aa ON aa.assignment_id = (
    SELECT a2.assignment_id FROM assessment_assignments a2 
    WHERE a2.property_type = 'lot' AND (a2.target_id_int = l.lot_id OR a2.target_id_str = l.lot_number)
    AND a2.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted')
    ORDER BY a2.assignment_id DESC LIMIT 1
  )
  LEFT JOIN users assign_u ON assign_u.user_id = aa.assigned_to_user_id
  LEFT JOIN gis_mapping_requests mr ON mr.request_id = (
    SELECT mr2.request_id FROM gis_mapping_requests mr2
    WHERE mr2.property_id = p.property_id AND mr2.target_id = l.lot_id AND mr2.property_type = 'lot'
    ORDER BY mr2.request_id DESC LIMIT 1
  )
  LEFT JOIN users req_u ON req_u.user_id = mr.requested_by_user_id
  LEFT JOIN users rev_u ON rev_u.user_id = mr.reviewed_by_user_id
`

const BLDG_GIS_QUERY = `
  SELECT 
    b.building_id AS id,
    b.building_id,
    b.property_id,
    b.building_name AS title,
    b.building_type,
    b.floor_area AS area,
    b.floor_count,
    b.construction_type,
    b.year_constructed,
    b.building_status AS status,
    'building' AS type,
    p.property_status,
    pc.classification_name,
    pt.property_type_name,
    COALESCE(b.property_photo, p.property_photo, bah.property_photo) AS property_photo,
    o.owner_id,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name, NULLIF(o.suffix, '')) AS owner,
    o.suffix AS owner_suffix,
    o.contact_number AS owner_contact,
    o.email AS owner_email,
    CONCAT_WS(', ', NULLIF(oad.street, ''), obr.barangay_name, omu.municipality_name, opr.province_name) AS owner_address,
    ad.house_number,
    ad.street,
    br.barangay_name,
    mu.municipality_name,
    pr.province_name,
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS full_address,
    g.gis_id,
    g.geometry_type,
    g.coordinates,
    g.area_sqm,
    g.perimeter_m,
    g.mapped_by_user_id,
    g.mapped_at,
    CONCAT_WS(' ', map_u.first_name, map_u.last_name) AS mapped_by_name,
    CASE 
      WHEN g.gis_id IS NOT NULL 
           AND g.coordinates IS NOT NULL 
           AND g.coordinates != '' 
           AND g.coordinates != 'null' 
           AND g.coordinates != '[]' 
      THEN 1 
      ELSE 0 
    END AS is_mapped,
    CASE 
      WHEN g.gis_id IS NOT NULL 
           AND g.coordinates IS NOT NULL 
           AND g.coordinates != '' 
           AND g.coordinates != 'null' 
           AND g.coordinates != '[]' 
      THEN COALESCE(g.mapping_status, 'verified')
      ELSE 'unmapped' 
    END AS mapping_status,
    COALESCE(bah.assessment_status, pa.assessment_status, 'unassessed') AS assessment_status,
    CASE 
      WHEN COALESCE(bah.assessment_status, pa.assessment_status, 'unassessed') NOT IN ('unassessed', 'pending') 
           OR COALESCE(bah.assessed_value, pa.assessed_value, 0) > 0 THEN 1 
      ELSE 0 
    END AS is_assessed,
    COALESCE(bah.assessor_level, pa.assessor_level) AS assessor_level,
    COALESCE(bah.market_value, pa.market_value, 0) AS market_value,
    COALESCE(bah.assessed_value, pa.assessed_value, 0) AS assessed_value,
    COALESCE(bah.assessment_date, pa.assessment_date) AS assessment_date,
    CONCAT_WS(' ', u.first_name, u.last_name) AS assessor_name,
    aa.assignment_id,
    aa.assignment_status,
    aa.due_date AS assignment_due_date,
    CONCAT_WS(' ', assign_u.first_name, assign_u.last_name) AS assigned_assessor_name,
    mr.request_id AS latest_request_id,
    mr.request_type AS latest_request_type,
    mr.request_status AS latest_request_status,
    mr.reason AS latest_request_reason,
    mr.notes AS latest_request_notes,
    mr.rejection_reason AS latest_rejection_reason,
    mr.requested_by_user_id AS latest_requested_by_user_id,
    CONCAT_WS(' ', req_u.first_name, req_u.last_name) AS latest_requested_by_name,
    mr.created_at AS latest_request_created_at,
    mr.reviewed_at AS latest_request_reviewed_at,
    CONCAT_WS(' ', rev_u.first_name, rev_u.last_name) AS latest_reviewed_by_name
  FROM property_buildings b
  JOIN properties p ON b.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN owner_addresses oa ON oa.owner_address_id = (
    SELECT oa2.owner_address_id FROM owner_addresses oa2 WHERE oa2.owner_id = o.owner_id LIMIT 1
  )
  LEFT JOIN addresses oad ON oad.address_id = oa.address_id
  LEFT JOIN barangays obr ON obr.barangay_id = oad.barangay_id
  LEFT JOIN municipalities omu ON omu.municipality_id = obr.municipality_id
  LEFT JOIN provinces opr ON opr.province_id = omu.province_id
  LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
  LEFT JOIN property_types pt ON p.property_type_id = pt.property_type_id
  LEFT JOIN addresses ad ON p.address_id = ad.address_id
  LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
  LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
  LEFT JOIN provinces pr ON mu.province_id = pr.province_id
  LEFT JOIN gis_locations g ON g.gis_id = (
    SELECT g2.gis_id FROM gis_locations g2 
    WHERE g2.building_id = b.building_id OR (g2.property_id = p.property_id AND g2.lot_id IS NULL AND g2.building_id IS NULL)
    ORDER BY g2.gis_id DESC LIMIT 1
  )
  LEFT JOIN users map_u ON map_u.user_id = g.mapped_by_user_id
  LEFT JOIN building_assessment_history bah ON bah.building_assessment_history_id = (
    SELECT h.building_assessment_history_id FROM building_assessment_history h 
    WHERE h.building_id = b.building_id 
    ORDER BY h.assessment_date DESC, h.building_assessment_history_id DESC LIMIT 1
  )
  LEFT JOIN property_assessments pa ON pa.assessment_id = (
    SELECT a.assessment_id FROM property_assessments a 
    WHERE a.property_id = p.property_id 
    ORDER BY a.assessment_date DESC, a.assessment_id DESC LIMIT 1
  )
  LEFT JOIN users u ON u.user_id = COALESCE(bah.assessor_user_id, pa.assessor_user_id)
  LEFT JOIN assessment_assignments aa ON aa.assignment_id = (
    SELECT a2.assignment_id FROM assessment_assignments a2 
    WHERE a2.property_type = 'building' AND (a2.target_id_int = b.building_id OR a2.target_id_str = b.building_name)
    AND a2.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted')
    ORDER BY a2.assignment_id DESC LIMIT 1
  )
  LEFT JOIN users assign_u ON assign_u.user_id = aa.assigned_to_user_id
  LEFT JOIN gis_mapping_requests mr ON mr.request_id = (
    SELECT mr2.request_id FROM gis_mapping_requests mr2
    WHERE mr2.property_id = p.property_id AND mr2.target_id = b.building_id AND mr2.property_type = 'building'
    ORDER BY mr2.request_id DESC LIMIT 1
  )
  LEFT JOIN users req_u ON req_u.user_id = mr.requested_by_user_id
  LEFT JOIN users rev_u ON rev_u.user_id = mr.reviewed_by_user_id
`

// Admin/Staff/Assessor/SuperAdmin view all properties (both mapped and unmapped)
router.get('/gis/properties', authenticate, allowRoles('admin', 'assessor', 'staff', 'super_admin'), async (req, res, next) => {
  try {
    const [lots] = await pool.query(LOT_GIS_QUERY + ' ORDER BY l.lot_id DESC')
    const [buildings] = await pool.query(BLDG_GIS_QUERY + ' ORDER BY b.building_id DESC')
    res.json({ lots, buildings })
  } catch (e) {
    next(e)
  }
})

// Client view their own properties
router.get('/gis/client-properties', authenticate, allowRoles('client', 'owner'), async (req, res, next) => {
  try {
    const owner_id = req.user.owner_id
    if (!owner_id) {
      return res.json({ lots: [], buildings: [] })
    }

    const [lots] = await pool.query(`${LOT_GIS_QUERY} WHERE p.owner_id = ? ORDER BY l.lot_id DESC`, [owner_id])
    const [buildings] = await pool.query(`${BLDG_GIS_QUERY} WHERE p.owner_id = ? ORDER BY b.building_id DESC`, [owner_id])
    res.json({ lots, buildings })
  } catch (e) {
    next(e)
  }
})

// Get single property details by unique entity or property id
router.get('/gis/property/:id', authenticate, allowRoles('admin', 'assessor', 'staff', 'super_admin', 'client', 'owner'), async (req, res, next) => {
  try {
    const id = req.params.id
    // Check if it's a lot
    const [lotRows] = await pool.query(`${LOT_GIS_QUERY} WHERE l.lot_id = ? OR l.property_id = ? OR l.lot_number = ? LIMIT 1`, [id, id, id])
    if (lotRows.length > 0) {
      const lot = lotRows[0]
      // Privacy check: client or owner can only view their own properties
      if (['client', 'owner'].includes(req.user.role) && req.user.owner_id && lot.owner_id !== req.user.owner_id) {
        return res.status(403).json({ message: 'Unauthorized to access this property record' })
      }
      const [photoRows] = await pool.query(
        `SELECT photo_id, property_id, lot_id, building_id, file_path, file_name, file_size, is_primary, created_at
         FROM property_photos 
         WHERE property_id = ? OR lot_id = ? 
         ORDER BY is_primary DESC, photo_id ASC`,
        [lot.property_id, lot.lot_id]
      )
      return res.json({ ...lot, type: 'lot', photos: photoRows })
    }

    // Check if it's a building
    const [bldgRows] = await pool.query(`${BLDG_GIS_QUERY} WHERE b.building_id = ? OR b.property_id = ? OR b.building_name = ? LIMIT 1`, [id, id, id])
    if (bldgRows.length > 0) {
      const bldg = bldgRows[0]
      // Privacy check: client or owner can only view their own properties
      if (['client', 'owner'].includes(req.user.role) && req.user.owner_id && bldg.owner_id !== req.user.owner_id) {
        return res.status(403).json({ message: 'Unauthorized to access this property record' })
      }
      const [photoRows] = await pool.query(
        `SELECT photo_id, property_id, lot_id, building_id, file_path, file_name, file_size, is_primary, created_at
         FROM property_photos 
         WHERE property_id = ? OR building_id = ? 
         ORDER BY is_primary DESC, photo_id ASC`,
        [bldg.property_id, bldg.building_id]
      )
      return res.json({ ...bldg, type: 'building', photos: photoRows })
    }

    return res.status(404).json({ message: 'Property not found' })
  } catch (e) {
    next(e)
  }
})

// ==========================================
// GIS MAPPING REQUESTS WORKFLOW ENDPOINTS
// ==========================================

// Get mapping requests
// Staff sees own requests; Admin, Super Admin & Assessor see all requests
router.get('/gis/requests', authenticate, allowRoles('admin', 'assessor', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const isStaff = req.user.role === 'staff'
    const statusFilter = req.query.status

    let sql = `
      SELECT 
        mr.request_id,
        mr.property_id,
        mr.property_type,
        mr.target_id,
        mr.request_type,
        mr.reason,
        mr.notes,
        mr.request_status,
        mr.rejection_reason,
        mr.requested_by_user_id,
        CONCAT_WS(' ', req_u.first_name, req_u.last_name) AS requested_by_name,
        mr.reviewed_by_user_id,
        CONCAT_WS(' ', rev_u.first_name, rev_u.last_name) AS reviewed_by_name,
        mr.completed_by_user_id,
        CONCAT_WS(' ', comp_u.first_name, comp_u.last_name) AS completed_by_name,
        mr.created_at,
        mr.reviewed_at,
        mr.completed_at,
        COALESCE(l.lot_number, b.building_name, CONCAT('Property #', p.property_id)) AS property_title,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name, NULLIF(o.suffix, '')) AS owner_name,
        br.barangay_name,
        CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name) AS full_address,
        CASE 
          WHEN g.gis_id IS NOT NULL AND g.coordinates IS NOT NULL AND g.coordinates != '' AND g.coordinates != 'null' AND g.coordinates != '[]' 
          THEN 'mapped' 
          ELSE 'unmapped' 
        END AS current_mapping_status
      FROM gis_mapping_requests mr
      JOIN properties p ON mr.property_id = p.property_id
      LEFT JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN property_lots l ON (mr.property_type = 'lot' AND l.lot_id = mr.target_id)
      LEFT JOIN property_buildings b ON (mr.property_type = 'building' AND b.building_id = mr.target_id)
      LEFT JOIN addresses ad ON p.address_id = ad.address_id
      LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
      LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
      LEFT JOIN gis_locations g ON (g.property_id = mr.property_id AND (g.lot_id = mr.target_id OR g.building_id = mr.target_id OR (g.lot_id IS NULL AND g.building_id IS NULL)))
      LEFT JOIN users req_u ON req_u.user_id = mr.requested_by_user_id
      LEFT JOIN users rev_u ON rev_u.user_id = mr.reviewed_by_user_id
      LEFT JOIN users comp_u ON comp_u.user_id = mr.completed_by_user_id
      WHERE 1=1
    `
    const params = []

    if (isStaff) {
      sql += ' AND mr.requested_by_user_id = ?'
      params.push(req.user.id)
    }

    if (statusFilter && ['pending', 'approved', 'rejected', 'completed', 'cancelled'].includes(statusFilter)) {
      sql += ' AND mr.request_status = ?'
      params.push(statusFilter)
    }

    sql += ' ORDER BY mr.request_id DESC'

    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

// Submit a mapping request (Staff, Admin, Assessor, Super Admin)
router.post('/gis/requests', authenticate, allowRoles('staff', 'admin', 'assessor', 'super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { property_id, property_type, target_id, request_type, reason, notes } = req.body

    if (!property_id || !property_type || !target_id || !reason || !reason.trim()) {
      return res.status(400).json({ message: 'Property ID, property type, target ID, and reason are required.' })
    }

    if (!['lot', 'building'].includes(property_type)) {
      return res.status(400).json({ message: "Invalid property type. Must be 'lot' or 'building'." })
    }

    const validRequestType = request_type === 'mapping_update' ? 'mapping_update' : 'initial_mapping'

    await connection.beginTransaction()

    // Verify property exists
    const [propCheck] = await connection.query('SELECT property_id FROM properties WHERE property_id = ?', [property_id])
    if (!propCheck.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Property record not found.' })
    }

    // Prevent duplicate pending requests for the same property entity and request type
    const [existingPending] = await connection.query(
      `SELECT request_id FROM gis_mapping_requests 
       WHERE property_id = ? AND target_id = ? AND property_type = ? AND request_status = 'pending'`,
      [property_id, target_id, property_type]
    )

    if (existingPending.length > 0) {
      await connection.rollback()
      return res.status(400).json({ message: 'A pending mapping request already exists for this property.' })
    }

    // Insert request
    const [insertResult] = await connection.query(
      `INSERT INTO gis_mapping_requests 
       (property_id, property_type, target_id, requested_by_user_id, request_type, reason, notes, request_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [property_id, property_type, target_id, req.user.id, validRequestType, reason.trim(), notes?.trim() || null]
    )

    const requestId = insertResult.insertId
    await logActivity(connection, req, 'CREATE', 'GIS_REQUEST', `Request #${requestId}`, `Submitted ${validRequestType} request for ${property_type} ${target_id}`)

    await connection.commit()

    res.status(201).json({
      message: 'Mapping request submitted successfully and is pending review.',
      request_id: requestId,
      status: 'pending'
    })
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

// Review mapping request: Approve or Reject (Admin & Super Admin only)
router.put('/gis/requests/:id/review', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const requestId = req.params.id
    const { action, rejection_reason } = req.body

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Action must be either 'approve' or 'reject'." })
    }

    if (action === 'reject' && (!rejection_reason || !rejection_reason.trim())) {
      return res.status(400).json({ message: 'A rejection reason is required when rejecting a mapping request.' })
    }

    await connection.beginTransaction()

    const [rows] = await connection.query('SELECT * FROM gis_mapping_requests WHERE request_id = ? FOR UPDATE', [requestId])
    if (!rows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Mapping request not found.' })
    }

    const request = rows[0]
    if (request.request_status !== 'pending') {
      await connection.rollback()
      return res.status(400).json({ message: `Cannot review request because its current status is '${request.request_status}'. Only pending requests can be reviewed.` })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const finalRejectionReason = action === 'reject' ? rejection_reason.trim() : null

    await connection.query(
      `UPDATE gis_mapping_requests 
       SET request_status = ?, reviewed_by_user_id = ?, reviewed_at = NOW(), rejection_reason = ?
       WHERE request_id = ?`,
      [newStatus, req.user.id, finalRejectionReason, requestId]
    )

    await logActivity(connection, req, 'UPDATE', 'GIS_REQUEST', `Request #${requestId}`, `${action.toUpperCase()}D mapping request for ${request.property_type} ${request.target_id}`)

    await connection.commit()

    res.json({
      message: `Mapping request successfully ${action}d.`,
      request_id: requestId,
      status: newStatus
    })
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

// Cancel mapping request (Staff can cancel their own pending requests; Admin/Super Admin can also cancel)
router.put('/gis/requests/:id/cancel', authenticate, allowRoles('staff', 'admin', 'super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const requestId = req.params.id

    await connection.beginTransaction()

    const [rows] = await connection.query('SELECT * FROM gis_mapping_requests WHERE request_id = ? FOR UPDATE', [requestId])
    if (!rows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Mapping request not found.' })
    }

    const request = rows[0]

    // Staff can only cancel their own requests
    if (req.user.role === 'staff' && request.requested_by_user_id !== req.user.id) {
      await connection.rollback()
      return res.status(403).json({ message: 'You can only cancel your own mapping requests.' })
    }

    if (request.request_status !== 'pending') {
      await connection.rollback()
      return res.status(400).json({ message: `Only pending requests can be cancelled. Current status is '${request.request_status}'.` })
    }

    await connection.query(
      "UPDATE gis_mapping_requests SET request_status = 'cancelled' WHERE request_id = ?",
      [requestId]
    )

    await logActivity(connection, req, 'UPDATE', 'GIS_REQUEST', `Request #${requestId}`, `Cancelled mapping request for ${request.property_type} ${request.target_id}`)

    await connection.commit()

    res.json({
      message: 'Mapping request successfully cancelled.',
      request_id: requestId,
      status: 'cancelled'
    })
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

// ==========================================
// GIS SAVING ENDPOINTS WITH ROLE AUTHORIZATION
// ==========================================

// Save Lot GIS
// Admin and Super Admin can map directly. Staff requires an approved mapping request.
router.post('/gis/lots/:lotId', authenticate, allowRoles('admin', 'assessor', 'super_admin', 'staff'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const lot_id = req.params.lotId
    let { coordinates, area_sqm, perimeter_m, property_id, mapping_status } = req.body
    const statusToSave = mapping_status || 'verified'
    
    if (!coordinates || !property_id) {
      return res.status(400).json({ message: 'Coordinates and property_id are required' })
    }

    // Role Permission Check: Staff MUST have an approved mapping request before saving
    if (req.user.role === 'staff') {
      const [approvedReqs] = await connection.query(
        `SELECT request_id FROM gis_mapping_requests 
         WHERE property_id = ? AND target_id = ? AND property_type = 'lot' AND request_status = 'approved'
         ORDER BY request_id DESC LIMIT 1`,
        [property_id, lot_id]
      )

      if (approvedReqs.length === 0) {
        return res.status(403).json({
          message: 'Staff mapping requires an approved mapping request before saving GIS boundaries. Please submit a request and wait for Admin approval.'
        })
      }
    }

    let coordJson = coordinates
    if (typeof coordJson === 'string') {
      try { coordJson = JSON.parse(coordJson) } catch (e) {}
    }

    // Normalize coordinates to array if GeoJSON object provided
    let cleanCoords = coordJson
    if (coordJson?.geometry?.coordinates) {
      cleanCoords = coordJson.geometry.coordinates
    } else if (coordJson?.coordinates && !Array.isArray(coordJson)) {
      cleanCoords = coordJson.coordinates
    }

    await connection.beginTransaction()
    
    // Check if lot exists
    const [lotCheck] = await connection.query('SELECT lot_id FROM property_lots WHERE lot_id = ?', [lot_id])
    if (!lotCheck.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Lot not found' })
    }

    // Prevent duplicates: Check if GIS already exists for this lot or property
    const [existingGis] = await connection.query(
      'SELECT gis_id FROM gis_locations WHERE lot_id = ? OR (property_id = ? AND lot_id IS NULL AND building_id IS NULL)',
      [lot_id, property_id]
    )
    if (existingGis.length > 0) {
      await connection.query(`
        UPDATE gis_locations 
        SET property_id = ?, lot_id = ?, building_id = NULL, geometry_type = 'Polygon', coordinates = ?, area_sqm = ?, perimeter_m = ?, mapping_status = ?, mapped_by_user_id = ?, mapped_at = NOW()
        WHERE gis_id = ?
      `, [property_id, lot_id, JSON.stringify(cleanCoords), Number(area_sqm) || 0, Number(perimeter_m) || 0, statusToSave, req.user.id, existingGis[0].gis_id])
    } else {
      await connection.query(`
        INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m, mapping_status, mapped_by_user_id, mapped_at) 
        VALUES (?, ?, 'Polygon', ?, ?, ?, ?, ?, NOW())
      `, [property_id, lot_id, JSON.stringify(cleanCoords), Number(area_sqm) || 0, Number(perimeter_m) || 0, statusToSave, req.user.id])
    }

    // If an approved mapping request exists for this lot, mark it completed
    await connection.query(
      `UPDATE gis_mapping_requests 
       SET request_status = 'completed', completed_by_user_id = ?, completed_at = NOW() 
       WHERE property_id = ? AND target_id = ? AND property_type = 'lot' AND request_status = 'approved'`,
      [req.user.id, property_id, lot_id]
    )
    
    await logActivity(connection, req, 'CREATE', 'GIS', `Lot ${lot_id}`, `Updated GIS boundary for Lot ${lot_id}`)
    
    await connection.commit()
    res.status(201).json({ message: 'Lot GIS saved successfully', lot_id, property_id, mapping_status: statusToSave })
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

// Save Building GIS
// Admin and Super Admin can map directly. Staff requires an approved mapping request.
router.post('/gis/buildings/:buildingId', authenticate, allowRoles('admin', 'assessor', 'super_admin', 'staff'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const building_id = req.params.buildingId
    let { coordinates, area_sqm, perimeter_m, property_id, mapping_status } = req.body
    const statusToSave = mapping_status || 'verified'
    
    if (!coordinates || !property_id) {
      return res.status(400).json({ message: 'Coordinates and property_id are required' })
    }

    // Role Permission Check: Staff MUST have an approved mapping request before saving
    if (req.user.role === 'staff') {
      const [approvedReqs] = await connection.query(
        `SELECT request_id FROM gis_mapping_requests 
         WHERE property_id = ? AND target_id = ? AND property_type = 'building' AND request_status = 'approved'
         ORDER BY request_id DESC LIMIT 1`,
        [property_id, building_id]
      )

      if (approvedReqs.length === 0) {
        return res.status(403).json({
          message: 'Staff mapping requires an approved mapping request before saving GIS boundaries. Please submit a request and wait for Admin approval.'
        })
      }
    }

    let coordJson = coordinates
    if (typeof coordJson === 'string') {
      try { coordJson = JSON.parse(coordJson) } catch (e) {}
    }

    // Normalize coordinates to array if GeoJSON object provided
    let cleanCoords = coordJson
    if (coordJson?.geometry?.coordinates) {
      cleanCoords = coordJson.geometry.coordinates
    } else if (coordJson?.coordinates && !Array.isArray(coordJson)) {
      cleanCoords = coordJson.coordinates
    }

    await connection.beginTransaction()
    
    // Check if building exists
    const [bldgCheck] = await connection.query('SELECT building_id FROM property_buildings WHERE building_id = ?', [building_id])
    if (!bldgCheck.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Building not found' })
    }

    // Prevent duplicates: Check if GIS already exists for this building or property
    const [existingGis] = await connection.query(
      'SELECT gis_id FROM gis_locations WHERE building_id = ? OR (property_id = ? AND lot_id IS NULL AND building_id IS NULL)',
      [building_id, property_id]
    )
    if (existingGis.length > 0) {
      await connection.query(`
        UPDATE gis_locations 
        SET property_id = ?, building_id = ?, lot_id = NULL, geometry_type = 'Polygon', coordinates = ?, area_sqm = ?, perimeter_m = ?, mapping_status = ?, mapped_by_user_id = ?, mapped_at = NOW()
        WHERE gis_id = ?
      `, [property_id, building_id, JSON.stringify(cleanCoords), Number(area_sqm) || 0, Number(perimeter_m) || 0, statusToSave, req.user.id, existingGis[0].gis_id])
    } else {
      await connection.query(`
        INSERT INTO gis_locations (property_id, building_id, geometry_type, coordinates, area_sqm, perimeter_m, mapping_status, mapped_by_user_id, mapped_at) 
        VALUES (?, ?, 'Polygon', ?, ?, ?, ?, ?, NOW())
      `, [property_id, building_id, JSON.stringify(cleanCoords), Number(area_sqm) || 0, Number(perimeter_m) || 0, statusToSave, req.user.id])
    }

    // If an approved mapping request exists for this building, mark it completed
    await connection.query(
      `UPDATE gis_mapping_requests 
       SET request_status = 'completed', completed_by_user_id = ?, completed_at = NOW() 
       WHERE property_id = ? AND target_id = ? AND property_type = 'building' AND request_status = 'approved'`,
      [req.user.id, property_id, building_id]
    )
    
    await logActivity(connection, req, 'CREATE', 'GIS', `Building ${building_id}`, `Updated GIS boundary for Building ${building_id}`)
    
    await connection.commit()
    res.status(201).json({ message: 'Building GIS saved successfully', building_id, property_id })
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

// Delete Lot GIS
router.delete('/gis/lots/:lotId', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM gis_locations WHERE lot_id = ?', [req.params.lotId])
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

// Delete Building GIS
router.delete('/gis/buildings/:buildingId', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM gis_locations WHERE building_id = ?', [req.params.buildingId])
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

export default router
