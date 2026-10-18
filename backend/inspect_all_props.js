import { pool } from './config/db.js';

async function main() {
  const [props] = await pool.query(`
    SELECT 
      p.property_id, 
      pt.property_type_name,
      p.owner_id,
      TRIM(CONCAT(COALESCE(o.first_name, ''), ' ', COALESCE(o.middle_name, ''), ' ', COALESCE(o.last_name, ''))) AS owner_name,
      l.lot_id, l.lot_number,
      b.building_id, b.building_name,
      a.barangay_id, bg.barangay_name, a.street,
      g.gis_id, g.geometry_type,
      (SELECT COUNT(*) FROM property_assessments pa WHERE pa.property_id = p.property_id) as assessment_count
    FROM properties p
    JOIN property_types pt ON p.property_type_id = pt.property_type_id
    LEFT JOIN property_owners o ON p.owner_id = o.owner_id
    LEFT JOIN property_lots l ON p.property_id = l.property_id
    LEFT JOIN property_buildings b ON p.property_id = b.property_id
    LEFT JOIN addresses a ON p.address_id = a.address_id
    LEFT JOIN barangays bg ON a.barangay_id = bg.barangay_id
    LEFT JOIN gis_locations g ON p.property_id = g.property_id
    ORDER BY p.property_id
  `);
  console.log('Total properties:', props.length);
  for (const r of props) {
    console.log(`PropID: ${r.property_id} | Type: ${r.property_type_name} | OwnerID: ${r.owner_id} (${r.owner_name}) | Lot/Bldg: ${r.lot_number || r.building_name} | Brgy: ${r.barangay_name} | GIS: ${r.gis_id ? 'YES ('+r.geometry_type+')' : 'NO'}`);
  }
  await pool.end();
}
main();
