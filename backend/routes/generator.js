import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'

const router = Router()
router.use('/generator', authenticate, allowRoles('super_admin', 'admin', 'assessor', 'staff'))

// Get owner's properties with detailed information needed for certificates
router.get('/generator/owners/:id/properties', async (req, res, next) => {
  try {
    const ownerId = req.params.id
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
      LEFT JOIN tax_declarations td ON (td.property_id = p.property_id OR td.assessment_id = pa.assessment_id)
      WHERE p.owner_id = ?
      ORDER BY p.property_id DESC
    `, [ownerId])
    
    res.json(rows)
  } catch (e) { next(e) }
})

// Get detailed property records for certificate generation/preview
router.get('/generator/properties/:id', async (req, res, next) => {
  try {
    const rawId = req.params.id
    const propertyId = String(rawId).replace(/[^0-9]/g, '')
    if (!propertyId) {
      return res.status(400).json({ message: 'Invalid property ID' })
    }

    const [rows] = await pool.query(`
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
        l.lot_id,
        l.lot_number,
        l.title_number,
        l.lot_area,
        b.building_id,
        b.building_name,
        b.floor_area,
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
          SELECT property_id, MAX(assessment_date)
          FROM property_assessments
          GROUP BY property_id
        )
      ) pa ON pa.property_id = p.property_id
      LEFT JOIN tax_declarations td ON (td.property_id = p.property_id OR td.assessment_id = pa.assessment_id)
      WHERE p.property_id = ?
      LIMIT 1
    `, [propertyId])

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Property record not found' })
    }

    const property = rows[0]

    // Fetch the latest generated certificate for this property if any exists
    const [latestCerts] = await pool.query(`
      SELECT gc.*,
        CONCAT(po.first_name, ' ', po.last_name) AS owner_name,
        CONCAT(u.first_name, ' ', u.last_name) AS generated_by_name
      FROM generated_certificates gc
      JOIN property_owners po ON po.owner_id = gc.owner_id
      LEFT JOIN users u ON u.user_id = gc.issued_by_user_id
      WHERE gc.property_id = ?
      ORDER BY gc.certificate_id DESC
      LIMIT 1
    `, [propertyId])

    const latestCertificate = latestCerts.length > 0 ? latestCerts[0] : null

    // Fetch all properties of this owner (for Template 2: Property Holdings)
    const [ownerProperties] = await pool.query(`
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
        po.first_name, po.middle_name, po.last_name
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
      LEFT JOIN tax_declarations td ON (td.property_id = p.property_id OR td.assessment_id = pa.assessment_id)
      WHERE p.owner_id = ?
      ORDER BY p.property_id ASC
    `, [property.owner_id])

    res.json({
      property,
      latestCertificate,
      ownerProperties
    })
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
      LEFT JOIN users u ON u.user_id = gc.issued_by_user_id
      ORDER BY gc.issued_at DESC
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

// Save a newly generated certificate
router.post('/generator/certificates', async (req, res, next) => {
  try {
    const { 
      certificate_type, 
      owner_id, 
      property_id, 
      requestor_name, 
      purpose,
      custom_owner_name,
      custom_tax_declaration_no,
      signer_name,
      signer_title,
      or_number
    } = req.body
    
    if (!certificate_type) {
      return res.status(400).json({ message: 'Certificate type is required' })
    }
    if (!owner_id) {
      return res.status(400).json({ message: 'Owner ID is required' })
    }
    if (!requestor_name || !requestor_name.trim()) {
      return res.status(400).json({ message: 'Requestor name is required' })
    }
    if (!purpose || !purpose.trim()) {
      return res.status(400).json({ message: 'Purpose is required' })
    }

    const cleanPropId = property_id ? Number(String(property_id).replace(/[^0-9]/g, '')) : null

    // Generate a unique certificate number (e.g. CERT-YYYYMMDD-ID)
    const dateStr = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 8)
    const rand = Math.floor(1000 + Math.random() * 9000)
    const certificate_number = `CERT-${dateStr}-${rand}`

    const [result] = await pool.query(`
      INSERT INTO generated_certificates 
      (certificate_number, certificate_type, owner_id, property_id, requestor_name, purpose, issued_by_user_id, custom_owner_name, custom_tax_declaration_no, signer_name, signer_title, or_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      certificate_number,
      certificate_type,
      owner_id,
      cleanPropId,
      requestor_name.trim(),
      purpose.trim(),
      req.user.id,
      custom_owner_name ? custom_owner_name.trim() : null,
      custom_tax_declaration_no ? custom_tax_declaration_no.trim() : null,
      signer_name ? signer_name.trim() : null,
      signer_title ? signer_title.trim() : null,
      or_number ? or_number.trim() : null
    ])

    const [newCert] = await pool.query(`
      SELECT gc.*,
        CONCAT(po.first_name, ' ', po.last_name) AS owner_name,
        CONCAT(u.first_name, ' ', u.last_name) AS generated_by_name
      FROM generated_certificates gc
      JOIN property_owners po ON po.owner_id = gc.owner_id
      LEFT JOIN users u ON u.user_id = gc.issued_by_user_id
      WHERE certificate_id = ?
    `, [result.insertId])
    
    res.status(201).json(newCert[0])
  } catch (e) { next(e) }
})

// Update an existing certificate record (overrides & metadata)
router.put('/generator/certificates/:id', async (req, res, next) => {
  try {
    const certId = req.params.id
    const { 
      certificate_type, 
      requestor_name, 
      purpose,
      custom_owner_name,
      custom_tax_declaration_no,
      signer_name,
      signer_title,
      or_number
    } = req.body

    if (!requestor_name || !requestor_name.trim()) {
      return res.status(400).json({ message: 'Requestor name is required' })
    }
    if (!purpose || !purpose.trim()) {
      return res.status(400).json({ message: 'Purpose is required' })
    }

    await pool.query(`
      UPDATE generated_certificates
      SET 
        certificate_type = COALESCE(?, certificate_type),
        requestor_name = ?,
        purpose = ?,
        custom_owner_name = ?,
        custom_tax_declaration_no = ?,
        signer_name = ?,
        signer_title = ?,
        or_number = ?
      WHERE certificate_id = ?
    `, [
      certificate_type || null,
      requestor_name.trim(),
      purpose.trim(),
      custom_owner_name ? custom_owner_name.trim() : null,
      custom_tax_declaration_no ? custom_tax_declaration_no.trim() : null,
      signer_name ? signer_name.trim() : null,
      signer_title ? signer_title.trim() : null,
      or_number ? or_number.trim() : null,
      certId
    ])

    const [updatedCert] = await pool.query(`
      SELECT gc.*,
        CONCAT(po.first_name, ' ', po.last_name) AS owner_name,
        CONCAT(u.first_name, ' ', u.last_name) AS generated_by_name
      FROM generated_certificates gc
      JOIN property_owners po ON po.owner_id = gc.owner_id
      LEFT JOIN users u ON u.user_id = gc.issued_by_user_id
      WHERE certificate_id = ?
    `, [certId])

    if (!updatedCert || updatedCert.length === 0) {
      return res.status(404).json({ message: 'Certificate record not found' })
    }

    res.json(updatedCert[0])
  } catch (e) { next(e) }
})

export default router
