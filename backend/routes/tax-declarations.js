import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles, requirePermission } from '../middleware/auth.js';
import { generateTaxDeclarationNumber } from '../utils/idGenerator.js';
import { createNotification } from '../utils/notifications.js';
import { logTaxAuditEvent } from '../utils/taxAudit.js';

const router = Router();

// =========================================================================
// 1. GET ALL TAX DECLARATIONS (Searchable & Filterable)
// =========================================================================
router.get('/tax-declarations', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const { status, type, barangay, year, q } = req.query;
    const rawQ = q ? String(q).trim() : '';
    const qWildcard = `%${rawQ}%`;
    const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;

    let query = `
      SELECT 
        td.*,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        o.email AS owner_email,
        o.contact_number AS owner_contact,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), brgy.barangay_name), ''),
          brgy.barangay_name,
          'Lagonglong, Misamis Oriental'
        ) AS property_address,
        u_prep.first_name AS preparer_first_name, u_prep.last_name AS preparer_last_name,
        u_app.first_name AS approver_first_name, u_app.last_name AS approver_last_name
      FROM tax_declarations td
      JOIN properties p ON td.property_id = p.property_id
      JOIN property_owners o ON td.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      LEFT JOIN users u_prep ON td.prepared_by_user_id = u_prep.user_id
      LEFT JOIN users u_app ON td.approved_by_user_id = u_app.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ' AND td.status = ?';
      params.push(status);
    }

    if (type && type !== 'ALL') {
      query += ' AND td.property_type = ?';
      params.push(type);
    }

    if (barangay && barangay !== 'ALL') {
      query += ' AND LOWER(brgy.barangay_name) = LOWER(?)';
      params.push(barangay);
    }

    if (year && year !== 'ALL') {
      query += ' AND td.tax_year = ?';
      params.push(year);
    }

    if (rawQ) {
      query += `
        AND (
          td.declaration_number LIKE ?
          OR td.target_id_str LIKE ?
          OR td.property_code LIKE ?
          OR (? = 1 AND td.tax_declaration_id = ?)
          OR (? = 1 AND td.property_id = ?)
          OR o.first_name LIKE ?
          OR o.last_name LIKE ?
          OR CONCAT_WS(' ', o.first_name, o.last_name) LIKE ?
        )
      `;
      params.push(
        qWildcard, qWildcard, qWildcard,
        numericQ !== null ? 1 : 0, numericQ || 0,
        numericQ !== null ? 1 : 0, numericQ || 0,
        qWildcard, qWildcard, qWildcard
      );
    }

    query += ' ORDER BY td.tax_declaration_id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 2. GET ELIGIBLE APPROVED ASSESSMENTS FOR TAX DECLARATION CREATION
// =========================================================================
router.get('/tax-declarations/eligible-assessments', authenticate, allowRoles('admin', 'staff', 'super_admin', 'assessor'), async (req, res, next) => {
  try {
    const { q } = req.query;
    const rawQ = q ? String(q).trim() : '';
    const qWildcard = `%${rawQ}%`;
    const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;

    // Lots with approved assessments that don't have an active or issued tax declaration
    const [lotAssessments] = await pool.query(`
      SELECT 
        'lot' AS type,
        lah.lot_assessment_history_id AS assessment_id,
        lah.lot_id AS target_id_int,
        l.lot_number AS target_id_str,
        p.property_id,
        p.property_code,
        p.owner_id,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(pc.classification_name, 'Residential') AS classification,
        COALESCE(l.lot_area, 0) AS land_area,
        0 AS building_area,
        lah.market_value,
        lah.assessed_value,
        ROUND((lah.assessed_value / NULLIF(lah.market_value, 0)) * 100, 2) AS assessment_level,
        lah.assessment_date,
        lah.approval_date
      FROM lot_assessment_history lah
      JOIN property_lots l ON lah.lot_id = l.lot_id
      JOIN properties p ON l.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      WHERE lah.assessment_status = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM tax_declarations td 
          WHERE td.property_type = 'lot' 
            AND td.target_id_int = lah.lot_id 
            AND td.status IN ('approved', 'issued', 'pending_review')
        )
        AND (? = '' OR
          (? = 1 AND lah.lot_id = ?) OR
          (? = 1 AND p.property_id = ?) OR
          l.lot_number LIKE ? OR
          p.property_code LIKE ? OR
          CONCAT_WS(' ', o.first_name, o.last_name) LIKE ?
        )
      ORDER BY lah.lot_assessment_history_id DESC
      LIMIT 30
    `, [rawQ, numericQ !== null ? 1 : 0, numericQ || 0, numericQ !== null ? 1 : 0, numericQ || 0, qWildcard, qWildcard, qWildcard]);

    // Buildings with approved assessments
    const [buildingAssessments] = await pool.query(`
      SELECT 
        'building' AS type,
        bah.building_assessment_history_id AS assessment_id,
        bah.building_id AS target_id_int,
        COALESCE(b.building_code, b.building_name, CONCAT('BUILDING-', b.building_id)) AS target_id_str,
        p.property_id,
        p.property_code,
        p.owner_id,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(pc.classification_name, 'Residential') AS classification,
        0 AS land_area,
        COALESCE(b.floor_area, 0) AS building_area,
        bah.market_value,
        bah.assessed_value,
        ROUND((bah.assessed_value / NULLIF(bah.market_value, 0)) * 100, 2) AS assessment_level,
        bah.assessment_date,
        bah.approval_date
      FROM building_assessment_history bah
      JOIN property_buildings b ON bah.building_id = b.building_id
      JOIN properties p ON b.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      WHERE bah.assessment_status = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM tax_declarations td 
          WHERE td.property_type = 'building' 
            AND td.target_id_int = bah.building_id 
            AND td.status IN ('approved', 'issued', 'pending_review')
        )
        AND (? = '' OR
          (? = 1 AND bah.building_id = ?) OR
          (? = 1 AND p.property_id = ?) OR
          b.building_code LIKE ? OR
          p.property_code LIKE ? OR
          CONCAT_WS(' ', o.first_name, o.last_name) LIKE ?
        )
      ORDER BY bah.building_assessment_history_id DESC
      LIMIT 30
    `, [rawQ, numericQ !== null ? 1 : 0, numericQ || 0, numericQ !== null ? 1 : 0, numericQ || 0, qWildcard, qWildcard, qWildcard]);

    // Generic properties with approved assessments
    const [propertyAssessments] = await pool.query(`
      SELECT 
        'property' AS type,
        pa.assessment_id AS assessment_id,
        pa.property_id AS target_id_int,
        COALESCE(p.property_code, CONCAT('PROPERTY-', pa.property_id)) AS target_id_str,
        p.property_id,
        p.property_code,
        p.owner_id,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(pc.classification_name, 'Residential') AS classification,
        0 AS land_area,
        0 AS building_area,
        pa.market_value,
        pa.assessed_value,
        ROUND((pa.assessed_value / NULLIF(pa.market_value, 0)) * 100, 2) AS assessment_level,
        pa.assessment_date,
        pa.approval_date
      FROM property_assessments pa
      JOIN properties p ON pa.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      WHERE pa.assessment_status = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM tax_declarations td 
          WHERE td.property_type = 'property' 
            AND td.target_id_int = pa.property_id 
            AND td.status IN ('approved', 'issued', 'pending_review')
        )
        AND (? = '' OR
          (? = 1 AND pa.property_id = ?) OR
          p.property_code LIKE ? OR
          CONCAT_WS(' ', o.first_name, o.last_name) LIKE ?
        )
      ORDER BY pa.assessment_id DESC
      LIMIT 30
    `, [rawQ, numericQ !== null ? 1 : 0, numericQ || 0, qWildcard, qWildcard]);

    res.json([...lotAssessments, ...buildingAssessments, ...propertyAssessments]);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 3. GET SINGLE TAX DECLARATION DETAILS
// =========================================================================
router.get('/tax-declarations/:id', authenticate, allowRoles('assessor', 'admin', 'staff', 'super_admin', 'client'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const isNum = /^\d+$/.test(String(id).trim());
    const numId = isNum ? parseInt(id, 10) : null;

    const [rows] = await pool.query(`
      SELECT 
        td.*,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        o.email AS owner_email,
        o.contact_number AS owner_contact,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), brgy.barangay_name), ''),
          brgy.barangay_name,
          'Lagonglong, Misamis Oriental'
        ) AS property_address,
        u_prep.first_name AS preparer_first_name, u_prep.last_name AS preparer_last_name,
        u_app.first_name AS approver_first_name, u_app.last_name AS approver_last_name,
        prev_td.declaration_number AS previous_declaration_number
      FROM tax_declarations td
      JOIN properties p ON td.property_id = p.property_id
      JOIN property_owners o ON td.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      LEFT JOIN users u_prep ON td.prepared_by_user_id = u_prep.user_id
      LEFT JOIN users u_app ON td.approved_by_user_id = u_app.user_id
      LEFT JOIN tax_declarations prev_td ON td.previous_td_id = prev_td.tax_declaration_id
      WHERE (? = 1 AND td.tax_declaration_id = ?) OR td.declaration_number = ?
    `, [numId !== null ? 1 : 0, numId || 0, String(id).trim()]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tax declaration record not found.' });
    }

    const record = rows[0];

    // Client/Owner authorization check
    if (req.user.role === 'client') {
      if (!req.user.owner_id || record.owner_id !== req.user.owner_id) {
        return res.status(403).json({ message: 'You are not authorized to view this tax declaration.' });
      }
    }

    res.json(record);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 4. CREATE DRAFT TAX DECLARATION (Assessor Only)
// =========================================================================
router.post('/tax-declarations', authenticate, allowRoles('assessor'), async (req, res, next) => {

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      property_type,
      target_id_int,
      target_id_str,
      property_id,
      property_code,
      owner_id,
      assessment_type,
      assessment_id,
      classification = 'Residential',
      actual_use = 'Residential',
      land_area,
      building_area,
      market_value,
      assessment_level,
      assessed_value,
      tax_year = new Date().getFullYear(),
      effectivity_date = `${new Date().getFullYear()}-01-01`,
      remarks,
      barangay_name = 'Lumbo',
      status = 'draft'
    } = req.body;

    let finalPropId = property_id;
    let finalOwnerId = owner_id;
    let finalTargetIdStr = target_id_str;
    let finalTargetIdInt = target_id_int;
    let finalMarketValue = market_value;
    let finalAssessedValue = assessed_value;
    let finalAssessmentLevel = assessment_level;
    let finalClassification = classification;
    let finalActualUse = actual_use;
    let finalLandArea = land_area;
    let finalBuildingArea = building_area;
    let finalPropertyCode = property_code;
    let finalBarangay = barangay_name;

    if (assessment_id && (!finalPropId || !finalOwnerId || !finalMarketValue || !finalAssessedValue)) {
      if (property_type === 'building') {
        const [bah] = await connection.query(`
          SELECT 
            bah.*, b.building_id, COALESCE(b.building_code, b.building_name) as b_str, b.floor_area,
            p.property_id, p.property_code, p.owner_id, pc.classification_name, brgy.barangay_name
          FROM building_assessment_history bah
          JOIN property_buildings b ON bah.building_id = b.building_id
          JOIN properties p ON b.property_id = p.property_id
          LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
          LEFT JOIN addresses addr ON p.address_id = addr.address_id
          LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
          WHERE bah.building_assessment_history_id = ?
        `, [assessment_id]);
        if (bah[0]) {
          const row = bah[0];
          finalPropId = finalPropId || row.property_id;
          finalOwnerId = finalOwnerId || row.owner_id;
          finalPropertyCode = finalPropertyCode || row.property_code;
          finalTargetIdInt = finalTargetIdInt || row.building_id;
          finalTargetIdStr = finalTargetIdStr || row.b_str;
          finalMarketValue = finalMarketValue || row.market_value;
          finalAssessedValue = finalAssessedValue || row.assessed_value;
          finalAssessmentLevel = finalAssessmentLevel || (row.market_value > 0 ? (row.assessed_value / row.market_value) * 100 : 20);
          finalBuildingArea = finalBuildingArea || row.floor_area;
          finalClassification = finalClassification || row.classification_name || 'Residential';
          finalBarangay = finalBarangay || row.barangay_name || 'Lumbo';
        }
      } else {
        const [lah] = await connection.query(`
          SELECT 
            lah.*, l.lot_id, l.lot_number, l.lot_area,
            p.property_id, p.property_code, p.owner_id, pc.classification_name, brgy.barangay_name
          FROM lot_assessment_history lah
          JOIN property_lots l ON lah.lot_id = l.lot_id
          JOIN properties p ON l.property_id = p.property_id
          LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
          LEFT JOIN addresses addr ON p.address_id = addr.address_id
          LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
          WHERE lah.lot_assessment_history_id = ?
        `, [assessment_id]);
        if (lah[0]) {
          const row = lah[0];
          finalPropId = finalPropId || row.property_id;
          finalOwnerId = finalOwnerId || row.owner_id;
          finalPropertyCode = finalPropertyCode || row.property_code;
          finalTargetIdInt = finalTargetIdInt || row.lot_id;
          finalTargetIdStr = finalTargetIdStr || row.lot_number;
          finalMarketValue = finalMarketValue || row.market_value;
          finalAssessedValue = finalAssessedValue || row.assessed_value;
          finalAssessmentLevel = finalAssessmentLevel || (row.market_value > 0 ? (row.assessed_value / row.market_value) * 100 : 20);
          finalLandArea = finalLandArea || row.lot_area;
          finalClassification = finalClassification || row.classification_name || 'Residential';
          finalBarangay = finalBarangay || row.barangay_name || 'Lumbo';
        }
      }
    }

    if (!finalPropId || !finalOwnerId || !finalTargetIdStr || !finalMarketValue || !finalAssessedValue) {
      await connection.rollback();
      return res.status(400).json({ message: 'Missing required property, owner, or valuation details for tax declaration.' });
    }

    // Generate unique temporary or official TD number
    const tdNumber = await generateTaxDeclarationNumber(connection, finalBarangay, tax_year);

    const isDirectApproved = status === 'approved' && ['admin', 'super_admin'].includes(req.user.role);
    const initialStatus = isDirectApproved ? 'approved' : (status === 'pending_review' ? 'pending_review' : 'draft');
    const approverId = isDirectApproved ? req.user.id : null;
    const approvalDate = isDirectApproved ? new Date() : null;

    const [result] = await connection.query(`
      INSERT INTO tax_declarations (
        declaration_number, property_type, target_id_int, target_id_str,
        property_id, property_code, owner_id, assessment_type, assessment_id,
        classification, actual_use, land_area, building_area, market_value,
        assessment_level, assessed_value, tax_year, effectivity_date, status,
        prepared_by_user_id, approved_by_user_id, approval_date, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tdNumber, property_type || 'lot', finalTargetIdInt || 0, finalTargetIdStr,
      finalPropId, finalPropertyCode || null, finalOwnerId, assessment_type || 'lot', assessment_id || 0,
      finalClassification, finalActualUse, finalLandArea || null, finalBuildingArea || null,
      finalMarketValue, finalAssessmentLevel || 20.00, finalAssessedValue, tax_year,
      effectivity_date, initialStatus, req.user.id, approverId, approvalDate, remarks || null
    ]);

    const newTdId = result.insertId;

    await logTaxAuditEvent(connection, req, 'tax_declaration', newTdId, 'CREATE_DECLARATION', null, {
      declaration_number: tdNumber,
      target_id_str,
      market_value,
      assessed_value,
      status: initialStatus
    }, `Draft tax declaration created for ${target_id_str}`);

    await connection.commit();

    // Notify Head Assessor if submitted for review
    if (initialStatus === 'pending_review') {
      const [admins] = await pool.query("SELECT user_id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active'");
      for (const a of admins) {
        await createNotification(
          a.user_id,
          'Tax Declaration For Review',
          `Draft Tax Declaration ${tdNumber} for ${target_id_str} submitted for review.`,
          'TAX_DECLARATION_PENDING',
          newTdId
        );
      }
    }

    res.status(201).json({
      message: `Tax Declaration ${tdNumber} created successfully.`,
      tax_declaration_id: newTdId,
      declaration_number: tdNumber,
      status: initialStatus
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 4B. UPDATE DRAFT TAX DECLARATION (Assessor Only)
// =========================================================================
router.put('/tax-declarations/:id', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    const {
      classification,
      actual_use,
      land_area,
      building_area,
      market_value,
      assessment_level,
      assessed_value,
      remarks
    } = req.body;

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM tax_declarations WHERE tax_declaration_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax declaration not found.' });
    }

    const current = rows[0];
    if (current.status !== 'draft' && current.status !== 'returned_for_correction') {
      await connection.rollback();
      return res.status(400).json({ 
        message: `Only draft or returned declarations can be edited. Current status is '${current.status}'.` 
      });
    }

    const mv = market_value !== undefined ? Number(market_value) : Number(current.market_value);
    const al = assessment_level !== undefined ? Number(assessment_level) : Number(current.assessment_level);
    const av = assessed_value !== undefined ? Number(assessed_value) : (mv * (al / 100));

    await connection.query(`
      UPDATE tax_declarations
      SET classification = COALESCE(?, classification),
          actual_use = COALESCE(?, actual_use),
          land_area = COALESCE(?, land_area),
          building_area = COALESCE(?, building_area),
          market_value = ?,
          assessment_level = ?,
          assessed_value = ?,
          remarks = COALESCE(?, remarks),
          status = 'draft',
          updated_at = CURRENT_TIMESTAMP
      WHERE tax_declaration_id = ?
    `, [
      classification || null,
      actual_use || null,
      land_area !== undefined ? land_area : null,
      building_area !== undefined ? building_area : null,
      mv, al, av,
      remarks || null,
      id
    ]);

    await logTaxAuditEvent(connection, req, 'tax_declaration', id, 'UPDATE_DECLARATION', current, req.body);
    await connection.commit();

    res.json({
      message: `Tax Declaration ${current.declaration_number} successfully updated.`,
      tax_declaration_id: id,
      declaration_number: current.declaration_number,
      market_value: mv,
      assessment_level: al,
      assessed_value: av,
      status: 'draft'
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 5. SUBMIT DRAFT DECLARATION FOR REVIEW (Assessor Only)
// =========================================================================
router.post('/tax-declarations/:id/submit-review', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM tax_declarations WHERE tax_declaration_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax declaration not found.' });
    }

    const current = rows[0];
    if (current.status !== 'draft' && current.status !== 'returned_for_correction') {
      await connection.rollback();
      return res.status(400).json({ message: `Cannot submit tax declaration with status '${current.status}'. Must be draft or returned.` });
    }

    await connection.query(
      'UPDATE tax_declarations SET status = "pending_review", updated_at = CURRENT_TIMESTAMP WHERE tax_declaration_id = ?',
      [id]
    );

    await logTaxAuditEvent(connection, req, 'tax_declaration', id, 'SUBMIT_FOR_REVIEW', { status: current.status }, { status: 'pending_review' });

    await connection.commit();

    // Broadcast notification to Head Assessor / Admin
    const [admins] = await pool.query("SELECT user_id FROM users WHERE role = 'admin' AND status = 'active'");
    for (const a of admins) {
      await createNotification(
        a.user_id,
        'Tax Declaration Pending Review',
        `Tax Declaration ${current.declaration_number} has been submitted by the Assessor for official review.`,
        'TAX_DECLARATION_PENDING',
        id
      );
    }

    res.json({ message: `Tax Declaration ${current.declaration_number} submitted for Admin review.` });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 6. REVIEW DECLARATION (Admin Only - Approve or Return with Correction Note)
// =========================================================================
router.post('/tax-declarations/:id/review', authenticate, allowRoles('admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    const { action, reason } = req.body; // action: 'approve' | 'return' | 'reject'

    if (!['approve', 'return', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Action must be 'approve', 'return', or 'reject'." });
    }

    if ((action === 'return' || action === 'reject') && !reason?.trim()) {
      return res.status(400).json({ message: 'Correction reason is required when returning or rejecting a declaration.' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM tax_declarations WHERE tax_declaration_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax declaration not found.' });
    }

    const current = rows[0];
    const newStatus = action === 'approve' ? 'approved' : (action === 'return' ? 'returned_for_correction' : 'cancelled');

    await connection.query(`
      UPDATE tax_declarations 
      SET status = ?, 
          approved_by_user_id = ?, 
          approval_date = ?, 
          correction_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE tax_declaration_id = ?
    `, [
      newStatus,
      action === 'approve' ? req.user.id : null,
      action === 'approve' ? new Date() : null,
      (action === 'return' || action === 'reject') ? reason.trim() : null,
      id
    ]);

    await logTaxAuditEvent(connection, req, 'tax_declaration', id, `REVIEW_${action.toUpperCase()}`, { status: current.status }, { status: newStatus, reason });

    await connection.commit();

    // Notify preparer
    if (current.prepared_by_user_id) {
      await createNotification(
        current.prepared_by_user_id,
        `Tax Declaration ${action === 'approve' ? 'Approved' : 'Returned'}`,
        `Tax Declaration ${current.declaration_number} was ${action === 'approve' ? 'approved' : 'returned for correction'}. ${reason ? `Note: ${reason}` : ''}`,
        'TAX_DECLARATION_STATUS',
        id
      );
    }

    res.json({
      message: `Tax Declaration ${current.declaration_number} was ${newStatus.replace(/_/g, ' ')}.`,
      status: newStatus
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Route aliases for frontend and integration direct convenience
router.post('/tax-declarations/:id/approve', authenticate, allowRoles('admin'), async (req, res, next) => {
  req.body = { action: 'approve' };
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM tax_declarations WHERE tax_declaration_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax declaration not found.' });
    }

    const current = rows[0];
    await connection.query(`
      UPDATE tax_declarations 
      SET status = 'approved', 
          approved_by_user_id = ?, 
          approval_date = CURRENT_TIMESTAMP, 
          updated_at = CURRENT_TIMESTAMP
      WHERE tax_declaration_id = ?
    `, [req.user.id, id]);

    await logTaxAuditEvent(connection, req, 'tax_declaration', id, 'APPROVE_DECLARATION', { status: current.status }, { status: 'approved' });
    await connection.commit();

    if (current.prepared_by_user_id) {
      await createNotification(
        current.prepared_by_user_id,
        'Tax Declaration Approved',
        `Tax Declaration ${current.declaration_number} was approved by the Municipal Administrator.`,
        'TAX_DECLARATION_STATUS',
        id
      );
    }

    res.json({ message: `Tax Declaration ${current.declaration_number} approved successfully.`, status: 'approved' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

router.post('/tax-declarations/:id/return', authenticate, allowRoles('admin'), async (req, res, next) => {
  const { reason = 'Returned for correction.' } = req.body;
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM tax_declarations WHERE tax_declaration_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax declaration not found.' });
    }

    const current = rows[0];
    await connection.query(`
      UPDATE tax_declarations 
      SET status = 'returned_for_correction', 
          correction_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE tax_declaration_id = ?
    `, [reason.trim(), id]);

    await logTaxAuditEvent(connection, req, 'tax_declaration', id, 'RETURN_FOR_CORRECTION', { status: current.status }, { status: 'returned_for_correction', reason });
    await connection.commit();

    if (current.prepared_by_user_id) {
      await createNotification(
        current.prepared_by_user_id,
        'Tax Declaration Returned for Correction',
        `Tax Declaration ${current.declaration_number} was returned: ${reason}`,
        'TAX_DECLARATION_STATUS',
        id
      );
    }

    res.json({ message: `Tax Declaration ${current.declaration_number} returned for correction.`, status: 'returned_for_correction' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 7. ISSUE TAX DECLARATION (Formal Issuance - Admin Only)
// =========================================================================
router.post('/tax-declarations/:id/issue', authenticate, allowRoles('admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM tax_declarations WHERE tax_declaration_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax declaration not found.' });
    }

    const current = rows[0];
    if (current.status !== 'approved') {
      await connection.rollback();
      return res.status(400).json({ message: `Only approved tax declarations can be issued. Current status: '${current.status}'.` });
    }

    const issueDate = new Date().toISOString().split('T')[0];

    await connection.query(`
      UPDATE tax_declarations 
      SET status = 'issued', 
          issue_date = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE tax_declaration_id = ?
    `, [issueDate, id]);

    await logTaxAuditEvent(connection, req, 'tax_declaration', id, 'ISSUE_DECLARATION', { status: current.status }, { status: 'issued', issue_date: issueDate });

    await connection.commit();

    // Notify owner user account if linked
    const [ownerUsers] = await pool.query('SELECT user_id FROM users WHERE owner_id = ?', [current.owner_id]);
    for (const u of ownerUsers) {
      await createNotification(
        u.user_id,
        'Official Tax Declaration Issued',
        `Official Tax Declaration ${current.declaration_number} for your property has been issued. You may now view or print your statement.`,
        'TAX_DECLARATION_ISSUED',
        id
      );
    }

    res.json({
      message: `Tax Declaration ${current.declaration_number} officially issued.`,
      issue_date: issueDate,
      status: 'issued'
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 8. REVISE TAX DECLARATION (Assessor Only - Creates superseding declaration with audit link)
// =========================================================================
router.post('/tax-declarations/:id/revise', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    const { revision_reason, market_value, assessment_level, assessed_value, remarks } = req.body;

    if (!revision_reason?.trim()) {
      return res.status(400).json({ message: 'Revision reason is required to supersede an issued tax declaration.' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM tax_declarations WHERE tax_declaration_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Original tax declaration not found.' });
    }

    const prev = rows[0];

    // Mark previous declaration as superseded
    await connection.query(
      'UPDATE tax_declarations SET status = "superseded", updated_at = CURRENT_TIMESTAMP WHERE tax_declaration_id = ?',
      [id]
    );

    // Generate new TD number for revision
    const [brgyRow] = await connection.query(`
      SELECT b.barangay_name FROM properties p
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
      WHERE p.property_id = ?
    `, [prev.property_id]);
    const brgy = brgyRow[0]?.barangay_name || 'Lumbo';

    const newTdNumber = await generateTaxDeclarationNumber(connection, brgy, prev.tax_year);

    const newMv = market_value !== undefined ? Number(market_value) : Number(prev.market_value);
    const newAl = assessment_level !== undefined ? Number(assessment_level) : Number(prev.assessment_level);
    const newAv = assessed_value !== undefined ? Number(assessed_value) : Number(prev.assessed_value);

    const [newResult] = await connection.query(`
      INSERT INTO tax_declarations (
        declaration_number, property_type, target_id_int, target_id_str,
        property_id, property_code, owner_id, assessment_type, assessment_id,
        classification, actual_use, land_area, building_area, market_value,
        assessment_level, assessed_value, tax_year, effectivity_date, status,
        prepared_by_user_id, approved_by_user_id, approval_date,
        previous_td_id, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, NOW(), ?, ?)
    `, [
      newTdNumber, prev.property_type, prev.target_id_int, prev.target_id_str,
      prev.property_id, prev.property_code, prev.owner_id, prev.assessment_type, prev.assessment_id,
      prev.classification, prev.actual_use, prev.land_area, prev.building_area,
      newMv, newAl, newAv, prev.tax_year, prev.effectivity_date,
      req.user.id, req.user.id, id,
      `Revision of ${prev.declaration_number}. Reason: ${revision_reason.trim()}`
    ]);

    await logTaxAuditEvent(connection, req, 'tax_declaration', newResult.insertId, 'REVISE_DECLARATION', { previous_td_id: id }, { new_td_number: newTdNumber, reason: revision_reason });

    await connection.commit();

    res.json({
      message: `Tax Declaration revised. New declaration ${newTdNumber} created (Supersedes ${prev.declaration_number}).`,
      tax_declaration_id: newResult.insertId,
      declaration_number: newTdNumber
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

export default router;
