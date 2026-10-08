import { pool } from './config/db.js';

async function migrate() {
  const connection = await pool.getConnection();
  try {
    console.log('Creating assessment_assignments table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assessment_assignments (
        assignment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        property_type ENUM('property', 'lot', 'building') NOT NULL,
        target_id_int INT UNSIGNED NOT NULL,
        target_id_str VARCHAR(50) NOT NULL,
        assigned_to_user_id INT UNSIGNED NOT NULL,
        assigned_by_user_id INT UNSIGNED NOT NULL,
        due_date DATE,
        instructions TEXT,
        assignment_status ENUM('assigned', 'in_progress', 'submitted', 'returned', 'approved', 'rejected', 'cancelled') DEFAULT 'assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to_user_id) REFERENCES users(user_id),
        FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id)
      )
    `);

    console.log('Creating assessment_permission_requests table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assessment_permission_requests (
        request_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        property_type ENUM('property', 'lot', 'building') NOT NULL,
        target_id_int INT UNSIGNED NOT NULL,
        target_id_str VARCHAR(50) NOT NULL,
        requested_by_user_id INT UNSIGNED NOT NULL,
        reason TEXT,
        request_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id)
      )
    `);

    console.log('Migration successful.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrate();
