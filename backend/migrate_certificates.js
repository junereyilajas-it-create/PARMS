import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'property_management_db'
  });
  
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS certificate_requests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        property_id INT UNSIGNED,
        status ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED') DEFAULT 'PENDING',
        rejection_reason TEXT,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_by INT UNSIGNED,
        reviewed_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL
      )
    `);
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS generated_certificates (
        certificate_id INT AUTO_INCREMENT PRIMARY KEY,
        certificate_number VARCHAR(100) UNIQUE,
        certificate_type VARCHAR(50),
        owner_id INT UNSIGNED,
        property_id INT UNSIGNED,
        requestor_name VARCHAR(255),
        purpose TEXT,
        issued_by_user_id INT UNSIGNED,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tables created successfully.');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await conn.end();
  }
}

run();
