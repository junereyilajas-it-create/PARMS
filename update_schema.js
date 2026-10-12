import { pool } from './backend/config/db.js';

async function update() {
  try {
    await pool.query("ALTER TABLE scanned_blueprints ADD COLUMN owner_name VARCHAR(255) NULL AFTER status");
    console.log("Added owner_name column.");
  } catch(e) {
    console.log(e.message);
  }
  process.exit(0);
}
update();
