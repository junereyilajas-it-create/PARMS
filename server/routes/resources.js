import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()
// Read models keep relationship data useful to the UI while the individual
// resources above remain available for normal table-level CRUD.
router.get('/property-records', authenticate, async (_, res, next) => { try {
  const [rows] = await pool.query(`SELECT p.property_id, p.property_status, l.lot_id, l.lot_number, l.title_number, l.location, l.lot_area, l.latitude, l.longitude,
    CONCAT(o.first_name, ' ', o.last_name) AS owner, t.property_type_name AS property_type, c.classification_name,
    COALESCE(a.market_value, b.market_value, 0) AS market_value, COALESCE(a.assessed_value, b.assessed_value, 0) AS assessed_value
    FROM properties p JOIN property_owners o ON o.owner_id = p.owner_id JOIN property_types t ON t.property_type_id = p.property_type_id
    JOIN property_classifications c ON c.classification_id = p.classification_id LEFT JOIN property_lots l ON l.property_id = p.property_id
    LEFT JOIN property_assessments a ON a.assessment_id = (SELECT pa.assessment_id FROM property_assessments pa WHERE pa.property_id = p.property_id ORDER BY pa.assessment_date DESC, pa.assessment_id DESC LIMIT 1)
    LEFT JOIN property_buildings b ON b.property_id = p.property_id ORDER BY p.property_id DESC`)
  res.json(rows)
} catch (e) { next(e) } })
const config = {
  addresses: { table: 'addresses', idColumn: 'address_id', columns: ['house_number','street','barangay','municipality','province','postal_code'] },
  owners: { table: 'property_owners', idColumn: 'owner_id', columns: ['first_name','middle_name','last_name','contact_number','email'] },
  ownerAddresses: { table: 'owner_addresses', idColumn: 'owner_address_id', columns: ['owner_id','address_id'] },
  propertyTypes: { table: 'property_types', idColumn: 'property_type_id', columns: ['property_type_name'] },
  classifications: { table: 'property_classifications', idColumn: 'classification_id', columns: ['classification_name'] },
  assessmentLevels: { table: 'assessment_levels', idColumn: 'assessment_level_id', columns: ['classification_id','assessment_percentage'] },
  properties: { table: 'properties', idColumn: 'property_id', columns: ['owner_id','address_id','property_type_id','classification_id','property_status'] },
  lots: { table: 'property_lots', idColumn: 'lot_id', columns: ['property_id','lot_number','title_number','location','lot_area','latitude','longitude','lot_status'] },
  buildings: { table: 'property_buildings', idColumn: 'building_id', columns: ['property_id','building_name','building_type','floor_area','floor_count','construction_type','year_constructed','market_value','assessed_value','building_status'] },
  lotHistory: { table: 'lot_history', idColumn: 'lot_history_id', columns: ['lot_id','owner_id','ownership_type','transfer_reason','transfer_date','end_date','is_current_owner','registered_by_user_id','remarks'] },
  lotAssessmentHistory: { table: 'lot_assessment_history', idColumn: 'lot_assessment_history_id', columns: ['lot_id','assessor_user_id','assessment_level_id','market_value','assessed_value','assessment_date','assessment_reason','remarks'] },
  buildingHistory: { table: 'building_history', idColumn: 'building_history_id', columns: ['building_id','owner_id','ownership_type','transfer_reason','transfer_date','end_date','is_current_owner','registered_by_user_id','remarks'] },
  buildingAssessmentHistory: { table: 'building_assessment_history', idColumn: 'building_assessment_history_id', columns: ['building_id','assessor_user_id','assessment_level_id','market_value','assessed_value','assessment_date','assessment_reason','remarks'] },
  assessments: { table: 'property_assessments', idColumn: 'assessment_id', columns: ['property_id','assessor_user_id','assessment_level_id','market_value','assessed_value','assessment_date','remarks'] },
  declarations: { table: 'tax_declarations', idColumn: 'tax_declaration_id', columns: ['property_id','assessment_id','declaration_number','tax_year','issue_date'] },
  predictions: { table: 'ai_predictions', idColumn: 'prediction_id', columns: ['property_id','predicted_market_value','predicted_assessed_value','confidence_score','prediction_reason','approved_by_user_id','prediction_status'] },
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
  router.post(`/${path}`, authenticate, allowRoles('admin','staff'), async (req, res, next) => { try { const values = columns.map(c => req.body[c]); const [r] = await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values); res.status(201).json({ id: r.insertId, message: 'Record created' }) } catch (e) { next(e) } })
  router.put(`/${path}/:id`, authenticate, allowRoles('admin','staff'), async (req, res, next) => { try { const values = [...columns.map(c => req.body[c]), req.params.id]; await pool.query(`UPDATE ${table} SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE ${idColumn} = ?`, values); res.json({ message: 'Record updated' }) } catch (e) { next(e) } })
  router.delete(`/${path}/:id`, authenticate, allowRoles('admin'), async (req, res, next) => { try { await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [req.params.id]); res.status(204).end() } catch (e) { next(e) } })
}
export default router
