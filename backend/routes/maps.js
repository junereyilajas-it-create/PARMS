import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()

const mapsBaseQuery = `SELECT l.*, NULL AS latitude, NULL AS longitude, 
  CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location, 
  p.property_status, o.first_name, o.last_name 
  FROM property_lots l 
  JOIN properties p ON p.property_id = l.property_id 
  JOIN property_owners o ON o.owner_id = p.owner_id 
  JOIN addresses ad ON ad.address_id = p.address_id 
  JOIN barangays br ON br.barangay_id = ad.barangay_id 
  JOIN municipalities mu ON mu.municipality_id = br.municipality_id 
  JOIN provinces pr ON pr.province_id = mu.province_id`

router.get('/maps/properties', authenticate, allowRoles('admin', 'assessor', 'staff'), async (_, res, next) => { try { const [rows] = await pool.query(`${mapsBaseQuery} WHERE EXISTS (SELECT 1 FROM gis_locations g WHERE g.property_id = p.property_id)`); res.json(rows) } catch (e) { next(e) } })
router.get('/maps/property/:id', authenticate, allowRoles('admin', 'assessor', 'staff'), async (req, res, next) => { try { const [rows] = await pool.query(`${mapsBaseQuery} WHERE l.lot_id = ?`, [req.params.id]); if (rows[0]) res.json(rows[0]); else res.status(404).json({ message: 'Property not found' }) } catch (e) { next(e) } })
router.get('/maps/barangay/:barangay', authenticate, allowRoles('admin', 'assessor', 'staff'), async (req, res, next) => { try { const [rows] = await pool.query(`${mapsBaseQuery} WHERE br.barangay_name LIKE ? AND EXISTS (SELECT 1 FROM gis_locations g WHERE g.property_id = p.property_id)`, [`%${req.params.barangay}%`]); res.json(rows) } catch (e) { next(e) } })
router.post('/maps/location', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => { res.status(400).json({ message: 'Deprecated endpoint' }) })
router.put('/maps/location/:id', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => { res.status(400).json({ message: 'Deprecated endpoint' }) })
export default router
