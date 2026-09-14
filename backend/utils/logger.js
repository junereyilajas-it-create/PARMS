export async function logActivity(connection, req, action, module_name, record_affected, activity) {
  try {
    const ip = req.ip || req.connection?.remoteAddress || '';
    await connection.query(
      'INSERT INTO activity_logs (user_id, role, action, module_name, record_affected, activity, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, req.user.role, action, module_name, record_affected, activity, ip]
    );
  } catch(e) {
    console.error('Failed to log activity', e);
  }
}

export async function logPropertyHistory(connection, req, property_id, action, prev_val, new_val) {
  try {
    await connection.query(
      'INSERT INTO property_history (property_id, user_id, action, previous_value, new_value) VALUES (?, ?, ?, ?, ?)',
      [property_id, req.user.id, action, prev_val ? JSON.stringify(prev_val) : null, new_val ? JSON.stringify(new_val) : null]
    );
  } catch(e) {
    console.error('Failed to log property history', e);
  }
}
