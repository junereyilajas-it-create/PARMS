import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';

const router = Router();

// Helper to check if an assessor has an active assignment for a property/lot/building
const checkAssessmentPermission = async (connection, type, target_id, assessor_id) => {
  const [assignments] = await connection.query(`
    SELECT assignment_id FROM assessment_assignments 
    WHERE property_type = ? AND target_id_int = ? AND assigned_to_user_id = ?
    AND assignment_status IN ('assigned', 'in_progress', 'returned', 'submitted', 'pending')
  `, [type, target_id, assessor_id]);
  return assignments.length > 0;
};

// Assessor submits an assessment for review
router.post('/assessments/:type/:id/submit', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const { type, id } = req.params;
  const connection = await pool.getConnection();
  try {
    const hasPermission = await checkAssessmentPermission(connection, type, id, req.user.id);
    if (!hasPermission) {
      connection.release();
      return res.status(403).json({ message: 'You are not authorized to assess this property. The property is assigned to another Assessor.' });
    }
    await connection.beginTransaction();
    const table = type === 'lot' ? 'lot_assessment_history' : type === 'building' ? 'building_assessment_history' : 'property_assessments';
    const idColumn = type === 'lot' ? 'lot_id' : type === 'building' ? 'building_id' : 'property_id';
    
    await connection.query(
      `UPDATE ${table} SET assessment_status = 'submitted' WHERE ${idColumn} = ? AND assessor_user_id = ? AND assessment_status IN ('draft', 'returned')`,
      [id, req.user.id]
    );

    // Sync status to assignments
    await connection.query(
      `UPDATE assessment_assignments 
       SET assignment_status = 'submitted' 
       WHERE property_type = ? AND target_id_int = ? AND assigned_to_user_id = ? AND assignment_status IN ('assigned', 'in_progress', 'returned_for_correction')`,
      [type, id, req.user.id]
    );

    await logActivity(pool, req, 'SUBMIT', 'Assessments', `ID ${id}`, `Assessor submitted ${type} assessment for review`);
    await connection.commit();
    res.json({ message: 'Assessment submitted for review.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Admin reviews/approves/rejects/returns an assessment
router.post('/assessments/:type/:id/review', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { type, id } = req.params;
  const { status, reason } = req.body;
  
  if (!['approved', 'rejected', 'returned'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be approved, rejected, or returned.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const table = type === 'lot' ? 'lot_assessment_history' : type === 'building' ? 'building_assessment_history' : 'property_assessments';
    const idColumn = type === 'lot' ? 'lot_id' : type === 'building' ? 'building_id' : 'property_id';
    
    await connection.query(
      `UPDATE ${table} 
       SET assessment_status = ?, head_assessor_id = ?, approval_date = CURRENT_TIMESTAMP, rejection_reason = ? 
       WHERE ${idColumn} = ? AND assessment_status = 'submitted'`,
      [status, req.user.id, reason || null, id]
    );

    // Sync status to assignments
    const mapAssignmentStatus = (s) => s === 'returned' ? 'returned_for_correction' : s;
    await connection.query(
      `UPDATE assessment_assignments 
       SET assignment_status = ? 
       WHERE property_type = ? AND target_id_int = ? AND assignment_status IN ('in_progress', 'submitted', 'pending')`,
      [mapAssignmentStatus(status), type, id]
    );

    const activityMsg = status === 'returned' 
      ? `Admin ${req.user.first_name || ''} returned Assessment ${id} for correction. Note: ${reason || 'N/A'}`
      : status === 'rejected'
      ? `Admin ${req.user.first_name || ''} rejected Assessment ${id}. Reason: ${reason || 'N/A'}`
      : `Admin ${req.user.first_name || ''} approved Assessment ${id}.`;
    await logActivity(pool, req, status.toUpperCase(), 'Assessments', `ID ${id}`, activityMsg);
    await connection.commit();
    res.json({ message: `Assessment ${status} successfully.` });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Helper query for unified assessments
const getUnifiedAssessmentsQuery = (whereClause = '', isPending = false) => `
  SELECT 
    'property' AS type, 
    pa.assessment_id, 
    pa.property_id AS target_id, 
    pa.property_id,
    pa.assessor_user_id, pa.assessor_level, pa.market_value, pa.assessed_value, pa.assessment_date, pa.remarks, pa.assessment_status, pa.rejection_reason,
    p.property_status, u.first_name, u.last_name
  FROM property_assessments pa
  JOIN properties p ON pa.property_id = p.property_id
  JOIN users u ON pa.assessor_user_id = u.user_id
  ${whereClause ? `WHERE pa.${whereClause}` : ''}

  UNION ALL

  SELECT 
    'lot' AS type, 
    la.lot_assessment_history_id AS assessment_id, 
    la.lot_id AS target_id, 
    l.property_id,
    la.assessor_user_id, la.assessor_level, la.market_value, la.assessed_value, la.assessment_date, la.remarks, la.assessment_status, la.rejection_reason,
    l.lot_status AS property_status, u.first_name, u.last_name
  FROM lot_assessment_history la
  JOIN property_lots l ON la.lot_id = l.lot_id
  JOIN users u ON la.assessor_user_id = u.user_id
  ${whereClause ? `WHERE la.${whereClause}` : ''}

  UNION ALL

  SELECT 
    'building' AS type, 
    ba.building_assessment_history_id AS assessment_id, 
    ba.building_id AS target_id, 
    b.property_id,
    ba.assessor_user_id, ba.assessor_level, ba.market_value, ba.assessed_value, ba.assessment_date, ba.remarks, ba.assessment_status, ba.rejection_reason,
    b.building_status AS property_status, u.first_name, u.last_name
  FROM building_assessment_history ba
  JOIN property_buildings b ON ba.building_id = b.building_id
  JOIN users u ON ba.assessor_user_id = u.user_id
  ${whereClause ? `WHERE ba.${whereClause}` : ''}
`;

// Get pending assessments for admin
router.get('/assessments/pending', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [assessments] = await pool.query(getUnifiedAssessmentsQuery("assessment_status = 'submitted'"));
    res.json({ properties: assessments, lots: [], buildings: [] }); // UI expects properties array for now, we just pass all in it
  } catch (err) {
    next(err);
  }
});

// Get all assessments (filtered for assessor, or all for admin)
router.get('/assessments', authenticate, allowRoles('admin', 'super_admin', 'assessor', 'staff'), async (req, res, next) => {
  try {
    let query;
    let params = [];
    if (['assessor'].includes(req.user.role)) {
      query = getUnifiedAssessmentsQuery("assessor_user_id = ?");
      params = [req.user.id, req.user.id, req.user.id];
    } else {
      query = getUnifiedAssessmentsQuery("");
    }
    
    // Wrap in a subquery to sort the UNION result
    const finalQuery = `SELECT * FROM (${query}) AS combined ORDER BY assessment_date DESC`;
    const [assessments] = await pool.query(finalQuery, params);
    res.json(assessments);
  } catch (err) {
    next(err);
  }
});

// Create new assessment (draft)
router.post('/assessments', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const { type, target_id, market_value, assessed_value, remarks, assessor_level, assessment_date } = req.body;
  
  if (!['property', 'lot', 'building'].includes(type)) return res.status(400).json({ message: 'Invalid assessment type' });
  
  const connection = await pool.getConnection();
  try {
    const hasPermission = await checkAssessmentPermission(connection, type, target_id, req.user.id);
    if (!hasPermission) {
      connection.release();
      return res.status(403).json({ message: 'You are not authorized to assess this property. The property is assigned to another Assessor.' });
    }
    const table = type === 'lot' ? 'lot_assessment_history' : type === 'building' ? 'building_assessment_history' : 'property_assessments';
    const idColumn = type === 'lot' ? 'lot_id' : type === 'building' ? 'building_id' : 'property_id';
    
    await connection.query(
      `INSERT INTO ${table} 
       (${idColumn}, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date, remarks, assessment_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [target_id, req.user.id, assessor_level || 20.00, market_value, assessed_value, assessment_date, remarks]
    );

    await connection.query(
      `UPDATE assessment_assignments 
       SET assignment_status = 'in_progress' 
       WHERE property_type = ? AND target_id_int = ? AND assigned_to_user_id = ? AND assignment_status = 'assigned'`,
      [type, target_id, req.user.id]
    );

    await logActivity(pool, req, 'CREATE', 'Assessments', `${type.toUpperCase()} ${target_id}`, 'Created draft assessment');
    res.status(201).json({ message: 'Assessment created successfully' });
  } catch (err) {
    next(err);
  } finally {
    connection.release();
  }
});

// Update assessment
router.put('/assessments/:type/:id', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const { type, id } = req.params;
  const { market_value, assessed_value, remarks } = req.body;
  
  if (!['property', 'lot', 'building'].includes(type)) return res.status(400).json({ message: 'Invalid assessment type' });
  
  const connection = await pool.getConnection();
  try {
    const table = type === 'lot' ? 'lot_assessment_history' : type === 'building' ? 'building_assessment_history' : 'property_assessments';
    const pkColumn = type === 'lot' ? 'lot_assessment_history_id' : type === 'building' ? 'building_assessment_history_id' : 'assessment_id';
    const targetColumn = type === 'lot' ? 'lot_id' : type === 'building' ? 'building_id' : 'property_id';
    
    // Only allow editing if draft or returned
    const [existing] = await connection.query(`SELECT assessment_status, ${targetColumn} AS target_id FROM ${table} WHERE ${pkColumn} = ? AND assessor_user_id = ?`, [id, req.user.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Assessment not found or unauthorized' });
    if (!['draft', 'returned'].includes(existing[0].assessment_status)) {
      return res.status(403).json({ message: 'Cannot edit an assessment that is not in draft or returned status.' });
    }

    const hasPermission = await checkAssessmentPermission(connection, type, existing[0].target_id, req.user.id);
    if (!hasPermission) {
      connection.release();
      return res.status(403).json({ message: 'You are not authorized to assess this property. The property is assigned to another Assessor.' });
    }

    await connection.query(
      `UPDATE ${table} 
       SET market_value = ?, assessed_value = ?, remarks = ?
       WHERE ${pkColumn} = ?`,
      [market_value, assessed_value, remarks, id]
    );
    await logActivity(pool, req, 'UPDATE', 'Assessments', `ID ${id}`, 'Updated draft assessment');
    res.json({ message: 'Assessment updated successfully' });
  } catch (err) {
    next(err);
  } finally {
    connection.release();
  }
});

export default router;

