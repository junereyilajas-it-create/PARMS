const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seed() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'property_management_db',
    port: process.env.DB_PORT || 3306,
  });

  const users = [
    { first_name: 'Junerey D.', last_name: 'Ilajas', username: 'junerey', email: 'junerey@example.com', password: 'junerey123', role: 'admin' },
    { first_name: 'Karl John', last_name: 'Reyes', username: 'karl', email: 'karl@example.com', password: 'karl123', role: 'super_admin' },
    { first_name: 'Christine Rose', last_name: 'Pahis', username: 'christine', email: 'christine@example.com', password: 'christine123', role: 'staff' },
    { first_name: 'Randrei John', last_name: 'Llacuna', username: 'randrei', email: 'randrei@example.com', password: 'randrei123', role: 'staff' },
    { first_name: 'Maria L.', last_name: 'Santos', username: 'maria', email: 'maria@example.com', password: 'maria123', role: 'assessor' },
    { first_name: 'Jose P.', last_name: 'Dela Cruz', username: 'jose', email: 'jose@example.com', password: 'jose123', role: 'assessor' },
    { first_name: 'Angela M.', last_name: 'Garcia', username: 'angela', email: 'angela@example.com', password: 'angela123', role: 'assessor' },
    { first_name: 'Kent A.', last_name: 'Mendoza', username: 'kent', email: 'kent@example.com', password: 'kent123', role: 'client' },
    { first_name: 'Balong R.', last_name: 'Flores', username: 'balong', email: 'balong@example.com', password: 'balong123', role: 'client' },
    { first_name: 'Buknoy T.', last_name: 'Ramos', username: 'buknoy', email: 'buknoy@example.com', password: 'buknoy123', role: 'client' },
    { first_name: 'Daniel C.', last_name: 'Cruz', username: 'daniel', email: 'daniel@example.com', password: 'daniel123', role: 'client' },
    { first_name: 'Sofia M.', last_name: 'Garcia', username: 'sofia', email: 'sofia@example.com', password: 'sofia123', role: 'client' },
    { first_name: 'Mark J.', last_name: 'Villanueva', username: 'mark', email: 'mark@example.com', password: 'mark123', role: 'client' },
    { first_name: 'Liza P.', last_name: 'Torres', username: 'liza', email: 'liza@example.com', password: 'liza123', role: 'client' },
    { first_name: 'Anthony B.', last_name: 'Ramos', username: 'anthony', email: 'anthony@example.com', password: 'anthony123', role: 'client' }
  ];

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);
    
    let owner_id = null;
    if (user.role === 'client') {
      const [res] = await pool.query('SELECT owner_id FROM property_owners WHERE email = ?', [user.email]);
      if (res.length > 0) owner_id = res[0].owner_id;
      else {
        const [insert] = await pool.query('INSERT INTO property_owners (first_name, last_name, email) VALUES (?, ?, ?)', [user.first_name, user.last_name, user.email]);
        owner_id = insert.insertId;
      }
    }

    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ? OR email = ?', [user.username, user.email]);
    if (existing.length > 0) {
      await pool.query('UPDATE users SET password_hash = ?, role = ?, first_name = ?, last_name = ?, email = ?, owner_id = ? WHERE user_id = ?', 
        [hash, user.role, user.first_name, user.last_name, user.email, owner_id, existing[0].user_id]);
      console.log('Updated user:', user.username);
    } else {
      await pool.query('INSERT INTO users (first_name, last_name, username, email, password_hash, role, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.first_name, user.last_name, user.username, user.email, hash, user.role, owner_id]);
      console.log('Inserted user:', user.username);
    }
  }
  
  console.log('Successfully seeded 15 users!');
  process.exit(0);
}

seed().catch(console.error);
