import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: 'Authentication required' })
  try { 
    req.user = jwt.verify(token, process.env.JWT_SECRET); 
    next();
  }
  catch { return res.status(401).json({ message: 'Invalid or expired token' }) }
}

export const loadPermissions = async (req, res, next) => {
  if (!req.user) return next();
  try {
    const [rows] = await pool.query(`
      SELECT permission_name FROM role_permissions WHERE role = ?
      UNION
      SELECT permission_name FROM user_permissions WHERE user_id = ?
    `, [req.user.role, req.user.id]);
    
    req.user.permissions = rows.map(r => r.permission_name);
    // Refresh role just in case it changed (to avoid logout requirement)
    const [u] = await pool.query('SELECT role FROM users WHERE user_id = ?', [req.user.id]);
    if (u[0]) req.user.role = u[0].role;
    
    next();
  } catch (err) {
    next(err);
  }
};
export const allowRoles = (...roles) => async (req, res, next) => {
  // ensure permissions are loaded
  if (!req.user.permissions) {
    return loadPermissions(req, res, () => allowRoles(...roles)(req, res, next));
  }
  const userRole = (req.user?.role || '').toString().trim().toLowerCase();
  const allowedRoles = roles.map(r => r.toString().trim().toLowerCase());
  
  if (userRole === 'super_admin') {
    if (allowedRoles.length === 1 && allowedRoles[0] === 'client') {
      return res.status(403).json({ message: 'Super Admin cannot access client-only endpoints' });
    }
    return next();
  }
  
  if (allowedRoles.includes(userRole)) return next();
  
  // Backward compatibility check
  return res.status(403).json({ message: 'Insufficient permissions' })
}

export const requirePermission = (permission) => async (req, res, next) => {
  if (!req.user.permissions) {
    return loadPermissions(req, res, () => requirePermission(permission)(req, res, next));
  }
  
  if (req.user.role === 'super_admin') return next();
  
  if (req.user.permissions.includes(permission)) {
    return next();
  }
  
  return res.status(403).json({ message: 'Insufficient permissions' });
}

export const requireOwnership = async (req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.role === 'admin' || req.user.role === 'assessor' || req.user.role === 'staff') return next()
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Insufficient permissions' })
  if (!req.user.owner_id) return res.status(403).json({ message: 'No owner ID linked to this client' })

  const propertyId = req.params.id || req.body.property_id
  if (!propertyId) return res.status(400).json({ message: 'Property ID is required for ownership check' })
  
  try {
    const [rows] = await pool.query('SELECT owner_id FROM properties WHERE property_id = ?', [propertyId])
    if (rows.length === 0) return res.status(404).json({ message: 'Property not found' })
    if (rows[0].owner_id !== req.user.owner_id) return res.status(403).json({ message: 'You are not authorized to view this property.' })
    next()
  } catch (err) {
    next(err)
  }
}
