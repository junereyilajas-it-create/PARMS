import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function createPropertyPhotosTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'property_management_db'
  });

  try {
    console.log('Creating property_photos table if it does not exist...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS property_photos (
        photo_id INT AUTO_INCREMENT PRIMARY KEY,
        property_id INT NOT NULL,
        lot_id INT NULL,
        building_id INT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) NULL,
        file_size INT NULL,
        mime_type VARCHAR(100) NULL,
        is_primary TINYINT(1) DEFAULT 0,
        caption VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_photos_property_id (property_id),
        INDEX idx_photos_lot_id (lot_id),
        INDEX idx_photos_building_id (building_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('property_photos table checked/created.');

    // Backfill any existing single photo records from properties table
    const [existingProps] = await connection.query(`
      SELECT property_id, property_photo FROM properties 
      WHERE property_photo IS NOT NULL AND property_photo != ''
    `);

    for (const p of existingProps) {
      const [alreadyMigrated] = await connection.query(
        'SELECT photo_id FROM property_photos WHERE property_id = ? AND file_path = ?',
        [p.property_id, p.property_photo]
      );
      if (alreadyMigrated.length === 0) {
        // Find lot_id or building_id if exists
        const [lots] = await connection.query('SELECT lot_id FROM property_lots WHERE property_id = ? LIMIT 1', [p.property_id]);
        const [bldgs] = await connection.query('SELECT building_id FROM property_buildings WHERE property_id = ? LIMIT 1', [p.property_id]);
        const lotId = lots.length > 0 ? lots[0].lot_id : null;
        const bldgId = bldgs.length > 0 ? bldgs[0].building_id : null;
        const filename = path.basename(p.property_photo);

        await connection.query(`
          INSERT INTO property_photos (property_id, lot_id, building_id, file_path, file_name, is_primary)
          VALUES (?, ?, ?, ?, ?, 1)
        `, [p.property_id, lotId, bldgId, p.property_photo, filename]);
        console.log(`Backfilled existing photo for Property #${p.property_id}`);
      }
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

createPropertyPhotosTable();
