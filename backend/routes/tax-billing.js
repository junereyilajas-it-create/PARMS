import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { generateBillNumber } from '../utils/idGenerator.js';
import { calculateRealPropertyTax } from '../utils/taxCalculationEngine.js';
import { createNotification } from '../utils/notifications.js';
import { logTaxAuditEvent } from '../utils/taxAudit.js';

const router = Router();

// =========================================================================
// 1. GET ALL TAX BILLS (Searchable & Filterable - Historical Records)
// =========================================================================
router.get('/tax-bills', authenticate, allowRoles('assessor', 'admin', 'staff', 'super_admin'), async (req, res, next) => {
  try {
    const { status, year, barangay, q } = req.query;
    const rawQ = q ? String(q).trim() : '';
    const qWildcard = `%${rawQ}%`;
    const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;

    let query = `
      SELECT 
        tb.*,
        td.declaration_number,
        td.property_type,
        td.target_id_str,
        td.classification,
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
      FROM tax_bills tb
      JOIN tax_declarations td ON tb.tax_declaration_id = td.tax_declaration_id
      JOIN properties p ON tb.property_id = p.property_id
      JOIN property_owners o ON tb.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      LEFT JOIN users u_prep ON tb.prepared_by_user_id = u_prep.user_id
      LEFT JOIN users u_app ON tb.approved_by_user_id = u_app.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ' AND tb.bill_status = ?';
      params.push(status);
    }

    if (year && year !== 'ALL') {
      query += ' AND tb.tax_year = ?';
      params.push(year);
    }

    if (barangay && barangay !== 'ALL') {
      query += ' AND LOWER(brgy.barangay_name) = LOWER(?)';
      params.push(barangay);
    }

    if (rawQ) {
      query += `
        AND (
          tb.bill_number LIKE ?
          OR td.declaration_number LIKE ?
          OR td.target_id_str LIKE ?
          OR tb.property_code LIKE ?
          OR (? = 1 AND tb.bill_id = ?)
          OR (? = 1 AND tb.property_id = ?)
          OR o.first_name LIKE ?
          OR o.last_name LIKE ?
          OR CONCAT_WS(' ', o.first_name, o.last_name) LIKE ?
        )
      `;
      params.push(
        qWildcard, qWildcard, qWildcard, qWildcard,
        numericQ !== null ? 1 : 0, numericQ || 0,
        numericQ !== null ? 1 : 0, numericQ || 0,
        qWildcard, qWildcard, qWildcard
      );
    }

    query += ' ORDER BY tb.bill_id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 2. GET ELIGIBLE TAX DECLARATIONS FOR BILLING (Approved or Issued without active bill for the year)
// =========================================================================
router.get('/tax-bills/eligible-declarations', authenticate, allowRoles('admin', 'staff', 'super_admin'), async (req, res, next) => {
  try {
    const { tax_year = new Date().getFullYear(), q } = req.query;
    const rawQ = q ? String(q).trim() : '';
    const qWildcard = `%${rawQ}%`;
    const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;

    const [rows] = await pool.query(`
      SELECT 
        td.tax_declaration_id,
        td.declaration_number,
        td.property_type,
        td.target_id_str,
        td.target_id_int,
        td.property_id,
        td.property_code,
        td.owner_id,
        td.classification,
        td.actual_use,
        td.land_area,
        td.building_area,
        td.market_value,
        td.assessment_level,
        td.assessed_value,
        td.status AS td_status,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay
      FROM tax_declarations td
      JOIN properties p ON td.property_id = p.property_id
      JOIN property_owners o ON td.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      WHERE td.status IN ('approved', 'issued')
        AND NOT EXISTS (
          SELECT 1 FROM tax_bills tb 
          WHERE tb.tax_declaration_id = td.tax_declaration_id 
            AND tb.tax_year = ? 
            AND tb.bill_status NOT IN ('cancelled')
        )
        AND (? = '' OR
          td.declaration_number LIKE ? OR
          td.target_id_str LIKE ? OR
          td.property_code LIKE ? OR
          (? = 1 AND td.tax_declaration_id = ?) OR
          CONCAT_WS(' ', o.first_name, o.last_name) LIKE ?
        )
      ORDER BY td.tax_declaration_id DESC
      LIMIT 40
    `, [tax_year, rawQ, qWildcard, qWildcard, qWildcard, numericQ !== null ? 1 : 0, numericQ || 0, qWildcard]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 3. GET SINGLE TAX BILL DETAILS (with items and payment history)
// =========================================================================
router.get('/tax-bills/:id', authenticate, allowRoles('assessor', 'admin', 'staff', 'super_admin', 'client'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const isNum = /^\d+$/.test(String(id).trim());
    const numId = isNum ? parseInt(id, 10) : null;

    const [bills] = await pool.query(`
      SELECT 
        tb.*,
        td.declaration_number,
        td.property_type,
        td.target_id_str,
        td.classification,
        td.actual_use,
        td.land_area,
        td.building_area,
        td.market_value,
        td.assessment_level,
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
      FROM tax_bills tb
      JOIN tax_declarations td ON tb.tax_declaration_id = td.tax_declaration_id
      JOIN properties p ON tb.property_id = p.property_id
      JOIN property_owners o ON tb.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      LEFT JOIN users u_prep ON tb.prepared_by_user_id = u_prep.user_id
      LEFT JOIN users u_app ON tb.approved_by_user_id = u_app.user_id
      WHERE (? = 1 AND tb.bill_id = ?) OR tb.bill_number = ?
    `, [numId !== null ? 1 : 0, numId || 0, String(id).trim()]);

    if (bills.length === 0) {
      return res.status(404).json({ message: 'Tax bill not found.' });
    }

    const bill = bills[0];

    // Ownership check for property owners
    if (req.user.role === 'client') {
      if (!req.user.owner_id || bill.owner_id !== req.user.owner_id) {
        return res.status(403).json({ message: 'You are not authorized to view this bill.' });
      }
    }

    // Fetch itemized bill breakdown
    const [items] = await pool.query('SELECT * FROM tax_bill_items WHERE bill_id = ? ORDER BY item_id ASC', [bill.bill_id]);

    // Fetch linked payment transactions
    const [payments] = await pool.query(`
      SELECT 
        pt.*,
        u.first_name AS cashier_first_name, u.last_name AS cashier_last_name
      FROM payment_transactions pt
      JOIN users u ON pt.cashier_user_id = u.user_id
      WHERE pt.bill_id = ?
      ORDER BY pt.transaction_id DESC
    `, [bill.bill_id]);

    // Fetch cashier transfer staging history
    const [transferRequests] = await pool.query(`
      SELECT ctr.*, u.first_name AS requester_first_name, u.last_name AS requester_last_name
      FROM cashier_transfer_requests ctr
      LEFT JOIN users u ON ctr.requested_by_user_id = u.user_id
      WHERE ctr.bill_id = ?
      ORDER BY ctr.transfer_id DESC
    `, [bill.bill_id]);

    res.json({
      ...bill,
      items,
      payments,
      transfer_requests: transferRequests
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 4. PREVIEW TAX CALCULATION (Real-time calculation engine breakdown)
// =========================================================================
router.post('/tax-bills/calculate-preview', authenticate, allowRoles('admin', 'staff', 'super_admin'), async (req, res, next) => {
  try {
    const {
      market_value,
      assessment_level,
      classification = 'Residential',
      tax_year = new Date().getFullYear(),
      is_advance_payment = true,
      months_delayed = 0,
      prior_delinquency = 0,
      allow_demo = false
    } = req.body;

    const calcResult = await calculateRealPropertyTax({
      marketValue: Number(market_value) || 0,
      assessmentLevelPct: Number(assessment_level) || 20,
      classification,
      taxYear: Number(tax_year) || new Date().getFullYear(),
      isAdvancePayment: Boolean(is_advance_payment),
      monthsDelayed: Number(months_delayed) || 0,
      priorDelinquency: Number(prior_delinquency) || 0,
      allowDemo: Boolean(allow_demo)
    });

    res.json({
      ...calcResult,
      assessed_value: calcResult.assessedValue,
      basic_tax: calcResult.basicTaxAmount,
      sef_tax: calcResult.sefTaxAmount,
      discount_amount: calcResult.discountAmount,
      penalty_amount: calcResult.penaltyInterestAmount,
      total_amount_due: calcResult.totalAmountDue
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 5. GENERATE REAL PROPERTY TAX BILL (DECOMMISSIONED)
// =========================================================================
const generateBillHandler = async (req, res) => {
  return res.status(400).json({
    message: 'Tax bill generation has been decommissioned. Official bills and receipts are not generated by this system. Please use Property Tax Computation Reports (for reference only).'
  });
};

router.post('/tax-bills/generate', authenticate, generateBillHandler);
router.post('/tax-bills', authenticate, generateBillHandler);

// =========================================================================
// 6. APPROVE TAX BILL FOR CASHIER COLLECTION
// =========================================================================
router.post('/tax-bills/:id/approve', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    await connection.beginTransaction();

    const [bills] = await connection.query('SELECT * FROM tax_bills WHERE bill_id = ? FOR UPDATE', [id]);
    if (bills.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax bill not found.' });
    }

    const bill = bills[0];
    if (bill.bill_status !== 'draft' && bill.bill_status !== 'pending_approval') {
      await connection.rollback();
      return res.status(400).json({ message: `Bill cannot be approved. Current status: '${bill.bill_status}'.` });
    }

    await connection.query(`
      UPDATE tax_bills 
      SET bill_status = 'approved', 
          approved_by_user_id = ?, 
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE bill_id = ?
    `, [req.user.id, id]);

    await logTaxAuditEvent(connection, req, 'tax_bill', id, 'APPROVE_BILL', { status: bill.bill_status }, { status: 'approved' });

    await connection.commit();

    // Broadcast to Cashiers
    const [cashiers] = await pool.query("SELECT user_id FROM users WHERE role = 'cashier' AND status = 'active'");
    for (const c of cashiers) {
      await createNotification(
        c.user_id,
        'Bill Approved for Collection',
        `Tax Bill ${bill.bill_number} (₱${Number(bill.total_amount_due).toLocaleString()}) approved and added to collection queue.`,
        'TAX_BILL_APPROVED',
        id
      );
    }

    // Notify Owner
    const [ownerUsers] = await pool.query('SELECT user_id FROM users WHERE owner_id = ?', [bill.owner_id]);
    for (const u of ownerUsers) {
      await createNotification(
        u.user_id,
        'RPT Billing Statement Available',
        `Your real property tax bill (${bill.bill_number}) for Tax Year ${bill.tax_year} is ready. Total due: ₱${Number(bill.total_amount_due).toLocaleString()}.`,
        'TAX_BILL_AVAILABLE',
        id
      );
    }

    res.json({
      message: `Tax Bill ${bill.bill_number} approved and dispatched to Cashier Collection Queue.`,
      bill_status: 'approved'
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 7. ADJUST / REBILL TAX BILL (DECOMMISSIONED - Manual overrides prohibited)
// =========================================================================
router.post('/tax-bills/:id/adjust', authenticate, async (req, res) => {
  return res.status(403).json({
    message: 'Manual alteration or adjustment of computed tax amounts is prohibited. All computations must derive directly from approved property records and statutory tax settings.'
  });
});

// =========================================================================
// 8. SEND TO CASHIER (DECOMMISSIONED)
// =========================================================================
router.post('/tax-bills/:id/send-to-cashier', authenticate, async (req, res) => {
  return res.status(400).json({
    message: 'Cashier dispatch module has been decommissioned. Collections are managed externally.'
  });
});

export default router;
