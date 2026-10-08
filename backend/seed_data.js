import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'property_management_db'
  });

  try {
    await conn.beginTransaction();

    // 1. Ensure Lookup Data Exists
    const [provRes] = await conn.query('INSERT IGNORE INTO provinces (province_name) VALUES ("Misamis Oriental")');
    const [[{ province_id }]] = await conn.query('SELECT province_id FROM provinces WHERE province_name = "Misamis Oriental"');

    const [munRes] = await conn.query('INSERT IGNORE INTO municipalities (province_id, municipality_name) VALUES (?, "Lagonglong")', [province_id]);
    const [[{ municipality_id }]] = await conn.query('SELECT municipality_id FROM municipalities WHERE municipality_name = "Lagonglong"');

    const barangays = ['Poblacion', 'Kauswagan', 'Gaston', 'Tabok', 'Mabini'];
    for (const b of barangays) {
      await conn.query('INSERT IGNORE INTO barangays (municipality_id, barangay_name) VALUES (?, ?)', [municipality_id, b]);
    }
    const [brgys] = await conn.query('SELECT barangay_id FROM barangays WHERE municipality_id = ?', [municipality_id]);
    
    await conn.query('INSERT IGNORE INTO property_types (property_type_name) VALUES ("LOT"), ("BUILDING")');
    const [[{ type_lot }]] = await conn.query('SELECT property_type_id AS type_lot FROM property_types WHERE property_type_name = "LOT"');
    const [[{ type_bldg }]] = await conn.query('SELECT property_type_id AS type_bldg FROM property_types WHERE property_type_name = "BUILDING"');

    await conn.query('INSERT IGNORE INTO property_classifications (classification_name) VALUES ("Residential"), ("Commercial"), ("Agricultural")');
    const [classes] = await conn.query('SELECT classification_id FROM property_classifications');
    const classIds = classes.map(c => c.classification_id);

    // 2. Ensure Users Exist
    const usersToSeed = [
      { first: 'Karl John', last: 'Reyes', user: 'karl', email: 'karl@example.com', pass: 'karl123', role: 'super_admin' },
      { first: 'Maria L.', last: 'Santos', user: 'maria', email: 'maria@example.com', pass: 'maria123', role: 'assessor' },
      { first: 'Jose P.', last: 'Dela Cruz', user: 'jose', email: 'jose@example.com', pass: 'jose123', role: 'assessor' },
      { first: 'Christine Rose', last: 'Pahis', user: 'christine', email: 'christine@example.com', pass: 'christine123', role: 'staff' },
      { first: 'Randrei John', last: 'Llacuna', user: 'randrei', email: 'randrei@example.com', pass: 'randrei123', role: 'staff' },
      { first: 'Angela M.', last: 'Garcia', user: 'angela', email: 'angela@example.com', pass: 'angela123', role: 'staff' }
    ];

    let assessorId = null;

    for (const u of usersToSeed) {
      const hash = await bcrypt.hash(u.pass, 10);
      const [existing] = await conn.query('SELECT user_id FROM users WHERE username = ?', [u.user]);
      if (existing.length > 0) {
        await conn.query('UPDATE users SET first_name=?, last_name=?, email=?, password_hash=?, role=?, status="active" WHERE username=?', [u.first, u.last, u.email, hash, u.role, u.user]);
        if (u.role === 'assessor' && !assessorId) assessorId = existing[0].user_id;
      } else {
        const [res] = await conn.query('INSERT INTO users (first_name, last_name, username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, "active")', [u.first, u.last, u.user, u.email, hash, u.role]);
        if (u.role === 'assessor' && !assessorId) assessorId = res.insertId;
      }
    }

    // 3. Ensure a Property Owner exists
    const [owners] = await conn.query('SELECT owner_id FROM property_owners LIMIT 1');
    let ownerId;
    if (owners.length === 0) {
      const [res] = await conn.query('INSERT INTO property_owners (first_name, last_name) VALUES ("Test", "Owner")');
      ownerId = res.insertId;
    } else {
      ownerId = owners[0].owner_id;
    }

    // 4. Create 30 Properties (15 Lots, 15 Buildings)
    let lotsAdded = 0;
    let bldgsAdded = 0;
    let lotsAssessed = 0;
    let bldgsAssessed = 0;

    for (let i = 1; i <= 30; i++) {
      const isLot = i <= 15;
      const typeId = isLot ? type_lot : type_bldg;
      const classId = classIds[i % classIds.length];
      const brgyId = brgys[i % brgys.length].barangay_id;

      const [addrRes] = await conn.query('INSERT INTO addresses (barangay_id, street) VALUES (?, ?)', [brgyId, 'Street ' + i]);
      const addressId = addrRes.insertId;

      const [propRes] = await conn.query('INSERT INTO properties (owner_id, address_id, property_type_id, classification_id) VALUES (?, ?, ?, ?)', [ownerId, addressId, typeId, classId]);
      const propertyId = propRes.insertId;

      if (isLot) {
        const lotNumber = 'LOT-T-' + Date.now() + '-' + i;
        const [lotRes] = await conn.query('INSERT INTO property_lots (property_id, lot_number, lot_area) VALUES (?, ?, ?)', [propertyId, lotNumber, 150 + i * 10]);
        const lotId = lotRes.insertId;
        lotsAdded++;

        if (lotsAssessed < 10) {
          await conn.query('INSERT INTO lot_assessment_history (lot_id, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date, assessment_status) VALUES (?, ?, ?, ?, ?, CURDATE(), "approved")', [lotId, assessorId, 20.00, 500000 + i*10000, 100000 + i*2000]);
          lotsAssessed++;
        }
      } else {
        const bldgName = 'BLDG-T-' + Date.now() + '-' + i;
        const [bldgRes] = await conn.query('INSERT INTO property_buildings (property_id, building_name, floor_area, floor_count) VALUES (?, ?, ?, ?)', [propertyId, bldgName, 100 + i * 5, 2]);
        const bldgId = bldgRes.insertId;
        bldgsAdded++;

        if (bldgsAssessed < 10) {
          await conn.query('INSERT INTO building_assessment_history (building_id, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date, assessment_status) VALUES (?, ?, ?, ?, ?, CURDATE(), "approved")', [bldgId, assessorId, 30.00, 1500000 + i*20000, 300000 + i*4000]);
          bldgsAssessed++;
        }
      }
    }

    await conn.commit();
    console.log('Seeding successful!');
    console.log(`Users seeded.`);
    console.log(`Lots added: ${lotsAdded}`);
    console.log(`Buildings added: ${bldgsAdded}`);
    console.log(`Lots assessed: ${lotsAssessed}`);
    console.log(`Buildings assessed: ${bldgsAssessed}`);

  } catch (err) {
    await conn.rollback();
    console.error('Seeding failed:', err);
  } finally {
    await conn.end();
  }
}

run();
