import mysql from 'mysql2/promise'; 
async function run() { 
  const c = await mysql.createConnection({ user: 'root', database: 'property_management_db' }); 
  const [pa] = await c.query('DESCRIBE property_assessments'); 
  const [la] = await c.query('DESCRIBE lot_assessment_history'); 
  const [ba] = await c.query('DESCRIBE building_assessment_history'); 
  const [al] = await c.query('DESCRIBE activity_logs'); 
  const [rh] = await c.query('SHOW TABLES LIKE "report_history"'); 
  console.log('pa:', pa.map(r=>r.Field)); 
  console.log('la:', la.map(r=>r.Field)); 
  console.log('ba:', ba.map(r=>r.Field)); 
  console.log('al:', al.map(r=>r.Field)); 
  console.log('rh:', rh.length > 0); 
  process.exit(0); 
} 
run();
