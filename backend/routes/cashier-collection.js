import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { generateTransactionNumber, generateOrNumber } from '../utils/idGenerator.js';
import { createNotification } from '../utils/notifications.js';
import { logTaxAuditEvent } from '../utils/taxAudit.js';

const router = Router();

// =========================================================================
// 1. GET CASHIER DASHBOARD STATS
// =========================================================================
router.get('/cashier/stats', authenticate, allowRoles('cashier', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Today's collections
    const [todayRows] = await pool.query(`
      SELECT 
        COUNT(*) AS transactions_today,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_paid ELSE 0 END), 0) AS total_collected_today,
        COALESCE(SUM(CASE WHEN status = 'completed' AND payment_method = 'cash' THEN amount_paid ELSE 0 END), 0) AS cash_collected_today,
        COALESCE(SUM(CASE WHEN status = 'completed' AND payment_method = 'check' THEN amount_paid ELSE 0 END), 0) AS check_collected_today,
        COALESCE(SUM(CASE WHEN status = 'completed' AND payment_method NOT IN ('cash', 'check') THEN amount_paid ELSE 0 END), 0) AS other_collected_today
      FROM payment_transactions
      WHERE payment_date = ?
    `, [today]);

    // Active bills in queue awaiting payment
    const [queueRows] = await pool.query(`
      SELECT 
        COUNT(*) AS bills_in_queue,
        COALESCE(SUM(remaining_balance), 0) AS total_outstanding_balance,
        SUM(CASE WHEN bill_status = 'partially_paid' THEN 1 ELSE 0 END) AS partially_paid_count,
        SUM(CASE WHEN due_date < CURRENT_DATE AND remaining_balance > 0 THEN 1 ELSE 0 END) AS overdue_count
      FROM tax_bills
      WHERE bill_status IN ('approved', 'partially_paid')
    `);

    // Today's reconciliation status
    const [reconRows] = await pool.query(`
      SELECT reconciliation_id, status, net_collection, discrepancy_amount
      FROM cashier_reconciliations
      WHERE reconciliation_date = ? AND cashier_user_id = ?
      LIMIT 1
    `, [today, req.user.id]);

    res.json({
      today_stats: todayRows[0] || {},
      queue_stats: queueRows[0] || {},
      reconciliation: reconRows[0] || null,
      server_date: today
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 2. GET COLLECTION QUEUE (Approved & Payable bills only)
// =========================================================================
router.get('/cashier/queue', authenticate, allowRoles('cashier', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const { q, year, barangay } = req.query;
    const rawQ = q ? String(q).trim() : '';
    const qWildcard = `%${rawQ}%`;
    const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;

    let query = `
      SELECT 
        tb.bill_id,
        tb.bill_number,
        tb.tax_declaration_id,
        tb.property_id,
        tb.property_code,
        tb.owner_id,
        tb.tax_year,
        tb.due_date,
        tb.assessed_value,
        tb.total_amount_due,
        tb.amount_paid,
        tb.remaining_balance,
        tb.bill_status,
        tb.is_demo,
        td.declaration_number,
        td.property_type,
        td.target_id_str,
        td.classification,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        o.contact_number AS owner_contact,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), brgy.barangay_name), ''),
          brgy.barangay_name,
          'Lagonglong, Misamis Oriental'
        ) AS property_address
      FROM tax_bills tb
      JOIN tax_declarations td ON tb.tax_declaration_id = td.tax_declaration_id
      JOIN properties p ON tb.property_id = p.property_id
      JOIN property_owners o ON tb.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      WHERE tb.bill_status IN ('approved', 'partially_paid')
    `;
    const params = [];

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

    query += ' ORDER BY tb.due_date ASC, tb.bill_id ASC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 3. GET PAYMENT TRANSACTIONS
// =========================================================================
router.get('/cashier/transactions', authenticate, allowRoles('cashier', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const { date, status, payment_method, q } = req.query;
    const rawQ = q ? String(q).trim() : '';
    const qWildcard = `%${rawQ}%`;

    let query = `
      SELECT 
        pt.*,
        tb.bill_number,
        tb.tax_year,
        td.declaration_number,
        td.target_id_str,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        u.first_name AS cashier_first_name, u.last_name AS cashier_last_name
      FROM payment_transactions pt
      JOIN tax_bills tb ON pt.bill_id = tb.bill_id
      JOIN tax_declarations td ON tb.tax_declaration_id = td.tax_declaration_id
      JOIN property_owners o ON pt.owner_id = o.owner_id
      JOIN users u ON pt.cashier_user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      query += ' AND pt.payment_date = ?';
      params.push(date);
    }

    if (status && status !== 'ALL') {
      query += ' AND pt.status = ?';
      params.push(status);
    }

    if (payment_method && payment_method !== 'ALL') {
      query += ' AND pt.payment_method = ?';
      params.push(payment_method);
    }

    if (rawQ) {
      query += `
        AND (
          pt.transaction_number LIKE ?
          OR pt.or_number LIKE ?
          OR tb.bill_number LIKE ?
          OR td.declaration_number LIKE ?
          OR td.target_id_str LIKE ?
          OR pt.transaction_reference LIKE ?
          OR CONCAT_WS(' ', o.first_name, o.last_name) LIKE ?
        )
      `;
      params.push(qWildcard, qWildcard, qWildcard, qWildcard, qWildcard, qWildcard, qWildcard);
    }

    query += ' ORDER BY pt.transaction_id DESC LIMIT 100';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 4. GET SINGLE PAYMENT TRANSACTION DETAILS (Printable receipt acknowledgment)
// =========================================================================
router.get('/cashier/transactions/:id', authenticate, allowRoles('cashier', 'admin', 'super_admin', 'client'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const isNum = /^\d+$/.test(String(id).trim());
    const numId = isNum ? parseInt(id, 10) : null;

    const [rows] = await pool.query(`
      SELECT 
        pt.*,
        tb.bill_number,
        tb.tax_year,
        tb.assessed_value,
        tb.basic_tax_amount,
        tb.sef_tax_amount,
        tb.discount_amount,
        tb.penalty_interest_amount,
        tb.total_amount_due,
        td.declaration_number,
        td.property_type,
        td.target_id_str,
        td.classification,
        td.actual_use,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        o.email AS owner_email,
        o.contact_number AS owner_contact,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), brgy.barangay_name), ''),
          brgy.barangay_name,
          'Lagonglong, Misamis Oriental'
        ) AS property_address,
        u.first_name AS cashier_first_name, u.last_name AS cashier_last_name
      FROM payment_transactions pt
      JOIN tax_bills tb ON pt.bill_id = tb.bill_id
      JOIN tax_declarations td ON tb.tax_declaration_id = td.tax_declaration_id
      JOIN properties p ON tb.property_id = p.property_id
      JOIN property_owners o ON pt.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      JOIN users u ON pt.cashier_user_id = u.user_id
      WHERE (? = 1 AND pt.transaction_id = ?) OR pt.transaction_number = ? OR pt.or_number = ?
    `, [numId !== null ? 1 : 0, numId || 0, String(id).trim(), String(id).trim()]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Transaction record not found.' });
    }

    const tx = rows[0];

    // Ownership check for clients
    if (req.user.role === 'client') {
      if (!req.user.owner_id || tx.owner_id !== req.user.owner_id) {
        return res.status(403).json({ message: 'You are not authorized to view this receipt.' });
      }
    }

    res.json(tx);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 5. RECORD CASHIER PAYMENT (Atomic Concurrency-Protected Payment Processing)
// =========================================================================
router.post('/cashier/pay', authenticate, allowRoles('cashier', 'admin', 'super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const {
      bill_id,
      amount_paid,
      payment_method = 'cash',
      payment_date = new Date().toISOString().split('T')[0],
      transaction_reference,
      or_number: customOrNumber,
      remarks,
      idempotency_key
    } = req.body;

    const paidNum = Number(amount_paid);
    if (!bill_id || isNaN(paidNum) || paidNum <= 0) {
      return res.status(400).json({ message: 'A valid Bill ID and positive payment amount are required.' });
    }

    await connection.beginTransaction();

    // Idempotency check to prevent accidental double-clicks / repeated submissions
    if (idempotency_key) {
      const [existingIdemp] = await connection.query(
        'SELECT transaction_id, transaction_number, or_number FROM payment_transactions WHERE idempotency_key = ?',
        [idempotency_key]
      );
      if (existingIdemp.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          message: 'Duplicate payment submission detected with the same idempotency key.',
          transaction_id: existingIdemp[0].transaction_id,
          transaction_number: existingIdemp[0].transaction_number,
          or_number: existingIdemp[0].or_number
        });
      }
    }

    // 1. Authoritative Lock on Bill
    const [bills] = await connection.query(
      'SELECT * FROM tax_bills WHERE bill_id = ? FOR UPDATE',
      [bill_id]
    );

    if (bills.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax bill not found.' });
    }

    const bill = bills[0];

    // Must be approved for collection
    if (bill.bill_status !== 'approved' && bill.bill_status !== 'partially_paid') {
      await connection.rollback();
      return res.status(400).json({ message: `Cannot accept payment for bill in status '${bill.bill_status}'. Must be Approved for Collection.` });
    }

    const currentBalance = Number(bill.remaining_balance);

    // Overpayment check (rejects overpayment beyond balance)
    if (paidNum > currentBalance + 0.01) {
      await connection.rollback();
      return res.status(400).json({
        message: `Amount received (₱${paidNum.toLocaleString()}) exceeds the authoritative outstanding balance (₱${currentBalance.toLocaleString()}). Overpayments are not permitted.`
      });
    }

    const newAmountPaid = Number((Number(bill.amount_paid) + paidNum).toFixed(2));
    const newRemainingBalance = Number(Math.max(0, currentBalance - paidNum).toFixed(2));
    const isFullyPaid = newRemainingBalance <= 0;
    const isPartial = !isFullyPaid;
    const newBillStatus = isFullyPaid ? 'paid' : 'partially_paid';

    // 2. Official Receipt (OR) Number Generation / Validation
    const isDemo = Boolean(bill.is_demo) || payment_method === 'demo_simulation';
    let orNumber = customOrNumber ? String(customOrNumber).trim() : null;

    if (!orNumber) {
      orNumber = await generateOrNumber(connection, bill.tax_year, isDemo);
    } else {
      // Check duplicate OR
      const [existingOr] = await connection.query(
        'SELECT transaction_id FROM payment_transactions WHERE or_number = ?',
        [orNumber]
      );
      if (existingOr.length > 0) {
        await connection.rollback();
        return res.status(409).json({ message: `Official Receipt number '${orNumber}' has already been issued. Duplicate receipt numbers are prohibited.` });
      }
    }

    // Generate unique sequential transaction number
    const txNumber = await generateTransactionNumber(connection, bill.tax_year);
    const currentTime = new Date().toTimeString().split(' ')[0];

    // 3. Record Payment Transaction
    const [txResult] = await connection.query(`
      INSERT INTO payment_transactions (
        transaction_number, bill_id, owner_id, cashier_user_id,
        or_number, amount_due_at_payment, amount_paid, balance_after_payment,
        payment_method, payment_date, payment_time, transaction_reference,
        is_partial, is_demo, status, remarks, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `, [
      txNumber, bill.bill_id, bill.owner_id, req.user.id,
      orNumber, currentBalance, paidNum, newRemainingBalance,
      payment_method, payment_date, currentTime, transaction_reference || null,
      isPartial ? 1 : 0, isDemo ? 1 : 0, remarks || null, idempotency_key || null
    ]);

    const txId = txResult.insertId;

    // 4. Update Bill Balance Atomically
    await connection.query(`
      UPDATE tax_bills
      SET amount_paid = ?,
          remaining_balance = ?,
          bill_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE bill_id = ?
    `, [newAmountPaid, newRemainingBalance, newBillStatus, bill.bill_id]);

    // 5. Audit Log
    await logTaxAuditEvent(connection, req, 'payment', txId, 'RECORD_PAYMENT', {
      previous_balance: currentBalance,
      bill_status: bill.bill_status
    }, {
      amount_paid: paidNum,
      balance_after: newRemainingBalance,
      or_number: orNumber,
      bill_status: newBillStatus,
      is_partial: isPartial
    }, `Payment collected for Bill ${bill.bill_number} (OR: ${orNumber})`);

    await connection.commit();

    // 6. Notify Owner
    const [ownerUsers] = await pool.query('SELECT user_id FROM users WHERE owner_id = ?', [bill.owner_id]);
    for (const u of ownerUsers) {
      await createNotification(
        u.user_id,
        isFullyPaid ? 'Payment Confirmed - Bill Paid' : 'Partial Payment Recorded',
        `Payment of ₱${paidNum.toLocaleString()} recorded for Bill ${bill.bill_number} (OR: ${orNumber}). Remaining balance: ₱${newRemainingBalance.toLocaleString()}.`,
        'PAYMENT_SUCCESS',
        txId
      );
    }

    res.status(201).json({
      message: `Payment of ₱${paidNum.toLocaleString()} recorded successfully. Official Receipt: ${orNumber}.`,
      transaction_id: txId,
      transaction_number: txNumber,
      or_number: orNumber,
      amount_paid: paidNum,
      balance_after_payment: newRemainingBalance,
      bill_status: newBillStatus,
      is_fully_paid: isFullyPaid
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 6. REVERSE / VOID PAYMENT (Controlled reversal with reason & balance restore)
// =========================================================================
const reversePaymentHandler = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id || req.body.transaction_id;
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ message: 'A verified justification reason is required for payment reversal or receipt voiding.' });
    }

    await connection.beginTransaction();

    const [txRows] = await connection.query(
      'SELECT * FROM payment_transactions WHERE transaction_id = ? FOR UPDATE',
      [id]
    );

    if (txRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Transaction record not found.' });
    }

    const tx = txRows[0];
    if (tx.status === 'voided' || tx.status === 'reversed') {
      await connection.rollback();
      return res.status(400).json({ message: `Transaction has already been ${tx.status}.` });
    }

    // 1. Mark transaction as voided / reversed (NEVER delete historical records)
    await connection.query(`
      UPDATE payment_transactions
      SET status = 'reversed',
          void_reason = ?,
          voided_by_user_id = ?,
          voided_at = CURRENT_TIMESTAMP,
          reversal_approved_by = ?
      WHERE transaction_id = ?
    `, [reason.trim(), req.user.id, req.user.id, id]);

    // 2. Restore Bill Balance Atomically
    const [bills] = await connection.query('SELECT * FROM tax_bills WHERE bill_id = ? FOR UPDATE', [tx.bill_id]);
    if (bills.length > 0) {
      const b = bills[0];
      const restoredPaid = Number(Math.max(0, Number(b.amount_paid) - Number(tx.amount_paid)).toFixed(2));
      const restoredBalance = Number((Number(b.remaining_balance) + Number(tx.amount_paid)).toFixed(2));
      const restoredStatus = restoredBalance >= Number(b.total_amount_due) ? 'approved' : 'partially_paid';

      await connection.query(`
        UPDATE tax_bills
        SET amount_paid = ?,
            remaining_balance = ?,
            bill_status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE bill_id = ?
      `, [restoredPaid, restoredBalance, restoredStatus, b.bill_id]);
    }

    await logTaxAuditEvent(connection, req, 'payment', id, 'REVERSE_PAYMENT', {
      status: tx.status,
      amount: tx.amount_paid
    }, {
      status: 'reversed',
      reason
    }, `Reversal of payment (OR: ${tx.or_number})`);

    await connection.commit();

    // Notify Owner of Reversal
    const [ownerUsers] = await pool.query('SELECT user_id FROM users WHERE owner_id = ?', [tx.owner_id]);
    for (const u of ownerUsers) {
      await createNotification(
        u.user_id,
        'Payment Transaction Adjusted / Reversed',
        `Payment transaction ${tx.or_number} (₱${Number(tx.amount_paid).toLocaleString()}) was reversed. Reason: ${reason}.`,
        'PAYMENT_REVERSED',
        id
      );
    }

    res.json({
      message: `Transaction ${tx.transaction_number} (OR: ${tx.or_number}) reversed successfully. Bill balance restored.`,
      status: 'reversed'
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

router.post('/cashier/transactions/:id/reverse', authenticate, allowRoles('admin', 'super_admin'), reversePaymentHandler);
router.post('/cashier/reverse', authenticate, allowRoles('admin', 'super_admin'), reversePaymentHandler);

// =========================================================================
// 7. GET CASHIER RECONCILIATIONS (Daily closing records)
// =========================================================================
router.get('/cashier/reconciliations', authenticate, allowRoles('cashier', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        cr.*,
        u.first_name AS cashier_first_name, u.last_name AS cashier_last_name,
        u_ver.first_name AS verifier_first_name, u_ver.last_name AS verifier_last_name
      FROM cashier_reconciliations cr
      JOIN users u ON cr.cashier_user_id = u.user_id
      LEFT JOIN users u_ver ON cr.verified_by_user_id = u_ver.user_id
      ORDER BY cr.reconciliation_date DESC, cr.reconciliation_id DESC
      LIMIT 60
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 8. CLOSE DAY RECONCILIATION
// =========================================================================
const closeDayReconciliationHandler = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const {
      reconciliation_date = new Date().toISOString().split('T')[0],
      actual_remitted_amount,
      physical_cash_count,
      remarks,
      notes
    } = req.body;

    const finalRemitted = actual_remitted_amount !== undefined && actual_remitted_amount !== null 
      ? Number(actual_remitted_amount) 
      : (physical_cash_count !== undefined && physical_cash_count !== null ? Number(physical_cash_count) : null);
    const finalRemarks = (remarks || notes || '').trim();

    const cashierId = req.user.id;
    await connection.beginTransaction();

    // Sum transactions for the date and cashier
    const [summaryRows] = await connection.query(`
      SELECT 
        COUNT(*) AS total_tx,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' AND status = 'completed' THEN amount_paid ELSE 0 END), 0) AS cash_tot,
        COALESCE(SUM(CASE WHEN payment_method = 'check' AND status = 'completed' THEN amount_paid ELSE 0 END), 0) AS check_tot,
        COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash', 'check') AND status = 'completed' THEN amount_paid ELSE 0 END), 0) AS other_tot,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_paid ELSE 0 END), 0) AS gross_tot,
        COALESCE(SUM(CASE WHEN status IN ('reversed', 'voided') THEN amount_paid ELSE 0 END), 0) AS voided_tot
      FROM payment_transactions
      WHERE payment_date = ? AND cashier_user_id = ?
    `, [reconciliation_date, cashierId]);

    const s = summaryRows[0] || {};
    const gross = Number(s.gross_tot);
    const voided = Number(s.voided_tot);
    const net = Number((gross).toFixed(2)); // net completed collections

    const remitted = finalRemitted !== null ? finalRemitted : net;
    const discrepancy = Number((remitted - net).toFixed(2));
    const status = discrepancy !== 0 ? 'discrepancy_flagged' : 'reconciled';

    const [existing] = await connection.query(
      'SELECT reconciliation_id FROM cashier_reconciliations WHERE reconciliation_date = ? AND cashier_user_id = ?',
      [reconciliation_date, cashierId]
    );

    let reconId;
    if (existing.length > 0) {
      reconId = existing[0].reconciliation_id;
      await connection.query(`
        UPDATE cashier_reconciliations
        SET total_transactions_count = ?,
            total_cash_collected = ?,
            total_check_collected = ?,
            total_other_collected = ?,
            gross_collection = ?,
            total_voided_reversed = ?,
            net_collection = ?,
            actual_remitted_amount = ?,
            discrepancy_amount = ?,
            status = ?,
            remarks = ?
        WHERE reconciliation_id = ?
      `, [
        s.total_tx, s.cash_tot, s.check_tot, s.other_tot,
        gross, voided, net, remitted, discrepancy, status, finalRemarks || null, reconId
      ]);
    } else {
      const [insertRes] = await connection.query(`
        INSERT INTO cashier_reconciliations (
          reconciliation_date, cashier_user_id, total_transactions_count,
          total_cash_collected, total_check_collected, total_other_collected,
          gross_collection, total_voided_reversed, net_collection,
          actual_remitted_amount, discrepancy_amount, status, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        reconciliation_date, cashierId, s.total_tx,
        s.cash_tot, s.check_tot, s.other_tot,
        gross, voided, net, remitted, discrepancy, status, finalRemarks || null
      ]);
      reconId = insertRes.insertId;
    }

    await logTaxAuditEvent(connection, req, 'reconciliation', reconId, 'CLOSE_DAY_RECONCILIATION', null, {
      date: reconciliation_date,
      net,
      remitted,
      discrepancy,
      status
    });

    await connection.commit();

    res.json({
      message: `Daily collection reconciliation closed (${status === 'reconciled' ? 'Balanced' : 'Discrepancy Flagged'}).`,
      reconciliation_id: reconId,
      gross_collection: gross,
      net_collection: net,
      actual_remitted_amount: remitted,
      discrepancy_amount: discrepancy,
      status
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

router.post('/cashier/reconciliations/close-day', authenticate, allowRoles('cashier', 'admin', 'super_admin'), closeDayReconciliationHandler);
router.post('/cashier/reconcile', authenticate, allowRoles('cashier', 'admin', 'super_admin'), closeDayReconciliationHandler);

// =========================================================================
// 9. DAILY CASHIER COLLECTION REPORT (For treasury remittance sheet)
// =========================================================================
router.get('/cashier/reports/daily', authenticate, allowRoles('cashier', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const { date = new Date().toISOString().split('T')[0], cashier_id } = req.query;

    let query = `
      SELECT 
        pt.*,
        tb.bill_number,
        tb.tax_year,
        td.declaration_number,
        td.target_id_str,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        u.first_name AS cashier_first_name, u.last_name AS cashier_last_name
      FROM payment_transactions pt
      JOIN tax_bills tb ON pt.bill_id = tb.bill_id
      JOIN tax_declarations td ON tb.tax_declaration_id = td.tax_declaration_id
      JOIN properties p ON tb.property_id = p.property_id
      JOIN property_owners o ON pt.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      JOIN users u ON pt.cashier_user_id = u.user_id
      WHERE pt.payment_date = ?
    `;
    const params = [date];

    if (cashier_id) {
      query += ' AND pt.cashier_user_id = ?';
      params.push(cashier_id);
    }

    query += ' ORDER BY pt.transaction_id ASC';
    const [transactions] = await pool.query(query, params);

    const totalCash = transactions.filter(t => t.status === 'completed' && t.payment_method === 'cash').reduce((acc, t) => acc + Number(t.amount_paid), 0);
    const totalCheck = transactions.filter(t => t.status === 'completed' && t.payment_method === 'check').reduce((acc, t) => acc + Number(t.amount_paid), 0);
    const totalOther = transactions.filter(t => t.status === 'completed' && !['cash', 'check'].includes(t.payment_method)).reduce((acc, t) => acc + Number(t.amount_paid), 0);
    const totalReversed = transactions.filter(t => t.status === 'reversed' || t.status === 'voided').reduce((acc, t) => acc + Number(t.amount_paid), 0);
    const netTotal = totalCash + totalCheck + totalOther;

    res.json({
      report_title: 'MUNICIPALITY OF LAGONGLONG - DAILY COLLECTION REPORT',
      collection_date: date,
      summary: {
        total_transactions: transactions.length,
        completed_transactions: transactions.filter(t => t.status === 'completed').length,
        total_cash: totalCash,
        total_check: totalCheck,
        total_other: totalOther,
        total_reversed: totalReversed,
        net_collection: netTotal
      },
      transactions
    });
  } catch (err) {
    next(err);
  }
});

export default router;
