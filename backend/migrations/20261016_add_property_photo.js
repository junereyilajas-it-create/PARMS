import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function addPropertyPhotoColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'property_management_db'
  });

  try {
    console.log('Checking and adding property_photo columns...');
    const tables = ['properties', 'property_lots', 'property_buildings'];

    for (const table of tables) {
      const [cols] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE 'property_photo'`);
      if (cols.length === 0) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN property_photo VARCHAR(255) NULL DEFAULT NULL`);
        console.log(`Added property_photo column to ${table}.`);
      } else {
        console.log(`Column property_photo already exists on ${table}.`);
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

addPropertyPhotoColumns();
