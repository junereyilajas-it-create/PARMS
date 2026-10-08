import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'property_management_db'
  });
  
  const passwordHash = await bcrypt.hash('junerey123', 10);
  
  const [existing] = await conn.query('SELECT * FROM users WHERE username = "junerey"');
  if (existing.length > 0) {
    console.log('User already exists, updating...');
    await conn.query(
      'UPDATE users SET first_name = "Junerey D.", last_name = "Ilajas", email = "junerey@example.com", password_hash = ?, role = "admin", status = "active" WHERE username = "junerey"',
      [passwordHash]
    );
  } else {
    console.log('Inserting Junerey...');
    await conn.query(
      'INSERT INTO users (first_name, last_name, username, email, password_hash, role, status) VALUES ("Junerey D.", "Ilajas", "junerey", "junerey@example.com", ?, "admin", "active")',
      [passwordHash]
    );
  }
  
  console.log('Done.');
  await conn.end();
}

run().catch(console.error);
