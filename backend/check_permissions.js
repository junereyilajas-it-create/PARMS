import mysql from 'mysql2/promise';

async function run() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'property_management_db'
    });
    
    const [u] = await connection.query("DESCRIBE users");
    console.log("users:", u);
    
    connection.end();
}
run();
