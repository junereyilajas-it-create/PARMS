import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()
router.get('/maps/properties', authenticate, async (_, res, next) => { try { const [rows] = await pool.query('SELECT p.*, o.fullname AS owner_name FROM properties p JOIN property_owners o ON o.id = p.owner_id WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL'); res.json(rows) } catch (e) { next(e) } })
router.get('/maps/property/:id', authenticate, async (req, res, next) => { try { const [rows] = await pool.query('SELECT p.*, o.fullname AS owner_name FROM properties p JOIN property_owners o ON o.id = p.owner_id WHERE p.id = ?', [req.params.id]); rows[0] ? res.json(rows[0]) : res.status(404).json({ message: 'Property not found' }) } catch (e) { next(e) } })
router.get('/maps/barangay/:barangay', authenticate, async (req, res, next) => { try { const [rows] = await pool.query('SELECT * FROM properties WHERE location LIKE ? AND latitude IS NOT NULL', [`%${req.params.barangay}%`]); res.json(rows) } catch (e) { next(e) } })
router.post('/maps/location', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => { try { const { property_id, latitude, longitude, gps_accuracy } = req.body; await pool.query('UPDATE properties SET latitude=?, longitude=?, gps_accuracy=? WHERE id=?', [latitude, longitude, gps_accuracy, property_id]); res.json({ message: 'Location saved' }) } catch (e) { next(e) } })
router.put('/maps/location/:id', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => { try { const { latitude, longitude, gps_accuracy } = req.body; await pool.query('UPDATE properties SET latitude=?, longitude=?, gps_accuracy=? WHERE id=?', [latitude, longitude, gps_accuracy, req.params.id]); res.json({ message: 'Location updated' }) } catch (e) { next(e) } })
export default router
