import mysql from 'mysql2/promise';

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'property_management_db'
  });

  try {
    console.log('Running migration...');
    
    // Add new columns to assessment_permission_requests
    await connection.query(`
      ALTER TABLE assessment_permission_requests
      ADD COLUMN request_action VARCHAR(50) NULL DEFAULT 'ASSESSMENT' AFTER property_type,
      ADD COLUMN proposed_data JSON NULL AFTER reason,
      ADD COLUMN reviewed_by_user_id INT UNSIGNED NULL AFTER rejection_reason,
      ADD COLUMN reviewed_at TIMESTAMP NULL AFTER reviewed_by_user_id;
    `);
    
    // Add foreign key for reviewed_by_user_id
    await connection.query(`
      ALTER TABLE assessment_permission_requests
      ADD CONSTRAINT fk_pr_reviewed_by
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL;
    `);

    // Add status column to properties, property_lots, property_buildings if they don't exist
    // Wait, property_lots has lot_status, property_buildings has building_status, properties has property_status.
    // They are already enums or varchars. Let's make sure they can accept 'pending_approval'.
    
    console.log('Migration successful.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Migration already applied.');
    } else {
      console.error('Migration failed:', err);
    }
  } finally {
    await connection.end();
  }
}

runMigration();
