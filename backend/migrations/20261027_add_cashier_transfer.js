import { pool } from '../config/db.js';

export async function runMigration() {
  console.log('=== STARTING SAFE MIGRATION: CASHIER TRANSFER STAGING ===');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Check and add cashier transfer columns to tax_bills if they don't exist
    const [cols] = await conn.query('DESCRIBE tax_bills');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('cashier_transfer_status')) {
      console.log('Adding cashier_transfer_status to tax_bills...');
      await conn.query(`
        ALTER TABLE tax_bills 
        ADD COLUMN cashier_transfer_status VARCHAR(50) NOT NULL DEFAULT 'not_transferred' AFTER bill_status,
        ADD COLUMN cashier_transferred_at DATETIME NULL AFTER cashier_transfer_status,
        ADD COLUMN cashier_transferred_by_user_id INT UNSIGNED NULL AFTER cashier_transferred_at,
        ADD COLUMN cashier_transfer_payload JSON NULL AFTER cashier_transferred_by_user_id,
        ADD COLUMN cashier_transfer_notes TEXT NULL AFTER cashier_transfer_payload,
        ADD INDEX idx_tb_cashier_transfer (cashier_transfer_status)
      `);
      console.log('✓ Added cashier transfer columns to tax_bills.');
    } else {
      console.log('✓ cashier_transfer_status already exists in tax_bills.');
    }

    // 2. Create cashier_transfer_requests table if not exists
    console.log('Ensuring cashier_transfer_requests table exists...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cashier_transfer_requests (
        transfer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        bill_id INT UNSIGNED NOT NULL,
        requested_by_user_id INT UNSIGNED NOT NULL,
        transfer_status VARCHAR(50) NOT NULL DEFAULT 'awaiting_development',
        payload JSON NOT NULL,
        response_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ctr_bill (bill_id),
        INDEX idx_ctr_user (requested_by_user_id),
        INDEX idx_ctr_status (transfer_status),
        CONSTRAINT fk_ctr_bill FOREIGN KEY (bill_id) REFERENCES tax_bills(bill_id) ON DELETE CASCADE,
        CONSTRAINT fk_ctr_user FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Table cashier_transfer_requests verified.');

    await conn.commit();
    console.log('=== MIGRATION COMPLETED SUCCESSFULLY! ===');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
    throw err;
  } finally {
    conn.release();
  }
}

// Auto-run if executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}
