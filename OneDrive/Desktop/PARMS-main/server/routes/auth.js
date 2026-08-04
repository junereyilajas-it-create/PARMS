import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { authenticate } from '../middleware/auth.js'
const router = Router()
router.post('/login', async (req, res, next) => { try {
  const { username, password } = req.body
  const [rows] = await pool.query('SELECT id, fullname, username, password, role FROM users WHERE username = ?', [username])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid username or password' })
  const token = jwt.sign({ id: user.id, role: user.role, fullname: user.fullname }, process.env.JWT_SECRET, { expiresIn: '8h' })
  res.json({ token, user: { id: user.id, fullname: user.fullname, username: user.username, role: user.role } })
} catch (err) { next(err) } })
router.get('/profile', authenticate, (req, res) => res.json(req.user))
export default router
