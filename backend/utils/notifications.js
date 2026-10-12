import { pool } from '../config/db.js';

/**
 * Creates a notification for a user.
 * 
 * @param {number} userId - The ID of the user to notify
 * @param {string} title - The title of the notification
 * @param {string} message - The notification message
 * @param {string} type - The type (e.g., 'PERMISSION_REQUEST', 'ASSESSMENT')
 * @param {string|number|null} relatedId - ID of the related resource (optional)
 */
export async function createNotification(userId, title, message, type, relatedId = null) {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, relatedId]
    );
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

/**
 * Broadcasts a notification to all users with a specific role.
 * 
 * @param {string} role - The role to notify (e.g., 'admin')
 * @param {string} title - The title of the notification
 * @param {string} message - The notification message
 * @param {string} type - The type (e.g., 'PERMISSION_REQUEST', 'ASSESSMENT')
 * @param {string|number|null} relatedId - ID of the related resource (optional)
 */
export async function notifyRole(role, title, message, type, relatedId = null) {
  try {
    const [users] = await pool.query('SELECT user_id FROM users WHERE role = ?', [role]);
    if (users.length > 0) {
      const values = users.map(u => [u.user_id, title, message, type, relatedId]);
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ?',
        [values]
      );
    }
  } catch (error) {
    console.error(`Error notifying role ${role}:`, error);
  }
}
