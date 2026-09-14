import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()

router.get('/stats/admin', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role')
    const [activities] = await pool.query('SELECT * FROM activity_logs ORDER BY activity_date DESC LIMIT 10')
    const [registrations] = await pool.query('SELECT user_id, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC LIMIT 10')
    const [propertyActivities] = await pool.query('SELECT * FROM property_history ORDER BY history_date DESC LIMIT 10')
    res.json({ users, activities, registrations, propertyActivities })
  } catch (e) { next(e) }
})

router.get('/stats/assessor', authenticate, allowRoles('admin', 'assessor'), async (req, res, next) => {
  try {
    const [properties] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_lots) as total_lots,
        (SELECT COUNT(*) FROM property_buildings) as total_buildings,
        (SELECT COUNT(*) FROM properties p WHERE EXISTS (SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id)) as assessed_properties,
        (SELECT COUNT(*) FROM properties p WHERE NOT EXISTS (SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id)) as unassessed_properties,
        (SELECT COUNT(*) FROM property_lots l WHERE EXISTS (SELECT 1 FROM lot_assessment_history la WHERE la.lot_id = l.lot_id)) as assessed_lots,
        (SELECT COUNT(*) FROM property_lots l WHERE NOT EXISTS (SELECT 1 FROM lot_assessment_history la WHERE la.lot_id = l.lot_id)) as unassessed_lots,
        (SELECT COUNT(*) FROM property_buildings b WHERE EXISTS (SELECT 1 FROM building_assessment_history ba WHERE ba.building_id = b.building_id)) as assessed_buildings,
        (SELECT COUNT(*) FROM property_buildings b WHERE NOT EXISTS (SELECT 1 FROM building_assessment_history ba WHERE ba.building_id = b.building_id)) as unassessed_buildings
    `)
    const [recentAssessments] = await pool.query('SELECT * FROM property_assessments ORDER BY assessment_date DESC, assessment_id DESC LIMIT 10')
    const [recentUpdates] = await pool.query('SELECT * FROM property_history ORDER BY history_date DESC LIMIT 10')
    res.json({ stats: properties[0], recentAssessments, recentUpdates })
  } catch(e) { next(e) }
})

router.get('/stats/staff', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const [properties] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_owners) as total_owners,
        (SELECT COUNT(*) FROM property_lots) as total_lots,
        (SELECT COUNT(*) FROM property_buildings) as total_buildings,
        (SELECT COUNT(*) FROM properties p WHERE EXISTS (SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id)) as assessed_properties,
        (SELECT COUNT(*) FROM properties p WHERE NOT EXISTS (SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id)) as unassessed_properties
    `)
    const [recentProperties] = await pool.query('SELECT * FROM properties ORDER BY created_at DESC LIMIT 10')
    const [recentDocs] = await pool.query('SELECT * FROM certified_copy_issuances ORDER BY issued_at DESC LIMIT 10')
    res.json({ stats: properties[0], recentProperties, recentDocs })
  } catch(e) { next(e) }
})
export default router
