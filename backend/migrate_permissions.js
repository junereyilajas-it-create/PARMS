import mysql from 'mysql2/promise';

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'property_management_db'
    });

    try {
        await connection.beginTransaction();

        // Create Permissions Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                permission_name VARCHAR(100) PRIMARY KEY,
                description VARCHAR(255),
                category VARCHAR(50)
            )
        `);

        // Create Role Permissions Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                role ENUM('super_admin','admin','assessor','staff','client'),
                permission_name VARCHAR(100),
                PRIMARY KEY (role, permission_name),
                FOREIGN KEY (permission_name) REFERENCES permissions(permission_name) ON DELETE CASCADE
            )
        `);

        // Create User Permissions Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id INT UNSIGNED,
                permission_name VARCHAR(100),
                PRIMARY KEY (user_id, permission_name),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (permission_name) REFERENCES permissions(permission_name) ON DELETE CASCADE
            )
        `);

        // Insert Default Permissions
        const perms = [
            // LOTS
            ['VIEW_LOT', 'View lots', 'Lots'],
            ['CREATE_LOT', 'Create lots', 'Lots'],
            ['EDIT_LOT', 'Edit lots', 'Lots'],
            ['MANAGE_LOT', 'Manage lots', 'Lots'],
            ['DELETE_LOT', 'Delete lots', 'Lots'],
            ['APPROVE_LOT', 'Approve lots', 'Lots'],
            // BUILDINGS
            ['VIEW_BUILDING', 'View buildings', 'Buildings'],
            ['CREATE_BUILDING', 'Create buildings', 'Buildings'],
            ['EDIT_BUILDING', 'Edit buildings', 'Buildings'],
            ['MANAGE_BUILDING', 'Manage buildings', 'Buildings'],
            ['DELETE_BUILDING', 'Delete buildings', 'Buildings'],
            ['APPROVE_BUILDING', 'Approve buildings', 'Buildings'],
            // ASSESSMENTS
            ['VIEW_ASSESSMENT', 'View assessments', 'Assessments'],
            ['CREATE_ASSESSMENT', 'Create assessments', 'Assessments'],
            ['EDIT_ASSESSMENT', 'Edit assessments', 'Assessments'],
            ['MANAGE_ASSESSMENT', 'Manage assessments', 'Assessments'],
            ['ASSIGN_ASSESSOR', 'Assign assessors', 'Assessments'],
            ['APPROVE_ASSESSMENT', 'Approve assessments', 'Assessments'],
            // OWNERS
            ['VIEW_OWNER', 'View owners', 'Owners'],
            ['CREATE_OWNER', 'Create owners', 'Owners'],
            ['EDIT_OWNER', 'Edit owners', 'Owners'],
            ['MANAGE_OWNER', 'Manage owners', 'Owners'],
            ['DELETE_OWNER', 'Delete owners', 'Owners'],
            // PERMISSION REQUESTS
            ['VIEW_PERMISSION_REQUEST', 'View permission requests', 'Permission Requests'],
            ['CREATE_PERMISSION_REQUEST', 'Create permission requests', 'Permission Requests'],
            ['APPROVE_PERMISSION_REQUEST', 'Approve permission requests', 'Permission Requests'],
            ['REJECT_PERMISSION_REQUEST', 'Reject permission requests', 'Permission Requests'],
            ['MANAGE_PERMISSION_REQUEST', 'Manage permission requests', 'Permission Requests'],
            // SYSTEM
            ['MANAGE_USERS', 'Manage users', 'System'],
            ['MANAGE_ROLES', 'Manage roles', 'System'],
            ['MANAGE_PERMISSIONS', 'Manage permissions', 'System'],
            ['MANAGE_STAFF', 'Manage staff', 'System'],
            ['VIEW_REPORTS', 'View reports', 'System'],
            ['MANAGE_CERTIFICATES', 'Manage certificates', 'System']
        ];

        for (const [name, desc, cat] of perms) {
            await connection.query('INSERT IGNORE INTO permissions (permission_name, description, category) VALUES (?, ?, ?)', [name, desc, cat]);
        }

        // We do NOT seed role_permissions yet, except maybe for super_admin having everything
        for (const [name] of perms) {
            await connection.query('INSERT IGNORE INTO role_permissions (role, permission_name) VALUES (?, ?)', ['super_admin', name]);
        }

        // Let's grant some basic roles based on current system so things don't completely break
        const adminPerms = ['MANAGE_LOT', 'MANAGE_BUILDING', 'MANAGE_OWNER', 'MANAGE_ASSESSMENT', 'MANAGE_PERMISSION_REQUEST', 'MANAGE_STAFF', 'VIEW_REPORTS', 'APPROVE_LOT', 'APPROVE_BUILDING', 'APPROVE_ASSESSMENT', 'APPROVE_PERMISSION_REQUEST', 'REJECT_PERMISSION_REQUEST', 'VIEW_LOT', 'VIEW_BUILDING', 'VIEW_ASSESSMENT', 'VIEW_OWNER', 'VIEW_PERMISSION_REQUEST'];
        for (const name of adminPerms) {
            await connection.query('INSERT IGNORE INTO role_permissions (role, permission_name) VALUES (?, ?)', ['admin', name]);
        }

        const assessorPerms = ['VIEW_ASSESSMENT', 'EDIT_ASSESSMENT', 'CREATE_PERMISSION_REQUEST', 'VIEW_LOT', 'VIEW_BUILDING', 'VIEW_OWNER'];
        for (const name of assessorPerms) {
            await connection.query('INSERT IGNORE INTO role_permissions (role, permission_name) VALUES (?, ?)', ['assessor', name]);
        }

        const staffPerms = ['VIEW_LOT', 'VIEW_BUILDING', 'VIEW_OWNER', 'CREATE_LOT', 'CREATE_BUILDING', 'MANAGE_CERTIFICATES'];
        for (const name of staffPerms) {
            await connection.query('INSERT IGNORE INTO role_permissions (role, permission_name) VALUES (?, ?)', ['staff', name]);
        }

        const clientPerms = ['VIEW_LOT', 'VIEW_BUILDING', 'VIEW_ASSESSMENT', 'VIEW_OWNER'];
        for (const name of clientPerms) {
            await connection.query('INSERT IGNORE INTO role_permissions (role, permission_name) VALUES (?, ?)', ['client', name]);
        }

        await connection.commit();
        console.log("Migration successful");
    } catch (e) {
        await connection.rollback();
        console.error("Migration failed", e);
    } finally {
        connection.end();
    }
}
migrate();
