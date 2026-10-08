import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { authenticate } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '../utils/email.js'
const router = Router()
router.post('/login', async (req, res, next) => { try {
  const { username, password } = req.body
  const [rows] = await pool.query('SELECT user_id, owner_id, first_name, last_name, username, password_hash, role, status FROM users WHERE username = ? OR email = ?', [username, username])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid username or password' })
  if (user.status && user.status.toLowerCase() !== 'active') return res.status(403).json({ message: 'Your account is inactive. Please contact the administrator.' })
  const fullname = `${user.first_name} ${user.last_name}`
  const token = jwt.sign({ id: user.user_id, owner_id: user.owner_id, role: user.role, fullname }, process.env.JWT_SECRET, { expiresIn: '8h' })
  
  await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id])
  
  // Create a mock req object with user for logActivity
  const logReq = { ...req, user: { id: user.user_id, fullname, role: user.role } }
  await logActivity(pool, logReq, 'LOGIN', 'Authentication', `User ID ${user.user_id}`, `${user.username} logged in`)
  
  res.json({ token, user: { id: user.user_id, owner_id: user.owner_id, fullname, username: user.username, role: user.role } })
} catch (err) { next(err) } })

router.post('/validate-login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    if (!username) return res.json({ usernameExists: false, passwordCorrect: false })
    
    const [rows] = await pool.query('SELECT username, password_hash, status FROM users WHERE username = ? OR email = ?', [username, username])
    const user = rows[0]
    
    if (!user) {
      return res.json({ usernameExists: false, passwordCorrect: false })
    }
    
    if (!password) {
      return res.json({ usernameExists: true, passwordCorrect: false })
    }
    
    const passwordCorrect = await bcrypt.compare(password, user.password_hash)
    if (user.status && user.status.toLowerCase() !== 'active') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact the administrator.' })
    }
    return res.json({ usernameExists: true, passwordCorrect })
  } catch (err) {
    next(err)
  }
})

router.post('/register', async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { first_name, last_name, username, email, password } = req.body
    if (![first_name, last_name, username, email, password].every(Boolean)) return res.status(400).json({ message: 'All required fields must be provided' })
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address' })
    
    await connection.beginTransaction()
    
    const password_hash = await bcrypt.hash(password, 10)
    
    // Create property owner record
    const [ownerResult] = await connection.query(
      'INSERT INTO property_owners (first_name, last_name, email) VALUES (?, ?, ?)',
      [first_name, last_name, email]
    )
    const owner_id = ownerResult.insertId
    
    // Create user record with CLIENT role
    const [result] = await connection.query(
      'INSERT INTO users (owner_id, first_name, last_name, username, password_hash, email, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [owner_id, first_name, last_name, username, password_hash, email, 'client']
    )
    
    await connection.commit()
    res.status(201).json({ id: result.insertId, message: 'Client account created. You can now sign in.' })
  } catch (err) {
    await connection.rollback()
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That username or email is already registered' })
    next(err)
  } finally {
    connection.release()
  }
})

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await logActivity(pool, req, 'LOGOUT', 'Authentication', `User ID ${req.user.id}`, `${req.user.fullname} logged out`)
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    next(err)
  }
})
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.role, u.created_at, u.status, u.last_login, p.owner_id, p.contact_number FROM users u LEFT JOIN property_owners p ON u.owner_id = p.owner_id WHERE u.user_id = ?', [req.user.id])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    res.json(rows[0])
  } catch(e) { next(e) }
})

router.put('/profile', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { first_name, last_name, email, contact_number } = req.body
    await connection.beginTransaction()
    
    await connection.query(
      'UPDATE users SET first_name=?, last_name=?, email=? WHERE user_id=?',
      [first_name, last_name, email, req.user.id]
    )
    
    if (req.user.owner_id) {
      await connection.query(
        'UPDATE property_owners SET first_name=?, last_name=?, email=?, contact_number=? WHERE owner_id=?',
        [first_name, last_name, email, contact_number || null, req.user.owner_id]
      )
    }
    
    await connection.commit()
    res.json({ message: 'Profile updated' })
  } catch(e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

router.put('/profile/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password are required' })
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' })
    
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.id])
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ message: 'Incorrect current password' })
    }
    
    const password_hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, req.user.id])
    await logActivity(pool, req, 'UPDATE', 'Authentication', `User ID ${req.user.id}`, `${req.user.fullname} changed their password`)
    
    res.json({ message: 'Password changed successfully' })
  } catch(e) { next(e) }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email format' })

    const [users] = await pool.query('SELECT user_id, first_name FROM users WHERE email = ?', [email])
    
    // To prevent email enumeration, we always return the same generic message
    // even if the email is not found.
    if (users.length > 0) {
      const user = users[0]
      const token = crypto.randomBytes(32).toString('hex')
      const token_hash = crypto.createHash('sha256').update(token).digest('hex')
      
      // Expire in 30 minutes
      const expires_at = new Date(Date.now() + 30 * 60 * 1000)
      
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.user_id, token_hash, expires_at]
      )
      
      const resetLink = `http://localhost:5173/reset-password?token=${token}`
      await sendPasswordResetEmail(email, resetLink)
    }

    res.json({ message: 'If the email is registered, a password reset link has been sent.' })
  } catch (err) {
    next(err)
  }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required' })
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })

    const token_hash = crypto.createHash('sha256').update(token).digest('hex')
    
    const [tokens] = await pool.query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL',
      [token_hash]
    )
    
    if (tokens.length === 0) {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired. Please request a new password reset link.' })
    }
    
    const resetRecord = tokens[0]
    const password_hash = await bcrypt.hash(newPassword, 10)
    
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      
      await connection.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, resetRecord.user_id])
      await connection.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [resetRecord.id])
      
      await connection.commit()
      res.json({ message: 'Your password has been changed successfully.' })
    } catch (err) {
      await connection.rollback()
      throw err
    } finally {
      connection.release()
    }
  } catch (err) {
    next(err)
  }
})

export default router
