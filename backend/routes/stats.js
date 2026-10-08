import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()

router.get('/stats/super_admin', authenticate, allowRoles('super_admin'), async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role')
    const [statusCounts] = await pool.query('SELECT status, COUNT(*) as count FROM users GROUP BY status')
    const [activities] = await pool.query(`
      SELECT l.*, u.first_name, u.last_name, u.role, u.username
      FROM activity_logs l
      LEFT JOIN users u ON u.user_id = l.user_id
      ORDER BY l.activity_date DESC LIMIT 20
    `)
    const [registrations] = await pool.query('SELECT user_id, first_name, last_name, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 10')
    const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users')
    
    // Additional requested stats
    const [propertyStats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_lots) as total_lots,
        (SELECT COUNT(*) FROM property_buildings) as total_buildings,
        (SELECT COUNT(*) FROM property_assessments) + (SELECT COUNT(*) FROM lot_assessment_history) + (SELECT COUNT(*) FROM building_assessment_history) as total_assessments,
        (SELECT COUNT(*) FROM properties p WHERE EXISTS (SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id)) as assessed_properties,
        (SELECT COUNT(*) FROM properties p WHERE NOT EXISTS (SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id)) as unassessed_properties,
        (SELECT COUNT(*) FROM certificate_requests WHERE status = 'PENDING') as pending_certificate_requests
    `)
    
    const activeUsers = statusCounts.find((s) => s.status === 'active')?.count || 0
    const inactiveUsers = statusCounts.find((s) => s.status === 'inactive')?.count || 0

    res.json({ 
      users, 
      activeUsers, 
      inactiveUsers, 
      activities, 
      registrations, 
      totalUsers: totalUsers[0]?.count || 0,
      ...propertyStats[0]
    })
  } catch (e) { next(e) }
})

router.get('/stats/health', authenticate, allowRoles('super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT 1')
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users')
    const [properties] = await pool.query('SELECT COUNT(*) as count FROM properties')
    const [assessments] = await pool.query('SELECT COUNT(*) as count FROM property_assessments')
    
    res.json({
      status: 'ONLINE',
      dbName: process.env.DB_NAME || 'property_management_db',
      users: users[0].count,
      properties: properties[0].count,
      assessments: assessments[0].count,
      timestamp: new Date().toISOString()
    })
  } catch (e) {
    res.json({
      status: 'OFFLINE',
      error: e.message,
      timestamp: new Date().toISOString()
    })
  }
})

router.get('/stats/admin', authenticate, allowRoles('super_admin', 'admin'), async (req, res, next) => {
  try {
    const [properties] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_lots l LEFT JOIN lot_assessment_history lah ON l.lot_id = lah.lot_id AND lah.assessment_status = 'approved' WHERE lah.lot_assessment_history_id IS NULL) as unassessed_lots,
        (SELECT COUNT(*) FROM property_buildings b LEFT JOIN building_assessment_history bah ON b.building_id = bah.building_id AND bah.assessment_status = 'approved' WHERE bah.building_assessment_history_id IS NULL) as unassessed_buildings,
        (SELECT COUNT(*) FROM property_assessments) + (SELECT COUNT(*) FROM lot_assessment_history) + (SELECT COUNT(*) FROM building_assessment_history) as total_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'submitted') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'submitted') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'submitted') as pending_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'approved') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'approved') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'approved') as approved_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'rejected') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'rejected') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'rejected') as rejected_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'returned') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'returned') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'returned') as returned_assessments,
        (SELECT SUM(assessed_value) FROM property_assessments WHERE assessment_status = 'approved') as total_assessed_value
    `)
    const [recentAssessments] = await pool.query('SELECT * FROM property_assessments ORDER BY assessment_date DESC LIMIT 10')
    const [byBarangay] = await pool.query(`
      SELECT b.barangay_name, COUNT(p.property_id) as count 
      FROM properties p 
      JOIN addresses a ON p.address_id = a.address_id 
      JOIN barangays b ON a.barangay_id = b.barangay_id 
      GROUP BY b.barangay_id
    `)
    res.json({ stats: properties[0], recentAssessments, byBarangay })
  } catch(e) { next(e) }
})

router.get('/stats/assessor', authenticate, allowRoles('admin', 'assessor'), async (req, res, next) => {
  try {
    const [properties] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_assessments WHERE assessor_user_id = ? AND assessment_status = 'approved') as completed_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessor_user_id = ? AND assessment_status IN ('draft', 'returned')) as pending_assessments
    `, [req.user.id, req.user.id])
    const [recentAssessments] = await pool.query('SELECT * FROM property_assessments WHERE assessor_user_id = ? ORDER BY assessment_date DESC LIMIT 10', [req.user.id])
    const [recentUpdates] = await pool.query('SELECT * FROM property_history WHERE user_id = ? ORDER BY history_date DESC LIMIT 10', [req.user.id])
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
    const [recentDocs] = await pool.query('SELECT * FROM generated_certificates ORDER BY issued_at DESC LIMIT 10')
    res.json({ stats: properties[0], recentProperties, recentDocs })
  } catch(e) { next(e) }
})
export default router
