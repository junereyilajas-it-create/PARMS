import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'

const router = Router()

const LOT_MAP_QUERY = `
  SELECT 
    l.lot_id AS id,
    l.lot_id,
    l.property_id,
    l.lot_number AS title,
    l.lot_area AS area,
    l.lot_status AS status,
    'lot' AS type,
    p.property_status,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name, NULLIF(o.suffix, '')) AS owner,
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location,
    br.barangay_name,
    mu.municipality_name,
    pr.province_name,
    g.gis_id,
    g.geometry_type,
    g.coordinates,
    g.area_sqm,
    g.perimeter_m,
    COALESCE(g.mapping_status, 'verified') AS mapping_status,
    COALESCE(lah.assessment_status, 'unassessed') AS assessment_status,
    COALESCE(lah.market_value, 0) AS market_value,
    COALESCE(lah.assessed_value, 0) AS assessed_value
  FROM property_lots l
  JOIN properties p ON l.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN addresses ad ON p.address_id = ad.address_id
  LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
  LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
  LEFT JOIN provinces pr ON mu.province_id = pr.province_id
  LEFT JOIN gis_locations g ON g.gis_id = (
    SELECT g2.gis_id FROM gis_locations g2 
    WHERE g2.lot_id = l.lot_id OR (g2.property_id = p.property_id AND g2.lot_id IS NULL AND g2.building_id IS NULL)
    ORDER BY g2.gis_id DESC LIMIT 1
  )
  LEFT JOIN lot_assessment_history lah ON lah.lot_assessment_history_id = (
    SELECT h.lot_assessment_history_id FROM lot_assessment_history h 
    WHERE h.lot_id = l.lot_id 
    ORDER BY h.assessment_date DESC, h.lot_assessment_history_id DESC LIMIT 1
  )
`

const BLDG_MAP_QUERY = `
  SELECT 
    b.building_id AS id,
    b.building_id,
    b.property_id,
    b.building_name AS title,
    b.floor_area AS area,
    b.building_status AS status,
    'building' AS type,
    p.property_status,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name, NULLIF(o.suffix, '')) AS owner,
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS location,
    br.barangay_name,
    mu.municipality_name,
    pr.province_name,
    g.gis_id,
    g.geometry_type,
    g.coordinates,
    g.area_sqm,
    g.perimeter_m,
    COALESCE(g.mapping_status, 'verified') AS mapping_status,
    COALESCE(bah.assessment_status, 'unassessed') AS assessment_status,
    COALESCE(bah.market_value, 0) AS market_value,
    COALESCE(bah.assessed_value, 0) AS assessed_value
  FROM property_buildings b
  JOIN properties p ON b.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN addresses ad ON p.address_id = ad.address_id
  LEFT JOIN barangays br ON ad.barangay_id = br.barangay_id
  LEFT JOIN municipalities mu ON br.municipality_id = mu.municipality_id
  LEFT JOIN provinces pr ON mu.province_id = pr.province_id
  LEFT JOIN gis_locations g ON g.gis_id = (
    SELECT g2.gis_id FROM gis_locations g2 
    WHERE g2.building_id = b.building_id OR (g2.property_id = p.property_id AND g2.lot_id IS NULL AND g2.building_id IS NULL)
    ORDER BY g2.gis_id DESC LIMIT 1
  )
  LEFT JOIN building_assessment_history bah ON bah.building_assessment_history_id = (
    SELECT h.building_assessment_history_id FROM building_assessment_history h 
    WHERE h.building_id = b.building_id 
    ORDER BY h.assessment_date DESC, h.building_assessment_history_id DESC LIMIT 1
  )
`

router.get('/maps/properties', authenticate, allowRoles('admin', 'assessor', 'staff', 'super_admin'), async (_, res, next) => {
  try {
    const [lots] = await pool.query(LOT_MAP_QUERY + ' ORDER BY l.lot_id DESC')
    const [bldgs] = await pool.query(BLDG_MAP_QUERY + ' ORDER BY b.building_id DESC')
    res.json([...lots, ...bldgs])
  } catch (e) {
    next(e)
  }
})

router.get('/maps/property/:id', authenticate, allowRoles('admin', 'assessor', 'staff', 'super_admin', 'client', 'owner'), async (req, res, next) => {
  try {
    const id = req.params.id
    const [lots] = await pool.query(`${LOT_MAP_QUERY} WHERE l.lot_id = ? OR l.property_id = ? LIMIT 1`, [id, id])
    if (lots[0]) return res.json(lots[0])
    const [bldgs] = await pool.query(`${BLDG_MAP_QUERY} WHERE b.building_id = ? OR b.property_id = ? LIMIT 1`, [id, id])
    if (bldgs[0]) return res.json(bldgs[0])
    res.status(404).json({ message: 'Property not found' })
  } catch (e) {
    next(e)
  }
})

router.get('/maps/barangay/:barangay', authenticate, allowRoles('admin', 'assessor', 'staff', 'super_admin'), async (req, res, next) => {
  try {
    const param = `%${req.params.barangay}%`
    const [lots] = await pool.query(`${LOT_MAP_QUERY} WHERE br.barangay_name LIKE ?`, [param])
    const [bldgs] = await pool.query(`${BLDG_MAP_QUERY} WHERE br.barangay_name LIKE ?`, [param])
    res.json([...lots, ...bldgs])
  } catch (e) {
    next(e)
  }
})

export default router
