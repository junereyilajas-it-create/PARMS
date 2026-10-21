import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { authenticate } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '../utils/email.js'
const router = Router()
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(401).json({ message: 'Invalid email or password. Please try again.' })
    }
    const cleanUser = String(username).trim().toLowerCase()
    const [rows] = await pool.query(
      'SELECT user_id, owner_id, first_name, last_name, username, password_hash, role, status FROM users WHERE LOWER(TRIM(username)) = ? OR LOWER(TRIM(email)) = ?',
      [cleanUser, cleanUser]
    )
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password. Please try again.' })
    }
    if (user.status && user.status.toLowerCase() !== 'active') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact the administrator.' })
    }
    const fullname = `${user.first_name} ${user.last_name}`
    const token = jwt.sign({ 
      id: user.user_id, 
      owner_id: user.owner_id, 
      role: user.role, 
      fullname,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username
    }, process.env.JWT_SECRET, { expiresIn: '8h' })
    
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id])
    
    const logReq = { ...req, user: { id: user.user_id, fullname, role: user.role } }
    await logActivity(pool, logReq, 'LOGIN', 'Authentication', `User ID ${user.user_id}`, `${user.username} logged in`)
    
    const [perms] = await pool.query(`
      SELECT permission_name FROM role_permissions WHERE role = ?
      UNION
      SELECT permission_name FROM user_permissions WHERE user_id = ?
    `, [user.role, user.user_id]);

    res.json({ 
      token, 
      user: { 
        id: user.user_id, 
        owner_id: user.owner_id, 
        fullname, 
        username: user.username, 
        role: user.role,
        permissions: perms.map(p => p.permission_name)
      } 
    })
  } catch (err) {
    next(err)
  }
})

router.post('/validate-login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    if (!username) return res.json({ usernameExists: false, passwordCorrect: false })
    const cleanUser = String(username).trim().toLowerCase()
    const [rows] = await pool.query('SELECT username, password_hash, status FROM users WHERE LOWER(TRIM(username)) = ? OR LOWER(TRIM(email)) = ?', [cleanUser, cleanUser])
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
    let { first_name, last_name, username, email, password, confirm_password } = req.body

    // 1. Validate required fields
    if (!first_name || !String(first_name).trim()) {
      return res.status(400).json({ message: 'First name is required' })
    }
    if (!last_name || !String(last_name).trim()) {
      return res.status(400).json({ message: 'Last name is required' })
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: 'Email address is required' })
    }
    if (!username || !String(username).trim()) {
      return res.status(400).json({ message: 'Username is required' })
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' })
    }
    if (confirm_password !== undefined && password !== confirm_password) {
      return res.status(400).json({ message: 'Passwords do not match' })
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    // 2. Email normalization & format validation
    const normalizedEmail = String(email).trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' })
    }

    // 3. Name normalization (collapse whitespace, lowercase for comparison)
    const cleanFirstName = String(first_name).trim().replace(/\s+/g, ' ')
    const cleanLastName = String(last_name).trim().replace(/\s+/g, ' ')
    if (!cleanFirstName || !cleanLastName) {
      return res.status(400).json({ message: 'Full name must contain valid non-space characters' })
    }
    const normalizedFullName = `${cleanFirstName} ${cleanLastName}`.toLowerCase()
    const cleanUsername = String(username).trim().toLowerCase()

    await connection.beginTransaction()

    // 4. Duplicate Email check in database (case-insensitive)
    const [existingEmail] = await connection.query(
      'SELECT user_id FROM users WHERE LOWER(TRIM(email)) = ?',
      [normalizedEmail]
    )
    if (existingEmail.length > 0) {
      await connection.rollback()
      return res.status(409).json({ message: 'This email address is already registered. Please use another email.' })
    }

    // 5. Duplicate Full Name check in database (case-insensitive, normalized spaces)
    const [existingName] = await connection.query(
      `SELECT user_id FROM users 
       WHERE normalized_full_name = ? 
          OR LOWER(TRIM(REGEXP_REPLACE(CONCAT(TRIM(first_name), ' ', TRIM(last_name)), ' +', ' '))) = ?`,
      [normalizedFullName, normalizedFullName]
    )
    if (existingName.length > 0) {
      await connection.rollback()
      return res.status(409).json({ message: 'An account with this full name already exists. Please check your information.' })
    }

    // 6. Duplicate Username check
    const [existingUsername] = await connection.query(
      'SELECT user_id FROM users WHERE LOWER(TRIM(username)) = ?',
      [cleanUsername]
    )
    if (existingUsername.length > 0) {
      await connection.rollback()
      return res.status(409).json({ message: 'That username is already taken. Please choose another username.' })
    }

    const password_hash = await bcrypt.hash(password, 10)

    // Create property owner record
    const [ownerResult] = await connection.query(
      'INSERT INTO property_owners (first_name, last_name, email) VALUES (?, ?, ?)',
      [cleanFirstName, cleanLastName, normalizedEmail]
    )
    const owner_id = ownerResult.insertId

    // Create user record with forced CLIENT role - public registration cannot create privileged roles!
    const [result] = await connection.query(
      'INSERT INTO users (owner_id, first_name, last_name, normalized_full_name, username, password_hash, email, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, "client", "active")',
      [owner_id, cleanFirstName, cleanLastName, normalizedFullName, cleanUsername, password_hash, normalizedEmail]
    )

    await connection.commit()
    res.status(201).json({ id: result.insertId, message: 'Account created successfully. You can now sign in.' })
  } catch (err) {
    await connection.rollback()
    if (err?.code === 'ER_DUP_ENTRY') {
      const errMsg = String(err.message || '').toLowerCase()
      if (errMsg.includes('normalized_full_name') || errMsg.includes('idx_users_normalized_full_name')) {
        return res.status(409).json({ message: 'An account with this full name already exists. Please check your information.' })
      }
      if (errMsg.includes('email')) {
        return res.status(409).json({ message: 'This email address is already registered. Please use another email.' })
      }
      if (errMsg.includes('username')) {
        return res.status(409).json({ message: 'That username is already taken. Please choose another username.' })
      }
      return res.status(409).json({ message: 'An account with this information already exists.' })
    }
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
    const [rows] = await pool.query(`
      SELECT u.user_id, u.username, u.email, u.first_name, u.middle_name, u.last_name,
             u.contact_number, u.profile_photo, u.theme_preference, u.notification_preferences,
             u.role, u.created_at, u.status, u.last_login, p.owner_id,
             COALESCE(u.contact_number, p.contact_number) AS contact_number
      FROM users u 
      LEFT JOIN property_owners p ON u.owner_id = p.owner_id 
      WHERE u.user_id = ?
    `, [req.user.id])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    const [perms] = await pool.query(`
      SELECT permission_name FROM role_permissions WHERE role = ?
      UNION
      SELECT permission_name FROM user_permissions WHERE user_id = ?
    `, [rows[0].role, req.user.id]);
    res.json({
      ...rows[0],
      permissions: perms.map(p => p.permission_name)
    })
  } catch(e) { next(e) }
})

router.put('/profile', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { first_name, middle_name, last_name, email, contact_number, theme_preference, notification_preferences } = req.body

    if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
      return res.status(400).json({ message: 'First name and last name are required.' })
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' })
    }

    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email address format.' })
    }

    const cleanFirstName = first_name.trim()
    const cleanMiddleName = middle_name ? middle_name.trim() : null
    const cleanLastName = last_name.trim()
    const cleanContact = contact_number ? contact_number.trim() : null
    const cleanTheme = ['light', 'dark', 'system'].includes(theme_preference) ? theme_preference : 'system'
    const notifString = typeof notification_preferences === 'object' && notification_preferences !== null
      ? JSON.stringify(notification_preferences)
      : (typeof notification_preferences === 'string' ? notification_preferences : null)

    const normalizedName = `${cleanFirstName} ${cleanLastName}`.toLowerCase().replace(/\s+/g, ' ')

    await connection.beginTransaction()

    // 1. Email Uniqueness Check (Case-insensitive, trimmed)
    const [emailCheck] = await connection.query(
      'SELECT user_id FROM users WHERE LOWER(TRIM(email)) = ? AND user_id != ?',
      [cleanEmail, req.user.id]
    )
    if (emailCheck.length > 0) {
      await connection.rollback()
      return res.status(409).json({ message: 'This email address is already registered. Please use another email.' })
    }

    // 2. Full Name Uniqueness Check (Normalized, case-insensitive, collapsed spaces)
    const [nameCheck] = await connection.query(
      'SELECT user_id FROM users WHERE normalized_full_name = ? AND user_id != ?',
      [normalizedName, req.user.id]
    )
    if (nameCheck.length > 0) {
      await connection.rollback()
      return res.status(409).json({ message: 'An account with this full name already exists. Please check your information.' })
    }

    await connection.query(
      `UPDATE users 
       SET first_name=?, middle_name=?, last_name=?, normalized_full_name=?, email=?, contact_number=?, theme_preference=?, notification_preferences=?
       WHERE user_id=?`,
      [cleanFirstName, cleanMiddleName, cleanLastName, normalizedName, cleanEmail, cleanContact, cleanTheme, notifString, req.user.id]
    )

    if (req.user.owner_id) {
      await connection.query(
        'UPDATE property_owners SET first_name=?, middle_name=?, last_name=?, email=?, contact_number=? WHERE owner_id=?',
        [cleanFirstName, cleanMiddleName, cleanLastName, cleanEmail, cleanContact, req.user.owner_id]
      )
    }

    await logActivity(connection, req, 'UPDATE', 'User Profile', `User ID ${req.user.id}`, `${req.user.fullname} updated their personal profile`)

    await connection.commit()
    res.json({ message: 'Profile updated successfully.' })
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
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long.' })
    }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.id])
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ message: 'Current password is incorrect. Please try again.' })
    }

    const password_hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, req.user.id])
    await logActivity(pool, req, 'UPDATE', 'Authentication', `User ID ${req.user.id}`, `${req.user.fullname} changed their account password`)

    res.json({ message: 'Password changed successfully. Please use your new password next time you log in.' })
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
