import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// Only Super Admin can manage permissions
const requireSuperAdmin = [authenticate, allowRoles('super_admin')];

router.get('/permissions', requireSuperAdmin, async (req, res, next) => {
  try {
    const [permissions] = await pool.query('SELECT * FROM permissions ORDER BY category, permission_name');
    res.json(permissions);
  } catch (e) { next(e) }
});

router.get('/roles/permissions', requireSuperAdmin, async (req, res, next) => {
  try {
    const [rolePerms] = await pool.query('SELECT role, permission_name FROM role_permissions');
    const mapping = {};
    rolePerms.forEach(row => {
      if (!mapping[row.role]) mapping[row.role] = [];
      mapping[row.role].push(row.permission_name);
    });
    res.json(mapping);
  } catch (e) { next(e) }
});

router.put('/roles/:role/permissions', requireSuperAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { role } = req.params;
    const { permissions } = req.body;
    
    await connection.beginTransaction();
    await connection.query('DELETE FROM role_permissions WHERE role = ?', [role]);
    
    if (permissions && permissions.length > 0) {
      const values = permissions.map(p => [role, p]);
      await connection.query('INSERT IGNORE INTO role_permissions (role, permission_name) VALUES ?', [values]);
    }
    
    await logActivity(connection, req, 'UPDATE', 'Role Management', role, `Super Admin updated permissions for role: ${role}`);
    await connection.commit();
    res.json({ message: 'Role permissions updated' });
  } catch (e) {
    await connection.rollback();
    next(e);
  } finally {
    connection.release();
  }
});

router.get('/users/:id/permissions', requireSuperAdmin, async (req, res, next) => {
  try {
    const [userPerms] = await pool.query('SELECT permission_name FROM user_permissions WHERE user_id = ?', [req.params.id]);
    res.json(userPerms.map(p => p.permission_name));
  } catch (e) { next(e) }
});

router.put('/users/:id/permissions', requireSuperAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.params.id;
    const { permissions } = req.body;
    
    await connection.beginTransaction();
    await connection.query('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
    
    if (permissions && permissions.length > 0) {
      const values = permissions.map(p => [userId, p]);
      await connection.query('INSERT IGNORE INTO user_permissions (user_id, permission_name) VALUES ?', [values]);
    }
    
    await logActivity(connection, req, 'UPDATE', 'User Management', `User ID ${userId}`, `Super Admin updated specific permissions for user ID ${userId}`);
    await connection.commit();
    res.json({ message: 'User specific permissions updated' });
  } catch (e) {
    await connection.rollback();
    next(e);
  } finally {
    connection.release();
  }
});

export default router;
