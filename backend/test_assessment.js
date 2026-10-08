import { pool } from './config/db.js';

async function main() {
  try {
    const type = 'property';
    const table = 'property_assessments';
    const idColumn = 'property_id';
    const target_id = 1;
    
    await pool.query(
      `INSERT INTO ${table} 
       (${idColumn}, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date, remarks, assessment_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [target_id, 1, 20.00, 100000, 50000, '2026-09-28', 'Test']
    );
    console.log("Success");
  } catch(e) {
    console.error(e);
  }
  pool.end();
}
main();
