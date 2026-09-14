import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: __dirname + '/../.env' });

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'property_management_db'
  });

  const connection = await pool.getConnection();
  
  try {
    console.log("Starting migration...");
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    console.log("Foreign key checks disabled.");

    // Define tables and foreign keys referencing property_id and building_id
    const fkDrops = [
      'ALTER TABLE property_lots DROP FOREIGN KEY fk_lots_property;',
      'ALTER TABLE property_buildings DROP FOREIGN KEY fk_buildings_property;',
      'ALTER TABLE property_assessments DROP FOREIGN KEY fk_assessments_property;',
      'ALTER TABLE tax_declarations DROP FOREIGN KEY fk_declarations_property;',
      'ALTER TABLE gis_locations DROP FOREIGN KEY fk_gis_property;',
      'ALTER TABLE property_history DROP FOREIGN KEY fk_property_history_property;',
      'ALTER TABLE certificate_requests DROP FOREIGN KEY fk_cert_req_property;',
      'ALTER TABLE issued_certificates DROP FOREIGN KEY issued_certificates_ibfk_1;', // We might need to query the actual FK names if they differ
      'ALTER TABLE ownership_transfers DROP FOREIGN KEY ownership_transfers_ibfk_1;',
      'ALTER TABLE property_inspections DROP FOREIGN KEY property_inspections_ibfk_1;',
      'ALTER TABLE assessment_appeals DROP FOREIGN KEY assessment_appeals_ibfk_1;',
      'ALTER TABLE certified_copy_issuances DROP FOREIGN KEY certified_copy_issuances_ibfk_1;',
      'ALTER TABLE building_assessment_history DROP FOREIGN KEY fk_building_assess_building;',
      'ALTER TABLE building_history DROP FOREIGN KEY fk_building_history_building;'
    ];
    
    // Fallback approach: just drop all foreign keys safely by querying information_schema
    const [fks] = await connection.query(`
      SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'property_management_db' 
      AND REFERENCED_TABLE_NAME IN ('properties', 'property_buildings');
    `);
    
    for (let fk of fks) {
      console.log(`Dropping FK ${fk.CONSTRAINT_NAME} from ${fk.TABLE_NAME}`);
      await connection.query(`ALTER TABLE ${fk.TABLE_NAME} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME};`);
    }

    // Now alter the column types
    const propertyTables = [
      'properties', 'property_lots', 'property_buildings', 'property_assessments', 
      'tax_declarations', 'gis_locations', 'property_history', 'certificate_requests', 
      'generated_certificates', 'ownership_transfers', 'property_inspections', 
      'assessment_appeals', 'certified_copy_issuances'
    ];
    
    for (let table of propertyTables) {
      console.log(`Altering property_id in ${table}`);
      // Drop default / auto_increment first if it's the primary key
      if (table === 'properties') {
        await connection.query(`ALTER TABLE properties MODIFY property_id VARCHAR(30) NOT NULL;`);
      } else {
        await connection.query(`ALTER TABLE ${table} MODIFY property_id VARCHAR(30);`);
      }
    }

    const buildingTables = ['property_buildings', 'building_assessment_history', 'building_history'];
    for (let table of buildingTables) {
      console.log(`Altering building_id in ${table}`);
      if (table === 'property_buildings') {
        await connection.query(`ALTER TABLE property_buildings MODIFY building_id VARCHAR(30) NOT NULL;`);
      } else {
        await connection.query(`ALTER TABLE ${table} MODIFY building_id VARCHAR(30);`);
      }
    }

    console.log("Column types updated. Now updating data...");

    // Get all properties to map old IDs to new IDs
    const [properties] = await connection.query(`
      SELECT p.property_id, a.street 
      FROM properties p 
      JOIN addresses a ON p.address_id = a.address_id 
      ORDER BY p.property_id ASC
    `);

    let purokCounts = {};
    let propertyIdMap = {};

    for (let prop of properties) {
      // Parse purok
      let purok = 'P0';
      const purokMatch = prop.street && prop.street.match(/Purok\s*(\d+)/i);
      if (purokMatch) {
        purok = `P${purokMatch[1]}`;
      } else {
        // Fallback for "Kabulawan St" or others - let's use a dummy default like PX or just map to 1 if we can't find it
        purok = 'PX'; 
      }

      if (!purokCounts[purok]) purokCounts[purok] = 1;
      else purokCounts[purok]++;

      const seq = purokCounts[purok];
      const newPropId = `LP-${purok}-A${seq}`;
      propertyIdMap[prop.property_id] = newPropId;

      console.log(`Mapping Property ${prop.property_id} -> ${newPropId}`);
    }

    // Now update properties and all related tables backwards
    // We must update foreign keys BEFORE the referenced primary key if we aren't cascading, 
    // but FK checks are disabled, so order doesn't strictly matter for constraints, 
    // but doing properties first is fine.
    
    // Update properties
    for (const [oldId, newId] of Object.entries(propertyIdMap)) {
      await connection.query(`UPDATE properties SET property_id = ? WHERE property_id = ?`, [newId, oldId]);
      // Update all related tables
      for (let table of propertyTables) {
        if (table !== 'properties') {
          await connection.query(`UPDATE ${table} SET property_id = ? WHERE property_id = ?`, [newId, oldId]);
        }
      }
    }

    // Now buildings
    const [buildings] = await connection.query(`
      SELECT b.building_id, p.property_id 
      FROM property_buildings b
      JOIN properties p ON b.property_id = p.property_id
      ORDER BY b.building_id ASC
    `);

    let bldgPurokCounts = {};
    let buildingIdMap = {};

    for (let bldg of buildings) {
      // the property_id here is already the new one like LP-P5-A1 because we updated property_buildings!
      // Wait, the select is joining on p.property_id. Yes, they match.
      const newPropId = bldg.property_id; // "LP-P5-A1"
      let purok = 'PX';
      const match = newPropId.match(/LP-(P\d+|PX)-A\d+/);
      if (match) purok = match[1];

      if (!bldgPurokCounts[purok]) bldgPurokCounts[purok] = 1;
      else bldgPurokCounts[purok]++;

      const seq = bldgPurokCounts[purok];
      const newBldgId = `LBP-${purok}-A${seq}`;
      buildingIdMap[bldg.building_id] = newBldgId;
      
      console.log(`Mapping Building ${bldg.building_id} -> ${newBldgId}`);
    }

    for (const [oldId, newId] of Object.entries(buildingIdMap)) {
      await connection.query(`UPDATE property_buildings SET building_id = ? WHERE building_id = ?`, [newId, oldId]);
      for (let table of buildingTables) {
        if (table !== 'property_buildings') {
          await connection.query(`UPDATE ${table} SET building_id = ? WHERE building_id = ?`, [newId, oldId]);
        }
      }
    }

    console.log("Re-establishing Foreign Keys...");
    // Recreate the foreign keys
    for (let fk of fks) {
      console.log(`Re-adding FK ${fk.CONSTRAINT_NAME} to ${fk.TABLE_NAME}`);
      // Assuming ON DELETE RESTRICT ON UPDATE CASCADE for safety
      await connection.query(`
        ALTER TABLE ${fk.TABLE_NAME} 
        ADD CONSTRAINT ${fk.CONSTRAINT_NAME} 
        FOREIGN KEY (${fk.COLUMN_NAME}) 
        REFERENCES ${fk.REFERENCED_TABLE_NAME}(${fk.COLUMN_NAME})
        ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log("Migration complete!");
    
  } catch (err) {
    console.error("Migration failed:", err);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
  } finally {
    connection.release();
    pool.end();
  }
}

migrate();
