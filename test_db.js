import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

(async () => {
  const pool = mysql.createPool({ 
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME 
  });
  
  try {
    const [rows] = await pool.query(`
      SELECT r.*, u.first_name, u.last_name
      FROM assessment_permission_requests r
      JOIN users u ON r.requested_by_user_id = u.user_id
      ORDER BY r.created_at DESC
    `);
    console.log('Query successful, rows:', rows.length);
  } catch (e) { 
    console.error('Error:', e); 
  }
  process.exit(0);
})();
