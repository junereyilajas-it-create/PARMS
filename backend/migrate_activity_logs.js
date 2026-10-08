import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'property_management_db'
  });
  
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED,
        role VARCHAR(50),
        action VARCHAR(50),
        module_name VARCHAR(100),
        record_affected VARCHAR(255),
        activity TEXT,
        ip_address VARCHAR(50),
        activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
      )
    `);
    console.log('activity_logs table created successfully.');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    await conn.end();
  }
}

run();
