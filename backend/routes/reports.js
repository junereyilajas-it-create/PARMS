import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';

const router = Router();

// 1. Semi-Annual Assessment Report
router.get('/reports/semi-annual', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { period, year } = req.query; // period: 'January-June' | 'July-December', year: '2026'
  try {
    const yr = year || new Date().getFullYear().toString();
    const isSecondHalf = period === 'July-December';
    const startDate = isSecondHalf ? `${yr}-07-01` : `${yr}-01-01`;
    const endDate = isSecondHalf ? `${yr}-12-31` : `${yr}-06-30`;

    // Global and period-specific stats
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_lots) as total_lots,
        (SELECT COUNT(*) FROM property_buildings) as total_buildings,
        (
          (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'approved' AND assessment_date >= ? AND assessment_date <= ?) +
          (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'approved' AND assessment_date >= ? AND assessment_date <= ?) +
          (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'approved' AND assessment_date >= ? AND assessment_date <= ?)
        ) as newly_assessed,
        (
          (SELECT COALESCE(SUM(assessed_value), 0) FROM lot_assessment_history WHERE assessment_status = 'approved') +
          (SELECT COALESCE(SUM(assessed_value), 0) FROM building_assessment_history WHERE assessment_status = 'approved') +
          (SELECT COALESCE(SUM(assessed_value), 0) FROM property_assessments WHERE assessment_status = 'approved')
        ) as total_assessed_value,
        (
          (SELECT COUNT(*) FROM lot_assessment_history WHERE assessment_status = 'submitted') +
          (SELECT COUNT(*) FROM building_assessment_history WHERE assessment_status = 'submitted') +
          (SELECT COUNT(*) FROM property_assessments WHERE assessment_status = 'submitted')
        ) as pending_assessments,
        (
          SELECT COUNT(*) 
          FROM assessment_assignments 
          WHERE assignment_status = 'cancelled' 
            AND ((created_at >= ? AND created_at <= ?) OR (updated_at >= ? AND updated_at <= ?))
        ) as cancelled_assessments,
        (
          SELECT COUNT(*) 
          FROM assessment_assignments 
          WHERE assignment_status IN ('assigned', 'in_progress', 'submitted')
        ) as active_assignments
    `, [
      startDate, endDate,
      startDate, endDate,
      startDate, endDate,
      `${startDate} 00:00:00`, `${endDate} 23:59:59`,
      `${startDate} 00:00:00`, `${endDate} 23:59:59`
    ]);

    // Breakdown by Barangay
    const [barangayStats] = await pool.query(`
      SELECT 
        b.barangay_name, 
        COUNT(DISTINCT p.property_id) as total_properties,
        COUNT(DISTINCT l.lot_id) as total_lots,
        COUNT(DISTINCT bg.building_id) as total_buildings,
        COALESCE(SUM(lah.assessed_value), 0) + COALESCE(SUM(bah.assessed_value), 0) + COALESCE(SUM(pa.assessed_value), 0) as total_assessed_value
      FROM barangays b
      LEFT JOIN addresses a ON a.barangay_id = b.barangay_id
      LEFT JOIN properties p ON p.address_id = a.address_id
      LEFT JOIN property_lots l ON l.property_id = p.property_id
      LEFT JOIN property_buildings bg ON bg.property_id = p.property_id
      LEFT JOIN lot_assessment_history lah ON lah.lot_id = l.lot_id AND lah.assessment_status = 'approved'
      LEFT JOIN building_assessment_history bah ON bah.building_id = bg.building_id AND bah.assessment_status = 'approved'
      LEFT JOIN property_assessments pa ON pa.property_id = p.property_id AND pa.assessment_status = 'approved'
      GROUP BY b.barangay_id, b.barangay_name
      ORDER BY b.barangay_name ASC
    `);

    res.json({
      period: `${period || 'January-June'} ${yr}`,
      dateRange: `${startDate} to ${endDate}`,
      summary: stats[0] || {},
      barangayActivity: barangayStats
    });
  } catch (err) {
    next(err);
  }
});

// 2. Property Assessment Summary
router.get('/reports/property-summary', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { barangay } = req.query;

    const [totals] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM property_lots) as total_lots,
        (SELECT COUNT(*) FROM property_buildings) as total_buildings,
        (SELECT COUNT(*) FROM property_owners) as total_owners,
        (
          SELECT COUNT(DISTINCT p.property_id) 
          FROM properties p
          WHERE EXISTS (
            SELECT 1 FROM property_assessments pa WHERE pa.property_id = p.property_id AND pa.assessment_status = 'approved'
          )
          OR EXISTS (
            SELECT 1 FROM property_lots pl
            JOIN lot_assessment_history lah ON pl.lot_id = lah.lot_id
            WHERE pl.property_id = p.property_id AND lah.assessment_status = 'approved'
          )
          OR EXISTS (
            SELECT 1 FROM property_buildings pb
            JOIN building_assessment_history bah ON pb.building_id = bah.building_id
            WHERE pb.property_id = p.property_id AND bah.assessment_status = 'approved'
          )
        ) as assessed_properties,
        (
          SELECT COUNT(DISTINCT p.property_id) 
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
        ) as unassessed_properties
    `);

    // Classification distribution
    const [byClassification] = await pool.query(`
      SELECT 
        pc.classification_name, 
        COUNT(DISTINCT p.property_id) as count,
        COALESCE(SUM(lah.assessed_value), 0) + COALESCE(SUM(bah.assessed_value), 0) + COALESCE(SUM(pa.assessed_value), 0) as total_assessed_value
      FROM property_classifications pc
      LEFT JOIN properties p ON p.classification_id = pc.classification_id
      LEFT JOIN property_lots l ON l.property_id = p.property_id
      LEFT JOIN property_buildings bg ON bg.property_id = p.property_id
      LEFT JOIN lot_assessment_history lah ON lah.lot_id = l.lot_id AND lah.assessment_status = 'approved'
      LEFT JOIN building_assessment_history bah ON bah.building_id = bg.building_id AND bah.assessment_status = 'approved'
      LEFT JOIN property_assessments pa ON pa.property_id = p.property_id AND pa.assessment_status = 'approved'
      GROUP BY pc.classification_id, pc.classification_name
      ORDER BY pc.classification_name ASC
    `);

    // Barangay distribution
    const [byBarangay] = await pool.query(`
      SELECT 
        b.barangay_name,
        COUNT(DISTINCT p.property_id) as total_properties,
        COUNT(DISTINCT l.lot_id) as total_lots,
        COUNT(DISTINCT bg.building_id) as total_buildings,
        COUNT(DISTINCT CASE 
          WHEN lah.lot_assessment_history_id IS NOT NULL OR bah.building_assessment_history_id IS NOT NULL OR pa.assessment_id IS NOT NULL 
          THEN p.property_id 
        END) as assessed_properties,
        COUNT(DISTINCT CASE 
          WHEN lah.lot_assessment_history_id IS NULL AND bah.building_assessment_history_id IS NULL AND pa.assessment_id IS NULL 
          THEN p.property_id 
        END) as unassessed_properties
      FROM barangays b
      LEFT JOIN addresses a ON a.barangay_id = b.barangay_id
      LEFT JOIN properties p ON p.address_id = a.address_id
      LEFT JOIN property_lots l ON l.property_id = p.property_id
      LEFT JOIN property_buildings bg ON bg.property_id = p.property_id
      LEFT JOIN lot_assessment_history lah ON lah.lot_id = l.lot_id AND lah.assessment_status = 'approved'
      LEFT JOIN building_assessment_history bah ON bah.building_id = bg.building_id AND bah.assessment_status = 'approved'
      LEFT JOIN property_assessments pa ON pa.property_id = p.property_id AND pa.assessment_status = 'approved'
      GROUP BY b.barangay_id, b.barangay_name
      ORDER BY b.barangay_name ASC
    `);

    res.json({
      ...totals[0],
      byClassification,
      byBarangay
    });
  } catch (err) {
    next(err);
  }
});

// 3. GIS / Tax Mapping Report
router.get('/reports/gis-summary', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM gis_locations) as total_mapped_properties,
        (SELECT COUNT(*) FROM gis_locations WHERE lot_id IS NOT NULL) as mapped_lots,
        (SELECT COUNT(*) FROM gis_locations WHERE building_id IS NOT NULL) as mapped_buildings,
        (SELECT COUNT(*) FROM properties WHERE property_id NOT IN (SELECT property_id FROM gis_locations WHERE property_id IS NOT NULL)) as unmapped_properties
    `);

    // Mapped coverage per barangay
    const [byBarangay] = await pool.query(`
      SELECT 
        b.barangay_name,
        COUNT(DISTINCT p.property_id) as total_properties,
        COUNT(DISTINCT g.gis_id) as mapped_count,
        (COUNT(DISTINCT p.property_id) - COUNT(DISTINCT g.property_id)) as unmapped_count,
        ROUND(CASE 
          WHEN COUNT(DISTINCT p.property_id) > 0 
          THEN (COUNT(DISTINCT g.property_id) / COUNT(DISTINCT p.property_id)) * 100 
          ELSE 0 
        END, 1) as coverage_pct
      FROM barangays b
      LEFT JOIN addresses a ON a.barangay_id = b.barangay_id
      LEFT JOIN properties p ON p.address_id = a.address_id
      LEFT JOIN gis_locations g ON g.property_id = p.property_id
      GROUP BY b.barangay_id, b.barangay_name
      ORDER BY b.barangay_name ASC
    `);

    res.json({
      ...stats[0],
      byBarangay
    });
  } catch (err) {
    next(err);
  }
});

// Helper for unified assessment records query
function buildUnifiedAssessmentsSQL(statusFilter = "WHERE assessment_status = 'approved'") {
  return `
    SELECT * FROM (
      -- Lot Assessments
      SELECT 
        'LOT' as property_type,
        lah.lot_assessment_history_id as assessment_id,
        lah.lot_id as target_id_int,
        COALESCE(l.lot_number, CONCAT('LOT-', l.lot_id)) as target_id_str,
        p.property_id,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) as owner_name,
        COALESCE(pc.classification_name, 'Residential') as classification,
        COALESCE(b.barangay_name, 'Lagonglong') as barangay,
        COALESCE(NULLIF(CONCAT_WS(', ', NULLIF(a.street, ''), b.barangay_name), ''), b.barangay_name, 'Lagonglong') as location,
        lah.market_value,
        lah.assessor_level,
        lah.assessed_value,
        lah.assessment_date,
        lah.assessment_status,
        CONCAT_WS(' ', u.first_name, u.last_name) as assessor_name,
        lah.assessor_user_id
      FROM lot_assessment_history lah
      JOIN property_lots l ON lah.lot_id = l.lot_id
      JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
      LEFT JOIN users u ON lah.assessor_user_id = u.user_id

      UNION ALL

      -- Building Assessments
      SELECT 
        'BUILDING' as property_type,
        bah.building_assessment_history_id as assessment_id,
        bah.building_id as target_id_int,
        COALESCE(bg.building_name, CONCAT('BLDG-', bg.building_id)) as target_id_str,
        p.property_id,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) as owner_name,
        COALESCE(pc.classification_name, 'Commercial') as classification,
        COALESCE(b.barangay_name, 'Lagonglong') as barangay,
        COALESCE(NULLIF(CONCAT_WS(', ', NULLIF(a.street, ''), b.barangay_name), ''), b.barangay_name, 'Lagonglong') as location,
        bah.market_value,
        bah.assessor_level,
        bah.assessed_value,
        bah.assessment_date,
        bah.assessment_status,
        CONCAT_WS(' ', u.first_name, u.last_name) as assessor_name,
        bah.assessor_user_id
      FROM building_assessment_history bah
      JOIN property_buildings bg ON bah.building_id = bg.building_id
      JOIN properties p ON bg.property_id = p.property_id
      LEFT JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
      LEFT JOIN users u ON bah.assessor_user_id = u.user_id

      UNION ALL

      -- Unified Property Assessments
      SELECT 
        'PROPERTY' as property_type,
        pa.assessment_id,
        pa.property_id as target_id_int,
        CONCAT('PROP-', pa.property_id) as target_id_str,
        p.property_id,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) as owner_name,
        COALESCE(pc.classification_name, 'General') as classification,
        COALESCE(b.barangay_name, 'Lagonglong') as barangay,
        COALESCE(NULLIF(CONCAT_WS(', ', NULLIF(a.street, ''), b.barangay_name), ''), b.barangay_name, 'Lagonglong') as location,
        pa.market_value,
        pa.assessor_level,
        pa.assessed_value,
        pa.assessment_date,
        pa.assessment_status,
        CONCAT_WS(' ', u.first_name, u.last_name) as assessor_name,
        pa.assessor_user_id
      FROM property_assessments pa
      JOIN properties p ON pa.property_id = p.property_id
      LEFT JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
      LEFT JOIN users u ON pa.assessor_user_id = u.user_id
    ) AS u ${statusFilter}
  `;
}

// 4. Assessed Value Report (Filterable by Barangay, Type, Classification, Date, Search)
router.get('/reports/assessed-value', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { barangay, property_type, classification, search, start_date, end_date } = req.query;

    const baseQuery = buildUnifiedAssessmentsSQL("WHERE assessment_status = 'approved'");

    const whereClauses = [];
    const params = [];

    if (barangay && barangay !== 'all') {
      whereClauses.push('barangay = ?');
      params.push(barangay);
    }

    if (property_type && property_type !== 'all') {
      whereClauses.push('property_type = ?');
      params.push(property_type.toUpperCase());
    }

    if (classification && classification !== 'all') {
      whereClauses.push('classification = ?');
      params.push(classification);
    }

    if (start_date) {
      whereClauses.push('assessment_date >= ?');
      params.push(start_date);
    }

    if (end_date) {
      whereClauses.push('assessment_date <= ?');
      params.push(end_date);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereClauses.push('(target_id_str LIKE ? OR owner_name LIKE ? OR location LIKE ? OR assessor_name LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const fullSQL = `
      SELECT * FROM (${baseQuery}) AS filtered
      ${whereSQL}
      ORDER BY assessment_date DESC, assessment_id DESC
    `;

    const [rows] = await pool.query(fullSQL, params);

    // Summary calculations
    const totalAssessedValue = rows.reduce((sum, r) => sum + Number(r.assessed_value || 0), 0);
    const totalMarketValue = rows.reduce((sum, r) => sum + Number(r.market_value || 0), 0);
    const avgAssessmentLevel = rows.length > 0
      ? (rows.reduce((sum, r) => sum + Number(r.assessor_level || 0), 0) / rows.length).toFixed(2)
      : '0.00';

    res.json({
      summary: {
        total_assessed_value: totalAssessedValue,
        total_market_value: totalMarketValue,
        average_assessment_level: avgAssessmentLevel,
        record_count: rows.length
      },
      records: rows
    });
  } catch (err) {
    next(err);
  }
});

// 5. New Assessment Report (Filterable by Assessor, Barangay, Status, Type, Date, Search)
router.get('/reports/new-assessments', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { assessor_id, barangay, status, property_type, search, start_date, end_date } = req.query;

    const baseQuery = buildUnifiedAssessmentsSQL(""); // all statuses

    const whereClauses = [];
    const params = [];

    if (assessor_id && assessor_id !== 'all') {
      whereClauses.push('assessor_user_id = ?');
      params.push(assessor_id);
    }

    if (barangay && barangay !== 'all') {
      whereClauses.push('barangay = ?');
      params.push(barangay);
    }

    if (status && status !== 'all') {
      whereClauses.push('assessment_status = ?');
      params.push(status.toLowerCase());
    }

    if (property_type && property_type !== 'all') {
      whereClauses.push('property_type = ?');
      params.push(property_type.toUpperCase());
    }

    if (start_date) {
      whereClauses.push('assessment_date >= ?');
      params.push(start_date);
    }

    if (end_date) {
      whereClauses.push('assessment_date <= ?');
      params.push(end_date);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereClauses.push('(target_id_str LIKE ? OR owner_name LIKE ? OR location LIKE ? OR assessor_name LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const fullSQL = `
      SELECT * FROM (${baseQuery}) AS filtered
      ${whereSQL}
      ORDER BY assessment_date DESC, assessment_id DESC
    `;

    const [rows] = await pool.query(fullSQL, params);

    const totalAssessedValue = rows.reduce((sum, r) => sum + Number(r.assessed_value || 0), 0);
    const approvedCount = rows.filter(r => r.assessment_status === 'approved').length;
    const pendingCount = rows.filter(r => ['submitted', 'pending'].includes(r.assessment_status)).length;

    res.json({
      summary: {
        total_new_assessments: rows.length,
        total_assessed_value: totalAssessedValue,
        approved_count: approvedCount,
        pending_count: pendingCount
      },
      records: rows
    });
  } catch (err) {
    next(err);
  }
});

// 6. Save Official Report to History
router.post('/reports/history', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { report_type, reporting_period, record_count } = req.body;
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      'INSERT INTO report_history (report_type, reporting_period, generated_by, record_count) VALUES (?, ?, ?, ?)',
      [report_type, reporting_period, req.user.id, record_count || 0]
    );
    await logActivity(connection, req, 'GENERATE', 'Reports', `Report ID ${result.insertId}`, `Admin generated ${report_type} for ${reporting_period}`);
    res.json({ message: 'Report successfully saved to history.', report_id: result.insertId });
  } catch (err) {
    next(err);
  } finally {
    connection.release();
  }
});

// 7. Get Official Report History
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
