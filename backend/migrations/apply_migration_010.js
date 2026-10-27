import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('Applying Migration 010: Property Tax Computations...');
  const sql = fs.readFileSync(path.join(__dirname, '010_tax_computation_reports.sql'), 'utf8');
  await pool.query(sql);
  console.log('[PASS] property_tax_computations table verified/created.');

  // Check if any computations exist
  const [existing] = await pool.query('SELECT count(*) as count FROM property_tax_computations');
  if (existing[0].count === 0) {
    console.log('Seeding existing tax computations from tax_bills and tax_declarations...');
    const [bills] = await pool.query(`
      SELECT 
        tb.*, 
        td.declaration_number, 
        td.property_type, 
        td.target_id_str, 
        td.target_id_int,
        td.classification, 
        td.actual_use, 
        td.market_value
      FROM tax_bills tb
      JOIN tax_declarations td ON tb.tax_declaration_id = td.tax_declaration_id
    `);

    for (const b of bills) {
      const compNumber = `COMP-${b.tax_year}-${String(b.bill_id).padStart(4, '0')}`;
      const status = b.bill_status === 'approved' || b.bill_status === 'paid' || b.bill_status === 'partially_paid' 
        ? 'approved' 
        : (b.bill_status === 'pending_approval' ? 'pending_approval' : 'draft');
      
      const [assessorUser] = await pool.query("SELECT user_id FROM users WHERE role = 'assessor' LIMIT 1");
      const computedBy = b.prepared_by_user_id || assessorUser[0]?.user_id || 1;
      const snapshotStr = b.rule_version_snapshot 
        ? (typeof b.rule_version_snapshot === 'object' ? JSON.stringify(b.rule_version_snapshot) : b.rule_version_snapshot)
        : null;

      await pool.query(`
        INSERT INTO property_tax_computations (
          computation_number, property_id, property_type, target_id_int, target_id_str,
          tax_declaration_id, owner_id, tax_year, classification, actual_use,
          market_value, assessment_level, assessed_value, basic_tax_rate, basic_tax_amount,
          sef_tax_rate, sef_tax_amount, other_levies_amount, discount_amount,
          penalty_interest_amount, prior_delinquency_amount, total_computed_tax,
          computation_status, is_complete, rule_version_snapshot, computed_by_user_id,
          reviewed_by_user_id, reviewed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `, [
        compNumber, b.property_id, b.property_type === 'building' ? 'building' : 'lot',
        b.target_id_int || null, b.target_id_str || b.property_code,
        b.tax_declaration_id, b.owner_id, b.tax_year, b.classification || 'Residential', b.actual_use || 'Residential',
        b.market_value || (Number(b.assessed_value) / 0.20),
        0.2000, b.assessed_value, b.basic_tax_rate || 0.0100, b.basic_tax_amount,
        b.sef_tax_rate || 0.0100, b.sef_tax_amount, b.other_levies_amount || 0.00,
        b.discount_amount || 0.00, b.penalty_interest_amount || 0.00,
        b.prior_delinquency_amount || 0.00, b.total_amount_due,
        status, snapshotStr, computedBy,
        b.approved_by_user_id, b.approved_at, b.created_at, b.updated_at
      ]);
    }
    console.log(`[PASS] Seeded ${bills.length} property tax computations from historical records.`);
  }

  // Deactivate any cashier accounts in users table
  const [updatedCashiers] = await pool.query("UPDATE users SET status = 'inactive' WHERE role = 'cashier'");
  console.log(`[PASS] Updated cashier user accounts status to inactive (${updatedCashiers.affectedRows} rows).`);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
