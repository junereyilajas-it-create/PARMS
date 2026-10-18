import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles, requireOwnership } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// Common query fragment for client properties
const propertySelect = `
  SELECT 
    p.property_id, 
    p.property_status, 
    l.lot_id, 
    l.lot_number, 
    l.title_number, 
    l.lot_area, 
    l.lot_status,
    b.building_id,
    b.building_name,
    b.floor_area,
    COALESCE(l.lot_area, b.floor_area, 0) AS area,
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location, 
    ad.street,
    br.barangay_name, 
    mu.municipality_name, 
    pr.province_name,
    p.owner_id,
    CONCAT(o.first_name, ' ', o.last_name) AS owner, 
    t.property_type_name AS property_type, 
    c.classification_name,
    td.declaration_number AS tax_declaration_no,
    COALESCE(a.market_value, 0) AS market_value, 
    COALESCE(a.assessed_value, 0) AS assessed_value,
    CASE WHEN a.assessment_id IS NOT NULL THEN 'ASSESSED' ELSE 'UNASSESSED' END AS assessment_status,
    a.assessment_date,
    (SELECT file_path FROM property_photos pp WHERE pp.property_id = p.property_id ORDER BY pp.is_primary DESC, pp.photo_id DESC LIMIT 1) AS photo_url,
    EXISTS (SELECT 1 FROM gis_locations g WHERE g.property_id = p.property_id) AS has_gis
  FROM properties p 
  JOIN property_owners o ON o.owner_id = p.owner_id 
  JOIN property_types t ON t.property_type_id = p.property_type_id
  JOIN property_classifications c ON c.classification_id = p.classification_id 
  JOIN addresses ad ON ad.address_id = p.address_id
  JOIN barangays br ON br.barangay_id = ad.barangay_id
  JOIN municipalities mu ON mu.municipality_id = br.municipality_id
  JOIN provinces pr ON pr.province_id = mu.province_id
  LEFT JOIN property_lots l ON l.property_id = p.property_id
  LEFT JOIN property_buildings b ON b.property_id = p.property_id
  LEFT JOIN (
    SELECT pa1.assessment_id, pa1.property_id, pa1.market_value, pa1.assessed_value, pa1.assessment_date
    FROM property_assessments pa1
    WHERE pa1.assessment_id = (
      SELECT pa2.assessment_id 
      FROM property_assessments pa2 
      WHERE pa2.property_id = pa1.property_id 
      ORDER BY pa2.assessment_date DESC, pa2.assessment_id DESC 
      LIMIT 1
    )
  ) a ON a.property_id = p.property_id
  LEFT JOIN tax_declarations td ON (td.property_id = p.property_id OR td.assessment_id = a.assessment_id)
`

// All client routes require 'client' role
router.use('/client', authenticate, allowRoles('client', 'owner'))

// 1. Client Dashboard Stats based on actual database records
router.get('/client/stats', async (req, res, next) => {
  try {
    if (!req.user.owner_id) {
      return res.json({ 
        total_properties: 0, 
        total_lots: 0, 
        total_buildings: 0, 
        assessed_properties: 0, 
        pending_assessments: 0,
        unassessed_properties: 0,
        total_requests: 0,
        pending_requests: 0,
        processing_requests: 0,
        approved_requests: 0,
        rejected_requests: 0
      })
    }

    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties WHERE owner_id = ?) as total_properties,
        (SELECT COUNT(*) FROM property_lots l JOIN properties p ON p.property_id = l.property_id WHERE p.owner_id = ?) as total_lots,
        (SELECT COUNT(*) FROM property_buildings b JOIN properties p ON p.property_id = b.property_id WHERE p.owner_id = ?) as total_buildings,
        (SELECT COUNT(*) FROM properties p WHERE p.owner_id = ? AND EXISTS (SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id)) as assessed_properties,
        (SELECT COUNT(*) FROM properties p WHERE p.owner_id = ? AND NOT EXISTS (SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id)) as pending_assessments,
        (SELECT COUNT(*) FROM certificate_requests WHERE user_id = ?) as total_requests,
        (SELECT COUNT(*) FROM certificate_requests WHERE user_id = ? AND status = 'PENDING') as pending_requests,
        (SELECT COUNT(*) FROM certificate_requests WHERE user_id = ? AND status IN ('PROCESSING', 'UNDER_REVIEW')) as processing_requests,
        (SELECT COUNT(*) FROM certificate_requests WHERE user_id = ? AND status IN ('APPROVED', 'COMPLETED')) as approved_requests,
        (SELECT COUNT(*) FROM certificate_requests WHERE user_id = ? AND status IN ('REJECTED', 'RETURNED')) as rejected_requests
    `, [
      req.user.owner_id, 
      req.user.owner_id, 
      req.user.owner_id, 
      req.user.owner_id, 
      req.user.owner_id,
      req.user.id,
      req.user.id,
      req.user.id,
      req.user.id,
      req.user.id
    ])

    const data = stats[0] || {}
    data.unassessed_properties = data.pending_assessments || 0
    res.json(data)
  } catch(e) { next(e) }
})

// 2. My Properties (List)
router.get('/client/my-properties', async (req, res, next) => {
  try {
    if (!req.user.owner_id) return res.json([])
    const [rows] = await pool.query(`${propertySelect} WHERE p.owner_id = ? ORDER BY p.property_id DESC`, [req.user.owner_id])
    res.json(rows)
  } catch (e) { next(e) }
})

// 3. My Property Details (with photos and GIS geometry)
router.get('/client/my-properties/:id', requireOwnership, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${propertySelect} WHERE p.property_id = ?`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Property not found' })

    const property = rows[0]

    // Fetch photos
    const [photos] = await pool.query(`
      SELECT photo_id, file_path, file_name, is_primary, caption, created_at 
      FROM property_photos 
      WHERE property_id = ? 
      ORDER BY is_primary DESC, photo_id DESC
    `, [property.property_id])

    // Fetch GIS coordinates if any
    const [gis] = await pool.query(`
      SELECT gis_id, geometry_type, coordinates, area_sqm, perimeter_m 
      FROM gis_locations 
      WHERE property_id = ? 
      LIMIT 1
    `, [property.property_id])

    // Fetch assessment history
    const [assessments] = await pool.query(`
      SELECT pa.*, CONCAT(u.first_name, ' ', u.last_name) AS assessor_name
      FROM property_assessments pa
      LEFT JOIN users u ON u.user_id = pa.assessor_id
      WHERE pa.property_id = ?
      ORDER BY pa.assessment_date DESC, pa.assessment_id DESC
    `, [property.property_id])

    res.json({
      ...property,
      photos,
      gis: gis.length > 0 ? gis[0] : null,
      assessments
    })
  } catch (e) { next(e) }
})

// 4. My GIS Properties (Properties with coordinates)
router.get('/client/my-gis', async (req, res, next) => {
  try {
    if (!req.user.owner_id) return res.json([])
    const [rows] = await pool.query(`
      SELECT 
        p.property_id, 
        t.property_type_name AS property_type,
        c.classification_name,
        CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name) AS location,
        br.barangay_name,
        g.geometry_type,
        g.coordinates,
        g.area_sqm,
        COALESCE(a.assessed_value, 0) AS assessed_value
      FROM properties p
      JOIN property_types t ON t.property_type_id = p.property_type_id
      JOIN property_classifications c ON c.classification_id = p.classification_id
      JOIN addresses ad ON ad.address_id = p.address_id
      JOIN barangays br ON br.barangay_id = ad.barangay_id
      JOIN municipalities mu ON mu.municipality_id = br.municipality_id
      JOIN gis_locations g ON g.property_id = p.property_id
      LEFT JOIN (
        SELECT property_id, assessed_value 
        FROM property_assessments 
        WHERE (property_id, assessment_date) IN (
          SELECT property_id, MAX(assessment_date) FROM property_assessments GROUP BY property_id
        )
      ) a ON a.property_id = p.property_id
      WHERE p.owner_id = ?
      ORDER BY p.property_id DESC
    `, [req.user.owner_id])
    res.json(rows)
  } catch (e) { next(e) }
})

// 5. Certificate Requests (List for Logged-in Owner)
router.get('/client/certificate-requests', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.request_id,
        c.reference_number,
        c.user_id,
        c.property_id,
        c.certificate_type,
        c.purpose,
        c.remarks,
        c.contact_number,
        c.status,
        c.rejection_reason,
        c.processing_notes,
        c.requested_at,
        c.reviewed_at,
        c.completed_at,
        c.certificate_id,
        gc.certificate_number,
        p.property_type_id,
        t.property_type_name,
        l.lot_number,
        b.building_name,
        td.declaration_number as tax_declaration_no,
        CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name) AS location,
        CONCAT(u.first_name, ' ', u.last_name) AS client_name,
        CONCAT(r.first_name, ' ', r.last_name) AS reviewer_name,
        CONCAT(st.first_name, ' ', st.last_name) AS staff_name
      FROM certificate_requests c
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN properties p ON p.property_id = c.property_id
      LEFT JOIN property_types t ON t.property_type_id = p.property_type_id
      LEFT JOIN property_lots l ON l.property_id = p.property_id
      LEFT JOIN property_buildings b ON b.property_id = p.property_id
      LEFT JOIN tax_declarations td ON td.property_id = p.property_id
      LEFT JOIN addresses ad ON p.address_id = ad.address_id
      LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
      LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
      LEFT JOIN users r ON r.user_id = c.reviewed_by
      LEFT JOIN users st ON st.user_id = c.assigned_to
      LEFT JOIN generated_certificates gc ON gc.certificate_id = c.certificate_id
      WHERE c.user_id = ?
      ORDER BY c.requested_at DESC
    `, [req.user.id])
    res.json(rows)
  } catch (e) { next(e) }
})

// 6. Create Certificate Request
router.post('/client/certificate-requests', requireOwnership, async (req, res, next) => {
  try {
    const { property_id, certificate_type, purpose, remarks, contact_number } = req.body
    
    if (!certificate_type || !certificate_type.trim()) {
      return res.status(400).json({ message: 'Certificate type is required.' })
    }
    if (!purpose || !purpose.trim()) {
      return res.status(400).json({ message: 'Purpose of request is required.' })
    }

    // Generate unique reference number: REQ-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    const reference_number = `REQ-${dateStr}-${rand}`

    const cleanPropId = property_id ? Number(String(property_id).replace(/[^0-9]/g, '')) : null

    // Get owner contact number fallback if not supplied
    let contact = contact_number?.trim() || null
    if (!contact && req.user.owner_id) {
      const [ownerRows] = await pool.query('SELECT contact_number FROM property_owners WHERE owner_id = ?', [req.user.owner_id])
      if (ownerRows[0]?.contact_number) contact = ownerRows[0].contact_number
    }

    const [result] = await pool.query(`
      INSERT INTO certificate_requests 
        (user_id, property_id, certificate_type, purpose, remarks, reference_number, contact_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `, [
      req.user.id, 
      cleanPropId, 
      certificate_type.trim(), 
      purpose.trim(), 
      remarks ? remarks.trim() : null, 
      reference_number,
      contact
    ])

    await logActivity(pool, req, 'CREATE', 'Certificate Requests', `Request ID ${result.insertId}`, `Submitted ${certificate_type} (${reference_number})`)

    res.status(201).json({ 
      id: result.insertId, 
      reference_number, 
      status: 'PENDING',
      message: `Certificate request ${reference_number} submitted successfully.` 
    })
  } catch (e) { next(e) }
})

// 7. Get Document Data for Approved Certificate Request (for Client Preview & Print)
router.get('/client/certificate-requests/:id/document', async (req, res, next) => {
  try {
    const requestId = req.params.id
    const [requests] = await pool.query(`
      SELECT c.*, 
        CONCAT(u.first_name, ' ', u.last_name) AS client_name,
        u.email AS client_email,
        p.owner_id
      FROM certificate_requests c
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN properties p ON p.property_id = c.property_id
      WHERE c.request_id = ? AND c.user_id = ?
    `, [requestId, req.user.id])

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Certificate request not found.' })
    }

    const reqData = requests[0]
    if (!['APPROVED', 'COMPLETED'].includes(reqData.status)) {
      return res.status(403).json({ message: 'Certificate has not been approved yet.' })
    }

    // If already linked to a generated_certificates record
    let generatedCert = null
    if (reqData.certificate_id) {
      const [certs] = await pool.query(`
        SELECT gc.*,
          CONCAT(po.first_name, ' ', po.last_name) AS owner_name,
          CONCAT(u.first_name, ' ', u.last_name) AS generated_by_name
        FROM generated_certificates gc
        JOIN property_owners po ON po.owner_id = gc.owner_id
        LEFT JOIN users u ON u.user_id = gc.issued_by_user_id
        WHERE gc.certificate_id = ?
      `, [reqData.certificate_id])
      if (certs.length > 0) generatedCert = certs[0]
    }

    // Property details
    let property = null
    let ownerProperties = []
    const propId = reqData.property_id

    if (propId) {
      const [props] = await pool.query(`
        SELECT 
          p.property_id, 
          p.property_status,
          p.owner_id,
          t.property_type_name,
          c.classification_name,
          CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location,
          ad.street,
          br.barangay_name,
          mu.municipality_name,
          pr.province_name,
          l.lot_number,
          l.title_number,
          l.lot_area,
          b.building_name,
          b.floor_area,
          COALESCE(l.lot_area, b.floor_area, 0) AS area,
          td.declaration_number as tax_declaration_no,
          pa.assessed_value,
          pa.market_value,
          po.first_name, 
          po.middle_name, 
          po.last_name, 
          po.contact_number, 
          po.email
        FROM properties p
        JOIN property_owners po ON po.owner_id = p.owner_id
        JOIN property_types t ON t.property_type_id = p.property_type_id
        JOIN property_classifications c ON c.classification_id = p.classification_id
        JOIN addresses ad ON ad.address_id = p.address_id
        JOIN barangays br ON br.barangay_id = ad.barangay_id
        JOIN municipalities mu ON mu.municipality_id = br.municipality_id
        JOIN provinces pr ON pr.province_id = mu.province_id
        LEFT JOIN property_lots l ON l.property_id = p.property_id
        LEFT JOIN property_buildings b ON b.property_id = p.property_id
        LEFT JOIN (
          SELECT assessment_id, property_id, assessed_value, market_value
          FROM property_assessments
          WHERE (property_id, assessment_date) IN (
            SELECT property_id, MAX(assessment_date) FROM property_assessments GROUP BY property_id
          )
        ) pa ON pa.property_id = p.property_id
        LEFT JOIN tax_declarations td ON (td.property_id = p.property_id OR td.assessment_id = pa.assessment_id)
        WHERE p.property_id = ?
      `, [propId])
      if (props.length > 0) property = props[0]
    }

    // Owner holdings if needed for holdings certificate
    if (req.user.owner_id) {
      const [holds] = await pool.query(`
        SELECT 
          p.property_id, 
          t.property_type_name,
          c.classification_name,
          CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name) AS location,
          br.barangay_name,
          COALESCE(l.lot_area, b.floor_area, 0) AS area,
          l.lot_area,
          b.floor_area,
          td.declaration_number AS tax_declaration_no,
          COALESCE(pa.assessed_value, 0) AS assessed_value,
          COALESCE(pa.market_value, 0) AS market_value
        FROM properties p
        JOIN property_types t ON t.property_type_id = p.property_type_id
        JOIN property_classifications c ON c.classification_id = p.classification_id
        JOIN addresses ad ON ad.address_id = p.address_id
        JOIN barangays br ON br.barangay_id = ad.barangay_id
        JOIN municipalities mu ON mu.municipality_id = br.municipality_id
        LEFT JOIN property_lots l ON l.property_id = p.property_id
        LEFT JOIN property_buildings b ON b.property_id = p.property_id
        LEFT JOIN (
          SELECT property_id, assessed_value, market_value 
          FROM property_assessments 
          WHERE (property_id, assessment_date) IN (
            SELECT property_id, MAX(assessment_date) FROM property_assessments GROUP BY property_id
          )
        ) pa ON pa.property_id = p.property_id
        LEFT JOIN tax_declarations td ON td.property_id = p.property_id
        WHERE p.owner_id = ?
        ORDER BY p.property_id ASC
      `, [req.user.owner_id])
      ownerProperties = holds
    }

    res.json({
      request: reqData,
      generatedCertificate: generatedCert,
      property,
      ownerProperties
    })
  } catch (e) { next(e) }
})

export default router
