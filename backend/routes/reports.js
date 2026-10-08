import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';

const router = Router();

// Generate Semi-Annual Assessment Report
router.get('/reports/semi-annual', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { period, year } = req.query; // e.g., period: 'January-June', year: '2026'
  try {
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_date >= ? AND assessment_date <= ?) as newly_assessed,
        (SELECT SUM(assessed_value) FROM property_assessments WHERE assessment_status = 'approved') as total_assessed_value,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status IN ('draft', 'submitted', 'returned')) as pending_assessments,
        (SELECT COUNT(*) FROM property_history WHERE action = 'Modified' AND history_date >= ? AND history_date <= ?) as modified_assessments,
        (SELECT COUNT(*) FROM property_history WHERE action = 'Cancelled' AND history_date >= ? AND history_date <= ?) as cancelled_assessments
    `, [
      `${year}-01-01`, `${year}-12-31`, 
      `${year}-01-01`, `${year}-12-31`,
      `${year}-01-01`, `${year}-12-31`
    ]);

    const [barangayStats] = await pool.query(`
      SELECT b.barangay_name, COUNT(p.property_id) as count
      FROM properties p
      JOIN addresses a ON p.address_id = a.address_id
      JOIN barangays b ON a.barangay_id = b.barangay_id
      GROUP BY b.barangay_id
    `);

    res.json({
      period: `${period} ${year}`,
      summary: stats[0],
      barangayActivity: barangayStats
    });
  } catch (err) {
    next(err);
  }
});

// Property Assessment Summary
router.get('/reports/property-summary', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_lots) as total_lots,
        (SELECT COUNT(*) FROM property_buildings) as total_buildings,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'approved') as assessed_properties,
        (SELECT COUNT(*) FROM property_assessments WHERE assessment_status != 'approved') as unassessed_properties
    `);
    res.json(stats[0]);
  } catch (err) {
    next(err);
  }
});

// Get GIS / Tax Mapping Report
router.get('/reports/gis-summary', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM gis_locations) as total_mapped_properties,
        (SELECT COUNT(*) FROM gis_locations WHERE lot_id IS NOT NULL) as mapped_lots,
        (SELECT COUNT(*) FROM gis_locations WHERE building_id IS NOT NULL) as mapped_buildings,
        (SELECT COUNT(*) FROM properties WHERE property_id NOT IN (SELECT property_id FROM gis_locations)) as unmapped_properties
    `);
    res.json(stats[0]);
  } catch (err) {
    next(err);
  }
});

// Assessed Value Report
router.get('/reports/assessed-value', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.property_id, 
        CONCAT(o.first_name, ' ', o.last_name) as owner_name, 
        pt.property_type_name as property_type, 
        pc.classification_name as classification, 
        CONCAT(a.house_number, ' ', a.street, ', ', b.barangay_name) as location,
        pa.market_value, 
        pa.assessor_level as assessment_level, 
        pa.assessed_value, 
        pa.assessment_date
      FROM property_assessments pa
      JOIN properties p ON pa.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      JOIN property_types pt ON p.property_type_id = pt.property_type_id
      JOIN property_classifications pc ON p.classification_id = pc.classification_id
      JOIN addresses a ON p.address_id = a.address_id
      JOIN barangays b ON a.barangay_id = b.barangay_id
      WHERE pa.assessment_status = 'approved'
      ORDER BY pa.assessment_date DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// New Assessment Report
router.get('/reports/new-assessments', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.property_id, 
        CONCAT(o.first_name, ' ', o.last_name) as owner_name, 
        b.barangay_name as barangay,
        pt.property_type_name as property_type, 
        pc.classification_name as classification, 
        pa.market_value, 
        pa.assessor_level as assessment_level, 
        pa.assessed_value, 
        pa.assessment_date,
        CONCAT(u.first_name, ' ', u.last_name) as assessor_name
      FROM property_assessments pa
      JOIN properties p ON pa.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      JOIN property_types pt ON p.property_type_id = pt.property_type_id
      JOIN property_classifications pc ON p.classification_id = pc.classification_id
      JOIN addresses a ON p.address_id = a.address_id
      JOIN barangays b ON a.barangay_id = b.barangay_id
      JOIN users u ON pa.assessor_user_id = u.user_id
      WHERE pa.assessment_status = 'approved'
      ORDER BY pa.assessment_date DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Cancellation and Modification Report
router.get('/reports/cancellation-modification', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ph.property_id, 
        CONCAT(o.first_name, ' ', o.last_name) as owner_name, 
        ph.action as action_type,
        ph.previous_value,
        ph.new_value,
        'Updated via System' as reason,
        ph.history_date as date,
        CONCAT(u.first_name, ' ', u.last_name) as performed_by,
        'Approved' as approval_status
      FROM property_history ph
      JOIN properties p ON ph.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      JOIN users u ON ph.user_id = u.user_id
      WHERE ph.action IN ('Modified', 'Cancelled')
      ORDER BY ph.history_date DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Assessment Appeal Report
router.get('/reports/appeals', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.property_id, 
        CONCAT(o.first_name, ' ', o.last_name) as owner_name, 
        a.submitted_at as date_filed,
        a.appeal_reason as reason,
        a.appeal_status as current_status,
        a.resolution as decision,
        a.resolved_at as date_resolved,
        CONCAT(u.first_name, ' ', u.last_name) as responsible_officer
      FROM assessment_appeals a
      JOIN property_owners o ON a.appellant_owner_id = o.owner_id
      LEFT JOIN users u ON a.assigned_assessor_id = u.user_id
      ORDER BY a.submitted_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Save Official Report History
router.post('/reports/history', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { report_type, reporting_period, record_count } = req.body;
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      'INSERT INTO report_history (report_type, reporting_period, generated_by, record_count) VALUES (?, ?, ?, ?)',
      [report_type, reporting_period, req.user.id, record_count || 0]
    );
    await logActivity(connection, req, 'GENERATE', 'Reports', `Report ID ${result.insertId}`, `Admin generated ${report_type} for ${reporting_period}`);
    res.json({ message: 'Report saved to history', report_id: result.insertId });
  } catch (err) {
    next(err);
  } finally {
    connection.release();
  }
});

// Get Report History
router.get('/reports/history', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [history] = await pool.query(`
      SELECT r.*, u.first_name, u.last_name 
      FROM report_history r
      JOIN users u ON r.generated_by = u.user_id
      ORDER BY r.generated_date DESC
    `);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

export default router;
