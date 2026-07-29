import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
const router = Router()
const config = {
  owners: { table: 'property_owners', columns: ['fullname','address','contact','email'] },
  properties: { table: 'properties', columns: ['owner_id','property_type','location','lot_number','area','building_area','building_age','building_materials','floors','rooms','market_value','assessed_value','classification','latitude','longitude','gps_accuracy','map_marker_color'] },
  assessments: { table: 'assessments', columns: ['property_id','assessment_level','market_value','assessed_value','assessment_date'] },
  declarations: { table: 'tax_declarations', columns: ['property_id','declaration_number','tax_year','issue_date'] },
  users: { table: 'users', columns: ['fullname','username','password','role'] },
}
for (const [path, { table, columns }] of Object.entries(config)) {
  router.get(`/${path}`, authenticate, async (req, res, next) => { try { const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY id DESC`); res.json(rows) } catch (e) { next(e) } })
  router.get(`/${path}/:id`, authenticate, async (req, res, next) => { try { const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]); rows[0] ? res.json(rows[0]) : res.status(404).json({ message: 'Record not found' }) } catch (e) { next(e) } })
  router.post(`/${path}`, authenticate, allowRoles('admin','staff'), async (req, res, next) => { try { const values = columns.map(c => req.body[c]); const [r] = await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values); res.status(201).json({ id: r.insertId, message: 'Record created' }) } catch (e) { next(e) } })
  router.put(`/${path}/:id`, authenticate, allowRoles('admin','staff'), async (req, res, next) => { try { const values = [...columns.map(c => req.body[c]), req.params.id]; await pool.query(`UPDATE ${table} SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, values); res.json({ message: 'Record updated' }) } catch (e) { next(e) } })
  router.delete(`/${path}/:id`, authenticate, allowRoles('admin'), async (req, res, next) => { try { await pool.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]); res.status(204).end() } catch (e) { next(e) } })
}
export default router
