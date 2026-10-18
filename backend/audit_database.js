import { pool } from './config/db.js';

async function audit() {
  console.log('=== 1. AUDITING OWNERS ===');
  const [owners] = await pool.query('SELECT * FROM property_owners ORDER BY owner_id');
  console.log(`Found ${owners.length} owners in database:`);
  for (const o of owners) {
    const [pCount] = await pool.query('SELECT COUNT(*) as count FROM properties WHERE owner_id = ?', [o.owner_id]);
    console.log(`ID: ${o.owner_id} | Name: ${o.first_name} ${o.middle_name || ''} ${o.last_name} | Contact: ${o.contact_number} | Email: ${o.email} | Owned Properties: ${pCount[0].count}`);
  }

  console.log('\n=== 2. AUDITING PROPERTIES & ADDRESSES ===');
  const [props] = await pool.query(`
    SELECT 
      p.property_id,
      pt.property_type_name,
      p.owner_id,
      TRIM(CONCAT(COALESCE(o.first_name, ''), ' ', COALESCE(o.middle_name, ''), ' ', COALESCE(o.last_name, ''))) AS owner_name,
      l.lot_id, l.lot_number,
      b.building_id, b.building_name,
      a.address_id, a.street, a.house_number,
      bg.barangay_id, bg.barangay_name,
      m.municipality_name,
      pr.province_name,
      g.gis_id, g.geometry_type, g.coordinates, g.area_sqm,
      (SELECT COUNT(*) FROM property_assessments pa WHERE pa.property_id = p.property_id) AS pa_count,
      (SELECT COUNT(*) FROM lot_assessment_history lah WHERE lah.lot_id = l.lot_id) AS lah_count,
      (SELECT COUNT(*) FROM building_assessment_history bah WHERE bah.building_id = b.building_id) AS bah_count
    FROM properties p
    JOIN property_types pt ON p.property_type_id = pt.property_type_id
    LEFT JOIN property_owners o ON p.owner_id = o.owner_id
    LEFT JOIN property_lots l ON p.property_id = l.property_id
    LEFT JOIN property_buildings b ON p.property_id = b.property_id
    LEFT JOIN addresses a ON p.address_id = a.address_id
    LEFT JOIN barangays bg ON a.barangay_id = bg.barangay_id
    LEFT JOIN municipalities m ON bg.municipality_id = m.municipality_id
    LEFT JOIN provinces pr ON m.province_id = pr.province_id
    LEFT JOIN gis_locations g ON p.property_id = g.property_id
    ORDER BY p.property_id
  `);

  let validGisCount = 0;
  let missingGisCount = 0;
  let nonLagonglongCount = 0;

  for (const p of props) {
    const isLagonglong = (p.municipality_name || '').toLowerCase() === 'lagonglong';
    if (!isLagonglong) nonLagonglongCount++;
    const hasGis = Boolean(p.gis_id && p.coordinates);
    if (hasGis) validGisCount++;
    else missingGisCount++;

    const isAssessed = p.pa_count > 0 || p.lah_count > 0 || p.bah_count > 0;

    console.log(
      `P#${p.property_id} [${p.property_type_name}] | ${p.lot_number || p.building_name} | Owner: ${p.owner_name} (ID:${p.owner_id}) | Brgy: ${p.barangay_name || 'MISSING'}, ${p.municipality_name || 'MISSING'} | GIS: ${hasGis ? 'YES' : 'NEEDS MAPPING'} | Assessed: ${isAssessed ? 'YES' : 'NO'}`
    );
  }

  console.log(`\nTotal Properties: ${props.length}`);
  console.log(`Mapped (GIS present): ${validGisCount}`);
  console.log(`Needs Mapping (missing GIS): ${missingGisCount}`);
  console.log(`Non-Lagonglong: ${nonLagonglongCount}`);

  console.log('\n=== 3. AUDITING USERS & ROLES ===');
  const [users] = await pool.query('SELECT user_id, username, first_name, last_name, role, email FROM users');
  for (const u of users) {
    console.log(`User#${u.user_id} (${u.username}): ${u.first_name} ${u.last_name} | Role: ${u.role} | Email: ${u.email}`);
  }

  await pool.end();
}

audit();
