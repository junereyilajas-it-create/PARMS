import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()
// Read models keep relationship data useful to the UI while the individual
// resources above remain available for normal table-level CRUD.
router.get('/property-records', authenticate, async (_, res, next) => { try {
  const [rows] = await pool.query(`SELECT p.property_id, p.property_status, l.lot_id, l.lot_number, l.title_number, 
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location, 
    l.lot_area, g.latitude, g.longitude, l.lot_status,
    CONCAT(o.first_name, ' ', o.last_name) AS owner, t.property_type_name AS property_type, c.classification_name,
    COALESCE(a.market_value, 0) AS market_value, COALESCE((a.market_value * al.assessment_percentage / 100), 0) AS assessed_value
    FROM properties p 
    JOIN property_owners o ON o.owner_id = p.owner_id 
    JOIN property_types t ON t.property_type_id = p.property_type_id
    JOIN property_classifications c ON c.classification_id = p.classification_id 
    JOIN addresses ad ON ad.address_id = p.address_id
    JOIN barangays br ON br.barangay_id = ad.barangay_id
    JOIN municipalities mu ON mu.municipality_id = br.municipality_id
    JOIN provinces pr ON pr.province_id = mu.province_id
    LEFT JOIN property_lots l ON l.property_id = p.property_id
    LEFT JOIN gis_locations g ON g.property_id = p.property_id
    LEFT JOIN property_assessments a ON a.assessment_id = (SELECT pa.assessment_id FROM property_assessments pa WHERE pa.property_id = p.property_id ORDER BY pa.assessment_date DESC, pa.assessment_id DESC LIMIT 1)
    LEFT JOIN assessment_levels al ON al.assessment_level_id = a.assessment_level_id
    ORDER BY p.property_id DESC`)
  res.json(rows)
} catch (e) { next(e) } })

// Keep owner, address, and property creation atomic so incomplete records are
// never left in the database when a registration fails.
router.post('/properties/register', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { owner, street, barangay, type, lot_area, market_value, coordinates, document, lot_number, title_number } = req.body
    if (![owner, street, barangay, type].every(value => typeof value === 'string' && value.trim())) return res.status(400).json({ message: 'Owner name, street, barangay, and property type are required.' })
    const nameParts = owner.trim().split(/\s+/)
    const firstName = nameParts.shift()
    const lastName = nameParts.pop() || firstName
    const middleName = nameParts.join(' ') || null
    const [latitude, longitude] = typeof coordinates === 'string' ? coordinates.split(',').map(value => Number(value.trim())) : []
    const classifications = { Residential: 'Residential Lot', Commercial: 'Commercial Lot', Industrial: 'Industrial Lot', Agricultural: 'Agricultural Land' }

    await connection.beginTransaction()
    const [ownerResult] = await connection.query('INSERT INTO property_owners (first_name, middle_name, last_name) VALUES (?, ?, ?)', [firstName, middleName, lastName])
    
    // Default location
    const [provinceRows] = await connection.query('SELECT province_id FROM provinces WHERE province_name = ?', ['Misamis Oriental'])
    const provinceId = provinceRows[0]?.province_id || 1
    const [municipalityRows] = await connection.query('SELECT municipality_id FROM municipalities WHERE municipality_name = ? AND province_id = ?', ['Lagonglong', provinceId])
    const municipalityId = municipalityRows[0]?.municipality_id || 1
    let [barangayRows] = await connection.query('SELECT barangay_id FROM barangays WHERE barangay_name = ? AND municipality_id = ?', [barangay.trim(), municipalityId])
    let barangayId = barangayRows[0]?.barangay_id
    if (!barangayId) {
        const [brgyRes] = await connection.query('INSERT INTO barangays (municipality_id, barangay_name) VALUES (?, ?)', [municipalityId, barangay.trim()])
        barangayId = brgyRes.insertId
    }
    const [addressResult] = await connection.query('INSERT INTO addresses (street, barangay_id) VALUES (?, ?)', [street.trim(), barangayId])
    
    await connection.query('INSERT INTO owner_addresses (owner_id, address_id) VALUES (?, ?)', [ownerResult.insertId, addressResult.insertId])
    const [typeRows] = await connection.query('SELECT property_type_id FROM property_types WHERE property_type_name = ?', [type.trim()])
    const [classificationRows] = await connection.query('SELECT classification_id FROM property_classifications WHERE classification_name = ?', [classifications[type.trim()] || 'Residential Lot'])
    if (!typeRows[0] || !classificationRows[0]) throw Object.assign(new Error('The selected property type is not configured.'), { status: 400 })
    const [propertyResult] = await connection.query('INSERT INTO properties (owner_id, address_id, property_type_id, classification_id, property_status) VALUES (?, ?, ?, ?, ?)', [ownerResult.insertId, addressResult.insertId, typeRows[0].property_type_id, classificationRows[0].classification_id, 'pending'])
    const area = Number(lot_area)
    await connection.query('INSERT INTO property_lots (property_id, lot_number, title_number, lot_area, lot_status) VALUES (?, ?, ?, ?, ?)', [
      propertyResult.insertId,
      lot_number?.trim() || `PROPERTY-${propertyResult.insertId}`,
      title_number?.trim() || document?.trim() || null,
      Number.isFinite(area) ? area : null,
      'pending',
    ])
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) await connection.query('INSERT INTO gis_locations (property_id, latitude, longitude) VALUES (?, ?, ?)', [propertyResult.insertId, latitude, longitude])
    const value = Number(String(market_value || '').replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(value) && market_value !== '') await connection.query('INSERT INTO property_assessments (property_id, assessor_user_id, assessment_level_id, market_value, assessment_date, remarks) VALUES (?, ?, ?, ?, CURDATE(), ?)', [propertyResult.insertId, req.user.id, 1, value, document || null])
    await connection.commit()
    res.status(201).json({ id: propertyResult.insertId, owner, address, type: type.trim(), lot_area: lot_area || null, message: 'Property registered.' })
  } catch (e) {
    await connection.rollback()
    if (e.status === 400) return res.status(400).json({ message: e.message })
    next(e)
  } finally { connection.release() }
})

router.delete('/properties/:id', authenticate, allowRoles('admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const id = req.params.id

    // tax_declarations depend on property_assessments and properties
    await connection.query('DELETE FROM tax_declarations WHERE property_id = ?', [id])
    
    // assessment_appeals depend on property_assessments and properties
    await connection.query('DELETE FROM assessment_appeals WHERE property_id = ?', [id])
    
    await connection.query('DELETE FROM property_assessments WHERE property_id = ?', [id])
    await connection.query('DELETE FROM ai_predictions WHERE property_id = ?', [id])
    await connection.query('DELETE FROM gis_locations WHERE property_id = ?', [id])
    await connection.query('DELETE FROM ownership_transfers WHERE property_id = ?', [id])
    await connection.query('DELETE FROM certified_copy_issuances WHERE property_id = ?', [id])

    // property_inspections and inspection_photos
    const [inspections] = await connection.query('SELECT inspection_id FROM property_inspections WHERE property_id = ?', [id])
    if (inspections.length) {
      const inspIds = inspections.map(i => i.inspection_id)
      await connection.query('DELETE FROM inspection_photos WHERE inspection_id IN (?)', [inspIds])
      await connection.query('DELETE FROM property_inspections WHERE property_id = ?', [id])
    }

    // property_lots and histories
    const [lots] = await connection.query('SELECT lot_id FROM property_lots WHERE property_id = ?', [id])
    if (lots.length) {
      const lotIds = lots.map(l => l.lot_id)
      await connection.query('DELETE FROM lot_history WHERE lot_id IN (?)', [lotIds])
      await connection.query('DELETE FROM lot_assessment_history WHERE lot_id IN (?)', [lotIds])
      await connection.query('DELETE FROM property_lots WHERE property_id = ?', [id])
    }

    // property_buildings and histories
    const [buildings] = await connection.query('SELECT building_id FROM property_buildings WHERE property_id = ?', [id])
    if (buildings.length) {
      const bldgIds = buildings.map(b => b.building_id)
      await connection.query('DELETE FROM building_history WHERE building_id IN (?)', [bldgIds])
      await connection.query('DELETE FROM building_assessment_history WHERE building_id IN (?)', [bldgIds])
      await connection.query('DELETE FROM property_buildings WHERE property_id = ?', [id])
    }

    const [result] = await connection.query('DELETE FROM properties WHERE property_id = ?', [id])
    
    if (!result.affectedRows) {
      await connection.rollback()
      return res.status(404).json({ message: 'Record not found' })
    }
    
    await connection.commit()
    res.status(204).end()
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally { 
    connection.release() 
  }
})

const config = {
  provinces: { table: 'provinces', idColumn: 'province_id', columns: ['province_name'] },
  municipalities: { table: 'municipalities', idColumn: 'municipality_id', columns: ['province_id','municipality_name'] },
  barangays: { table: 'barangays', idColumn: 'barangay_id', columns: ['municipality_id','barangay_name'] },
  addresses: { table: 'addresses', idColumn: 'address_id', columns: ['house_number','street','barangay_id','postal_code'] },
  owners: { table: 'property_owners', idColumn: 'owner_id', columns: ['first_name','middle_name','last_name','contact_number','email'] },
  ownerAddresses: { table: 'owner_addresses', idColumn: 'owner_address_id', columns: ['owner_id','address_id'] },
  propertyTypes: { table: 'property_types', idColumn: 'property_type_id', columns: ['property_type_name'] },
  classifications: { table: 'property_classifications', idColumn: 'classification_id', columns: ['classification_name'] },
  assessmentLevels: { table: 'assessment_levels', idColumn: 'assessment_level_id', columns: ['classification_id','assessment_percentage'] },
  properties: { table: 'properties', idColumn: 'property_id', columns: ['owner_id','address_id','property_type_id','classification_id','property_status'] },
  lots: { table: 'property_lots', idColumn: 'lot_id', columns: ['property_id','lot_number','title_number','lot_area','lot_status'] },
  buildings: { table: 'property_buildings', idColumn: 'building_id', columns: ['property_id','building_name','building_type','floor_area','floor_count','construction_type','year_constructed','building_status'] },
  lotHistory: { table: 'lot_history', idColumn: 'lot_history_id', columns: ['lot_id','owner_id','ownership_type','transfer_reason','transfer_date','end_date','registered_by_user_id','remarks'] },
  lotAssessmentHistory: { table: 'lot_assessment_history', idColumn: 'lot_assessment_history_id', columns: ['lot_id','assessor_user_id','assessment_level_id','market_value','assessment_date','assessment_reason','remarks'] },
  buildingHistory: { table: 'building_history', idColumn: 'building_history_id', columns: ['building_id','owner_id','ownership_type','transfer_reason','transfer_date','end_date','registered_by_user_id','remarks'] },
  buildingAssessmentHistory: { table: 'building_assessment_history', idColumn: 'building_assessment_history_id', columns: ['building_id','assessor_user_id','assessment_level_id','market_value','assessment_date','assessment_reason','remarks'] },
  assessments: { table: 'property_assessments', idColumn: 'assessment_id', columns: ['property_id','assessor_user_id','assessment_level_id','market_value','assessment_date','remarks'] },
  declarations: { table: 'tax_declarations', idColumn: 'tax_declaration_id', columns: ['property_id','assessment_id','declaration_number','tax_year','issue_date'] },
  predictions: { table: 'ai_predictions', idColumn: 'prediction_id', columns: ['property_id','predicted_market_value','confidence_score','prediction_reason','approved_by_user_id','prediction_status'] },
  locations: { table: 'gis_locations', idColumn: 'location_id', columns: ['property_id','latitude','longitude','gps_accuracy'] },
  activityLogs: { table: 'activity_logs', idColumn: 'log_id', columns: ['user_id','module_name','activity','ip_address'] },
  users: { table: 'users', idColumn: 'user_id', columns: ['first_name','last_name','username','password_hash','email','role'] },
  transfers: { table: 'ownership_transfers', idColumn: 'transfer_id', columns: ['property_id','previous_owner_id','new_owner_id','transfer_reason','transfer_date','reference_number','remarks','processed_by_user_id'] },
  inspections: { table: 'property_inspections', idColumn: 'inspection_id', columns: ['property_id','inspector_user_id','scheduled_at','completed_at','inspection_status','property_condition','remarks'] },
  inspectionPhotos: { table: 'inspection_photos', idColumn: 'photo_id', columns: ['inspection_id','file_path','caption'] },
  appeals: { table: 'assessment_appeals', idColumn: 'appeal_id', columns: ['property_id','assessment_id','appellant_owner_id','appeal_reason','assigned_assessor_id','appeal_status','resolution','resolved_at'] },
  certifiedCopies: { table: 'certified_copy_issuances', idColumn: 'issuance_id', columns: ['property_id','certification_number','document_type','requestor_name','issued_by_user_id','purpose'] },
  backups: { table: 'database_backups', idColumn: 'backup_id', columns: ['file_name','file_path','file_size_bytes','checksum','backup_status','created_by_user_id'] },
}
for (const [path, { table, columns, idColumn }] of Object.entries(config)) {
  router.get(`/${path}`, authenticate, async (req, res, next) => { try { const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY ${idColumn} DESC`); res.json(rows) } catch (e) { next(e) } })
  router.get(`/${path}/:id`, authenticate, async (req, res, next) => { try { const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [req.params.id]); rows[0] ? res.json(rows[0]) : res.status(404).json({ message: 'Record not found' }) } catch (e) { next(e) } })
  router.post(`/${path}`, authenticate, allowRoles('admin','staff'), async (req, res, next) => { try {
    const values = columns.map(c => req.body[c] === '' ? null : req.body[c])
    const [result] = await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values)
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [result.insertId])
    res.status(201).json({ record: rows[0], message: 'Record created' })
  } catch (e) { next(e) } })
  router.put(`/${path}/:id`, authenticate, allowRoles('admin','staff'), async (req, res, next) => { try {
    const values = [...columns.map(c => req.body[c] === '' ? null : req.body[c]), req.params.id]
    const [result] = await pool.query(`UPDATE ${table} SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE ${idColumn} = ?`, values)
    if (!result.affectedRows) return res.status(404).json({ message: 'Record not found' })
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [req.params.id])
    res.json({ record: rows[0], message: 'Record updated' })
  } catch (e) { next(e) } })
  router.delete(`/${path}/:id`, authenticate, allowRoles('admin'), async (req, res, next) => { try {
    const [result] = await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ message: 'Record not found' })
    res.status(204).end()
  } catch (e) { next(e) } })
}
export default router
