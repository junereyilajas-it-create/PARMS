import { pool } from './backend/config/db.js';
import bcrypt from 'bcryptjs';

async function fixBalong() {
  try {
    const username = 'balong';
    const password = 'balong123';
    const role = 'super_admin';

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    const password_hash = await bcrypt.hash(password, 10);
    
    if (rows.length > 0) {
      console.log('Balong exists. Updating...');
      await pool.query(
        'UPDATE users SET password_hash = ?, role = ?, status = "active" WHERE username = ?',
        [password_hash, role, username]
      );
      console.log('Updated.');
    } else {
      console.log('Balong does not exist. Creating...');
      await pool.query(
        'INSERT INTO users (first_name, last_name, username, password_hash, email, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['Super', 'Admin', username, password_hash, 'superadmin@example.com', role, 'active']
      );
      console.log('Created.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

fixBalong();
