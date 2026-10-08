import { pool } from './config/db.js';

async function main() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_id INT AUTO_INCREMENT PRIMARY KEY,
        setting_category VARCHAR(50) NOT NULL,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT,
        is_sensitive BOOLEAN DEFAULT FALSE,
        description TEXT
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        ticket_id VARCHAR(50) PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        subject VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Low',
        status ENUM('Open', 'In Progress', 'Resolved', 'Closed') DEFAULT 'Open',
        assigned_to INT UNSIGNED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (assigned_to) REFERENCES users(user_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        message_id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id VARCHAR(50) NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );
    `);
    
    // Add default system settings if table is empty
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM system_settings');
    if (rows[0].count === 0) {
      await pool.query(`
        INSERT INTO system_settings (setting_category, setting_key, setting_value, is_sensitive, description) VALUES
        ('System Information', 'system_name', 'Assessor Office System', FALSE, 'The name of the application displayed in the header.'),
        ('System Information', 'contact_email', 'support@assessor.gov.ph', FALSE, 'Primary contact email for the office.'),
        ('Appearance', 'default_theme', 'light', FALSE, 'Default theme for new users (light or dark).'),
        ('Maintenance', 'maintenance_mode', 'false', TRUE, 'If true, standard users cannot log in or use the system.')
      `);
    }

    try {
      await pool.query('ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL');
      console.log('Added last_login column to users table.');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        throw e;
      }
    }

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    pool.end();
  }
}

main();
