import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

router.get('/system-settings', authenticate, allowRoles('admin', 'super_admin', 'staff', 'assessor'), async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    let query = 'SELECT * FROM system_settings';
    if (!isSuperAdmin) {
      query += ' WHERE is_sensitive = FALSE';
    }
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch(e) { next(e) }
})

router.put('/system-settings/:key', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    // Admin cannot modify sensitive settings
    if (req.user.role !== 'super_admin') {
      const [settingCheck] = await pool.query('SELECT is_sensitive FROM system_settings WHERE setting_key = ?', [key]);
      if (settingCheck.length > 0 && settingCheck[0].is_sensitive) {
         return res.status(403).json({ message: 'Forbidden. You do not have permission to modify this setting.' });
      }
    }
    
    await pool.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [String(value), key]);
    await logActivity(pool, req, 'UPDATE', 'System Settings', `Setting ${key}`, `${req.user.fullname} updated system setting ${key}`);
    res.json({ message: 'Setting updated successfully.' });
  } catch(e) { next(e) }
})

export default router
