import { pool } from './config/db.js';

async function migrateLots() {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Find all tables that reference lot_id
    const [fks] = await connection.query(`
      SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE REFERENCED_TABLE_NAME = 'property_lots' 
      AND REFERENCED_COLUMN_NAME = 'lot_id' 
      AND TABLE_SCHEMA = 'property_management_db'
    `);
    
    // Drop foreign keys
    for (const fk of fks) {
      console.log(`Dropping FK ${fk.CONSTRAINT_NAME} from ${fk.TABLE_NAME}...`);
      await connection.query(`ALTER TABLE ${fk.TABLE_NAME} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
      
      // Update the column type to VARCHAR(30)
      console.log(`Updating column ${fk.COLUMN_NAME} in ${fk.TABLE_NAME}...`);
      await connection.query(`ALTER TABLE ${fk.TABLE_NAME} MODIFY ${fk.COLUMN_NAME} VARCHAR(30)`);
    }
    
    // Drop PK on property_lots and update type
    console.log('Updating property_lots lot_id to VARCHAR(30)...');
    
    // Check if lot_id is auto_increment, if so, we need to modify it first without auto_increment
    await connection.query(`ALTER TABLE property_lots MODIFY lot_id INT UNSIGNED NOT NULL`);
    await connection.query(`ALTER TABLE property_lots MODIFY lot_id VARCHAR(30) NOT NULL`);
    
    // Restore foreign keys
    for (const fk of fks) {
      console.log(`Restoring FK ${fk.CONSTRAINT_NAME} on ${fk.TABLE_NAME}...`);
      await connection.query(`ALTER TABLE ${fk.TABLE_NAME} ADD CONSTRAINT ${fk.CONSTRAINT_NAME} FOREIGN KEY (${fk.COLUMN_NAME}) REFERENCES property_lots(lot_id) ON DELETE CASCADE`);
    }

    // Now, we need to generate new string IDs for the existing lots.
    const [lots] = await connection.query(`
      SELECT l.lot_id, l.property_id, p.address_id, a.street 
      FROM property_lots l
      JOIN properties p ON p.property_id = l.property_id
      JOIN addresses a ON p.address_id = a.address_id
    `);

    let updates = 0;
    for (const lot of lots) {
      const purok = lot.street && lot.street.toLowerCase().includes('purok') 
        ? 'P' + lot.street.toLowerCase().replace('purok', '').trim()
        : 'P0';
        
      const newLotId = `LP-${purok}-L${lot.lot_id}`;
      
      await connection.query('UPDATE property_lots SET lot_id = ? WHERE lot_id = ?', [newLotId, lot.lot_id]);
      
      // Update foreign keys that were using the old ID
      for (const fk of fks) {
        await connection.query(`UPDATE ${fk.TABLE_NAME} SET ${fk.COLUMN_NAME} = ? WHERE ${fk.COLUMN_NAME} = ?`, [newLotId, lot.lot_id]);
      }
      
      updates++;
    }
    
    console.log(`Successfully migrated lot_id for ${updates} lots.`);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrateLots();
