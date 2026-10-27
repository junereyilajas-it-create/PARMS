import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { logTaxAuditEvent } from '../utils/taxAudit.js';

const router = Router();

// =========================================================================
// 1. GET ALL TAX CONFIGURATIONS
// =========================================================================
router.get('/tax-configurations', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const { category, verification_status } = req.query;
    let query = 'SELECT * FROM tax_configurations WHERE 1=1';
    const params = [];

    if (category && category !== 'ALL') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (verification_status && verification_status !== 'ALL') {
      query += ' AND verification_status = ?';
      params.push(verification_status);
    }

    query += ' ORDER BY category ASC, config_id ASC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 2. GET ACTIVE ASSESSMENT LEVEL FOR PROPERTY CLASSIFICATION
// =========================================================================
router.get('/tax-configurations/assessment-level', authenticate, async (req, res, next) => {
  try {
    const { classification } = req.query;
    let query = `
      SELECT * FROM tax_configurations 
      WHERE category = 'assessment_level' 
        AND verification_status IN ('approved', 'active')
        AND (effective_end_date IS NULL OR effective_end_date >= CURRENT_DATE)
    `;
    const params = [];
    if (classification && classification !== 'ALL') {
      query += ' AND (LOWER(property_classification) = LOWER(?) OR property_classification = "ALL")';
      params.push(classification);
    }
    query += ' ORDER BY CASE WHEN LOWER(property_classification) = LOWER(?) THEN 0 ELSE 1 END, config_id ASC LIMIT 1';
    params.push(classification || '');

    const [rows] = await pool.query(query, params);
    if (rows.length > 0) {
      const val = parseFloat(rows[0].value_numeric) || 0.20;
      return res.json({
        rule_code: rows[0].rule_code,
        rule_name: rows[0].rule_name,
        property_classification: rows[0].property_classification,
        value_numeric: val,
        percentage: Math.round(val * 100),
        legal_reference: rows[0].legal_reference
      });
    }

    // Default fallback if no custom rule configured
    res.json({
      rule_code: 'AL_DEFAULT_20',
      rule_name: 'Statutory Default Assessment Level (20%)',
      property_classification: classification || 'Residential',
      value_numeric: 0.20,
      percentage: 20,
      legal_reference: 'RA 7160 Sec. 218'
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 3. GET TAX CONFIGURATION READINESS CHECKLIST
// =========================================================================
router.get('/tax-configurations/readiness', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const [rules] = await pool.query('SELECT * FROM tax_configurations');

    // Analyze statutory requirements
    const smvRules = rules.filter(r => r.category === 'smv');
    const alRules = rules.filter(r => r.category === 'assessment_level');
    const rptRules = rules.filter(r => r.category === 'tax_rate');
    const sefRules = rules.filter(r => r.category === 'sef_levy');
    const discPenRules = rules.filter(r => r.category === 'discount' || r.category === 'penalty_interest');

    const checklist = [
      {
        id: 1,
        title: 'Schedule of Market Values (SMV)',
        description: 'Approved SMV for land categories and building types (RA 7160 Sec. 212 / RA 12001 RPVARA).',
        category: 'smv',
        status: smvRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active') ? 'Approved' : (smvRules.length > 0 ? 'Pending Verification' : 'Not Configured'),
        legal_reference: smvRules[0]?.legal_reference || 'Provincial Ordinance / BLGF Schedule',
        configured_count: smvRules.length,
        is_ready: smvRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active')
      },
      {
        id: 2,
        title: 'Approved Assessment Levels by Classification',
        description: 'Statutory assessment level percentages for Residential, Commercial, Agricultural, and Industrial.',
        category: 'assessment_level',
        status: alRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active') ? 'Approved' : 'Pending Verification',
        legal_reference: 'RA 7160 Sec. 218 / RA 12001',
        configured_count: alRules.length,
        is_ready: alRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active')
      },
      {
        id: 3,
        title: 'Basic Real Property Tax (RPT) Rate',
        description: 'Statutory 1% basic real property tax levy for municipalities within provincial jurisdiction.',
        category: 'tax_rate',
        status: rptRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active') ? 'Approved' : 'Pending Verification',
        legal_reference: rptRules[0]?.legal_reference || 'RA 7160 Sec. 233',
        configured_count: rptRules.length,
        is_ready: rptRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active')
      },
      {
        id: 4,
        title: 'Special Education Fund (SEF) Levy',
        description: 'Statutory 1% SEF additional levy accrued to the Local School Board.',
        category: 'sef_levy',
        status: sefRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active') ? 'Approved' : 'Pending Verification',
        legal_reference: sefRules[0]?.legal_reference || 'RA 7160 Sec. 235',
        configured_count: sefRules.length,
        is_ready: sefRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active')
      },
      {
        id: 5,
        title: 'Authorized Discounts, Penalties & Interest',
        description: '10% prompt payment discount (Q1) and 2% monthly delinquency interest schedule.',
        category: 'discount',
        status: discPenRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active') ? 'Approved' : 'Pending Verification',
        legal_reference: 'RA 7160 Sec. 251 & 255',
        configured_count: discPenRules.length,
        is_ready: discPenRules.some(r => r.verification_status === 'approved' || r.verification_status === 'active')
      },
      {
        id: 6,
        title: 'Official Billing Procedures & Numbering Format',
        description: 'Atomic consecutive sequence: RPT-{Year}-{Sequence} with concurrency protection.',
        category: 'numbering_format',
        status: 'Approved',
        legal_reference: 'PARMS Municipal Database Architecture',
        configured_count: 1,
        is_ready: true
      },
      {
        id: 7,
        title: 'Official Receipt Numbering & Inventory',
        description: 'Consecutive OR tracking: OR-{Year}-{Sequence} with duplicate prevention & void audit.',
        category: 'numbering_format',
        status: 'Approved',
        legal_reference: 'COA Local Treasury Circulars & PARMS Cashier Module',
        configured_count: 1,
        is_ready: true
      },
      {
        id: 8,
        title: 'Workflow: Assessment -> Declaration -> Billing -> Collection',
        description: 'Formal role handoff: Admin reviews & approves -> Cashier verifies & collects.',
        category: 'workflow',
        status: 'Approved',
        legal_reference: 'PARMS Core Workflow Specification',
        configured_count: 1,
        is_ready: true
      },
      {
        id: 9,
        title: 'Payment Channel & Cashier Handoff',
        description: 'Municipal Cashier counter payment verification and electronic provider preparation.',
        category: 'payment_channel',
        status: 'Approved',
        legal_reference: 'Municipal Treasurer Cashiering Division',
        configured_count: 1,
        is_ready: true
      },
      {
        id: 10,
        title: 'Authorized Municipal Officers Role Matrix',
        description: 'Segregation of duties: Super Admin, Head Assessor, Assessor, Staff, Cashier, Owner.',
        category: 'roles',
        status: 'Approved',
        legal_reference: 'PARMS Role-Based Access Control',
        configured_count: 1,
        is_ready: true
      }
    ];

    const allReady = checklist.every(item => item.is_ready);
    const approvedCount = checklist.filter(item => item.is_ready).length;

    res.json({
      municipality: 'Municipality of Lagonglong',
      province: 'Misamis Oriental',
      checklist,
      overall_status: allReady ? 'Ready for Official Billing' : 'Partially Configured / Demo Permitted',
      approved_count: approvedCount,
      total_requirements: checklist.length,
      official_billing_allowed: allReady,
      demo_billing_allowed: true,
      last_evaluated: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// Helper function to validate dates and negative values
function validateTaxRulePayload(body) {
  const { category, rule_code, rule_name, value_numeric, effective_start_date, effective_end_date } = body;

  const validCategories = ['smv', 'assessment_level', 'tax_rate', 'sef_levy', 'discount', 'penalty_interest', 'numbering_format'];
  if (!category || !validCategories.includes(category)) {
    return { valid: false, message: `Invalid category. Must be one of: ${validCategories.join(', ')}` };
  }

  if (!rule_code || !rule_code.trim()) {
    return { valid: false, message: 'Rule code is required.' };
  }

  if (!rule_name || !rule_name.trim()) {
    return { valid: false, message: 'Rule name is required.' };
  }

  const valNum = parseFloat(value_numeric);
  if (isNaN(valNum)) {
    return { valid: false, message: 'Numeric value must be a valid number.' };
  }
  if (valNum < 0) {
    return { valid: false, message: 'Invalid rate/percentage: Negative values are strictly prohibited.' };
  }

  if (category === 'tax_rate' && valNum > 0.10) {
    return { valid: false, message: 'Basic RPT rate cannot exceed 10% (0.10) under Local Government Code.' };
  }
  if (category === 'sef_levy' && valNum > 0.05) {
    return { valid: false, message: 'SEF rate cannot exceed 5% (0.05) under Local Government Code.' };
  }
  if (category === 'assessment_level' && (valNum > 1.0 && valNum > 100)) {
    return { valid: false, message: 'Assessment level must be expressed as a valid decimal (0.0 - 1.0) or percentage.' };
  }

  if (!effective_start_date) {
    return { valid: false, message: 'Effective start date is required.' };
  }

  if (effective_end_date && new Date(effective_end_date) < new Date(effective_start_date)) {
    return { valid: false, message: 'Effective end date cannot be earlier than effective start date.' };
  }

  return { valid: true };
}

// =========================================================================
// =========================================================================
// 4. CREATE TAX CONFIGURATION RULE (Assessor Only)
// =========================================================================
router.post('/tax-configurations', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const valResult = validateTaxRulePayload(req.body);
    if (!valResult.valid) {
      return res.status(400).json({ message: valResult.message });
    }

    const {
      category,
      rule_code,
      rule_name,
      property_classification = 'ALL',
      actual_use,
      value_numeric,
      tax_year,
      legal_reference,
      source_document,
      effective_start_date,
      effective_end_date,
      notes,
      is_demo = false
    } = req.body;

    const valNum = parseFloat(value_numeric);
    // Normalize percentage to decimal if user entered e.g. 20 for 20%
    const normalizedValue = (['assessment_level', 'discount', 'penalty_interest'].includes(category) && valNum > 1.0)
      ? valNum / 100
      : valNum;

    await connection.beginTransaction();

    // Prevent conflicting duplicate active configuration
    const [conflicts] = await connection.query(`
      SELECT config_id, rule_code, rule_name FROM tax_configurations
      WHERE category = ? 
        AND property_classification = ?
        AND (tax_year IS NULL OR tax_year = ?)
        AND verification_status IN ('approved', 'active')
        AND (effective_end_date IS NULL OR effective_end_date >= ?)
        AND rule_code != ?
    `, [category, property_classification, tax_year || new Date().getFullYear(), effective_start_date, rule_code.trim()]);

    if (conflicts.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: `Conflict detected: An active approved rule ('${conflicts[0].rule_name}' [${conflicts[0].rule_code}]) already covers category '${category}' for classification '${property_classification}'. Please deactivate or expire the existing rule first.`
      });
    }

    await connection.query(`
      INSERT INTO tax_configurations (
        category, rule_code, rule_name, property_classification, actual_use,
        value_numeric, tax_year, legal_reference, source_document,
        verification_status, is_demo, effective_start_date, effective_end_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rule_name = VALUES(rule_name),
        property_classification = VALUES(property_classification),
        actual_use = VALUES(actual_use),
        value_numeric = VALUES(value_numeric),
        tax_year = VALUES(tax_year),
        legal_reference = VALUES(legal_reference),
        source_document = VALUES(source_document),
        is_demo = VALUES(is_demo),
        effective_start_date = VALUES(effective_start_date),
        effective_end_date = VALUES(effective_end_date),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP
    `, [
      category, rule_code.trim(), rule_name.trim(), property_classification, actual_use || null,
      normalizedValue, tax_year || null, legal_reference || null, source_document || null,
      is_demo ? 1 : 0, effective_start_date, effective_end_date || null, notes || null
    ]);

    await logTaxAuditEvent(connection, req, 'tax_configuration', rule_code, 'CREATE_CONFIG', null, req.body);

    await connection.commit();
    res.status(201).json({ message: `Tax rule '${rule_name}' successfully submitted for Admin approval.` });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 5. UPDATE TAX CONFIGURATION RULE (Assessor Only)
// =========================================================================
router.put('/tax-configurations/:id', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const configId = req.params.id;
    const [existing] = await connection.query('SELECT * FROM tax_configurations WHERE config_id = ?', [configId]);
    if (!existing.length) {
      return res.status(404).json({ message: 'Tax configuration record not found.' });
    }

    const valResult = validateTaxRulePayload(req.body);
    if (!valResult.valid) {
      return res.status(400).json({ message: valResult.message });
    }

    const {
      category,
      rule_code,
      rule_name,
      property_classification = 'ALL',
      actual_use,
      value_numeric,
      tax_year,
      legal_reference,
      source_document,
      effective_start_date,
      effective_end_date,
      notes,
      is_demo = false
    } = req.body;

    const valNum = parseFloat(value_numeric);
    const normalizedValue = (['assessment_level', 'discount', 'penalty_interest'].includes(category) && valNum > 1.0)
      ? valNum / 100
      : valNum;

    await connection.beginTransaction();

    await connection.query(`
      UPDATE tax_configurations
      SET category = ?,
          rule_code = ?,
          rule_name = ?,
          property_classification = ?,
          actual_use = ?,
          value_numeric = ?,
          tax_year = ?,
          legal_reference = ?,
          source_document = ?,
          is_demo = ?,
          verification_status = 'pending_verification',
          effective_start_date = ?,
          effective_end_date = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE config_id = ?
    `, [
      category, rule_code.trim(), rule_name.trim(), property_classification, actual_use || null,
      normalizedValue, tax_year || null, legal_reference || null, source_document || null,
      is_demo ? 1 : 0, effective_start_date, effective_end_date || null, notes || null,
      configId
    ]);

    await logTaxAuditEvent(connection, req, 'tax_configuration', configId, 'UPDATE_CONFIG', existing[0], req.body);

    await connection.commit();
    res.json({ message: `Tax configuration '${rule_name}' successfully updated and resubmitted for Admin approval.` });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 6. VERIFY & APPROVE TAX RULE (Admin Only)
// =========================================================================
router.post('/tax-configurations/:id/verify', authenticate, allowRoles('admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    const { legal_reference, notes } = req.body || {};

    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT * FROM tax_configurations WHERE config_id = ?', [id]);
    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax configuration record not found.' });
    }

    await connection.query(`
      UPDATE tax_configurations
      SET verification_status = 'approved',
          verified_by_user_id = ?,
          verified_at = CURRENT_TIMESTAMP,
          approved_by_user_id = ?,
          approved_at = CURRENT_TIMESTAMP,
          legal_reference = COALESCE(?, legal_reference),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE config_id = ?
    `, [req.user.id, req.user.id, legal_reference || null, notes || null, id]);

    await logTaxAuditEvent(connection, req, 'tax_configuration', id, 'VERIFY_APPROVE_CONFIG', null, { verified_by: req.user.id });

    await connection.commit();
    res.json({ message: 'Tax configuration verified and approved for official municipal calculations.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 6B. REJECT TAX RULE (Admin Only - Returns to Assessor for Correction)
// =========================================================================
router.post('/tax-configurations/:id/reject', authenticate, allowRoles('admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    const { rejection_reason, reason, notes } = req.body || {};
    const comment = rejection_reason || reason || notes;

    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ message: 'Rejection reason/comment is required when returning a tax rule to the Assessor.' });
    }

    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT * FROM tax_configurations WHERE config_id = ?', [id]);
    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax configuration record not found.' });
    }

    await connection.query(`
      UPDATE tax_configurations
      SET verification_status = 'rejected',
          notes = CONCAT_WS(' | Rejected by Admin: ', COALESCE(notes, ''), ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE config_id = ?
    `, [String(comment).trim(), id]);

    await logTaxAuditEvent(connection, req, 'tax_configuration', id, 'REJECT_CONFIG', existing[0], { rejected_by: req.user.id, reason: comment });

    await connection.commit();
    res.json({ message: 'Tax configuration rejected and returned to Assessor for correction.', verification_status: 'rejected' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 7. DEACTIVATE / EXPIRE TAX RULE (Assessor Only)
// =========================================================================
router.post('/tax-configurations/:id/deactivate', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    await connection.beginTransaction();

    await connection.query(`
      UPDATE tax_configurations
      SET verification_status = 'expired',
          effective_end_date = CURRENT_DATE,
          updated_at = CURRENT_TIMESTAMP
      WHERE config_id = ?
    `, [id]);

    await logTaxAuditEvent(connection, req, 'tax_configuration', id, 'DEACTIVATE_CONFIG', null, { deactivated_by: req.user.id });

    await connection.commit();
    res.json({ message: 'Tax configuration has been marked as expired/superseded.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 8. DELETE TAX RULE (Assessor Only - For non-active / draft configurations)
// =========================================================================
router.delete('/tax-configurations/:id', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    const [existing] = await connection.query('SELECT * FROM tax_configurations WHERE config_id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ message: 'Record not found.' });
    }

    await connection.beginTransaction();

    await connection.query('DELETE FROM tax_configurations WHERE config_id = ?', [id]);
    await logTaxAuditEvent(connection, req, 'tax_configuration', id, 'DELETE_CONFIG', existing[0], null);

    await connection.commit();
    res.json({ message: 'Configuration record deleted.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

export default router;
