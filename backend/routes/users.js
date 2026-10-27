import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'
const router = Router()

router.get('/users', authenticate, allowRoles('super_admin'), async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT user_id, first_name, last_name, username, email, role, status, created_at FROM users ORDER BY user_id DESC')
    res.json(users)
  } catch (e) { next(e) }
})

router.get('/activity-logs-detailed', authenticate, allowRoles('super_admin', 'admin'), async (req, res, next) => {
  try {
    const [logs] = await pool.query(`
      SELECT l.*, u.first_name, u.last_name, u.role
      FROM activity_logs l
      LEFT JOIN users u ON u.user_id = l.user_id
      ORDER BY l.activity_date DESC
    `)
    res.json(logs)
  } catch (e) { next(e) }
})

router.post('/users', authenticate, allowRoles('super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { first_name, last_name, username, email, password, role, status } = req.body
    if (role === 'cashier') {
      return res.status(400).json({ message: 'The Cashier role has been decommissioned and cannot be assigned to user accounts.' })
    }
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })
    const password_hash = await bcrypt.hash(password, 10)
    await connection.beginTransaction()
    const [result] = await connection.query(
      'INSERT INTO users (first_name, last_name, username, password_hash, email, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [first_name, last_name, username, password_hash, email, role || 'staff', status || 'active']
    )
    await logActivity(connection, req, 'CREATE', 'User Management', `User ID ${result.insertId}`, `Super Admin created user ${username}`)
    await connection.commit()
    res.status(201).json({ message: 'User created', user_id: result.insertId })
  } catch (e) {
    await connection.rollback()
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Unable to create user. The username or email is already registered.' })
    }
    next(e)
  } finally { connection.release() }
})

router.put('/users/:id', authenticate, allowRoles('super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { first_name, last_name, username, email, role, password, status } = req.body
    if (role === 'cashier') {
      return res.status(400).json({ message: 'The Cashier role has been decommissioned and cannot be assigned to user accounts.' })
    }
    await connection.beginTransaction()

    // Check if role or status is being changed
    const [oldUser] = await connection.query('SELECT role, status FROM users WHERE user_id = ?', [req.params.id])
    const oldRole = oldUser[0]?.role
    const oldStatus = oldUser[0]?.status

    if (oldRole === 'super_admin' && (role !== 'super_admin' || status === 'inactive')) {
      const [admins] = await connection.query('SELECT COUNT(*) as count FROM users WHERE role = "super_admin" AND status = "active" AND user_id != ?', [req.params.id])
      if (admins[0].count === 0) {
        await connection.rollback()
        return res.status(400).json({ message: 'At least one active Super Admin account must remain in the system.' })
      }
    }

    if (password && password.length >= 6) {
      const password_hash = await bcrypt.hash(password, 10)
      await connection.query(
        'UPDATE users SET first_name=?, last_name=?, username=?, email=?, role=?, status=?, password_hash=? WHERE user_id=?',
        [first_name, last_name, username, email, role, status || 'active', password_hash, req.params.id]
      )
    } else {
      await connection.query(
        'UPDATE users SET first_name=?, last_name=?, username=?, email=?, role=?, status=? WHERE user_id=?',
        [first_name, last_name, username, email, role, status || 'active', req.params.id]
      )
    }

    if (oldRole && oldRole !== role) {
      await logActivity(connection, req, 'UPDATE', 'User Management', `User ID ${req.params.id}`, `Super Admin changed ${username}'s role from ${oldRole} to ${role}`)
    } else {
      await logActivity(connection, req, 'UPDATE', 'User Management', `User ID ${req.params.id}`, `Super Admin updated user ${username}`)
    }

    await connection.commit()
    res.json({ message: 'User updated' })
  } catch (e) {
    await connection.rollback()
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Unable to update user. The username or email is already registered.' })
    }
    next(e)
  } finally { connection.release() }
})

router.delete('/users/:id', authenticate, allowRoles('super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [userToDelete] = await connection.query('SELECT role, status FROM users WHERE user_id = ?', [req.params.id])
    if (!userToDelete.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'User not found' })
    }

    if (userToDelete[0].role === 'super_admin' && userToDelete[0].status === 'active') {
      const [admins] = await connection.query('SELECT COUNT(*) as count FROM users WHERE role = "super_admin" AND status = "active" AND user_id != ?', [req.params.id])
      if (admins[0].count === 0) {
        await connection.rollback()
        return res.status(400).json({ message: 'At least one active Super Admin account must remain in the system.' })
      }
    }

    await connection.query('DELETE FROM users WHERE user_id=?', [req.params.id])
    await logActivity(connection, req, 'DELETE', 'User Management', `User ID ${req.params.id}`, `Super Admin deleted user ID ${req.params.id}`)
    await connection.commit()
    res.status(204).end()
  } catch (e) {
    await connection.rollback()
    if (e.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ message: 'Unable to delete this user because they are linked to other records.' })
    }
    next(e)
  } finally { connection.release() }
})

export default router
