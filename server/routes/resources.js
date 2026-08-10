import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()
const config = {
  owners: { table: 'property_owners', idColumn: 'owner_id', columns: ['first_name','middle_name','last_name','contact_number','email'] },
  properties: { table: 'properties', idColumn: 'property_id', columns: ['owner_id','address_id','property_type_id','classification_id','property_status'] },
  lots: { table: 'property_lots', idColumn: 'lot_id', columns: ['property_id','lot_number','title_number','location','lot_area','latitude','longitude','lot_status'] },
  buildings: { table: 'property_buildings', idColumn: 'building_id', columns: ['property_id','building_name','building_type','floor_area','floor_count','construction_type','year_constructed','market_value','assessed_value','building_status'] },
  assessments: { table: 'property_assessments', idColumn: 'assessment_id', columns: ['property_id','assessor_user_id','assessment_level_id','market_value','assessed_value','assessment_date','remarks'] },
  declarations: { table: 'tax_declarations', idColumn: 'tax_declaration_id', columns: ['property_id','assessment_id','declaration_number','tax_year','issue_date'] },
  users: { table: 'users', idColumn: 'user_id', columns: ['first_name','last_name','username','password_hash','email','role_id'] },
}
for (const [path, { table, columns, idColumn }] of Object.entries(config)) {
  router.get(`/${path}`, authenticate, async (req, res, next) => { try { const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY ${idColumn} DESC`); res.json(rows) } catch (e) { next(e) } })
  router.get(`/${path}/:id`, authenticate, async (req, res, next) => { try { const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [req.params.id]); rows[0] ? res.json(rows[0]) : res.status(404).json({ message: 'Record not found' }) } catch (e) { next(e) } })
  router.post(`/${path}`, authenticate, allowRoles('admin','staff'), async (req, res, next) => { try { const values = columns.map(c => req.body[c]); const [r] = await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values); res.status(201).json({ id: r.insertId, message: 'Record created' }) } catch (e) { next(e) } })
  router.put(`/${path}/:id`, authenticate, allowRoles('admin','staff'), async (req, res, next) => { try { const values = [...columns.map(c => req.body[c]), req.params.id]; await pool.query(`UPDATE ${table} SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE ${idColumn} = ?`, values); res.json({ message: 'Record updated' }) } catch (e) { next(e) } })
  router.delete(`/${path}/:id`, authenticate, allowRoles('admin'), async (req, res, next) => { try { await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [req.params.id]); res.status(204).end() } catch (e) { next(e) } })
}
export default router
