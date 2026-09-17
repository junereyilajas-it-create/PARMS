import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'property_management_db',
    multipleStatements: true
  });

  const sql = `
    DROP TABLE IF EXISTS gis_locations;
    CREATE TABLE gis_locations (
      gis_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      property_id VARCHAR(80) NOT NULL,
      lot_id VARCHAR(80) NULL,
      building_id VARCHAR(80) NULL,
      geometry_type VARCHAR(50) NOT NULL DEFAULT 'Polygon',
      coordinates JSON NOT NULL,
      area_sqm DECIMAL(15,2),
      perimeter_m DECIMAL(15,2),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_gis_prop FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
      CONSTRAINT fk_gis_lot FOREIGN KEY (lot_id) REFERENCES property_lots(lot_id) ON DELETE CASCADE,
      CONSTRAINT fk_gis_bldg FOREIGN KEY (building_id) REFERENCES property_buildings(building_id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `;
  await connection.query(sql);
  console.log('GIS table migrated successfully.');
  await connection.end();
}

run().catch(console.error);
