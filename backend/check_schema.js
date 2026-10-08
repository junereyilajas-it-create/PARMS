import { pool } from './config/db.js';

async function main() {
  try {
    const [rows] = await pool.query('SHOW CREATE TABLE users');
    console.log(rows[0]['Create Table']);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
main();
