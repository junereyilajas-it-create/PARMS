import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'property_management_db'
  });
  
  const [res] = await conn.query('SELECT * FROM users WHERE username = "junerey"');
  console.table(res);
  
  await conn.end();
}

run().catch(console.error);
