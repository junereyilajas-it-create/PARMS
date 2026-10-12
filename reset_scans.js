import { pool } from './backend/config/db.js';
(async () => {
  await pool.query("UPDATE scanned_blueprints SET status = 'rejected', rejection_reason = 'Server restarted' WHERE status = 'processing'");
  console.log('Done');
  process.exit(0);
})();
