import { pool } from './config/db.js';

async function main() {
  try {
    const [lots] = await pool.query(`
      SELECT 
        l.lot_id as id,
        l.property_id,
        l.lot_number as title,
        l.lot_area as area,
        l.lot_status as status,
        g.gis_id,
        g.geometry_type,
        g.coordinates,
        g.area_sqm,
        g.perimeter_m,
        CONCAT_WS(' ', o.first_name, o.last_name) AS owner,
        p.property_status
      FROM property_lots l
      JOIN properties p ON l.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN gis_locations g ON g.lot_id = l.lot_id
    `);
    console.log("Lots count:", lots.length);

    const [buildings] = await pool.query(`
      SELECT 
        b.building_id as id,
        b.property_id,
        b.building_name as title,
        b.floor_area as area,
        b.building_status as status,
        g.gis_id,
        g.geometry_type,
        g.coordinates,
        g.area_sqm,
        g.perimeter_m,
        CONCAT_WS(' ', o.first_name, o.last_name) AS owner,
        p.property_status
      FROM property_buildings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      LEFT JOIN gis_locations g ON g.building_id = b.building_id
    `);
    console.log("Buildings count:", buildings.length);

  } catch(e) {
    console.error(e);
  }
  pool.end();
}
main();
