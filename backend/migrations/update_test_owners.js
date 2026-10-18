import { pool } from '../config/db.js';

async function updateTestOwners() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Add suffix column to property_owners if it does not exist
    const [cols] = await connection.query("SHOW COLUMNS FROM property_owners LIKE 'suffix'");
    if (cols.length === 0) {
      await connection.query("ALTER TABLE property_owners ADD COLUMN suffix VARCHAR(30) NULL AFTER last_name");
      console.log('Added suffix column to property_owners.');
    }

    // 2. Update owner_id: 1 (formerly "Test Owner") -> "Roberto M. Santos"
    const [res1] = await connection.query(
      `UPDATE property_owners 
       SET first_name = 'Roberto', 
           middle_name = 'M.', 
           last_name = 'Santos', 
           suffix = NULL,
           contact_number = '0917-555-0192', 
           email = 'roberto.santos@parms.gov.ph' 
       WHERE owner_id = 1`,
    );
    console.log(`Updated owner #1: ${res1.affectedRows} row(s) updated.`);

    // Ensure owner #1 has an address record in owner_addresses
    const [oa1] = await connection.query('SELECT owner_address_id FROM owner_addresses WHERE owner_id = 1');
    if (oa1.length === 0) {
      // Find Poblacion barangay id in Lagonglong
      const [brgyRows] = await connection.query(
        "SELECT barangay_id FROM barangays WHERE barangay_name = 'Poblacion' AND municipality_id = 1 LIMIT 1"
      );
      const brgyId = brgyRows.length > 0 ? brgyRows[0].barangay_id : 1;
      const [addrRes] = await connection.query(
        "INSERT INTO addresses (street, barangay_id, postal_code) VALUES ('Purok 2, Rizal St.', ?, '9005')",
        [brgyId]
      );
      await connection.query(
        "INSERT INTO owner_addresses (owner_id, address_id) VALUES (1, ?)",
        [addrRes.insertId]
      );
      console.log('Created owner address for owner #1 in Poblacion, Lagonglong.');
    }

    // 3. Update owner_id: 26 (formerly "Karl Test") -> "Karl J. Reyes"
    const [res26] = await connection.query(
      `UPDATE property_owners 
       SET first_name = 'Karl', 
           middle_name = 'J.', 
           last_name = 'Reyes', 
           suffix = NULL,
           contact_number = '0918-555-0284', 
           email = 'karl@municipality.gov' 
       WHERE owner_id = 26`,
    );
    console.log(`Updated owner #26: ${res26.affectedRows} row(s) updated.`);

    // Update user #13 (username 'karl') display name to Karl Reyes
    await connection.query(
      "UPDATE users SET first_name = 'Karl', last_name = 'Reyes' WHERE user_id = 13 OR username = 'karl'"
    );
    console.log('Updated user karl display name to Karl Reyes.');

    // 4. Enrich demo owners with middle initials if they lack one
    const demoMiddleNames = [
      { id: 2, middle: 'P.' },
      { id: 3, middle: 'L.' },
      { id: 4, middle: 'M.' },
      { id: 5, middle: 'G.' },
      { id: 6, middle: 'S.' },
      { id: 7, middle: 'D.' },
      { id: 8, middle: 'C.' },
      { id: 9, middle: 'R.' },
      { id: 10, middle: 'C.' },
      { id: 11, middle: 'A.' },
    ];
    for (const d of demoMiddleNames) {
      await connection.query(
        "UPDATE property_owners SET middle_name = ? WHERE owner_id = ? AND (middle_name IS NULL OR middle_name = '')",
        [d.middle, d.id]
      );
    }
    console.log('Enriched demo owners 2-11 with middle initials.');

    await connection.commit();
    console.log('Database migration completed successfully.');
  } catch (err) {
    await connection.rollback();
    console.error('Migration failed:', err);
    throw err;
  } finally {
    connection.release();
    await pool.end();
  }
}

updateTestOwners();
