import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { authenticate } from '../middleware/auth.js'
const router = Router()
router.post('/login', async (req, res, next) => { try {
  const { username, password } = req.body
  const [rows] = await pool.query('SELECT user_id, first_name, last_name, username, password_hash, role FROM users WHERE username = ?', [username])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid username or password' })
  const fullname = `${user.first_name} ${user.last_name}`
  const token = jwt.sign({ id: user.user_id, role: user.role, fullname }, process.env.JWT_SECRET, { expiresIn: '8h' })
  res.json({ token, user: { id: user.user_id, fullname, username: user.username, role: user.role } })
} catch (err) { next(err) } })
router.get('/profile', authenticate, (req, res) => res.json(req.user))
export default router
