import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';

const router = Router();

// GET all assignments (Admin view)
router.get('/assessments/assignments', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, 
             u.first_name as assessor_first_name, u.last_name as assessor_last_name,
             u2.first_name as assigner_first_name, u2.last_name as assigner_last_name
      FROM assessment_assignments a
      JOIN users u ON a.assigned_to_user_id = u.user_id
      JOIN users u2 ON a.assigned_by_user_id = u2.user_id
      ORDER BY a.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET assessor's assignments
router.get('/assessments/assignments/my', authenticate, allowRoles('assessor'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, 
             u2.first_name as assigner_first_name, u2.last_name as assigner_last_name
      FROM assessment_assignments a
      JOIN users u2 ON a.assigned_by_user_id = u2.user_id
      WHERE a.assigned_to_user_id = ?
      ORDER BY a.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST assign an assessment
router.post('/assessments/assign', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { property_type, target_id_int, target_id_str, assigned_to_user_id, due_date, instructions } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if there is already an active assignment
    const [existing] = await connection.query(`
      SELECT assignment_id FROM assessment_assignments 
      WHERE property_type = ? AND target_id_int = ? 
      AND assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted')
    `, [property_type, target_id_int]);

    if (existing.length > 0) {
      return res.status(409).json({ message: 'This property already has an active assessment assignment.' });
    }

    const [result] = await connection.query(`
      INSERT INTO assessment_assignments (property_type, target_id_int, target_id_str, assigned_to_user_id, assigned_by_user_id, due_date, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [property_type, target_id_int, target_id_str, assigned_to_user_id, req.user.id, due_date || null, instructions || '']);

    const [assessor] = await connection.query(`SELECT first_name FROM users WHERE user_id = ?`, [assigned_to_user_id]);
    const assessorName = assessor[0] ? assessor[0].first_name : 'Assessor';

    await logActivity(connection, req, 'ASSIGN', 'Assignments', `ID ${result.insertId}`, `Admin ${req.user.first_name} assigned ${target_id_str} to Assessor ${assessorName}.`);

    await connection.commit();
    res.status(201).json({ message: 'Assessment assigned successfully.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// PUT reassign an assessment
router.put('/assessments/assignments/:id/reassign', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { id } = req.params;
  const { new_assessor_id, reason } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [assignment] = await connection.query(`SELECT * FROM assessment_assignments WHERE assignment_id = ?`, [id]);
    if (!assignment[0]) return res.status(404).json({ message: 'Assignment not found' });
    const old_id = assignment[0].assigned_to_user_id;

    // Mark old as reassigned
    await connection.query(`
      UPDATE assessment_assignments 
      SET assignment_status = 'reassigned'
      WHERE assignment_id = ?
    `, [id]);

    // Create new assignment
    await connection.query(`
      INSERT INTO assessment_assignments (property_type, target_id_int, target_id_str, assigned_to_user_id, assigned_by_user_id, instructions)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [assignment[0].property_type, assignment[0].target_id_int, assignment[0].target_id_str, new_assessor_id, req.user.id, `Reassigned from ${old_id}. Reason: ${reason}`]);

    const [newAssessor] = await connection.query(`SELECT first_name FROM users WHERE user_id = ?`, [new_assessor_id]);
    const name = newAssessor[0] ? newAssessor[0].first_name : 'Assessor';

    await logActivity(connection, req, 'REASSIGN', 'Assignments', `ID ${id}`, `Admin reassigned ${assignment[0].target_id_str} to ${name}. Reason: ${reason}`);

    await connection.commit();
    res.json({ message: 'Assessment reassigned successfully.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// POST cancel assignment
router.post('/assessments/assignments/:id/cancel', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`UPDATE assessment_assignments SET assignment_status = 'cancelled' WHERE assignment_id = ?`, [id]);
    await logActivity(connection, req, 'CANCEL', 'Assignments', `ID ${id}`, `Admin cancelled assessment assignment ${id}.`);
    await connection.commit();
    res.json({ message: 'Assignment cancelled successfully.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// GET permission requests
router.get('/assessments/requests', authenticate, async (req, res, next) => {
  try {
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const filter = isAdmin ? '' : 'WHERE r.requested_by_user_id = ?';
    const params = isAdmin ? [] : [req.user.id];

    const [rows] = await pool.query(`
      SELECT r.*, u.first_name, u.last_name
      FROM assessment_permission_requests r
      JOIN users u ON r.requested_by_user_id = u.user_id
      ${filter}
      ORDER BY r.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST create permission request
router.post('/assessments/requests', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const { property_type, target_id_int, target_id_str, reason } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(`
      SELECT assignment_id FROM assessment_assignments 
      WHERE property_type = ? AND target_id_int = ? AND assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted', 'returned_for_correction')
    `, [property_type, target_id_int]);

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({ message: 'This property is already assigned to another Assessor.' });
    }

    const [result] = await connection.query(`
      INSERT INTO assessment_permission_requests (property_type, target_id_int, target_id_str, requested_by_user_id, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [property_type, target_id_int, target_id_str, req.user.id, reason]);

    await logActivity(connection, req, 'REQUEST', 'Assignments', `ID ${result.insertId}`, `Assessor ${req.user.first_name} requested permission to assess ${target_id_str}.`);
    await connection.commit();
    res.status(201).json({ message: 'Permission requested successfully.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// POST approve request
router.post('/assessments/requests/:id/approve', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reqRow] = await connection.query(`SELECT * FROM assessment_permission_requests WHERE request_id = ?`, [id]);
    if (!reqRow[0]) return res.status(404).json({ message: 'Request not found' });
    const request = reqRow[0];

    // Approve the request
    await connection.query(`UPDATE assessment_permission_requests SET request_status = 'approved' WHERE request_id = ?`, [id]);

    // Create the assignment
    const [assignRes] = await connection.query(`
      INSERT INTO assessment_assignments (property_type, target_id_int, target_id_str, assigned_to_user_id, assigned_by_user_id, instructions)
      VALUES (?, ?, ?, ?, ?, 'Auto-assigned from approved permission request.')
    `, [request.property_type, request.target_id_int, request.target_id_str, request.requested_by_user_id, req.user.id]);

    await logActivity(connection, req, 'APPROVE', 'Assignments', `PR ${id}`, `Admin approved permission request PR-${id}. Assignment Created.`);

    await connection.commit();
    res.json({ message: 'Permission request approved. Assignment created.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// POST reject request
router.post('/assessments/requests/:id/reject', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`UPDATE assessment_permission_requests SET request_status = 'rejected', rejection_reason = ? WHERE request_id = ?`, [reason, id]);
    await logActivity(connection, req, 'REJECT', 'Assignments', `PR ${id}`, `Admin rejected permission request PR-${id}. Reason: ${reason}`);
    await connection.commit();
    res.json({ message: 'Permission request rejected.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

export default router;
