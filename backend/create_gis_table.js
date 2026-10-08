import { pool } from './config/db.js';

async function main() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gis_locations (
        gis_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        property_id INT UNSIGNED NOT NULL,
        lot_id INT UNSIGNED DEFAULT NULL,
        building_id INT UNSIGNED DEFAULT NULL,
        geometry_type VARCHAR(50) DEFAULT 'Polygon',
        coordinates JSON NOT NULL,
        area_sqm DECIMAL(12,2) DEFAULT NULL,
        perimeter_m DECIMAL(12,2) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
        FOREIGN KEY (lot_id) REFERENCES property_lots(lot_id) ON DELETE CASCADE,
        FOREIGN KEY (building_id) REFERENCES property_buildings(building_id) ON DELETE CASCADE
      )
    `);
    console.log("Created gis_locations table.");
  } catch(e) {
    console.error("Error creating gis_locations:", e);
  }
  pool.end();
}
main();
