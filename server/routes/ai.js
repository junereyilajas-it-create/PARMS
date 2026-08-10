import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'

const router = Router()
const levels = { Residential: 20, Commercial: 50, Agricultural: 40, Industrial: 50 }

router.post('/ai/property-estimate', authenticate, allowRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { property_type = 'Residential', classification, lot_area = 0, building_area = 0, building_age = 0, property_id } = req.body
    const type = classification || property_type
    const [comparables] = await pool.query('SELECT l.lot_id AS id, l.location, l.lot_area AS area, b.market_value, b.assessed_value FROM property_lots l JOIN properties p ON p.property_id = l.property_id LEFT JOIN property_buildings b ON b.property_id = p.property_id LEFT JOIN property_types t ON t.property_type_id = p.property_type_id WHERE t.property_type_name = ? AND b.market_value IS NOT NULL ORDER BY l.lot_id DESC LIMIT 5', [property_type])
    const comparableAverage = comparables.length ? comparables.reduce((sum, p) => sum + Number(p.market_value), 0) / comparables.length : 0
    const sizeValue = Number(lot_area) * 1250 + Number(building_area) * 18500
    const ageAdjustment = Math.max(.65, 1 - Number(building_age) * .008)
    const estimated = Math.round((comparableAverage ? comparableAverage * .55 + sizeValue * .45 : sizeValue) * ageAdjustment)
    const assessmentLevel = levels[type] || 20
    const assessed = Math.round(estimated * assessmentLevel / 100)
    const confidence = Math.min(94, Math.round(62 + comparables.length * 6 + (building_area > 0 ? 4 : 0)))
    const reason = `Based on ${comparables.length || 'available'} comparable ${property_type.toLowerCase()} record(s), lot and building area, ${building_age || 0}-year building age, and the ${assessmentLevel}% ${type} assessment level.`
    let predictionId = null
    if (property_id) {
      const [result] = await pool.query('INSERT INTO ai_predictions (property_id, predicted_market_value, predicted_assessed_value, confidence_score, prediction_model, prediction_reason) VALUES (?, ?, ?, ?, ?, ?)', [property_id, estimated, assessed, confidence, 'Comparable Value Model v1', reason])
      predictionId = result.insertId
    }
    res.json({ prediction_id: predictionId, estimated_market_value: estimated, suggested_assessed_value: assessed, assessment_level: assessmentLevel, confidence_percentage: confidence, similar_properties: comparables, explanation: reason })
  } catch (error) { next(error) }
})

router.post('/ai/similar-properties', authenticate, async (req, res, next) => { try { const [rows] = await pool.query('SELECT l.lot_id AS id, l.location, t.property_type_name AS property_type, l.lot_area AS area, b.market_value, b.assessed_value FROM property_lots l JOIN properties p ON p.property_id = l.property_id LEFT JOIN property_buildings b ON b.property_id = p.property_id LEFT JOIN property_types t ON t.property_type_id = p.property_type_id WHERE t.property_type_name = ? ORDER BY l.lot_id DESC LIMIT 10', [req.body.property_type]); res.json(rows) } catch (e) { next(e) } })
router.get('/ai/history', authenticate, async (_, res, next) => { try { const [rows] = await pool.query('SELECT p.*, l.location, t.property_type_name AS property_type FROM ai_predictions p JOIN properties pr ON pr.property_id = p.property_id JOIN property_lots l ON l.property_id = pr.property_id JOIN property_types t ON t.property_type_id = pr.property_type_id ORDER BY prediction_date DESC'); res.json(rows) } catch (e) { next(e) } })
export default router
