import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'

const router = Router()

// Admin/Staff routes for certificate requests
router.use(authenticate, allowRoles('admin', 'assessor', 'staff'))

// List all certificate requests
router.get('/admin/certificate-requests', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, p.property_type_id,
        CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name) AS location,
        CONCAT(u.first_name, ' ', u.last_name) as client_name,
        CONCAT(po.first_name, ' ', po.last_name) as owner_name,
        CONCAT(r.first_name, ' ', r.last_name) as reviewer_name
      FROM certificate_requests c
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN properties p ON p.property_id = c.property_id
      LEFT JOIN property_owners po ON po.owner_id = p.owner_id
      LEFT JOIN addresses ad ON p.address_id = ad.address_id
      LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
      LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
      LEFT JOIN users r ON r.user_id = c.reviewed_by
      ORDER BY c.requested_at DESC
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

// Update certificate request status
router.put('/admin/certificate-requests/:id', async (req, res, next) => {
  try {
    const { status, rejection_reason } = req.body
    if (!status) return res.status(400).json({ message: 'Status is required' })
    
    let query = 'UPDATE certificate_requests SET status = ?, reviewed_by = ?'
    const params = [status, req.user.id]

    if (status === 'REJECTED') {
      query += ', rejection_reason = ?'
      params.push(rejection_reason || null)
    }
    if (['APPROVED', 'REJECTED', 'UNDER_REVIEW'].includes(status)) {
      query += ', reviewed_at = CURRENT_TIMESTAMP'
    }
    if (status === 'COMPLETED') {
      query += ', completed_at = CURRENT_TIMESTAMP'
    }

    query += ' WHERE request_id = ?'
    params.push(req.params.id)

    const [result] = await pool.query(query, params)
    if (!result.affectedRows) return res.status(404).json({ message: 'Request not found' })

    res.json({ message: 'Request updated successfully' })
  } catch (e) { next(e) }
})

export default router
