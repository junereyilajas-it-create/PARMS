import { pool } from '../config/db.js';

/**
 * Immutable Tax Audit Event Logger
 */
export async function logTaxAuditEvent(connectionOrPool, req, entityType, entityId, action, prevState = null, newState = null, reason = null) {
  try {
    const conn = connectionOrPool || pool;
    const ip = req?.ip || req?.connection?.remoteAddress || '127.0.0.1';
    const userId = req?.user?.id || 1;
    const userRole = req?.user?.role || 'system';

    await conn.query(`
      INSERT INTO tax_audit_events 
        (user_id, role, entity_type, entity_id, action, previous_state, new_state, reason, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      userRole,
      entityType,
      String(entityId),
      action,
      prevState ? JSON.stringify(prevState) : null,
      newState ? JSON.stringify(newState) : null,
      reason,
      ip
    ]);
  } catch (err) {
    console.error('Error recording tax audit event:', err);
  }
}
