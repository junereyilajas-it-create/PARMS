import mysql from 'mysql2/promise';
import 'dotenv/config.js';

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'parms'
  });
  
  await conn.query(`
    CREATE TABLE IF NOT EXISTS scanned_blueprints (
        scan_id INT AUTO_INCREMENT PRIMARY KEY,
        uploaded_by_user_id INT,
        original_filename VARCHAR(255),
        stored_filepath VARCHAR(255),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('processing', 'draft', 'pending_approval', 'approved', 'rejected') DEFAULT 'processing',
        lot_number VARCHAR(50),
        cad_reference VARCHAR(100),
        barangay VARCHAR(100),
        municipality VARCHAR(100),
        province VARCHAR(100),
        stated_area DECIMAL(10, 2),
        survey_date VARCHAR(50),
        calculated_area DECIMAL(10, 2),
        closure_error DECIMAL(10, 4),
        rejection_reason TEXT,
        gis_geometry JSON
    );
  `);
  
  await conn.query(`
    CREATE TABLE IF NOT EXISTS scanned_segments (
        segment_id INT AUTO_INCREMENT PRIMARY KEY,
        scan_id INT,
        segment_number INT,
        from_point VARCHAR(20),
        to_point VARCHAR(20),
        bearing VARCHAR(50),
        distance DECIMAL(10, 2),
        distance_raw VARCHAR(50),
        ocr_confidence DECIMAL(5, 2),
        is_corrected BOOLEAN DEFAULT FALSE,
        original_bearing VARCHAR(50),
        original_distance VARCHAR(50),
        FOREIGN KEY (scan_id) REFERENCES scanned_blueprints(scan_id) ON DELETE CASCADE
    );
  `);
  
  console.log('Tables created');
  process.exit(0);
}
run().catch(console.error);
