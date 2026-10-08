import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'property_management_db'
  });

  try {
    // Modify users table
    await conn.query("ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'assessor', 'staff', 'client') NOT NULL DEFAULT 'staff'");
    
    const [cols] = await conn.query("SHOW COLUMNS FROM users LIKE 'status'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'");
    }

    // Insert super admin user if not exists
    const [existing] = await conn.query("SELECT * FROM users WHERE role = 'super_admin'");
    if (existing.length === 0) {
      const hash = await bcrypt.hash('superadmin123', 10);
      await conn.query(
        "INSERT INTO users (first_name, last_name, username, password_hash, email, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['Karl John', 'Reyes', 'karl_superadmin', hash, 'karl@superadmin.com', 'super_admin', 'active']
      );
      console.log('Created Super Admin user: karl_superadmin / superadmin123');
    } else {
      console.log('Super Admin already exists');
    }
  } catch(e) {
    console.error(e);
  } finally {
    await conn.end();
  }
}
run();
