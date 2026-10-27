import { pool } from '../config/db.js';
import { generatePropertyId, generateLotId, generateBuildingId } from '../utils/idGenerator.js';

async function runTests() {
  console.log('--- STARTING VERIFICATION OF ALL DELIVERABLES ---');

  // TEST 1: Database DOUBLE Error Check - Search with 'jemar store' and 'BLDG-15'
  console.log('\n[TEST 1] Testing queries with "jemar store" and "BLDG-15"...');
  const testTerms = ['jemar store', 'BLDG-15', 'LOT_L-474', 'PROP_1'];

  for (const term of testTerms) {
    try {
      const rawQ = term.trim();
      const qWildcard = `%${rawQ}%`;
      const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;

      // Lots search query
      const [lots] = await pool.query(`
        SELECT l.lot_id, l.lot_number, p.property_id, p.property_code
        FROM property_lots l
        JOIN properties p ON l.property_id = p.property_id
        LEFT JOIN property_owners o ON p.owner_id = o.owner_id
        LEFT JOIN addresses a ON p.address_id = a.address_id
        LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
        WHERE (? = '' OR 
          (? = 1 AND l.lot_id = ?) OR 
          (? = 1 AND l.property_id = ?) OR
          l.lot_number LIKE ? OR 
          p.property_code LIKE ? OR
          o.first_name LIKE ? OR 
          o.last_name LIKE ? OR 
          CONCAT_WS(' ', o.first_name, o.last_name) LIKE ? OR
          b.barangay_name LIKE ?
        )
        LIMIT 5
      `, [rawQ, numericQ !== null ? 1 : 0, numericQ || 0, numericQ !== null ? 1 : 0, numericQ || 0, qWildcard, qWildcard, qWildcard, qWildcard, qWildcard, qWildcard]);

      // Buildings search query
      const [buildings] = await pool.query(`
        SELECT bg.building_id, bg.building_code, p.property_id, p.property_code
        FROM property_buildings bg
        JOIN properties p ON bg.property_id = p.property_id
        LEFT JOIN property_owners o ON p.owner_id = o.owner_id
        LEFT JOIN addresses a ON p.address_id = a.address_id
        LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
        WHERE (? = '' OR 
          (? = 1 AND bg.building_id = ?) OR 
          (? = 1 AND bg.property_id = ?) OR
          bg.building_code LIKE ? OR
          bg.building_name LIKE ? OR 
          p.property_code LIKE ? OR
          o.first_name LIKE ? OR 
          o.last_name LIKE ? OR 
          CONCAT_WS(' ', o.first_name, o.last_name) LIKE ? OR
          b.barangay_name LIKE ?
        )
        LIMIT 5
      `, [rawQ, numericQ !== null ? 1 : 0, numericQ || 0, numericQ !== null ? 1 : 0, numericQ || 0, qWildcard, qWildcard, qWildcard, qWildcard, qWildcard, qWildcard, qWildcard]);

      console.log(`  ✓ Search for "${term}" succeeded without DOUBLE error. (Lots found: ${lots.length}, Buildings found: ${buildings.length})`);
    } catch (err) {
      console.error(`  ✗ Search for "${term}" FAILED with error:`, err.message);
      process.exit(1);
    }
  }

  // TEST 2: ID Standardizer and Sequences
  console.log('\n[TEST 2] Testing ID Generation and Standard Formats...');
  try {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    const nextProp = await generatePropertyId(conn);
    const nextLumboLot = await generateLotId(conn, 'Lumbo');
    const nextPobLot = await generateLotId(conn, 'Poblacion');
    const nextLumboBldg = await generateBuildingId(conn, 'Lumbo');
    const nextPobBldg = await generateBuildingId(conn, 'Poblacion');

    await conn.rollback();
    conn.release();

    console.log(`  Generated Property ID: ${nextProp} (Matches PROP_\\d+)`);
    console.log(`  Generated Lumbo Lot ID: ${nextLumboLot} (Matches LOT_L-\\d+)`);
    console.log(`  Generated Poblacion Lot ID: ${nextPobLot} (Matches LOT_P-\\d+)`);
    console.log(`  Generated Lumbo Building ID: ${nextLumboBldg} (Matches BUILDING_L-\\d+)`);
    console.log(`  Generated Poblacion Building ID: ${nextPobBldg} (Matches BUILDING_P-\\d+)`);

    if (!/^PROP_\d+$/.test(nextProp)) throw new Error('Invalid Property ID format');
    if (!/^LOT_L-\d+$/.test(nextLumboLot)) throw new Error('Invalid Lumbo Lot ID format');
    if (!/^LOT_P-\d+$/.test(nextPobLot)) throw new Error('Invalid Poblacion Lot ID format');
    if (!/^BUILDING_L-\d+$/.test(nextLumboBldg)) throw new Error('Invalid Lumbo Building ID format');
    if (!/^BUILDING_P-\d+$/.test(nextPobBldg)) throw new Error('Invalid Poblacion Building ID format');

    console.log('  ✓ All ID formats strictly comply with specification!');
  } catch (err) {
    console.error('  ✗ ID Generation test FAILED:', err.message);
    process.exit(1);
  }

  // TEST 3: Check Existing Database Records
  console.log('\n[TEST 3] Verifying existing migrated database records...');
  try {
    const [sampleLots] = await pool.query('SELECT lot_id, lot_number FROM property_lots LIMIT 5');
    console.log('  Sample Migrated Lots:', sampleLots.map(l => `${l.lot_id}: ${l.lot_number}`).join(', '));

    const [sampleBldgs] = await pool.query('SELECT building_id, building_code, building_name FROM property_buildings LIMIT 5');
    console.log('  Sample Migrated Buildings:', sampleBldgs.map(b => `${b.building_id}: ${b.building_code}`).join(', '));

    const [sampleProps] = await pool.query('SELECT property_id, property_code FROM properties LIMIT 5');
    console.log('  Sample Migrated Properties:', sampleProps.map(p => `${p.property_id}: ${p.property_code}`).join(', '));

    // Check that all property_code, lot_number, and building_code are populated
    const [emptyLotCodes] = await pool.query('SELECT COUNT(*) as cnt FROM property_lots WHERE lot_number IS NULL OR lot_number = ""');
    const [emptyBldgCodes] = await pool.query('SELECT COUNT(*) as cnt FROM property_buildings WHERE building_code IS NULL OR building_code = ""');
    const [emptyPropCodes] = await pool.query('SELECT COUNT(*) as cnt FROM properties WHERE property_code IS NULL OR property_code = ""');

    console.log(`  Lots missing codes: ${emptyLotCodes[0].cnt}`);
    console.log(`  Buildings missing codes: ${emptyBldgCodes[0].cnt}`);
    console.log(`  Properties missing codes: ${emptyPropCodes[0].cnt}`);

    if (emptyLotCodes[0].cnt > 0 || emptyBldgCodes[0].cnt > 0 || emptyPropCodes[0].cnt > 0) {
      throw new Error('Some records are missing standardized codes!');
    }
    console.log('  ✓ All properties, lots, and buildings have valid standardized IDs.');
  } catch (err) {
    console.error('  ✗ Database record check FAILED:', err.message);
    process.exit(1);
  }

  // TEST 4: Unified Assessments & Assignments Queries
  console.log('\n[TEST 4] Verifying assessment queries...');
  try {
    const [assignments] = await pool.query(`
      SELECT a.assignment_id, a.property_type, a.target_id_str, a.assignment_status,
             COALESCE(p.property_code, p_lot.property_code, p_bldg.property_code) AS property_code
      FROM assessment_assignments a
      JOIN users u ON a.assigned_to_user_id = u.user_id
      JOIN users u2 ON a.assigned_by_user_id = u2.user_id
      LEFT JOIN properties p ON (a.property_type = 'property' AND (p.property_id = a.target_id_int OR p.property_code = a.target_id_str OR CAST(p.property_id AS CHAR) = a.target_id_str))
      LEFT JOIN property_lots l ON (a.property_type = 'lot' AND (l.lot_id = a.target_id_int OR l.lot_number = a.target_id_str OR CAST(l.lot_id AS CHAR) = a.target_id_str))
      LEFT JOIN properties p_lot ON l.property_id = p_lot.property_id
      LEFT JOIN property_buildings b ON (a.property_type = 'building' AND (b.building_id = a.target_id_int OR b.building_code = a.target_id_str OR b.building_name = a.target_id_str OR CAST(b.building_id AS CHAR) = a.target_id_str))
      LEFT JOIN properties p_bldg ON b.property_id = p_bldg.property_id
      LIMIT 5
    `);
    console.log(`  ✓ Assessment assignments query succeeded. (Found ${assignments.length} assignments)`);

    const [assessments] = await pool.query(`
      SELECT 
        'lot' AS type, 
        la.lot_assessment_history_id AS assessment_id, 
        la.lot_id AS target_id, 
        l.property_id,
        p.property_code,
        l.lot_number,
        la.assessment_status
      FROM lot_assessment_history la
      JOIN property_lots l ON la.lot_id = l.lot_id
      JOIN properties p ON l.property_id = p.property_id
      LIMIT 5
    `);
    console.log(`  ✓ Lot assessments query succeeded. (Found ${assessments.length} lot assessments)`);
  } catch (err) {
    console.error('  ✗ Assessment query test FAILED:', err.message);
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('========================================');
  process.exit(0);
}

runTests();
