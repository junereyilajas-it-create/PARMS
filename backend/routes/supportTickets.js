import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// Get support tickets
router.get('/support-tickets', authenticate, async (req, res, next) => {
  try {
    let query = 'SELECT s.*, u.first_name, u.last_name, u.email FROM support_tickets s JOIN users u ON s.user_id = u.user_id';
    const params = [];
    
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
       query += ' WHERE s.user_id = ?';
       params.push(req.user.id);
    }
    query += ' ORDER BY s.created_at DESC';
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch(e) { next(e) }
})

// Create support ticket
router.post('/support-tickets', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { subject, category, description, priority } = req.body;
    
    await connection.beginTransaction();
    const [countRows] = await connection.query('SELECT COUNT(*) as count FROM support_tickets');
    const nextNum = (countRows[0].count + 1).toString().padStart(4, '0');
    const currentYear = new Date().getFullYear();
    const ticketId = `SUP-${currentYear}-${nextNum}`;
    
    await connection.query(
      `INSERT INTO support_tickets (ticket_id, user_id, subject, category, description, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [ticketId, req.user.id, subject, category, description, priority || 'Low']
    );
    
    await logActivity(connection, req, 'CREATE', 'Support Tickets', ticketId, `${req.user.fullname} submitted a support ticket`);
    await connection.commit();
    res.status(201).json({ ticket_id: ticketId, message: 'Ticket created successfully.' });
  } catch(e) {
    await connection.rollback();
    next(e);
  } finally {
    connection.release();
  }
})

// Update support ticket
router.put('/support-tickets/:id', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { status, assigned_to } = req.body;
    await pool.query(
      'UPDATE support_tickets SET status = COALESCE(?, status), assigned_to = COALESCE(?, assigned_to) WHERE ticket_id = ?',
      [status, assigned_to, req.params.id]
    );
    await logActivity(pool, req, 'UPDATE', 'Support Tickets', req.params.id, `${req.user.fullname} updated support ticket ${req.params.id}`);
    res.json({ message: 'Ticket updated successfully.' });
  } catch(e) { next(e) }
})

// Get ticket messages
router.get('/support-tickets/:id/messages', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.*, u.first_name, u.last_name, u.role 
      FROM support_ticket_messages m 
      JOIN users u ON m.user_id = u.user_id 
      WHERE m.ticket_id = ? 
      ORDER BY m.created_at ASC`, [req.params.id]
    );
    res.json(rows);
  } catch(e) { next(e) }
})

// Add ticket message
router.post('/support-tickets/:id/messages', authenticate, async (req, res, next) => {
  try {
    const { message } = req.body;
    const [result] = await pool.query(
      'INSERT INTO support_ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, message]
    );
    res.status(201).json({ message_id: result.insertId });
  } catch(e) { next(e) }
})

export default router
