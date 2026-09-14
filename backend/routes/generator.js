import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'

const router = Router()
router.use(authenticate, allowRoles('admin', 'assessor', 'staff'))

// Get owner's properties with detailed information needed for certificates
router.get('/generator/owners/:id/properties', async (req, res, next) => {
  try {
    const ownerId = req.params.id
    // Query to get properties, joining lots, buildings, classifications, addresses, and tax declarations
    const [rows] = await pool.query(`
      SELECT 
        p.property_id, 
        p.property_status,
        t.property_type_name,
        c.classification_name,
        CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location,
        br.barangay_name,
        mu.municipality_name,
        pr.province_name,
        l.lot_area,
        b.floor_area,
        td.declaration_number as tax_declaration_no,
        pa.assessed_value,
        pa.market_value,
        po.first_name, po.middle_name, po.last_name, po.contact_number
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
          SELECT property_id, MAX(assessment_date)
          FROM property_assessments
          GROUP BY property_id
        )
      ) pa ON pa.property_id = p.property_id
      LEFT JOIN tax_declarations td ON td.assessment_id = pa.assessment_id
      WHERE p.owner_id = ?
      ORDER BY p.property_id DESC
    `, [ownerId])
    
    res.json(rows)
  } catch (e) { next(e) }
})

// Get all generated certificates
router.get('/generator/certificates', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT gc.*,
        CONCAT(po.first_name, ' ', po.last_name) AS owner_name,
        CONCAT(u.first_name, ' ', u.last_name) AS generated_by_name
      FROM generated_certificates gc
      JOIN property_owners po ON po.owner_id = gc.owner_id
      JOIN users u ON u.user_id = gc.issued_by_user_id
      ORDER BY gc.issued_at DESC
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

// Save a newly generated certificate
router.post('/generator/certificates', async (req, res, next) => {
  try {
    const { certificate_type, owner_id, property_id, requestor_name, purpose } = req.body
    
    // Generate a unique certificate number (e.g. CERT-YYYYMMDD-ID)
    const dateStr = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 8)
    const rand = Math.floor(1000 + Math.random() * 9000)
    const certificate_number = `CERT-${dateStr}-${rand}`

    const [result] = await pool.query(`
      INSERT INTO generated_certificates 
      (certificate_number, certificate_type, owner_id, property_id, requestor_name, purpose, issued_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      certificate_number,
      certificate_type,
      owner_id,
      property_id || null,
      requestor_name,
      purpose,
      req.user.id
    ])

    const [newCert] = await pool.query(`
      SELECT gc.*,
        CONCAT(po.first_name, ' ', po.last_name) AS owner_name,
        CONCAT(u.first_name, ' ', u.last_name) AS generated_by_name
      FROM generated_certificates gc
      JOIN property_owners po ON po.owner_id = gc.owner_id
      JOIN users u ON u.user_id = gc.issued_by_user_id
      WHERE certificate_id = ?
    `, [result.insertId])
    
    res.status(201).json(newCert[0])
  } catch (e) { next(e) }
})

export default router
