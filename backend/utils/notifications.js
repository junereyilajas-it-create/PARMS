import { pool } from '../config/db.js';

/**
 * Creates a notification for a user with deduplication against existing unread notifications.
 * 
 * @param {number} userId - The ID of the user to notify
 * @param {string} title - The title of the notification
 * @param {string} message - The notification message
 * @param {string} type - The type (e.g., 'PERMISSION_REQUEST', 'PERMISSION_APPROVED', 'PERMISSION_REJECTED')
 * @param {string|number|null} relatedId - ID of the related resource (optional)
 */
export async function createNotification(userId, title, message, type, relatedId = null) {
  try {
    const relIdStr = relatedId !== null && relatedId !== undefined ? String(relatedId) : null;
    if (relIdStr) {
      const [existing] = await pool.query(
        'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND related_id = ? AND is_read = FALSE',
        [userId, type, relIdStr]
      );
      if (existing.length > 0) return;
    }
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, relIdStr]
    );
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

/**
 * Broadcasts a notification to all users with a specific role.
 */
export async function notifyRole(role, title, message, type, relatedId = null) {
  return notifyRoles([role], title, message, type, relatedId);
}

/**
 * Broadcasts a notification to all active users with any of the specified roles (e.g. ['admin', 'super_admin']).
 * Deduplicates to prevent spamming unread notifications for the same request.
 */
export async function notifyRoles(roles, title, message, type, relatedId = null) {
  try {
    const roleList = Array.isArray(roles) ? roles : [roles];
    const [users] = await pool.query(
      'SELECT user_id FROM users WHERE role IN (?) AND (status IS NULL OR LOWER(status) = "active")',
      [roleList]
    );
    const relIdStr = relatedId !== null && relatedId !== undefined ? String(relatedId) : null;
    for (const u of users) {
      if (relIdStr) {
        const [existing] = await pool.query(
          'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND related_id = ? AND is_read = FALSE',
          [u.user_id, type, relIdStr]
        );
        if (existing.length > 0) continue;
      }
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
        [u.user_id, title, message, type, relIdStr]
      );
    }
  } catch (error) {
    console.error(`Error notifying roles ${roles}:`, error);
  }
}
