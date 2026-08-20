import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()

const mapsBaseQuery = `SELECT l.*, g.latitude, g.longitude, 
  CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location, 
  p.property_status, o.first_name, o.last_name 
  FROM property_lots l 
  JOIN properties p ON p.property_id = l.property_id 
  JOIN property_owners o ON o.owner_id = p.owner_id 
  JOIN gis_locations g ON g.property_id = p.property_id
  JOIN addresses ad ON ad.address_id = p.address_id 
  JOIN barangays br ON br.barangay_id = ad.barangay_id 
  JOIN municipalities mu ON mu.municipality_id = br.municipality_id 
  JOIN provinces pr ON pr.province_id = mu.province_id`

router.get('/maps/properties', authenticate, async (_, res, next) => { try { const [rows] = await pool.query(`${mapsBaseQuery} WHERE g.latitude IS NOT NULL AND g.longitude IS NOT NULL`); res.json(rows) } catch (e) { next(e) } })
router.get('/maps/property/:id', authenticate, async (req, res, next) => { try { const [rows] = await pool.query(`${mapsBaseQuery} WHERE l.lot_id = ?`, [req.params.id]); rows[0] ? res.json(rows[0]) : res.status(404).json({ message: 'Property not found' }) } catch (e) { next(e) } })
router.get('/maps/barangay/:barangay', authenticate, async (req, res, next) => { try { const [rows] = await pool.query(`${mapsBaseQuery} WHERE br.barangay_name LIKE ? AND g.latitude IS NOT NULL`, [`%${req.params.barangay}%`]); res.json(rows) } catch (e) { next(e) } })
router.post('/maps/location', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => { try { const { property_id, latitude, longitude, gps_accuracy } = req.body; await pool.query('INSERT INTO gis_locations (property_id, latitude, longitude, gps_accuracy) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE latitude=VALUES(latitude), longitude=VALUES(longitude), gps_accuracy=VALUES(gps_accuracy)', [property_id, latitude, longitude, gps_accuracy]); res.json({ message: 'Location saved' }) } catch (e) { next(e) } })
router.put('/maps/location/:id', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => { try { const { latitude, longitude, gps_accuracy } = req.body; await pool.query('UPDATE gis_locations g JOIN property_lots l ON l.property_id = g.property_id SET g.latitude=?, g.longitude=?, g.gps_accuracy=? WHERE l.lot_id=?', [latitude, longitude, gps_accuracy, req.params.id]); res.json({ message: 'Location updated' }) } catch (e) { next(e) } })
export default router
