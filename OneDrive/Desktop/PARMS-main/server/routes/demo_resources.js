
import { Router } from 'express'
import { pool } from '../config/db.js'
const router = Router()

// Public demo endpoints for properties only (no auth) to allow quick frontend testing
const table = 'property_lots'
const columns = ['owner_id','address_id','property_type_id','classification_id','lot_number','title_number','location','lot_area','latitude','longitude','property_status']
const idColumn = 'lot_id'

// Fallback in-memory store when DB is not available (allows demo without DB config)
let demoStore = []
let nextId = 100000
let dbAvailable = true

router.get('/demo/properties', async (req, res, next) => {
	if (dbAvailable) try { const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY ${idColumn} DESC`); return res.json(rows) } catch (e) { dbAvailable = false }
	return res.json(demoStore.slice().reverse())
})

router.post('/demo/properties', async (req, res, next) => {
	if (dbAvailable) try { const values = columns.map(c => req.body[c] ?? null); const [r] = await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`, values); return res.status(201).json({ id: r.insertId, message: 'Record created (demo)' }) } catch (e) { dbAvailable = false }
	const id = nextId++
	const record = { }
	record[idColumn] = id
	for (const c of columns) record[c] = req.body[c] ?? null
	demoStore.push(record)
	return res.status(201).json({ id, message: 'Record created (in-memory demo)' })
})

router.put('/demo/properties/:id', async (req, res, next) => {
	if (dbAvailable) try { const values = [...columns.map(c => req.body[c] ?? null), req.params.id]; await pool.query(`UPDATE ${table} SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE ${idColumn} = ?`, values); return res.json({ message: 'Record updated (demo)' }) } catch (e) { dbAvailable = false }
	const id = Number(req.params.id)
	const idx = demoStore.findIndex(r => Number(r[idColumn]) === id)
	if (idx === -1) return res.status(404).json({ message: 'Record not found (in-memory demo)' })
	for (const c of columns) if (c in req.body) demoStore[idx][c] = req.body[c]
	return res.json({ message: 'Record updated (in-memory demo)' })
})

router.delete('/demo/properties/:id', async (req, res, next) => {
	if (dbAvailable) try { await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [req.params.id]); return res.status(204).end() } catch (e) { dbAvailable = false }
	const id = Number(req.params.id)
	const idx = demoStore.findIndex(r => Number(r[idColumn]) === id)
	if (idx === -1) return res.status(404).json({ message: 'Record not found (in-memory demo)' })
	demoStore.splice(idx, 1)
	return res.status(204).end()
})

export default router
