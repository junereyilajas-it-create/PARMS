import { pool } from './config/db.js';

async function main() {
  const [props] = await pool.query('SELECT property_id, owner_id FROM properties LIMIT 5');
  console.log("Properties:", props);
  const [lots] = await pool.query('SELECT lot_id, property_id, lot_number FROM property_lots LIMIT 5');
  console.log("Lots:", lots);
  const [buildings] = await pool.query('SELECT building_id, property_id, building_name FROM property_buildings LIMIT 5');
  console.log("Buildings:", buildings);
  pool.end();
}
main();
