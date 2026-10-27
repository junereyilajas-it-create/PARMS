import { pool } from '../config/db.js';

async function migrate() {
  try {
    console.log('Migrating certificate_requests status enum...');
    await pool.query(`
      ALTER TABLE certificate_requests 
      MODIFY COLUMN status ENUM('PENDING', 'APPROVED', 'IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW', 'READY_FOR_PICKUP', 'RELEASED', 'COMPLETED', 'REJECTED', 'RETURNED', 'CANCELLED') DEFAULT 'PENDING'
    `);
    console.log('✅ Modified status enum successfully');

    const [cols] = await pool.query('DESCRIBE certificate_requests');
    const colNames = cols.map(c => c.Field);
    if (!colNames.includes('released_at')) {
      await pool.query('ALTER TABLE certificate_requests ADD COLUMN released_at TIMESTAMP NULL AFTER completed_at');
      console.log('✅ Added released_at column');
    }
    if (!colNames.includes('released_by')) {
      await pool.query('ALTER TABLE certificate_requests ADD COLUMN released_by INT UNSIGNED NULL AFTER released_at');
      console.log('✅ Added released_by column');
    }
  } catch (err) {
    console.error('Migration error:', err.message);
  }
  process.exit(0);
}

migrate();
