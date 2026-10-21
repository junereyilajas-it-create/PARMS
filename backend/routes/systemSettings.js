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

// Super Admin Database Backup Export
router.get('/system-settings/backup', authenticate, allowRoles('super_admin'), async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT user_id, username, email, first_name, last_name, role, status, created_at FROM users');
    const [properties] = await pool.query('SELECT * FROM properties');
    const [lots] = await pool.query('SELECT * FROM property_lots');
    const [buildings] = await pool.query('SELECT * FROM property_buildings');
    const [owners] = await pool.query('SELECT * FROM property_owners');
    const [settings] = await pool.query('SELECT * FROM system_settings');
    const [gis] = await pool.query('SELECT * FROM gis_locations');
    const [requests] = await pool.query('SELECT * FROM gis_mapping_requests');
    const [barangays] = await pool.query('SELECT * FROM barangays');

    const backupData = {
      system: 'PARMS (Property Assessor Records Management System)',
      jurisdiction: 'Lagonglong, Misamis Oriental, Philippines',
      version: 'PARMS v2.4.0',
      exported_at: new Date().toISOString(),
      exported_by: req.user.fullname || 'Super Admin',
      database: 'property_management_db',
      statistics: {
        total_properties: lots.length + buildings.length,
        total_lots: lots.length,
        total_buildings: buildings.length,
        total_users: users.length,
        total_owners: owners.length,
        total_gis_records: gis.length
      },
      tables: {
        users,
        properties,
        property_lots: lots,
        property_buildings: buildings,
        property_owners: owners,
        system_settings: settings,
        gis_locations: gis,
        gis_mapping_requests: requests,
        barangays
      },
      database_tables: {
        users,
        properties,
        property_lots: lots,
        property_buildings: buildings,
        property_owners: owners,
        system_settings: settings,
        gis_locations: gis,
        gis_mapping_requests: requests,
        barangays
      },
      backup_metadata: {
        system: 'PARMS (Property Assessor Records Management System)',
        jurisdiction: 'Lagonglong, Misamis Oriental, Philippines',
        version: 'PARMS v2.4.0',
        exported_at: new Date().toISOString()
      }
    };

    await logActivity(pool, req, 'EXPORT', 'System Settings', 'Database Backup', `${req.user.fullname} downloaded full database snapshot backup`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=PARMS_backup_${new Date().toISOString().slice(0, 10)}.json`);
    res.json(backupData);
  } catch(e) { next(e) }
});

// Admin & Super Admin System Activity Logs Summary
router.get('/system-settings/audit-summary', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [logs] = await pool.query(`
      SELECT log_id, user_id, action, module_name, record_affected, activity, ip_address, activity_date
      FROM activity_logs
      ORDER BY log_id DESC
      LIMIT 20
    `);
    res.json({ logs, count: logs.length });
  } catch(e) { next(e) }
});

export default router
