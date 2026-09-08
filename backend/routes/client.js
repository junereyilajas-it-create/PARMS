import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles, requireOwnership } from '../middleware/auth.js'

const router = Router()

// Common query fragments
const propertySelect = `
  SELECT p.property_id, p.property_status, l.lot_id, l.lot_number, l.title_number, 
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location, 
    l.lot_area, g.latitude, g.longitude, l.lot_status,
    CONCAT(o.first_name, ' ', o.last_name) AS owner, t.property_type_name AS property_type, c.classification_name,
    COALESCE(a.market_value, 0) AS market_value, COALESCE(a.assessed_value, 0) AS assessed_value
  FROM properties p 
  JOIN property_owners o ON o.owner_id = p.owner_id 
  JOIN property_types t ON t.property_type_id = p.property_type_id
  JOIN property_classifications c ON c.classification_id = p.classification_id 
  JOIN addresses ad ON ad.address_id = p.address_id
  JOIN barangays br ON br.barangay_id = ad.barangay_id
  JOIN municipalities mu ON mu.municipality_id = br.municipality_id
  JOIN provinces pr ON pr.province_id = mu.province_id
  LEFT JOIN property_lots l ON l.property_id = p.property_id
  LEFT JOIN gis_locations g ON g.property_id = p.property_id
  LEFT JOIN property_assessments a ON a.assessment_id = (SELECT pa.assessment_id FROM property_assessments pa WHERE pa.property_id = p.property_id ORDER BY pa.assessment_date DESC, pa.assessment_id DESC LIMIT 1)
`

// All client routes require 'client' role
router.use(authenticate, allowRoles('client'))

// 1. My Profile
router.get('/client/profile', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.role, u.owner_id, 
        po.contact_number 
      FROM users u
      LEFT JOIN property_owners po ON po.owner_id = u.owner_id
      WHERE u.user_id = ?
    `, [req.user.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Profile not found' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

router.put('/client/profile', async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { first_name, last_name, email, contact_number } = req.body
    await connection.beginTransaction()
    
    await connection.query('UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE user_id = ?', [first_name, last_name, email, req.user.id])
    
    if (req.user.owner_id) {
      await connection.query('UPDATE property_owners SET first_name = ?, last_name = ?, email = ?, contact_number = ? WHERE owner_id = ?', [first_name, last_name, email, contact_number || null, req.user.owner_id])
    }
    
    await connection.commit()
    res.json({ message: 'Profile updated successfully' })
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

// 2. My Properties (List)
router.get('/client/my-properties', async (req, res, next) => {
  try {
    if (!req.user.owner_id) return res.json([])
    const [rows] = await pool.query(`${propertySelect} WHERE p.owner_id = ? ORDER BY p.property_id DESC`, [req.user.owner_id])
    res.json(rows)
  } catch (e) { next(e) }
})

// 2. My Property Details (with ownership check)
router.get('/client/my-properties/:id', requireOwnership, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${propertySelect} WHERE p.property_id = ?`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Property not found' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

// 3. My GIS Map (List properties with coordinates)
router.get('/client/my-gis', async (req, res, next) => {
  try {
    if (!req.user.owner_id) return res.json([])
    const [rows] = await pool.query(`${propertySelect} WHERE p.owner_id = ? AND g.latitude IS NOT NULL AND g.longitude IS NOT NULL`, [req.user.owner_id])
    res.json(rows)
  } catch (e) { next(e) }
})

// 4. Certificate Requests (List)
router.get('/client/certificate-requests', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, p.property_type_id,
        CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name) AS location
      FROM certificate_requests c
      LEFT JOIN properties p ON p.property_id = c.property_id
      LEFT JOIN addresses ad ON p.address_id = ad.address_id
      LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
      LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
      WHERE c.user_id = ?
      ORDER BY c.requested_at DESC
    `, [req.user.id])
    res.json(rows)
  } catch (e) { next(e) }
})

// 5. Certificate Request Details
router.get('/client/certificate-requests/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, p.property_type_id,
        CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name) AS location
      FROM certificate_requests c
      LEFT JOIN properties p ON p.property_id = c.property_id
      LEFT JOIN addresses ad ON p.address_id = ad.address_id
      LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
      LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
      WHERE c.request_id = ? AND c.user_id = ?
    `, [req.params.id, req.user.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Certificate request not found' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

// 6. Create Certificate Request (requires ownership if property_id is provided)
router.post('/client/certificate-requests', requireOwnership, async (req, res, next) => {
  try {
    const { property_id, certificate_type, purpose, remarks } = req.body
    if (!certificate_type || !purpose) return res.status(400).json({ message: 'Certificate type and purpose are required.' })

    const [result] = await pool.query(`
      INSERT INTO certificate_requests (user_id, property_id, certificate_type, purpose, remarks)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.id, property_id || null, certificate_type, purpose, remarks || null])
    
    res.status(201).json({ id: result.insertId, message: 'Certificate request submitted successfully.' })
  } catch (e) { next(e) }
})

export default router
