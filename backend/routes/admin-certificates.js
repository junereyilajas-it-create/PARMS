import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// Admin, Super Admin, Assessor, Staff can access certificate request processing
router.use('/admin/certificate-requests', authenticate, allowRoles('admin', 'super_admin', 'staff', 'assessor'))

// 1. List all certificate requests with full owner, property, and reviewer details
router.get('/admin/certificate-requests', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.request_id,
        c.reference_number,
        c.user_id,
        c.property_id,
        c.certificate_type,
        c.purpose,
        c.remarks,
        c.contact_number,
        c.status,
        c.rejection_reason,
        c.processing_notes,
        c.requested_at,
        c.reviewed_at,
        c.completed_at,
        c.certificate_id,
        gc.certificate_number,
        gc.issued_at AS certificate_issued_at,
        p.property_type_id,
        t.property_type_name,
        l.lot_number,
        l.title_number,
        b.building_name,
        td.declaration_number as tax_declaration_no,
        CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name) AS location,
        CONCAT(u.first_name, ' ', u.last_name) AS client_name,
        u.username AS client_username,
        u.email AS client_email,
        po.owner_id,
        CONCAT(po.first_name, ' ', po.last_name) AS owner_name,
        po.contact_number AS owner_contact,
        CONCAT(r.first_name, ' ', r.last_name) AS reviewer_name,
        CONCAT(st.first_name, ' ', st.last_name) AS assigned_staff_name
      FROM certificate_requests c
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN properties p ON p.property_id = c.property_id
      LEFT JOIN property_owners po ON po.owner_id = p.owner_id
      LEFT JOIN property_types t ON t.property_type_id = p.property_type_id
      LEFT JOIN property_lots l ON l.property_id = p.property_id
      LEFT JOIN property_buildings b ON b.property_id = p.property_id
      LEFT JOIN tax_declarations td ON td.property_id = p.property_id
      LEFT JOIN addresses ad ON p.address_id = ad.address_id
      LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
      LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
      LEFT JOIN users r ON r.user_id = c.reviewed_by
      LEFT JOIN users st ON st.user_id = c.assigned_to
      LEFT JOIN generated_certificates gc ON gc.certificate_id = c.certificate_id
      ORDER BY c.requested_at DESC
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

// 2. Update certificate request status & workflow
router.put('/admin/certificate-requests/:id', async (req, res, next) => {
  try {
    const requestId = req.params.id
    const { 
      status, 
      rejection_reason, 
      processing_notes, 
      assigned_to,
      certificate_id 
    } = req.body

    if (!status) return res.status(400).json({ message: 'Status is required' })

    const [existing] = await pool.query('SELECT * FROM certificate_requests WHERE request_id = ?', [requestId])
    if (existing.length === 0) return res.status(404).json({ message: 'Certificate request not found' })
    const prev = existing[0]

    // Role-based validation
    const userRole = (req.user?.role || '').toLowerCase()
    if (userRole === 'staff') {
      if (['APPROVED', 'COMPLETED'].includes(status) && !['admin', 'super_admin'].includes(userRole)) {
        return res.status(403).json({ message: 'Staff members cannot finalize certificate approvals. Please submit for Admin Review.' })
      }
    }

    const updates = []
    const params = []

    updates.push('status = ?')
    params.push(status)

    if (processing_notes !== undefined) {
      updates.push('processing_notes = ?')
      params.push(processing_notes ? processing_notes.trim() : null)
    }

    if (['REJECTED', 'RETURNED'].includes(status)) {
      updates.push('rejection_reason = ?')
      params.push(rejection_reason ? rejection_reason.trim() : null)
    } else if (rejection_reason !== undefined) {
      updates.push('rejection_reason = ?')
      params.push(rejection_reason || null)
    }

    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?')
      params.push(assigned_to || null)
    } else if (status === 'PROCESSING' && !prev.assigned_to) {
      updates.push('assigned_to = ?')
      params.push(req.user.id)
    }

    if (certificate_id !== undefined) {
      updates.push('certificate_id = ?')
      params.push(certificate_id || null)
    }

    if (['APPROVED', 'REJECTED', 'UNDER_REVIEW', 'RETURNED'].includes(status)) {
      updates.push('reviewed_by = ?')
      params.push(req.user.id)
      updates.push('reviewed_at = CURRENT_TIMESTAMP')
    }

    if (['COMPLETED', 'APPROVED'].includes(status)) {
      updates.push('completed_at = CURRENT_TIMESTAMP')
    }

    params.push(requestId)

    const query = `UPDATE certificate_requests SET ${updates.join(', ')} WHERE request_id = ?`
    await pool.query(query, params)

    // Notify requesting client automatically
    try {
      let notifTitle = 'Certificate Request Update'
      let notifMsg = `Your request #${prev.reference_number || prev.request_id} status has been updated to ${status}.`
      let notifType = 'INFO'

      if (status === 'APPROVED' || status === 'COMPLETED') {
        notifTitle = 'Certificate Approved & Ready'
        notifMsg = `Your requested ${prev.certificate_type} (#${prev.reference_number || prev.request_id}) has been approved and is ready.`
        notifType = 'SUCCESS'
      } else if (status === 'REJECTED') {
        notifTitle = 'Certificate Request Rejected'
        notifMsg = `Your request #${prev.reference_number || prev.request_id} was rejected. Reason: ${rejection_reason || 'See office remarks'}`
        notifType = 'ERROR'
      } else if (status === 'RETURNED') {
        notifTitle = 'Certificate Request Needs Correction'
        notifMsg = `Your request #${prev.reference_number || prev.request_id} requires additional information: ${rejection_reason || 'Please review requirements.'}`
        notifType = 'WARNING'
      } else if (status === 'PROCESSING') {
        notifTitle = 'Certificate Processing Started'
        notifMsg = `Staff has begun preparing your ${prev.certificate_type} (#${prev.reference_number || prev.request_id}).`
        notifType = 'INFO'
      }

      await pool.query(`
        INSERT INTO notifications (user_id, title, message, type, related_id)
        VALUES (?, ?, ?, ?, ?)
      `, [prev.user_id, notifTitle, notifMsg, notifType, String(requestId)])
    } catch (notifErr) {
      console.warn('Could not insert notification for client:', notifErr.message)
    }

    // Log Activity
    await logActivity(
      pool, 
      req, 
      'UPDATE', 
      'Certificate Requests', 
      `Request ID ${requestId}`, 
      `Status changed from ${prev.status} to ${status}`
    )

    res.json({ message: 'Certificate request updated successfully.' })
  } catch (e) { next(e) }
})

// 3. One-click / workflow certificate issuance linked to request
router.post('/admin/certificate-requests/:id/generate', async (req, res, next) => {
  try {
    const requestId = req.params.id
    const { 
      certificate_type,
      signer_name,
      signer_title,
      or_number,
      custom_owner_name,
      custom_tax_declaration_no
    } = req.body

    const [requests] = await pool.query(`
      SELECT c.*, p.owner_id, CONCAT(u.first_name, ' ', u.last_name) as client_name
      FROM certificate_requests c
      LEFT JOIN properties p ON p.property_id = c.property_id
      JOIN users u ON u.user_id = c.user_id
      WHERE c.request_id = ?
    `, [requestId])

    if (requests.length === 0) return res.status(404).json({ message: 'Request not found' })
    const reqData = requests[0]

    // Determine owner_id
    let ownerId = reqData.owner_id
    if (!ownerId) {
      // Find user's linked owner
      const [userRows] = await pool.query('SELECT owner_id FROM users WHERE user_id = ?', [reqData.user_id])
      ownerId = userRows[0]?.owner_id
    }
    if (!ownerId) {
      return res.status(400).json({ message: 'No registered property owner found for this request. Please link an owner.' })
    }

    const certType = certificate_type || reqData.certificate_type || 'Template 1: Standard Certification'
    const reqName = custom_owner_name || reqData.client_name || 'Property Owner'
    const purp = reqData.purpose || 'For legal purposes'

    // Generate certificate number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    const certificate_number = `CERT-${dateStr}-${rand}`

    const [certResult] = await pool.query(`
      INSERT INTO generated_certificates 
      (certificate_number, certificate_type, owner_id, property_id, requestor_name, purpose, issued_by_user_id, custom_owner_name, custom_tax_declaration_no, signer_name, signer_title, or_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      certificate_number,
      certType,
      ownerId,
      reqData.property_id || null,
      reqName,
      purp,
      req.user.id,
      custom_owner_name ? custom_owner_name.trim() : null,
      custom_tax_declaration_no ? custom_tax_declaration_no.trim() : null,
      signer_name || 'MARIE MAE P. UBALDE',
      signer_title || 'OIC - Municipal Assessor',
      or_number || '4567695'
    ])

    const certificateId = certResult.insertId

    // Update request status to COMPLETED or APPROVED
    await pool.query(`
      UPDATE certificate_requests 
      SET status = 'COMPLETED', certificate_id = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [certificateId, req.user.id, requestId])

    // Send notification to client
    try {
      await pool.query(`
        INSERT INTO notifications (user_id, title, message, type, related_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        reqData.user_id, 
        'Official Certificate Ready', 
        `Your certificate (${certificate_number}) for request #${reqData.reference_number || reqData.request_id} has been generated and approved.`, 
        'SUCCESS', 
        String(requestId)
      ])
    } catch(err) {
      console.warn('Notification error:', err.message)
    }

    await logActivity(
      pool, 
      req, 
      'CREATE', 
      'Certificates', 
      `Certificate ${certificate_number}`, 
      `Generated certificate for request #${reqData.reference_number || reqData.request_id}`
    )

    res.status(201).json({
      message: 'Certificate successfully generated and linked to request.',
      certificate_id: certificateId,
      certificate_number
    })
  } catch (e) { next(e) }
})

export default router
