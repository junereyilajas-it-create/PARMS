import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: 'Authentication required' })
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next() }
  catch { return res.status(401).json({ message: 'Invalid or expired token' }) }
}
export const allowRoles = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Insufficient permissions' })

export const requireOwnership = async (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'assessor' || req.user.role === 'staff') return next()
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Insufficient permissions' })
  if (!req.user.owner_id) return res.status(403).json({ message: 'No owner ID linked to this client' })

  const propertyId = req.params.id || req.body.property_id
  if (!propertyId) return res.status(400).json({ message: 'Property ID is required for ownership check' })
  
  try {
    const [rows] = await pool.query('SELECT owner_id FROM properties WHERE property_id = ?', [propertyId])
    if (rows.length === 0) return res.status(404).json({ message: 'Property not found' })
    if (rows[0].owner_id !== req.user.owner_id) return res.status(403).json({ message: 'You are not authorized to view this property.' })
    next()
  } catch (err) {
    next(err)
  }
}
