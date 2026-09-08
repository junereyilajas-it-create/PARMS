import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { authenticate } from '../middleware/auth.js'
const router = Router()
router.post('/login', async (req, res, next) => { try {
  const { username, password } = req.body
  const [rows] = await pool.query('SELECT user_id, owner_id, first_name, last_name, username, password_hash, role FROM users WHERE username = ?', [username])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid username or password' })
  const fullname = `${user.first_name} ${user.last_name}`
  const token = jwt.sign({ id: user.user_id, owner_id: user.owner_id, role: user.role, fullname }, process.env.JWT_SECRET, { expiresIn: '8h' })
  res.json({ token, user: { id: user.user_id, owner_id: user.owner_id, fullname, username: user.username, role: user.role } })
} catch (err) { next(err) } })
router.post('/register', async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { first_name, last_name, username, email, password } = req.body
    if (![first_name, last_name, username, email, password].every(Boolean)) return res.status(400).json({ message: 'All required fields must be provided' })
    
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
router.get('/profile', authenticate, (req, res) => res.json(req.user))
export default router
