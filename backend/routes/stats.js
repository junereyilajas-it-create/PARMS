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
    
    const [propertyStats] = await pool.query(`
      SELECT 
        ((SELECT COUNT(*) FROM property_lots) + (SELECT COUNT(*) FROM property_buildings)) as total_properties,
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
    const [lots] = await pool.query('SELECT COUNT(*) as count FROM property_lots')
    const [bldgs] = await pool.query('SELECT COUNT(*) as count FROM property_buildings')
    const [assessments] = await pool.query('SELECT COUNT(*) as count FROM property_assessments')
    const totalProperties = (lots[0]?.count || 0) + (bldgs[0]?.count || 0)
    
    res.json({
      status: 'ONLINE',
      dbName: process.env.DB_NAME || 'property_management_db',
      users: users[0].count,
      properties: totalProperties,
      total_lots: lots[0]?.count || 0,
      total_buildings: bldgs[0]?.count || 0,
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
        ((SELECT COUNT(*) FROM property_lots) + (SELECT COUNT(*) FROM property_buildings)) as total_properties,
        (SELECT COUNT(*) FROM property_lots) as total_lots,
        (SELECT COUNT(*) FROM property_buildings) as total_buildings,
        (SELECT COUNT(*) FROM property_lots l LEFT JOIN lot_assessment_history lah ON l.lot_id = lah.lot_id AND lah.assessment_status = 'approved' WHERE lah.lot_assessment_history_id IS NULL) as unassessed_lots,
        (SELECT COUNT(*) FROM property_buildings b LEFT JOIN building_assessment_history bah ON b.building_id = bah.building_id AND bah.assessment_status = 'approved' WHERE bah.building_assessment_history_id IS NULL) as unassessed_buildings,
        (SELECT COUNT(*) FROM property_assessments) + (SELECT COUNT(*) FROM lot_assessment_history) + (SELECT COUNT(*) FROM building_assessment_history) as total_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'submitted') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'submitted') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'submitted') as pending_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'approved') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'approved') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'approved') as approved_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'rejected') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'rejected') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'rejected') as rejected_assessments,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'returned') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'returned') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'returned') as returned_assessments,
        (SELECT SUM(assessed_value) FROM property_assessments WHERE assessment_status = 'approved') as total_assessed_value
    `);

    // Dedicated Assessment Overview for new Admin Dashboard section
    const [overviewRows] = await pool.query(`
      SELECT 
        ((SELECT COUNT(*) FROM property_lots) + (SELECT COUNT(*) FROM property_buildings)) as total_properties,
        (SELECT COUNT(*) FROM property_lots) as total_lots,
        (SELECT COUNT(*) FROM property_buildings) as total_buildings,
        (SELECT COUNT(*) FROM assessment_assignments) as total_assignments,
        (SELECT COUNT(*) FROM assessment_assignments WHERE assignment_status IN ('assigned', 'in_progress', 'submitted', 'pending')) as active_assignments,
        (SELECT (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'submitted') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'submitted') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'submitted')) as pending_assessments,
        (SELECT (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'approved') + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'approved') + (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'approved')) as completed_assessments,
        (SELECT COUNT(*) FROM assessment_assignments WHERE assignment_status = 'cancelled') as cancelled_assignments,
        (
          SELECT COUNT(DISTINCT p.property_id) 
          FROM properties p
          WHERE NOT EXISTS (
            SELECT 1 FROM assessment_assignments aa 
            WHERE (
              (aa.property_type = 'property' AND aa.target_id_int = p.property_id)
              OR (aa.property_type = 'lot' AND aa.target_id_int IN (SELECT lot_id FROM property_lots WHERE property_id = p.property_id))
              OR (aa.property_type = 'building' AND aa.target_id_int IN (SELECT building_id FROM property_buildings WHERE property_id = p.property_id))
            ) AND aa.assignment_status IN ('assigned', 'in_progress', 'submitted', 'pending')
          )
          AND NOT EXISTS (
            SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id AND pa.assessment_status = 'approved'
          )
          AND NOT EXISTS (
            SELECT 1 FROM property_lots pl JOIN lot_assessment_history lah ON pl.lot_id = lah.lot_id WHERE pl.property_id = p.property_id AND lah.assessment_status = 'approved'
          )
          AND NOT EXISTS (
            SELECT 1 FROM property_buildings pb JOIN building_assessment_history bah ON pb.building_id = bah.building_id WHERE pb.property_id = p.property_id AND bah.assessment_status = 'approved'
          )
        ) as unassigned_properties
    `);

    // Workload distribution per eligible assessor
    const [assessorWorkload] = await pool.query(`
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.username,
        u.email,
        u.status,
        (
          SELECT COUNT(*) 
          FROM assessment_assignments aa 
          WHERE aa.assigned_to_user_id = u.user_id
        ) AS total_assigned,
        (
          SELECT COUNT(*) 
          FROM assessment_assignments aa 
          WHERE aa.assigned_to_user_id = u.user_id 
            AND aa.assignment_status IN ('assigned', 'in_progress')
        ) AS pending_assignments,
        (
          SELECT (
            (SELECT COUNT(*) FROM property_assessments WHERE assessor_user_id = u.user_id AND assessment_status = 'submitted') +
            (SELECT COUNT(*) FROM lot_assessment_history WHERE assessor_user_id = u.user_id AND assessment_status = 'submitted') +
            (SELECT COUNT(*) FROM building_assessment_history WHERE assessor_user_id = u.user_id AND assessment_status = 'submitted')
          )
        ) AS awaiting_review,
        (
          SELECT (
            (SELECT COUNT(*) FROM property_assessments WHERE assessor_user_id = u.user_id AND assessment_status = 'approved') +
            (SELECT COUNT(*) FROM lot_assessment_history WHERE assessor_user_id = u.user_id AND assessment_status = 'approved') +
            (SELECT COUNT(*) FROM building_assessment_history WHERE assessor_user_id = u.user_id AND assessment_status = 'approved')
          )
        ) AS completed
      FROM users u
      WHERE u.role = 'assessor' AND u.status = 'active'
      ORDER BY u.first_name ASC, u.last_name ASC
    `);

    // Recent system activities from persistent activity_logs
    const [recentActivities] = await pool.query(`
      SELECT 
        l.log_id,
        l.user_id,
        l.role,
        l.action,
        l.module_name,
        l.record_affected,
        l.activity,
        l.activity_date,
        COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.username, 'System') as user_name
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.user_id
      ORDER BY l.activity_date DESC
      LIMIT 15
    `);

    const [recentAssessments] = await pool.query('SELECT * FROM property_assessments ORDER BY assessment_date DESC LIMIT 10');
    const [byBarangay] = await pool.query(`
      SELECT b.barangay_name, COUNT(p.property_id) as count 
      FROM properties p 
      JOIN addresses a ON p.address_id = a.address_id 
      JOIN barangays b ON a.barangay_id = b.barangay_id 
      GROUP BY b.barangay_id
    `);

    res.json({ 
      stats: properties[0], 
      assessmentOverview: overviewRows[0],
      assessorWorkload,
      recentActivities,
      recentAssessments, 
      byBarangay 
    });
  } catch(e) { next(e) }
});

router.get('/stats/assessor', authenticate, allowRoles('admin', 'assessor'), async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Unassessed properties in system
    const [unassessedProps] = await pool.query(`
      SELECT COUNT(DISTINCT p.property_id) as cnt
      FROM properties p
      WHERE NOT EXISTS (
        SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id AND pa.assessment_status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM property_lots pl
        JOIN lot_assessment_history lah ON pl.lot_id = lah.lot_id
        WHERE pl.property_id = p.property_id AND lah.assessment_status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM property_buildings pb
        JOIN building_assessment_history bah ON pb.building_id = bah.building_id
        WHERE pb.property_id = p.property_id AND bah.assessment_status = 'approved'
      )
    `);

    // 2. Assigned properties for logged-in assessor
    const [assignedProps] = await pool.query(`
      SELECT COUNT(*) as cnt 
      FROM assessment_assignments 
      WHERE assigned_to_user_id = ? 
        AND assignment_status IN ('assigned', 'in_progress', 'submitted')
    `, [userId]);

    // 3. Pending assessments for logged-in assessor (active assignments + submitted for review + returned for correction)
    const [pendingAssessmentsCount] = await pool.query(`
      SELECT (
        (SELECT COUNT(*) FROM assessment_assignments WHERE assigned_to_user_id = ? AND assignment_status IN ('assigned', 'in_progress'))
        + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessor_user_id = ? AND assessment_status IN ('submitted', 'returned', 'returned_for_correction', 'draft'))
        + (SELECT COUNT(*) FROM building_assessment_history WHERE assessor_user_id = ? AND assessment_status IN ('submitted', 'returned', 'returned_for_correction', 'draft'))
        + (SELECT COUNT(*) FROM property_assessments WHERE assessor_user_id = ? AND assessment_status IN ('submitted', 'returned', 'returned_for_correction', 'draft'))
      ) as cnt
    `, [userId, userId, userId, userId]);

    // 4. Completed assessments for logged-in assessor
    const [completedAssessmentsCount] = await pool.query(`
      SELECT (
        (SELECT COUNT(*) FROM lot_assessment_history WHERE assessor_user_id = ? AND assessment_status = 'approved')
        + (SELECT COUNT(*) FROM building_assessment_history WHERE assessor_user_id = ? AND assessment_status = 'approved')
        + (SELECT COUNT(*) FROM property_assessments WHERE assessor_user_id = ? AND assessment_status = 'approved')
      ) as cnt
    `, [userId, userId, userId]);

    // 5. Pending permission requests submitted by logged-in assessor
    const [pendingRequestsCount] = await pool.query(`
      SELECT COUNT(*) as cnt 
      FROM assessment_permission_requests 
      WHERE requested_by_user_id = ? AND request_status = 'pending'
    `, [userId]);

    // 6. Returned / corrections needed count
    const [returnedCount] = await pool.query(`
      SELECT (
        (SELECT COUNT(*) FROM assessment_assignments WHERE assigned_to_user_id = ? AND assignment_status = 'returned')
        + (SELECT COUNT(*) FROM lot_assessment_history WHERE assessor_user_id = ? AND assessment_status IN ('returned', 'returned_for_correction'))
        + (SELECT COUNT(*) FROM building_assessment_history WHERE assessor_user_id = ? AND assessment_status IN ('returned', 'returned_for_correction'))
        + (SELECT COUNT(*) FROM property_assessments WHERE assessor_user_id = ? AND assessment_status IN ('returned', 'returned_for_correction'))
      ) as cnt
    `, [userId, userId, userId, userId]);

    const stats = {
      unassessed_properties: Number(unassessedProps[0]?.cnt || 0),
      assigned_properties: Number(assignedProps[0]?.cnt || 0),
      pending_assessments: Number(pendingAssessmentsCount[0]?.cnt || 0),
      completed_assessments: Number(completedAssessmentsCount[0]?.cnt || 0),
      pending_permission_requests: Number(pendingRequestsCount[0]?.cnt || 0),
      corrections_needed: Number(returnedCount[0]?.cnt || 0)
    };

    res.json({ stats });
  } catch(e) { next(e) }
})

router.get('/stats/staff', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const [properties] = await pool.query(`
      SELECT 
        ((SELECT COUNT(*) FROM property_lots) + (SELECT COUNT(*) FROM property_buildings)) as total_properties,
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
