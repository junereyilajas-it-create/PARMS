import fs from 'fs'
import { pool } from './config/db.js'

async function run() {
  const sql = fs.readFileSync('migrations/01_add_structure_columns.sql', 'utf8')
  try {
    await pool.query(sql)
    console.log('Migration successful')
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist')
    } else {
      console.error(err)
    }
  } finally {
    process.exit(0)
  }
}
run()
