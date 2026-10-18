import { pool } from '../config/db.js';

async function migrate() {
  console.log('Starting migration for certificate_requests table...');
  try {
    const [existingCols] = await pool.query('DESCRIBE certificate_requests');
    const colNames = existingCols.map(c => c.Field);

    if (!colNames.includes('certificate_type')) {
      await pool.query("ALTER TABLE certificate_requests ADD COLUMN certificate_type VARCHAR(100) DEFAULT 'Certificate of Property Ownership' AFTER property_id");
      console.log('Added certificate_type column');
    }

    if (!colNames.includes('purpose')) {
      await pool.query("ALTER TABLE certificate_requests ADD COLUMN purpose TEXT AFTER certificate_type");
      console.log('Added purpose column');
    }

    if (!colNames.includes('remarks')) {
      await pool.query("ALTER TABLE certificate_requests ADD COLUMN remarks TEXT AFTER purpose");
      console.log('Added remarks column');
    }

    if (!colNames.includes('reference_number')) {
      await pool.query("ALTER TABLE certificate_requests ADD COLUMN reference_number VARCHAR(50) AFTER remarks");
      console.log('Added reference_number column');
    }

    if (!colNames.includes('contact_number')) {
      await pool.query("ALTER TABLE certificate_requests ADD COLUMN contact_number VARCHAR(50) AFTER reference_number");
      console.log('Added contact_number column');
    }

    if (!colNames.includes('certificate_id')) {
      await pool.query("ALTER TABLE certificate_requests ADD COLUMN certificate_id INT UNSIGNED NULL AFTER contact_number");
      console.log('Added certificate_id column');
    }

    if (!colNames.includes('processing_notes')) {
      await pool.query("ALTER TABLE certificate_requests ADD COLUMN processing_notes TEXT NULL AFTER rejection_reason");
      console.log('Added processing_notes column');
    }

    if (!colNames.includes('assigned_to')) {
      await pool.query("ALTER TABLE certificate_requests ADD COLUMN assigned_to INT UNSIGNED NULL AFTER reviewed_by");
      console.log('Added assigned_to column');
    }

    await pool.query("ALTER TABLE certificate_requests MODIFY COLUMN status ENUM('PENDING', 'PROCESSING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'RETURNED') DEFAULT 'PENDING'");
    console.log('Updated status ENUM column');

    const [updatedCols] = await pool.query('DESCRIBE certificate_requests');
    console.log('Updated columns:', updatedCols.map(c => `${c.Field} (${c.Type})`));
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
