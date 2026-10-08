import { pool } from './config/db.js';

async function main() {
  const [users] = await pool.query('SELECT user_id, username, email, role, status FROM users');
  console.log("Users:", users);
  pool.end();
}
main();
