import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import { createNotification, notifyRole } from '../utils/notifications.js';

const router = Router();

// GET available properties for assessment assignment (Search by Lot ID, Building ID, Property ID, Owner Name, Barangay)
router.get('/assessments/available-properties', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const rawQ = req.query.q ? req.query.q.trim() : '';
    const qWildcard = `%${rawQ}%`;
    const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;

    // 1. Query matching Lots
    const [lots] = await pool.query(`
      SELECT 
        'lot' AS property_type,
        l.lot_id AS target_id_int,
        COALESCE(l.lot_number, CONCAT('LOT-', l.lot_id)) AS target_id_str,
        l.property_id,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        COALESCE(b.barangay_name, 'Unknown') AS barangay,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(a.street, ''), b.barangay_name), ''),
          b.barangay_name,
          'Lagonglong'
        ) AS location,
        CASE 
          WHEN (SELECT COUNT(*) FROM lot_assessment_history lah WHERE lah.lot_id = l.lot_id AND lah.assessment_status = 'approved') > 0 THEN 'Approved'
          WHEN (SELECT COUNT(*) FROM lot_assessment_history lah WHERE lah.lot_id = l.lot_id AND lah.assessment_status = 'submitted') > 0 THEN 'Pending Review'
          WHEN (SELECT COUNT(*) FROM assessment_assignments aa WHERE aa.property_type = 'lot' AND (aa.target_id_int = l.lot_id OR aa.target_id_str = l.lot_number) AND aa.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted')) > 0 THEN 'Assigned'
          ELSE 'Unassessed'
        END AS assessment_status,
        (
          SELECT aa.assignment_id 
          FROM assessment_assignments aa 
          WHERE aa.property_type = 'lot' 
            AND (aa.target_id_int = l.lot_id OR aa.target_id_str = l.lot_number) 
            AND aa.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted') 
          ORDER BY aa.assignment_id DESC LIMIT 1
        ) AS active_assignment_id,
        (
          SELECT CONCAT_WS(' ', u.first_name, u.last_name) 
          FROM assessment_assignments aa 
          JOIN users u ON aa.assigned_to_user_id = u.user_id 
          WHERE aa.property_type = 'lot' 
            AND (aa.target_id_int = l.lot_id OR aa.target_id_str = l.lot_number) 
            AND aa.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted') 
          ORDER BY aa.assignment_id DESC LIMIT 1
        ) AS active_assessor_name
      FROM property_lots l
      JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
      WHERE (? = '' OR 
        l.lot_id = ? OR 
        l.lot_number LIKE ? OR 
        l.property_id = ? OR 
        o.first_name LIKE ? OR 
        o.last_name LIKE ? OR 
        CONCAT_WS(' ', o.first_name, o.last_name) LIKE ? OR
        b.barangay_name LIKE ?
      )
      ORDER BY l.lot_id ASC
      LIMIT 60
    `, [rawQ, numericQ, qWildcard, numericQ, qWildcard, qWildcard, qWildcard, qWildcard]);

    // 2. Query matching Buildings
    const [buildings] = await pool.query(`
      SELECT 
        'building' AS property_type,
        bg.building_id AS target_id_int,
        COALESCE(bg.building_name, CONCAT('BLDG-', bg.building_id)) AS target_id_str,
        bg.property_id,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        COALESCE(b.barangay_name, 'Unknown') AS barangay,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(a.street, ''), b.barangay_name), ''),
          b.barangay_name,
          'Lagonglong'
        ) AS location,
        CASE 
          WHEN (SELECT COUNT(*) FROM building_assessment_history bah WHERE bah.building_id = bg.building_id AND bah.assessment_status = 'approved') > 0 THEN 'Approved'
          WHEN (SELECT COUNT(*) FROM building_assessment_history bah WHERE bah.building_id = bg.building_id AND bah.assessment_status = 'submitted') > 0 THEN 'Pending Review'
          WHEN (SELECT COUNT(*) FROM assessment_assignments aa WHERE aa.property_type = 'building' AND (aa.target_id_int = bg.building_id OR aa.target_id_str = bg.building_name) AND aa.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted')) > 0 THEN 'Assigned'
          ELSE 'Unassessed'
        END AS assessment_status,
        (
          SELECT aa.assignment_id 
          FROM assessment_assignments aa 
          WHERE aa.property_type = 'building' 
            AND (aa.target_id_int = bg.building_id OR aa.target_id_str = bg.building_name) 
            AND aa.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted') 
          ORDER BY aa.assignment_id DESC LIMIT 1
        ) AS active_assignment_id,
        (
          SELECT CONCAT_WS(' ', u.first_name, u.last_name) 
          FROM assessment_assignments aa 
          JOIN users u ON aa.assigned_to_user_id = u.user_id 
          WHERE aa.property_type = 'building' 
            AND (aa.target_id_int = bg.building_id OR aa.target_id_str = bg.building_name) 
            AND aa.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted') 
          ORDER BY aa.assignment_id DESC LIMIT 1
        ) AS active_assessor_name
      FROM property_buildings bg
      JOIN properties p ON bg.property_id = p.property_id
      LEFT JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
      WHERE (? = '' OR 
        bg.building_id = ? OR 
        bg.building_name LIKE ? OR 
        bg.property_id = ? OR 
        o.first_name LIKE ? OR 
        o.last_name LIKE ? OR 
        CONCAT_WS(' ', o.first_name, o.last_name) LIKE ? OR
        b.barangay_name LIKE ?
      )
      ORDER BY bg.building_id ASC
      LIMIT 60
    `, [rawQ, numericQ, qWildcard, numericQ, qWildcard, qWildcard, qWildcard, qWildcard]);

    const results = [...lots, ...buildings].map(item => ({
      ...item,
      has_active_assignment: Boolean(item.active_assignment_id)
    }));

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET active eligible assessors (for Admin/Head Assessor assignment with live assigned count)
router.get('/assessments/assessors', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const rawQ = req.query.q ? req.query.q.trim() : '';
    const q = `%${rawQ}%`;
    const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;
    const [rows] = await pool.query(`
      SELECT 
        u.user_id, 
        u.first_name, 
        u.last_name, 
        u.username, 
        u.email, 
        u.role, 
        u.status,
        (
          SELECT COUNT(*) 
          FROM assessment_assignments aa 
          WHERE aa.assigned_to_user_id = u.user_id 
            AND aa.assignment_status IN ('assigned', 'in_progress', 'submitted', 'pending')
        ) AS active_assignments_count,
        (
          SELECT COUNT(*) 
          FROM assessment_assignments aa 
          WHERE aa.assigned_to_user_id = u.user_id
        ) AS total_assignments_count
      FROM users u
      WHERE u.role = 'assessor' AND u.status = 'active'
        AND (
          ? = ''
          OR u.user_id = ?
          OR CONCAT_WS(' ', u.first_name, u.last_name) LIKE ?
          OR u.first_name LIKE ?
          OR u.last_name LIKE ?
          OR u.username LIKE ?
          OR u.email LIKE ?
        )
      ORDER BY u.first_name ASC, u.last_name ASC
    `, [rawQ, numericQ, q, q, q, q, q]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET all assignments (Admin view, enriched with owner & address)
router.get('/assessments/assignments', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, 
             u.first_name as assessor_first_name, u.last_name as assessor_last_name,
             u2.first_name as assigner_first_name, u2.last_name as assigner_last_name,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(' ', po_prop.first_name, po_prop.middle_name, po_prop.last_name)), ''),
               NULLIF(TRIM(CONCAT_WS(' ', po_lot.first_name, po_lot.middle_name, po_lot.last_name)), ''),
               NULLIF(TRIM(CONCAT_WS(' ', po_bldg.first_name, po_bldg.middle_name, po_bldg.last_name)), ''),
               'No owner record'
             ) AS owner_name,
             COALESCE(
               br_lot.barangay_name,
               br_bldg.barangay_name,
               br_prop.barangay_name,
               'Lagonglong'
             ) AS barangay,
             COALESCE(
               NULLIF(CONCAT_WS(', ', NULLIF(TRIM(ad_prop.street), ''), br_prop.barangay_name), ''),
               NULLIF(CONCAT_WS(', ', NULLIF(TRIM(ad_lot.street), ''), br_lot.barangay_name), ''),
               NULLIF(CONCAT_WS(', ', NULLIF(TRIM(ad_bldg.street), ''), br_bldg.barangay_name), ''),
               'Address not yet mapped'
             ) AS property_address
      FROM assessment_assignments a
      JOIN users u ON a.assigned_to_user_id = u.user_id
      JOIN users u2 ON a.assigned_by_user_id = u2.user_id
      LEFT JOIN properties p ON (a.property_type = 'property' AND (p.property_id = a.target_id_str OR p.property_id = a.target_id_int))
      LEFT JOIN property_owners po_prop ON p.owner_id = po_prop.owner_id
      LEFT JOIN addresses ad_prop ON p.address_id = ad_prop.address_id
      LEFT JOIN barangays br_prop ON ad_prop.barangay_id = br_prop.barangay_id
      LEFT JOIN property_lots l ON (a.property_type = 'lot' AND (l.lot_id = a.target_id_int OR l.lot_number = a.target_id_str))
      LEFT JOIN properties p_lot ON l.property_id = p_lot.property_id
      LEFT JOIN property_owners po_lot ON p_lot.owner_id = po_lot.owner_id
      LEFT JOIN addresses ad_lot ON p_lot.address_id = ad_lot.address_id
      LEFT JOIN barangays br_lot ON ad_lot.barangay_id = br_lot.barangay_id
      LEFT JOIN property_buildings b ON (a.property_type = 'building' AND (b.building_id = a.target_id_int OR b.building_name = a.target_id_str))
      LEFT JOIN properties p_bldg ON b.property_id = p_bldg.property_id
      LEFT JOIN property_owners po_bldg ON p_bldg.owner_id = po_bldg.owner_id
      LEFT JOIN addresses ad_bldg ON p_bldg.address_id = ad_bldg.address_id
      LEFT JOIN barangays br_bldg ON ad_bldg.barangay_id = br_bldg.barangay_id
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

// POST assign an assessment (supports new assignment & seamless reassignment)
router.post('/assessments/assign', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { property_type, target_id_int, target_id_str, assigned_to_user_id, due_date, instructions, reassign, reason } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (!['lot', 'building', 'property'].includes(property_type)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid property type. Must be lot, building, or property.' });
    }

    // 1. Validate that the property exists in the database
    let propExists = false;
    if (property_type === 'lot') {
      const [lRows] = await connection.query('SELECT lot_id FROM property_lots WHERE lot_id = ? OR lot_number = ?', [target_id_int, target_id_str]);
      propExists = lRows.length > 0;
    } else if (property_type === 'building') {
      const [bRows] = await connection.query('SELECT building_id FROM property_buildings WHERE building_id = ? OR building_name = ?', [target_id_int, target_id_str]);
      propExists = bRows.length > 0;
    } else if (property_type === 'property') {
      const [pRows] = await connection.query('SELECT property_id FROM properties WHERE property_id = ?', [target_id_int]);
      propExists = pRows.length > 0;
    }

    if (!propExists) {
      await connection.rollback();
      return res.status(404).json({ message: 'Selected property does not exist in the database.' });
    }

    // 2. Validate that the selected account is an active eligible assessor
    const [assessorRows] = await connection.query('SELECT user_id, first_name, last_name, role, status FROM users WHERE user_id = ?', [assigned_to_user_id]);
    if (!assessorRows[0] || assessorRows[0].role !== 'assessor' || assessorRows[0].status !== 'active') {
      await connection.rollback();
      return res.status(400).json({ message: 'Selected user is not an active eligible assessor.' });
    }
    const assessorName = `${assessorRows[0].first_name} ${assessorRows[0].last_name}`.trim();

    // 3. Check for existing active assignment
    const [existing] = await connection.query(`
      SELECT a.assignment_id, a.assigned_to_user_id, u.first_name, u.last_name
      FROM assessment_assignments a
      JOIN users u ON a.assigned_to_user_id = u.user_id
      WHERE a.property_type = ? AND a.target_id_int = ? 
      AND a.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted')
      ORDER BY a.assignment_id DESC LIMIT 1
    `, [property_type, target_id_int]);

    if (existing.length > 0) {
      const curr = existing[0];
      const currName = `${curr.first_name} ${curr.last_name}`.trim();

      if (!reassign) {
        await connection.rollback();
        return res.status(409).json({
          message: `This property is already actively assigned to Assessor ${currName}.`,
          current_assignment_id: curr.assignment_id,
          current_assessor_id: curr.assigned_to_user_id,
          current_assessor_name: currName
        });
      }

      // Reassign: Mark old assignment as reassigned
      await connection.query(`
        UPDATE assessment_assignments 
        SET assignment_status = 'reassigned'
        WHERE assignment_id = ?
      `, [curr.assignment_id]);

      const reassignNote = reason ? `Reassigned from ${currName}. Reason: ${reason}` : (instructions || `Reassigned from ${currName}`);
      const [newAssign] = await connection.query(`
        INSERT INTO assessment_assignments (property_type, target_id_int, target_id_str, assigned_to_user_id, assigned_by_user_id, due_date, instructions)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [property_type, target_id_int, target_id_str, assigned_to_user_id, req.user.id, due_date || null, reassignNote]);

      await logActivity(connection, req, 'REASSIGN', 'Assignments', `ID ${newAssign.insertId}`, `Admin ${req.user.first_name || ''} reassigned ${target_id_str} from ${currName} to ${assessorName}.${reason ? ' Reason: ' + reason : ''}`);
      await createNotification(assigned_to_user_id, 'Assessment Assigned (Reassigned)', `You have been assigned to assess ${target_id_str}.`, 'ASSESSMENT', target_id_str);

      await connection.commit();
      return res.status(201).json({ message: `Assessment successfully reassigned to ${assessorName}.`, assignment_id: newAssign.insertId });
    }

    // 4. Create fresh assignment
    const [result] = await connection.query(`
      INSERT INTO assessment_assignments (property_type, target_id_int, target_id_str, assigned_to_user_id, assigned_by_user_id, due_date, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [property_type, target_id_int, target_id_str, assigned_to_user_id, req.user.id, due_date || null, instructions || '']);

    await logActivity(connection, req, 'ASSIGN', 'Assignments', `ID ${result.insertId}`, `Admin ${req.user.first_name || ''} assigned ${target_id_str} to Assessor ${assessorName}.`);
    await createNotification(assigned_to_user_id, 'New Assessment Assigned', `You have been assigned to assess ${target_id_str}.`, 'ASSESSMENT', target_id_str);

    await connection.commit();
    res.status(201).json({ message: `Assessment successfully assigned to ${assessorName}.`, assignment_id: result.insertId });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// PUT reassign an assessment by assignment_id
router.put('/assessments/assignments/:id/reassign', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { id } = req.params;
  const { new_assessor_id, reason, due_date } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [assignment] = await connection.query(`SELECT * FROM assessment_assignments WHERE assignment_id = ?`, [id]);
    if (!assignment[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Assignment record not found.' });
    }

    const current = assignment[0];

    if (current.assignment_status === 'cancelled') {
      await connection.rollback();
      return res.status(400).json({ message: 'Cannot reassign a cancelled assignment.' });
    }

    if (current.assignment_status === 'approved') {
      await connection.rollback();
      return res.status(400).json({ message: 'Cannot reassign an assessment that has already been approved.' });
    }

    // Validate new assessor
    const [assessorRows] = await connection.query('SELECT user_id, first_name, last_name, role, status FROM users WHERE user_id = ?', [new_assessor_id]);
    if (!assessorRows[0] || assessorRows[0].role !== 'assessor' || assessorRows[0].status !== 'active') {
      await connection.rollback();
      return res.status(400).json({ message: 'Selected user is not an active eligible assessor.' });
    }

    const old_id = current.assigned_to_user_id;
    if (Number(old_id) === Number(new_assessor_id)) {
      await connection.rollback();
      return res.status(400).json({ message: 'The selected assessor is already assigned to this property.' });
    }

    const [oldAssessorRows] = await connection.query('SELECT first_name, last_name FROM users WHERE user_id = ?', [old_id]);
    const oldAssessorName = oldAssessorRows[0] ? `${oldAssessorRows[0].first_name} ${oldAssessorRows[0].last_name}`.trim() : `Assessor #${old_id}`;
    const newAssessorName = `${assessorRows[0].first_name} ${assessorRows[0].last_name}`.trim();

    // Mark old as reassigned
    await connection.query(`
      UPDATE assessment_assignments 
      SET assignment_status = 'reassigned'
      WHERE assignment_id = ?
    `, [id]);

    // Create new assignment
    const reassignInstructions = `Reassigned from ${oldAssessorName}.${reason ? ' Reason: ' + reason : ''}`;
    const [result] = await connection.query(`
      INSERT INTO assessment_assignments (property_type, target_id_int, target_id_str, assigned_to_user_id, assigned_by_user_id, due_date, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [current.property_type, current.target_id_int, current.target_id_str, new_assessor_id, req.user.id, due_date || current.due_date || null, reassignInstructions]);

    const adminName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.username;
    await logActivity(
      connection, 
      req, 
      'REASSIGN', 
      'Assignments', 
      `Assignment #${result.insertId} (${current.target_id_str})`, 
      `Admin ${adminName} reassigned ${current.property_type.toUpperCase()} ${current.target_id_str} from ${oldAssessorName} to ${newAssessorName}.${reason ? ' Reason: ' + reason : ''}`
    );

    // Notify new assessor
    await createNotification(
      new_assessor_id, 
      'Assessment Reassigned', 
      `You have been assigned to assess ${current.target_id_str} (transferred from ${oldAssessorName}).${reason ? ' Reason: ' + reason : ''}`, 
      'ASSESSMENT', 
      current.target_id_str
    );

    // Notify previous assessor
    await createNotification(
      old_id, 
      'Assignment Transferred', 
      `Your assignment for ${current.target_id_str} has been transferred to ${newAssessorName} by Admin.${reason ? ' Reason: ' + reason : ''}`, 
      'ASSESSMENT', 
      current.target_id_str
    );

    await connection.commit();
    res.json({ message: `Assessment successfully reassigned to ${newAssessorName}.`, assignment_id: result.insertId });
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
  const { reason } = req.body || {};
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [assignment] = await connection.query(`SELECT * FROM assessment_assignments WHERE assignment_id = ?`, [id]);
    if (!assignment[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Assignment record not found.' });
    }

    const current = assignment[0];
    if (current.assignment_status === 'cancelled') {
      await connection.rollback();
      return res.status(400).json({ message: 'Assignment is already cancelled.' });
    }

    if (current.assignment_status === 'approved') {
      await connection.rollback();
      return res.status(400).json({ message: 'Cannot cancel an assignment that has already been approved.' });
    }

    // Preserve cancellation reason and admin audit in instructions/activity_log
    const cancelNote = reason ? `\n[Cancelled by Admin: ${reason}]` : `\n[Cancelled by Admin]`;
    await connection.query(
      `UPDATE assessment_assignments 
       SET assignment_status = 'cancelled', 
           instructions = CONCAT(COALESCE(instructions, ''), ?) 
       WHERE assignment_id = ?`,
      [cancelNote, id]
    );

    const adminName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.username;
    await logActivity(
      connection, 
      req, 
      'CANCEL', 
      'Assignments', 
      `Assignment #${id} (${current.target_id_str})`, 
      `Admin ${adminName} cancelled assignment for ${current.property_type.toUpperCase()} ${current.target_id_str}.${reason ? ' Reason: ' + reason : ''}`
    );

    await createNotification(
      current.assigned_to_user_id, 
      'Assignment Cancelled', 
      `Your assessment assignment for ${current.target_id_str} was cancelled by Admin.${reason ? ' Reason: ' + reason : ''}`, 
      'ASSESSMENT', 
      current.target_id_str
    );

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
    const scope = req.query.scope; // 'my' or 'all'
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    // Check if user has permission to view all requests
    let canViewAll = isAdmin;
    if (!canViewAll) {
      const [permRows] = await pool.query(`
        SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_name = 'VIEW_PERMISSION_REQUEST'
        UNION
        SELECT 1 FROM role_permissions WHERE role = ? AND permission_name = 'VIEW_PERMISSION_REQUEST'
      `, [req.user.id, req.user.role]);
      canViewAll = permRows.length > 0;
    }

    if (scope === 'all' && !canViewAll) {
      return res.status(403).json({ 
        unauthorized: true, 
        message: 'You do not have permission to view requests from other assessors.',
        data: [] 
      });
    }

    let filter = '';
    let params = [];

    if (scope === 'all') {
      filter = '';
    } else if (scope === 'my' || !isAdmin) {
      filter = 'WHERE r.requested_by_user_id = ?';
      params = [req.user.id];
    }

    const [rows] = await pool.query(`
      SELECT 
        r.*, 
        u.first_name, 
        u.last_name,
        u.username AS requester_username,
        u.email AS requester_email,
        rev.first_name AS reviewer_first_name,
        rev.last_name AS reviewer_last_name,
        aa.assignment_id,
        aa.assignment_status,
        aa.assigned_to_user_id,
        assessor_u.first_name AS assessor_first_name,
        assessor_u.last_name AS assessor_last_name,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', po_prop.first_name, po_prop.middle_name, po_prop.last_name)), ''),
          NULLIF(TRIM(CONCAT_WS(' ', po_lot.first_name, po_lot.middle_name, po_lot.last_name)), ''),
          NULLIF(TRIM(CONCAT_WS(' ', po_bldg.first_name, po_bldg.middle_name, po_bldg.last_name)), '')
        ) AS owner_name,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(ad_prop.street), ''), br_prop.barangay_name, mu_prop.municipality_name), ''),
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(ad_lot.street), ''), br_lot.barangay_name, mu_lot.municipality_name), ''),
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(ad_bldg.street), ''), br_bldg.barangay_name, mu_bldg.municipality_name), ''),
          NULLIF(br_prop.barangay_name, ''),
          NULLIF(br_lot.barangay_name, ''),
          NULLIF(br_bldg.barangay_name, ''),
          'Address not yet mapped'
        ) AS property_address,
        COALESCE(l.lot_number, b.building_name, r.target_id_str) AS property_or_lot_number,
        COALESCE(br_prop.barangay_name, br_lot.barangay_name, br_bldg.barangay_name, '') AS barangay
      FROM assessment_permission_requests r
      JOIN users u ON r.requested_by_user_id = u.user_id
      LEFT JOIN users rev ON r.reviewed_by_user_id = rev.user_id
      LEFT JOIN assessment_assignments aa ON (
        aa.property_type = r.property_type 
        AND (aa.target_id_int = r.target_id_int OR aa.target_id_str = r.target_id_str)
        AND aa.assignment_status NOT IN ('cancelled')
      )
      LEFT JOIN users assessor_u ON aa.assigned_to_user_id = assessor_u.user_id
      -- Property link
      LEFT JOIN properties p ON (r.property_type = 'property' AND (p.property_id = r.target_id_str OR p.property_id = r.target_id_int))
      LEFT JOIN property_owners po_prop ON p.owner_id = po_prop.owner_id
      LEFT JOIN addresses ad_prop ON p.address_id = ad_prop.address_id
      LEFT JOIN barangays br_prop ON ad_prop.barangay_id = br_prop.barangay_id
      LEFT JOIN municipalities mu_prop ON br_prop.municipality_id = mu_prop.municipality_id
      -- Lot link
      LEFT JOIN property_lots l ON (r.property_type = 'lot' AND (l.lot_id = r.target_id_str OR l.lot_id = r.target_id_int OR l.lot_number = r.target_id_str))
      LEFT JOIN properties p_lot ON l.property_id = p_lot.property_id
      LEFT JOIN property_owners po_lot ON p_lot.owner_id = po_lot.owner_id
      LEFT JOIN addresses ad_lot ON p_lot.address_id = ad_lot.address_id
      LEFT JOIN barangays br_lot ON ad_lot.barangay_id = br_lot.barangay_id
      LEFT JOIN municipalities mu_lot ON br_lot.municipality_id = mu_lot.municipality_id
      -- Building link
      LEFT JOIN property_buildings b ON (r.property_type = 'building' AND (b.building_id = r.target_id_str OR b.building_id = r.target_id_int OR b.building_name = r.target_id_str))
      LEFT JOIN properties p_bldg ON b.property_id = p_bldg.property_id
      LEFT JOIN property_owners po_bldg ON p_bldg.owner_id = po_bldg.owner_id
      LEFT JOIN addresses ad_bldg ON p_bldg.address_id = ad_bldg.address_id
      LEFT JOIN barangays br_bldg ON ad_bldg.barangay_id = br_bldg.barangay_id
      LEFT JOIN municipalities mu_bldg ON br_bldg.municipality_id = mu_bldg.municipality_id
      ${filter}
      ORDER BY r.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching assessment requests:', err);
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
    await notifyRole('admin', 'New Permission Request', `${req.user.first_name} requested permission to assess ${target_id_str}.`, 'PERMISSION_REQUEST', target_id_str);
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
    if (request.request_status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: 'Request is already processed.' });
    }

    // Approve the request
    await connection.query(`UPDATE assessment_permission_requests SET request_status = 'approved', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE request_id = ?`, [req.user.id, id]);

    if (request.request_action === 'ASSESSMENT') {
      // Create the assignment
      const [assignRes] = await connection.query(`
        INSERT INTO assessment_assignments (property_type, target_id_int, target_id_str, assigned_to_user_id, assigned_by_user_id, instructions)
        VALUES (?, ?, ?, ?, ?, 'Auto-assigned from approved permission request.')
      `, [request.property_type, request.target_id_int, request.target_id_str, request.requested_by_user_id, req.user.id]);
      await logActivity(connection, req, 'APPROVE', 'Assignments', `PR ${id}`, `Admin approved permission request PR-${id}. Assignment Created.`);
      await createNotification(request.requested_by_user_id, 'Permission Request Approved', `Your request to assess ${request.target_id_str} was approved.`, 'PERMISSION_APPROVED', request.target_id_str);
    } else if (request.request_action === 'ADDITION') {
      if (request.property_type === 'lot') {
        await connection.query('UPDATE property_lots SET lot_status = "active" WHERE lot_id = ?', [request.target_id_str]);
        await connection.query('UPDATE properties SET property_status = "active" WHERE property_id = (SELECT property_id FROM property_lots WHERE lot_id = ?)', [request.target_id_str]);
      } else if (request.property_type === 'building') {
        await connection.query('UPDATE property_buildings SET building_status = "active" WHERE building_id = ?', [request.target_id_str]);
        await connection.query('UPDATE properties SET property_status = "active" WHERE property_id = (SELECT property_id FROM property_buildings WHERE building_id = ?)', [request.target_id_str]);
      }
      await logActivity(connection, req, 'APPROVE', 'Properties', `PR ${id}`, `Admin approved addition of ${request.property_type} ${request.target_id_str}.`);
      await createNotification(request.requested_by_user_id, `${request.property_type === 'lot' ? 'Lot' : 'Building'} Approved`, `Your request to add ${request.property_type} ${request.target_id_str} was approved.`, 'PERMISSION_APPROVED', request.target_id_str);
    } else if (request.request_action === 'MANAGEMENT') {
      let data = request.proposed_data;
      if (typeof data === 'string') data = JSON.parse(data);
      if (request.property_type === 'lot') {
        await connection.query(
          'UPDATE property_lots SET property_id=?, lot_number=?, title_number=?, lot_area=?, lot_status=? WHERE lot_id=?',
          [data.property_id, data.lot_number, data.title_number || null, data.lot_area || null, data.lot_status || 'active', request.target_id_str]
        );
      } else if (request.property_type === 'building') {
        await connection.query(
          'UPDATE property_buildings SET property_id=?, building_name=?, building_type=?, floor_area=?, floor_count=?, construction_type=?, year_constructed=?, building_status=? WHERE building_id=?',
          [data.property_id, data.building_name, data.building_type, data.floor_area || null, data.floor_count || null, data.construction_type || null, data.year_constructed || null, data.building_status || 'active', request.target_id_str]
        );
        if (data.market_value !== undefined || data.assessed_value !== undefined) {
          await connection.query(
            'INSERT INTO building_assessment_history (building_id, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date, assessment_reason) VALUES (?, ?, ?, ?, ?, CURDATE(), ?)',
            [request.target_id_str, request.requested_by_user_id, 20.00, Number(data.market_value) || 0, Number(data.assessed_value) || 0, 'Approved staff update']
          );
        }
      }
      await logActivity(connection, req, 'APPROVE', 'Properties', `PR ${id}`, `Admin approved changes to ${request.property_type} ${request.target_id_str}.`);
      await createNotification(request.requested_by_user_id, `${request.property_type === 'lot' ? 'Lot' : 'Building'} Update Approved`, `Your request to update ${request.property_type} ${request.target_id_str} was approved.`, 'PERMISSION_APPROVED', request.target_id_str);
    } else if (request.request_action === 'GIS_UPDATE') {
      let data = request.proposed_data;
      if (typeof data === 'string') data = JSON.parse(data);
      
      const isLot = request.property_type === 'lot';
      const idField = isLot ? 'lot_id' : 'building_id';
      
      const [existingRow] = await connection.query(`SELECT gis_id FROM gis_locations WHERE ${idField} = ?`, [request.target_id_str]);
      
      if (existingRow.length > 0) {
        await connection.query(`
          UPDATE gis_locations SET coordinates = ?, area_sqm = ?, perimeter_m = ? WHERE gis_id = ?
        `, [JSON.stringify(data.coordinates), data.area_sqm, data.perimeter_m, existingRow[0].gis_id]);
      } else {
        await connection.query(`
          INSERT INTO gis_locations (property_id, ${idField}, geometry_type, coordinates, area_sqm, perimeter_m) 
          VALUES (?, ?, 'Polygon', ?, ?, ?)
        `, [data.property_id, request.target_id_str, JSON.stringify(data.coordinates), data.area_sqm, data.perimeter_m]);
      }
      
      if (data.scan_id) {
        await connection.query(`UPDATE scanned_blueprints SET status = 'approved' WHERE scan_id = ?`, [data.scan_id]);
      }
      
      await logActivity(connection, req, 'APPROVE', 'GIS', `PR ${id}`, `Admin approved GIS update for ${request.property_type} ${request.target_id_str}.`);
      await createNotification(request.requested_by_user_id, 'GIS Update Approved', `Your request to update GIS for ${request.property_type} ${request.target_id_str} was approved.`, 'PERMISSION_APPROVED', request.target_id_str);
    } else if (request.request_action === 'SCAN_ADDITION') {
      let data = request.proposed_data;
      if (typeof data === 'string') data = JSON.parse(data);

      const owner = data.owner || 'Unknown Owner';
      const barangay = data.barangay || '';
      const municipality = data.municipality || '';
      const province = data.province || '';
      const area = data.stated_area || 0;

      // 1. Create or get owner
      const [ownerRows] = await connection.query('SELECT owner_id FROM property_owners WHERE full_name = ?', [owner]);
      let ownerId;
      if (ownerRows.length > 0) {
        ownerId = ownerRows[0].owner_id;
      } else {
        const [ownerResult] = await connection.query('INSERT INTO property_owners (full_name, contact_number, email, address) VALUES (?, NULL, NULL, NULL)', [owner]);
        ownerId = ownerResult.insertId;
      }

      // 2. Create address
      const [addressResult] = await connection.query('INSERT INTO property_addresses (street_address, barangay, municipality, province, region, zip_code) VALUES (?, ?, ?, ?, ?, ?)', 
        ['', barangay, municipality, province, 'Region X', '9000']);
      const addressId = addressResult.insertId;

      // 3. Generate property ID
      const purokStr = `${municipality.toUpperCase()}-${barangay.toUpperCase().replace(/\s+/g, '')}`;
      const [pRows] = await connection.query(
        "SELECT property_id FROM properties WHERE property_id LIKE ? ORDER BY CAST(SUBSTRING_INDEX(property_id, '-A', -1) AS UNSIGNED) DESC LIMIT 1",
        [`LP-${purokStr}-A%`]
      );
      let nextPropSeq = 1;
      if (pRows.length > 0) {
        const match = pRows[0].property_id.match(/-A(\d+)$/);
        if (match) nextPropSeq = parseInt(match[1]) + 1;
      }
      const propertyIdStr = `LP-${purokStr}-A${nextPropSeq}`;

      // 4. Create property
      await connection.query('INSERT INTO properties (property_id, owner_id, address_id, property_type_id, classification_id, property_status) VALUES (?, ?, ?, ?, ?, ?)', 
        [propertyIdStr, ownerId, addressId, 1, 1, 'active']);

      // 5. Generate lot ID and Create lot
      const [lRows] = await connection.query(
        "SELECT lot_id FROM property_lots WHERE lot_id LIKE ? ORDER BY CAST(SUBSTRING_INDEX(lot_id, '-L', -1) AS UNSIGNED) DESC LIMIT 1",
        [`LP-${purokStr}-L%`]
      );
      let nextLotSeq = 1;
      if (lRows.length > 0) {
        const match = lRows[0].lot_id.match(/-L(\d+)$/);
        if (match) nextLotSeq = parseInt(match[1]) + 1;
      }
      const lotId = `LP-${purokStr}-L${nextLotSeq}`;

      await connection.query('INSERT INTO property_lots (lot_id, property_id, lot_number, title_number, lot_area, lot_status) VALUES (?, ?, ?, ?, ?, ?)', 
        [lotId, propertyIdStr, data.lot_number || `LOT-${propertyIdStr}`, data.cad_reference || null, Number.isFinite(area) ? area : null, 'active']);

      // 6. Create GIS Location
      if (data.coordinates) {
        await connection.query(`
          INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m) 
          VALUES (?, ?, 'Polygon', ?, ?, ?)
        `, [propertyIdStr, lotId, JSON.stringify(data.coordinates), data.area_sqm || 0, data.perimeter_m || 0]);
      }

      // 7. Update scanner status
      if (data.scan_id) {
        await connection.query(`UPDATE scanned_blueprints SET status = 'approved', lot_number = ?, cad_reference = ? WHERE scan_id = ?`, [data.lot_number, data.cad_reference, data.scan_id]);
      }
      
      await logActivity(connection, req, 'APPROVE', 'Scanner', `PR ${id}`, `Admin approved blueprint lot creation. Lot ID: ${lotId}`);
      await createNotification(request.requested_by_user_id, 'Blueprint Lot Created', `Your request to create lot ${data.lot_number} was approved.`, 'PERMISSION_APPROVED', lotId);
    }

    await connection.commit();
    res.json({ message: 'Request approved successfully.' });
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
    const [reqRow] = await connection.query(`SELECT request_status, requested_by_user_id, target_id_str, request_action, property_type, proposed_data FROM assessment_permission_requests WHERE request_id = ?`, [id]);
    if (!reqRow[0]) return res.status(404).json({ message: 'Request not found' });
    if (reqRow[0].request_status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: 'Request is already processed.' });
    }
    
    await connection.query(`UPDATE assessment_permission_requests SET request_status = 'rejected', rejection_reason = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE request_id = ?`, [reason, req.user.id, id]);
    if (reqRow[0]) {
      const { requested_by_user_id, target_id_str, request_action, property_type } = reqRow[0];
      await logActivity(connection, req, 'REJECT', request_action === 'ASSESSMENT' ? 'Assignments' : 'Properties', `PR ${id}`, `Admin rejected ${request_action} request PR-${id}. Reason: ${reason}`);

      let notifTitle = 'Permission Request Rejected';
      let notifMsg = `Your request to assess ${target_id_str} was rejected. Reason: ${reason}`;
      if (request_action === 'ADDITION') {
        notifTitle = `${property_type === 'lot' ? 'Lot' : 'Building'} Addition Rejected`;
        notifMsg = `Your request to add ${property_type} ${target_id_str} was rejected. Reason: ${reason}`;
      } else if (request_action === 'MANAGEMENT') {
        notifTitle = `${property_type === 'lot' ? 'Lot' : 'Building'} Update Rejected`;
        notifMsg = `Your request to update ${property_type} ${target_id_str} was rejected. Reason: ${reason}`;
      } else if (request_action === 'GIS_UPDATE') {
        notifTitle = 'GIS Update Rejected';
        notifMsg = `Your request to update GIS for ${property_type} ${target_id_str} was rejected. Reason: ${reason}`;
        if (reqRow[0].proposed_data) {
          let data = reqRow[0].proposed_data;
          if (typeof data === 'string') data = JSON.parse(data);
          if (data.scan_id) {
            await connection.query(`UPDATE scanned_blueprints SET status = 'rejected', rejection_reason = ? WHERE scan_id = ?`, [reason, data.scan_id]);
          }
        }
      } else if (request_action === 'SCAN_ADDITION') {
        notifTitle = 'Blueprint Scan Rejected';
        notifMsg = `Your request to create a lot from a blueprint scan was rejected. Reason: ${reason}`;
        if (reqRow[0].proposed_data) {
          let data = reqRow[0].proposed_data;
          if (typeof data === 'string') data = JSON.parse(data);
          if (data.scan_id) {
            await connection.query(`UPDATE scanned_blueprints SET status = 'rejected', rejection_reason = ? WHERE scan_id = ?`, [reason, data.scan_id]);
          }
        }
      }
      await createNotification(requested_by_user_id, notifTitle, notifMsg, 'PERMISSION_REJECTED', target_id_str);
    }

    await connection.commit();
    res.json({ message: 'Permission request rejected.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// POST cancel request
router.post('/assessments/requests/:id/cancel', authenticate, allowRoles('staff', 'assessor'), async (req, res, next) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reqRow] = await connection.query(`SELECT requested_by_user_id, request_status, target_id_str, property_type FROM assessment_permission_requests WHERE request_id = ?`, [id]);
    if (!reqRow[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Request not found' });
    }
    if (reqRow[0].requested_by_user_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ message: 'Unauthorized to cancel this request. You can only cancel your own requests.' });
    }
    if (reqRow[0].request_status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: `Cannot cancel request. Only pending requests can be cancelled (current status: ${reqRow[0].request_status}).` });
    }

    await connection.query(`UPDATE assessment_permission_requests SET request_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`, [id]);
    await logActivity(connection, req, 'CANCEL', 'Permission Requests', `PR-${id}`, `Assessor ${req.user.first_name || ''} ${req.user.last_name || ''} cancelled permission request PR-${id} for ${reqRow[0].target_id_str}.`);
    await connection.commit();

    res.json({ message: 'Request cancelled successfully.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// POST resubmit request
router.post('/assessments/requests/:id/resubmit', authenticate, allowRoles('staff', 'assessor'), async (req, res, next) => {
  const { id } = req.params;
  const { proposed_data } = req.body;
  const connection = await pool.getConnection();
  try {
    const [reqRow] = await connection.query(`SELECT requested_by_user_id, request_status FROM assessment_permission_requests WHERE request_id = ?`, [id]);
    if (!reqRow[0]) return res.status(404).json({ message: 'Request not found' });
    if (reqRow[0].requested_by_user_id !== req.user.id) return res.status(403).json({ message: 'Unauthorized to resubmit this request.' });
    if (reqRow[0].request_status !== 'rejected') return res.status(400).json({ message: 'Can only resubmit rejected requests.' });

    await connection.query(
      `UPDATE assessment_permission_requests SET request_status = 'pending', proposed_data = ?, rejection_reason = NULL, reviewed_by_user_id = NULL, reviewed_at = NULL WHERE request_id = ?`,
      [proposed_data ? JSON.stringify(proposed_data) : null, id]
    );
    res.json({ message: 'Request resubmitted successfully.' });
  } catch (err) {
    next(err);
  } finally {
    connection.release();
  }
});

// PUT edit assessment permission request
router.put('/assessments/requests/:id', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { id } = req.params;
  const { property_type, target_id_str, target_id_int, requested_by_user_id, reason, request_action } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(`SELECT * FROM assessment_permission_requests WHERE request_id = ?`, [id]);
    if (!existingRows[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Assessment request not found.' });
    }
    const existing = existingRows[0];

    // Check if property exists
    let resolvedIntId = target_id_int;
    let resolvedStrId = target_id_str || existing.target_id_str;
    const resolvedType = property_type || existing.property_type;

    if (resolvedType === 'lot') {
      const [lots] = await connection.query('SELECT lot_id, lot_number FROM property_lots WHERE lot_id = ? OR lot_number = ?', [resolvedStrId, resolvedStrId]);
      if (lots.length > 0) {
        resolvedIntId = lots[0].lot_id;
        resolvedStrId = lots[0].lot_number || String(lots[0].lot_id);
      }
    } else if (resolvedType === 'building') {
      const [bldgs] = await connection.query('SELECT building_id, building_name FROM property_buildings WHERE building_id = ? OR building_name = ?', [resolvedStrId, resolvedStrId]);
      if (bldgs.length > 0) {
        resolvedIntId = bldgs[0].building_id;
        resolvedStrId = bldgs[0].building_name || String(bldgs[0].building_id);
      }
    }

    // Check assessor if provided
    let newAssessorId = existing.requested_by_user_id;
    if (requested_by_user_id) {
      const [uRows] = await connection.query('SELECT user_id, first_name, last_name, role, status FROM users WHERE user_id = ?', [requested_by_user_id]);
      if (!uRows[0] || uRows[0].status !== 'active') {
        await connection.rollback();
        return res.status(400).json({ message: 'Selected assessor account is invalid or inactive.' });
      }
      newAssessorId = uRows[0].user_id;
    }

    // If request was already approved, ensure assessment has not already completed
    if (existing.request_status === 'approved') {
      // Check if official assessment completed
      const checkTable = existing.property_type === 'lot' ? 'lot_assessment_history' : existing.property_type === 'building' ? 'building_assessment_history' : 'property_assessments';
      const checkCol = existing.property_type === 'lot' ? 'lot_id' : existing.property_type === 'building' ? 'building_id' : 'property_id';
      const [assessRows] = await connection.query(`SELECT assessment_status FROM ${checkTable} WHERE ${checkCol} = ? AND assessment_status = 'approved'`, [existing.target_id_int || existing.target_id_str]);
      if (assessRows.length > 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Cannot edit this request: The property assessment has already been approved and finalized.' });
      }

      // Sync changes to the assessment_assignments record
      if (existing.request_action === 'ASSESSMENT') {
        await connection.query(`
          UPDATE assessment_assignments 
          SET property_type = ?, target_id_int = ?, target_id_str = ?, assigned_to_user_id = ?, instructions = ?
          WHERE property_type = ? AND (target_id_int = ? OR target_id_str = ?) AND assignment_status NOT IN ('cancelled')
        `, [
          resolvedType, resolvedIntId, resolvedStrId, newAssessorId, reason || existing.reason,
          existing.property_type, existing.target_id_int, existing.target_id_str
        ]);
      }
    }

    // Update request
    await connection.query(`
      UPDATE assessment_permission_requests 
      SET property_type = ?, target_id_int = ?, target_id_str = ?, requested_by_user_id = ?, reason = ?, request_action = ?, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [
      resolvedType, 
      resolvedIntId || existing.target_id_int, 
      resolvedStrId, 
      newAssessorId, 
      reason !== undefined ? reason : existing.reason, 
      request_action || existing.request_action,
      id
    ]);

    await logActivity(connection, req, 'EDIT_REQUEST', 'Assignments', `PR ${id}`, `Admin edited request PR-${id}. Target: ${resolvedStrId}, Assigned to User ID: ${newAssessorId}.`);
    await connection.commit();
    res.json({ message: 'Assessment request updated successfully.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// POST revoke or cancel an approved request
router.post('/assessments/requests/:id/revoke', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const { id } = req.params;
  const { reason, return_to } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ message: 'A reason for cancelling or revoking the approval is required.' });
  }

  const newStatus = return_to === 'revoked' ? 'revoked' : 'pending';
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reqRow] = await connection.query(`SELECT * FROM assessment_permission_requests WHERE request_id = ?`, [id]);
    if (!reqRow[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Assessment request not found.' });
    }
    const request = reqRow[0];

    if (request.request_status !== 'approved') {
      await connection.rollback();
      return res.status(400).json({ message: `Cannot revoke request: Request is currently in '${request.request_status}' status, not approved.` });
    }

    // Safety check: verify if an assessment is already approved
    if (request.request_action === 'ASSESSMENT') {
      const checkTable = request.property_type === 'lot' ? 'lot_assessment_history' : request.property_type === 'building' ? 'building_assessment_history' : 'property_assessments';
      const checkCol = request.property_type === 'lot' ? 'lot_id' : request.property_type === 'building' ? 'building_id' : 'property_id';
      const [assessRows] = await connection.query(`SELECT assessment_status FROM ${checkTable} WHERE ${checkCol} = ? AND assessment_status = 'approved'`, [request.target_id_int || request.target_id_str]);
      if (assessRows.length > 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Cannot revoke approval: Property assessment has already been completed and approved by Head Assessor.' });
      }

      // Deactivate / cancel the associated assignment so the property is unassigned or reset
      await connection.query(`
        UPDATE assessment_assignments 
        SET assignment_status = 'cancelled' 
        WHERE property_type = ? AND (target_id_int = ? OR target_id_str = ?) AND assignment_status IN ('assigned', 'in_progress', 'pending')
      `, [request.property_type, request.target_id_int, request.target_id_str]);
    }

    // Update the request status
    await connection.query(`
      UPDATE assessment_permission_requests 
      SET request_status = ?, rejection_reason = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [newStatus, `Revoked: ${reason.trim()}`, req.user.id, id]);

    await logActivity(
      connection, 
      req, 
      'REVOKE_APPROVAL', 
      'Assignments', 
      `PR ${id}`, 
      `Admin revoked approval for request PR-${id} (${request.target_id_str}). Reason: ${reason}. Status set to: ${newStatus}.`
    );

    await createNotification(
      request.requested_by_user_id, 
      'Approval Revoked', 
      `Approval for request PR-${id} (${request.target_id_str}) was revoked by Admin. Reason: ${reason}`, 
      'PERMISSION_REVOKED', 
      request.target_id_str
    );

    await connection.commit();
    res.json({ 
      message: newStatus === 'pending' 
        ? 'Approval cancelled successfully. Request has been returned to Pending Review.' 
        : 'Approval successfully revoked.',
      new_status: newStatus 
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

export default router;
