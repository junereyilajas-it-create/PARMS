import { pool } from './backend/config/db.js';

async function update() {
  try {
    await pool.query("ALTER TABLE generated_certificates ADD COLUMN status ENUM('Generated', 'Cancelled') NOT NULL DEFAULT 'Generated' AFTER purpose");
    console.log("Added status column to generated_certificates.");
  } catch(e) {
    console.log(e.message);
  }
  process.exit(0);
}
update();
