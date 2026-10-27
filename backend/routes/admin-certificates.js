import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, loadPermissions } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// Certificate Management: Staff & Super Admin have access. Admin and Client are restricted.
router.use('/admin/certificate-requests', authenticate, loadPermissions, (req, res, next) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ message: 'Admin is not permitted to access certificate management. Certificate management is handled by Staff.' });
  }
  if (['super_admin', 'staff'].includes(req.user.role)) return next();
  if (req.user.permissions?.includes('MANAGE_CERTIFICATES')) return next();
  return res.status(403).json({ message: 'Insufficient permissions. You require certificate management authorization.' });
});

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
        c.released_at,
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
        COALESCE(po.owner_id, u.owner_id) AS owner_id,
        COALESCE(CONCAT(po.first_name, ' ', po.last_name), CONCAT(u.first_name, ' ', u.last_name)) AS owner_name,
        COALESCE(po.contact_number, c.contact_number) AS owner_contact,
        CONCAT(r.first_name, ' ', r.last_name) AS reviewer_name,
        CONCAT(st.first_name, ' ', st.last_name) AS assigned_staff_name,
        CONCAT(rel.first_name, ' ', rel.last_name) AS released_by_name
      FROM certificate_requests c
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN properties p ON p.property_id = c.property_id
      LEFT JOIN property_owners po ON (po.owner_id = p.owner_id OR po.owner_id = u.owner_id)
      LEFT JOIN property_types t ON t.property_type_id = p.property_type_id
      LEFT JOIN property_lots l ON l.property_id = p.property_id
      LEFT JOIN property_buildings b ON b.property_id = p.property_id
      LEFT JOIN tax_declarations td ON td.property_id = p.property_id
      LEFT JOIN addresses ad ON p.address_id = ad.address_id
      LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
      LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
      LEFT JOIN users r ON r.user_id = c.reviewed_by
      LEFT JOIN users st ON st.user_id = c.assigned_to
      LEFT JOIN users rel ON rel.user_id = c.released_by
      LEFT JOIN generated_certificates gc ON gc.certificate_id = c.certificate_id
      ORDER BY c.requested_at DESC
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

// 2. Update certificate request status & workflow:
// Workflow: PENDING -> APPROVED -> IN_PROGRESS -> READY_FOR_PICKUP -> RELEASED
// Or: PENDING -> REJECTED
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

    // Role-based validation: Staff or Super Admin only
    const userRole = (req.user?.role || '').toLowerCase()
    if (userRole === 'admin') {
      return res.status(403).json({ message: 'Admin is not permitted to manage certificates.' })
    }

    // Prevent duplicate processing
    if (prev.status === status) {
      return res.status(400).json({ message: `Request is already in ${status} status.` })
    }

    // Terminal status guards
    if (prev.status === 'RELEASED') {
      return res.status(400).json({ message: 'This certificate request has already been released and cannot be modified.' })
    }
    if (prev.status === 'REJECTED') {
      return res.status(400).json({ message: 'This certificate request was rejected and cannot be modified.' })
    }

    // Rejection validation: Reason is strictly required
    if (status === 'REJECTED') {
      if (!rejection_reason || !rejection_reason.trim()) {
        return res.status(400).json({ message: 'A rejection reason is required when rejecting a certificate request.' })
      }
    }

    // Workflow validation: Pending → Approved → In Progress → Ready for Pickup → Released
    const validTransitions = {
      'PENDING': ['APPROVED', 'REJECTED'],
      'APPROVED': ['IN_PROGRESS', 'PROCESSING', 'REJECTED'],
      'IN_PROGRESS': ['READY_FOR_PICKUP', 'REJECTED'],
      'PROCESSING': ['READY_FOR_PICKUP', 'REJECTED'],
      'UNDER_REVIEW': ['READY_FOR_PICKUP', 'REJECTED'],
      'READY_FOR_PICKUP': ['RELEASED'],
      'RELEASED': [],
      'REJECTED': []
    }

    const allowed = validTransitions[prev.status] || []
    if (!allowed.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status transition from ${prev.status} to ${status}. Requests must follow: Pending → Approved → In Progress → Ready for Pickup → Released.` 
      })
    }

    const updates = []
    const params = []

    updates.push('status = ?')
    params.push(status)

    if (processing_notes !== undefined) {
      updates.push('processing_notes = ?')
      params.push(processing_notes ? processing_notes.trim() : null)
    }

    if (status === 'REJECTED') {
      updates.push('rejection_reason = ?')
      params.push(rejection_reason ? rejection_reason.trim() : null)
      updates.push('reviewed_by = ?')
      params.push(req.user.id)
      updates.push('reviewed_at = CURRENT_TIMESTAMP')
    } else if (rejection_reason !== undefined) {
      updates.push('rejection_reason = ?')
      params.push(rejection_reason ? rejection_reason.trim() : null)
    }

    if (status === 'APPROVED') {
      updates.push('reviewed_by = ?')
      params.push(req.user.id)
      updates.push('reviewed_at = CURRENT_TIMESTAMP')
    }

    if (status === 'IN_PROGRESS' || status === 'PROCESSING') {
      updates.push('assigned_to = ?')
      params.push(assigned_to || req.user.id)
    } else if (assigned_to !== undefined) {
      updates.push('assigned_to = ?')
      params.push(assigned_to || null)
    }

    if (certificate_id !== undefined) {
      updates.push('certificate_id = ?')
      params.push(certificate_id || null)
    }

    if (status === 'READY_FOR_PICKUP') {
      updates.push('completed_at = CURRENT_TIMESTAMP')
      if (!prev.assigned_to) {
        updates.push('assigned_to = ?')
        params.push(req.user.id)
      }
    }

    if (status === 'RELEASED') {
      updates.push('released_at = CURRENT_TIMESTAMP')
      updates.push('released_by = ?')
      params.push(req.user.id)
      if (!prev.completed_at) {
        updates.push('completed_at = CURRENT_TIMESTAMP')
      }
    }

    params.push(requestId)

    const query = `UPDATE certificate_requests SET ${updates.join(', ')} WHERE request_id = ?`
    await pool.query(query, params)

    // Notify requesting client/owner automatically
    try {
      const propIdDisplay = prev.property_id ? `PROPERTY-${prev.property_id}` : 'your registered property'
      const certTypeDisplay = prev.certificate_type || 'Certificate'
      const refNumberDisplay = prev.reference_number || `REQ-${prev.request_id}`

      let notifTitle = 'Certificate Request Update'
      let notifMsg = `Your request #${refNumberDisplay} status has been updated to ${status}.`
      let notifType = 'INFO'

      if (status === 'READY_FOR_PICKUP') {
        notifTitle = 'Certificate Ready for Pickup'
        // Exact message as required by specification:
        // "Your [Certificate Type] for property [Property ID] is ready for pickup at the Assessor's Office. Please bring your valid identification and request reference number when claiming your certificate."
        notifMsg = `Your ${certTypeDisplay} for property ${propIdDisplay} is ready for pickup at the Assessor's Office. Please bring your valid identification and request reference number when claiming your certificate.`
        notifType = 'CERTIFICATE_READY'
      } else if (status === 'APPROVED') {
        notifTitle = 'Certificate Request Approved'
        notifMsg = `Your ${certTypeDisplay} request (${refNumberDisplay}) for property ${propIdDisplay} has been approved by the Assessor's Office and is queued for preparation.`
        notifType = 'CERTIFICATE_APPROVED'
      } else if (status === 'IN_PROGRESS' || status === 'PROCESSING') {
        notifTitle = 'Certificate Preparation In Progress'
        notifMsg = `Staff has begun preparing your ${certTypeDisplay} for property ${propIdDisplay} (Ref: ${refNumberDisplay}).`
        notifType = 'CERTIFICATE_IN_PROGRESS'
      } else if (status === 'RELEASED') {
        notifTitle = 'Certificate Officially Released'
        notifMsg = `Your ${certTypeDisplay} (${refNumberDisplay}) for property ${propIdDisplay} has been officially released to you. Thank you!`
        notifType = 'CERTIFICATE_RELEASED'
      } else if (status === 'REJECTED') {
        notifTitle = 'Certificate Request Rejected'
        notifMsg = `Your ${certTypeDisplay} request (${refNumberDisplay}) for property ${propIdDisplay} was rejected. Reason: ${rejection_reason || 'Incomplete property documents'}`
        notifType = 'CERTIFICATE_REJECTED'
      }

      // Check deduplication: avoid duplicate unread notification for same user, type, and request
      const [existingNotif] = await pool.query(
        'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND related_id = ? AND is_read = FALSE',
        [prev.user_id, notifType, String(requestId)]
      )

      if (existingNotif.length === 0) {
        await pool.query(`
          INSERT INTO notifications (user_id, title, message, type, related_id)
          VALUES (?, ?, ?, ?, ?)
        `, [prev.user_id, notifTitle, notifMsg, notifType, String(requestId)])
      }
    } catch (notifErr) {
      console.warn('Could not insert notification for owner:', notifErr.message)
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

    res.json({ 
      message: `Certificate request #${prev.reference_number || requestId} status updated to ${status}.`,
      status
    })
  } catch (e) { next(e) }
})

// 3. One-click certificate issuance linked to request
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

    if (reqData.status === 'PENDING') {
      return res.status(400).json({ 
        message: 'Please review and approve the certificate request before preparing and generating the certificate.' 
      })
    }
    if (reqData.status === 'REJECTED') {
      return res.status(400).json({ message: 'Cannot generate a certificate for a rejected request.' })
    }
    if (reqData.status === 'RELEASED') {
      return res.status(400).json({ message: 'This certificate request has already been released.' })
    }

    // Determine owner_id
    let ownerId = reqData.owner_id
    if (!ownerId) {
      const [userRows] = await pool.query('SELECT owner_id FROM users WHERE user_id = ?', [reqData.user_id])
      ownerId = userRows[0]?.owner_id
    }
    if (!ownerId) {
      return res.status(400).json({ message: 'No registered property owner found for this request. Please link an owner.' })
    }

    const certType = certificate_type || reqData.certificate_type || 'Template 1: Standard Certification'
    const reqName = custom_owner_name || reqData.client_name || 'Property Owner'
    const purp = reqData.purpose || 'For legal purposes'

    // Generate unique certificate number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    const certificate_number = `CERT-${dateStr}-${rand}`

    const [certResult] = await pool.query(`
      INSERT INTO generated_certificates 
      (certificate_number, certificate_type, owner_id, property_id, requestor_name, purpose, issued_by_user_id, custom_owner_name, custom_tax_declaration_no, signer_name, signer_title, or_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Generated')
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

    // Mark as READY_FOR_PICKUP upon certificate preparation
    await pool.query(`
      UPDATE certificate_requests 
      SET status = 'READY_FOR_PICKUP', certificate_id = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [certificateId, req.user.id, requestId])

    // Send notification to owner
    try {
      const propIdDisplay = reqData.property_id ? `PROPERTY-${reqData.property_id}` : 'your registered property'
      const notifMsg = `Your ${certType} for property ${propIdDisplay} is ready for pickup at the Assessor's Office. Please bring your valid identification and request reference number when claiming your certificate.`
      
      const [existingNotif] = await pool.query(
        'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND related_id = ? AND is_read = FALSE',
        [reqData.user_id, 'CERTIFICATE_READY', String(requestId)]
      )

      if (existingNotif.length === 0) {
        await pool.query(`
          INSERT INTO notifications (user_id, title, message, type, related_id)
          VALUES (?, ?, ?, ?, ?)
        `, [
          reqData.user_id, 
          'Certificate Ready for Pickup', 
          notifMsg, 
          'CERTIFICATE_READY', 
          String(requestId)
        ])
      }
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
      message: 'Certificate successfully generated and marked ready for pickup.',
      certificate_id: certificateId,
      certificate_number,
      status: 'READY_FOR_PICKUP'
    })
  } catch (e) { next(e) }
})

export default router
