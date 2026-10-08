import { pool } from './config/db.js';

async function main() {
  const [desc] = await pool.query('DESCRIBE property_owners');
  console.log("Schema:", desc);
  pool.end();
}
main();
