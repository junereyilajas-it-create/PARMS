import { pool } from './config/db.js';

async function main() {
  const [gis] = await pool.query('SELECT * FROM gis_locations LIMIT 1');
  console.log("GIS Sample:", JSON.stringify(gis, null, 2));

  const [owners] = await pool.query('SELECT * FROM property_owners LIMIT 1');
  console.log("Owners Table:", JSON.stringify(owners, null, 2));

  const [properties] = await pool.query('SELECT * FROM properties LIMIT 1');
  console.log("Properties Table:", JSON.stringify(properties, null, 2));

  pool.end();
}
main();
