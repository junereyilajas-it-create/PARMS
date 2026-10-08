import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'property_management_db',
    multipleStatements: true
  });

  try {
    console.log('Starting schema migration...');

    // 1. Update roles enum
    await connection.query(`
      ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'assessor', 'staff', 'client') NOT NULL DEFAULT 'staff';
    `);
    console.log('Updated users role ENUM.');

    // 2. Add workflow columns to property_assessments
    await connection.query(`
      ALTER TABLE property_assessments 
      ADD COLUMN assessment_status ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected', 'returned') NOT NULL DEFAULT 'draft',
      ADD COLUMN head_assessor_id INT UNSIGNED NULL,
      ADD COLUMN approval_date TIMESTAMP NULL,
      ADD COLUMN rejection_reason TEXT NULL,
      ADD CONSTRAINT fk_assessments_head FOREIGN KEY (head_assessor_id) REFERENCES users(user_id) ON DELETE SET NULL;
    `);
    console.log('Updated property_assessments workflow columns.');

    // 3. Add workflow columns to lot_assessment_history
    await connection.query(`
      ALTER TABLE lot_assessment_history 
      ADD COLUMN assessment_status ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected', 'returned') NOT NULL DEFAULT 'draft',
      ADD COLUMN head_assessor_id INT UNSIGNED NULL,
      ADD COLUMN approval_date TIMESTAMP NULL,
      ADD COLUMN rejection_reason TEXT NULL,
      ADD CONSTRAINT fk_lot_assessments_head FOREIGN KEY (head_assessor_id) REFERENCES users(user_id) ON DELETE SET NULL;
    `);
    console.log('Updated lot_assessment_history workflow columns.');

    // 4. Add workflow columns to building_assessment_history
    await connection.query(`
      ALTER TABLE building_assessment_history 
      ADD COLUMN assessment_status ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected', 'returned') NOT NULL DEFAULT 'draft',
      ADD COLUMN head_assessor_id INT UNSIGNED NULL,
      ADD COLUMN approval_date TIMESTAMP NULL,
      ADD COLUMN rejection_reason TEXT NULL,
      ADD CONSTRAINT fk_building_assessments_head FOREIGN KEY (head_assessor_id) REFERENCES users(user_id) ON DELETE SET NULL;
    `);
    console.log('Updated building_assessment_history workflow columns.');

    // 5. Create report_history table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS report_history (
        report_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        report_type VARCHAR(100) NOT NULL,
        reporting_period VARCHAR(100) NOT NULL,
        generated_by INT UNSIGNED NOT NULL,
        generated_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        record_count INT UNSIGNED NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Generated',
        CONSTRAINT fk_report_history_user FOREIGN KEY (generated_by) REFERENCES users(user_id)
      ) ENGINE=InnoDB;
    `);
    console.log('Created report_history table.');

    // 6. Update Activity Logs if needed
    try {
      await connection.query(`
        ALTER TABLE activity_logs 
        ADD COLUMN role VARCHAR(50) AFTER user_id,
        ADD COLUMN record_affected VARCHAR(255) AFTER module_name,
        ADD COLUMN action VARCHAR(80) AFTER role;
      `);
      console.log('Updated activity_logs with new columns.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Activity logs already have the required columns.');
      } else {
        throw err;
      }
    }

    // 7. Seed Data: Update Junerey to super_admin, and insert a new Head Assessor if not exists
    await connection.query(`UPDATE users SET role = 'super_admin' WHERE username = 'junerey';`);
    console.log('Promoted junerey to super_admin.');

    const [rows] = await connection.query(`SELECT user_id FROM users WHERE username = 'headassessor'`);
    if (rows.length === 0) {
      const passwordHash = await bcrypt.hash('password123', 10);
      await connection.query(`
        INSERT INTO users (first_name, last_name, username, password_hash, email, role)
        VALUES ('Head', 'Assessor', 'headassessor', ?, 'headassessor@gmail.com', 'admin');
      `, [passwordHash]);
      console.log('Created Head Assessor user (username: headassessor, password: password123).');
    }

    // Mark existing assessments as approved for consistency with existing data
    await connection.query(`UPDATE property_assessments SET assessment_status = 'approved'`);
    await connection.query(`UPDATE lot_assessment_history SET assessment_status = 'approved'`);
    await connection.query(`UPDATE building_assessment_history SET assessment_status = 'approved'`);
    console.log('Marked existing assessments as approved.');

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

migrate();
