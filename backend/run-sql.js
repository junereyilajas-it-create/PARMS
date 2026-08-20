import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  const sql = fs.readFileSync('./database.sql', 'utf8');
  await connection.query(sql);
  console.log('Database reset successfully.');
  await connection.end();
}

run().catch(console.error);
