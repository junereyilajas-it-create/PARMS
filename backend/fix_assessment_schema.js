import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'property_management_db',
    multipleStatements: true
  });

  try {
    const queries = [
      `ALTER TABLE property_assessments
       ADD COLUMN assessment_status ENUM('draft', 'submitted', 'approved', 'returned', 'rejected') DEFAULT 'draft',
       ADD COLUMN head_assessor_id INT UNSIGNED NULL,
       ADD COLUMN approval_date DATETIME NULL,
       ADD COLUMN rejection_reason TEXT NULL,
       ADD CONSTRAINT fk_pa_head_assessor FOREIGN KEY (head_assessor_id) REFERENCES users(user_id);`,
       
      `ALTER TABLE lot_assessment_history
       ADD COLUMN assessment_status ENUM('draft', 'submitted', 'approved', 'returned', 'rejected') DEFAULT 'draft',
       ADD COLUMN head_assessor_id INT UNSIGNED NULL,
       ADD COLUMN approval_date DATETIME NULL,
       ADD COLUMN rejection_reason TEXT NULL,
       ADD CONSTRAINT fk_lah_head_assessor FOREIGN KEY (head_assessor_id) REFERENCES users(user_id);`,

      `ALTER TABLE building_assessment_history
       ADD COLUMN assessment_status ENUM('draft', 'submitted', 'approved', 'returned', 'rejected') DEFAULT 'draft',
       ADD COLUMN head_assessor_id INT UNSIGNED NULL,
       ADD COLUMN approval_date DATETIME NULL,
       ADD COLUMN rejection_reason TEXT NULL,
       ADD CONSTRAINT fk_bah_head_assessor FOREIGN KEY (head_assessor_id) REFERENCES users(user_id);`
    ];

    for (let q of queries) {
      try {
        await connection.query(q);
        console.log('Executed:', q.split('\\n')[0]);
      } catch(e) {
        if(e.code === 'ER_DUP_FIELDNAME') {
           console.log('Columns already exist.');
        } else {
           console.error('Error executing query:', e.message);
        }
      }
    }

    console.log('Schema update complete.');
  } finally {
    await connection.end();
  }
}

run().catch(console.error);
