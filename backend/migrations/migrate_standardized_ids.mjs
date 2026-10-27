import { pool } from '../config/db.js';

export const BARANGAY_CODES = {
  'lumbo': 'L',
  'poblacion': 'P',
  'banglay': 'B',
  'dampil': 'D',
  'gaston': 'G',
  'kabulawan': 'KB',
  'kauswagan': 'KW',
  'mabini': 'MB',
  'manaol': 'M',
  'tabok': 'T',
  'umagos': 'U',
  'unknown': 'X'
};

export function getBarangayCode(barangayName) {
  if (!barangayName) return 'P';
  const clean = barangayName.trim().toLowerCase();
  for (const [name, code] of Object.entries(BARANGAY_CODES)) {
    if (clean.includes(name)) return code;
  }
  return clean.slice(0, 2).toUpperCase();
}

async function runMigration() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log('1. Creating id_sequences table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS id_sequences (
        sequence_key VARCHAR(50) PRIMARY KEY,
        current_val INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('2. Creating id_migration_history table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS id_migration_history (
        migration_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(30) NOT NULL,
        entity_id INT UNSIGNED NOT NULL,
        old_id VARCHAR(100),
        new_id VARCHAR(100) NOT NULL,
        migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_old_id (old_id),
        INDEX idx_new_id (new_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('3. Ensuring property_code in properties table...');
    const [propCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_code'
    `);
    if (propCols.length === 0) {
      await connection.query(`
        ALTER TABLE properties ADD COLUMN property_code VARCHAR(50) NULL AFTER property_id;
      `);
      console.log('Added property_code column to properties.');
    }

    console.log('4. Ensuring building_code in property_buildings table...');
    const [bldgCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'property_buildings' AND COLUMN_NAME = 'building_code'
    `);
    if (bldgCols.length === 0) {
      await connection.query(`
        ALTER TABLE property_buildings ADD COLUMN building_code VARCHAR(80) NULL AFTER building_id;
      `);
      console.log('Added building_code column to property_buildings.');
    }

    console.log('5. Populating standard property_code (PROP_1, PROP_2...)...');
    const [props] = await connection.query('SELECT property_id, property_code FROM properties ORDER BY property_id ASC');
    let maxPropSeq = 0;
    for (const p of props) {
      const standardPropCode = `PROP_${p.property_id}`;
      maxPropSeq = Math.max(maxPropSeq, p.property_id);
      if (p.property_code !== standardPropCode) {
        await connection.query('UPDATE properties SET property_code = ? WHERE property_id = ?', [standardPropCode, p.property_id]);
        await connection.query(
          'INSERT INTO id_migration_history (entity_type, entity_id, old_id, new_id) VALUES (?, ?, ?, ?)',
          ['property', p.property_id, p.property_code || String(p.property_id), standardPropCode]
        );
      }
    }
    // Add unique index on property_code if not present
    const [propIdx] = await connection.query(`SHOW INDEX FROM properties WHERE Key_name = 'idx_property_code'`);
    if (propIdx.length === 0) {
      await connection.query(`ALTER TABLE properties ADD UNIQUE INDEX idx_property_code (property_code)`);
    }

    await connection.query(`
      INSERT INTO id_sequences (sequence_key, current_val) VALUES ('property', ?)
      ON DUPLICATE KEY UPDATE current_val = GREATEST(current_val, VALUES(current_val))
    `, [maxPropSeq]);

    console.log('6. Standardizing lot numbers (LOT_{Brgy}-{Seq})...');
    const [lots] = await connection.query(`
      SELECT l.lot_id, l.property_id, l.lot_number, b.barangay_name
      FROM property_lots l
      LEFT JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
      ORDER BY l.lot_id ASC
    `);

    // Track sequence per barangay code
    const brgyLotCounters = {
      'L': 474,  // Lumbo starts at 474 (LOT_L-474)
      'P': 317,  // Poblacion starts at 317 (LOT_P-317)
    };

    // First assign fixed IDs from prompt if applicable
    for (const l of lots) {
      const brgyCode = getBarangayCode(l.barangay_name);
      let newLotId = '';

      if (l.lot_id === 23 && brgyCode === 'L') {
        newLotId = 'LOT_L-474';
        brgyLotCounters['L'] = Math.max(brgyLotCounters['L'] || 474, 475);
      } else if (l.lot_id === 3 && brgyCode === 'P') {
        newLotId = 'LOT_P-317';
        brgyLotCounters['P'] = Math.max(brgyLotCounters['P'] || 317, 318);
      } else {
        if (!brgyLotCounters[brgyCode]) {
          brgyLotCounters[brgyCode] = 101;
        }
        const seq = brgyLotCounters[brgyCode]++;
        newLotId = `LOT_${brgyCode}-${seq}`;
      }

      const oldLotNum = l.lot_number;
      if (oldLotNum !== newLotId) {
        await connection.query('UPDATE property_lots SET lot_number = ? WHERE lot_id = ?', [newLotId, l.lot_id]);
        await connection.query(
          'INSERT INTO id_migration_history (entity_type, entity_id, old_id, new_id) VALUES (?, ?, ?, ?)',
          ['lot', l.lot_id, oldLotNum, newLotId]
        );

        // Update references in assessment_assignments
        await connection.query(
          `UPDATE assessment_assignments 
           SET target_id_str = ? 
           WHERE property_type = 'lot' AND (target_id_int = ? OR target_id_str = ?)`,
          [newLotId, l.lot_id, oldLotNum]
        );

        // Update references in assessment_permission_requests
        await connection.query(
          `UPDATE assessment_permission_requests 
           SET target_id_str = ? 
           WHERE property_type = 'lot' AND (target_id_int = ? OR target_id_str = ?)`,
          [newLotId, l.lot_id, oldLotNum]
        );

        // Update references in scanned_blueprints
        if (oldLotNum) {
          await connection.query(
            `UPDATE scanned_blueprints SET lot_number = ? WHERE lot_number = ?`,
            [newLotId, oldLotNum]
          );
        }
      }
    }

    // Save sequences for lots
    for (const [code, nextSeq] of Object.entries(brgyLotCounters)) {
      await connection.query(`
        INSERT INTO id_sequences (sequence_key, current_val) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE current_val = GREATEST(current_val, VALUES(current_val))
      `, [`lot_${code}`, nextSeq - 1]);
    }

    console.log('7. Standardizing building codes (BUILDING_{Brgy}-{1001+Seq})...');
    const [bldgs] = await connection.query(`
      SELECT bg.building_id, bg.property_id, bg.building_name, bg.building_code, b.barangay_name
      FROM property_buildings bg
      LEFT JOIN properties p ON bg.property_id = p.property_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      LEFT JOIN barangays b ON a.barangay_id = b.barangay_id
      ORDER BY bg.building_id ASC
    `);

    const brgyBldgCounters = {};

    for (const bg of bldgs) {
      const brgyCode = getBarangayCode(bg.barangay_name);
      if (!brgyBldgCounters[brgyCode]) {
        brgyBldgCounters[brgyCode] = 1001;
      }
      const seq = brgyBldgCounters[brgyCode]++;
      const newBldgCode = `BUILDING_${brgyCode}-${seq}`;
      const oldBldgRef = bg.building_code || bg.building_name || `BLDG-${bg.building_id}`;

      await connection.query('UPDATE property_buildings SET building_code = ? WHERE building_id = ?', [newBldgCode, bg.building_id]);
      await connection.query(
        'INSERT INTO id_migration_history (entity_type, entity_id, old_id, new_id) VALUES (?, ?, ?, ?)',
        ['building', bg.building_id, oldBldgRef, newBldgCode]
      );

      // Update references in assessment_assignments
      await connection.query(
        `UPDATE assessment_assignments 
         SET target_id_str = ? 
         WHERE property_type = 'building' AND (target_id_int = ? OR target_id_str = ? OR target_id_str = ?)`,
        [newBldgCode, bg.building_id, oldBldgRef, `BLDG-${bg.building_id}`]
      );

      // Update references in assessment_permission_requests
      await connection.query(
        `UPDATE assessment_permission_requests 
         SET target_id_str = ? 
         WHERE property_type = 'building' AND (target_id_int = ? OR target_id_str = ? OR target_id_str = ?)`,
        [newBldgCode, bg.building_id, oldBldgRef, `BLDG-${bg.building_id}`]
      );
    }

    // Add unique index on building_code if not present
    const [bldgIdx] = await connection.query(`SHOW INDEX FROM property_buildings WHERE Key_name = 'idx_building_code'`);
    if (bldgIdx.length === 0) {
      await connection.query(`ALTER TABLE property_buildings ADD UNIQUE INDEX idx_building_code (building_code)`);
    }

    // Save sequences for buildings
    for (const [code, nextSeq] of Object.entries(brgyBldgCounters)) {
      await connection.query(`
        INSERT INTO id_sequences (sequence_key, current_val) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE current_val = GREATEST(current_val, VALUES(current_val))
      `, [`building_${code}`, nextSeq - 1]);
    }

    await connection.commit();
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    connection.release();
  }
}

runMigration();
