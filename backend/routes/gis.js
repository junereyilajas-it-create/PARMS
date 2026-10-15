import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

const LOT_GIS_QUERY = `
  SELECT 
    l.lot_id AS id,
    l.lot_id,
    l.property_id,
    l.lot_number AS title,
    l.title_number,
    l.lot_area AS area,
    l.lot_status AS status,
    'lot' AS type,
    p.property_status,
    pc.classification_name,
    pt.property_type_name,
    COALESCE(l.property_photo, p.property_photo, lah.property_photo) AS property_photo,
    o.owner_id,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner,
    o.contact_number AS owner_contact,
    o.email AS owner_email,
    CONCAT_WS(', ', NULLIF(oad.street, ''), obr.barangay_name, omu.municipality_name, opr.province_name) AS owner_address,
    ad.house_number,
    ad.street,
    br.barangay_name,
    mu.municipality_name,
    pr.province_name,
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS full_address,
    g.gis_id,
    g.geometry_type,
    g.coordinates,
    g.area_sqm,
    g.perimeter_m,
    COALESCE(lah.assessment_status, pa.assessment_status, 'unassessed') AS assessment_status,
    COALESCE(lah.assessor_level, pa.assessor_level) AS assessor_level,
    COALESCE(lah.market_value, pa.market_value, 0) AS market_value,
    COALESCE(lah.assessed_value, pa.assessed_value, 0) AS assessed_value,
    COALESCE(lah.assessment_date, pa.assessment_date) AS assessment_date,
    CONCAT_WS(' ', u.first_name, u.last_name) AS assessor_name,
    aa.assignment_id,
    aa.assignment_status,
    aa.due_date AS assignment_due_date,
    CONCAT_WS(' ', assign_u.first_name, assign_u.last_name) AS assigned_assessor_name
  FROM property_lots l
  JOIN properties p ON l.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN owner_addresses oa ON oa.owner_address_id = (
    SELECT oa2.owner_address_id FROM owner_addresses oa2 WHERE oa2.owner_id = o.owner_id LIMIT 1
  )
  LEFT JOIN addresses oad ON oad.address_id = oa.address_id
  LEFT JOIN barangays obr ON obr.barangay_id = oad.barangay_id
  LEFT JOIN municipalities omu ON omu.municipality_id = obr.municipality_id
  LEFT JOIN provinces opr ON opr.province_id = omu.province_id
  LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
  LEFT JOIN property_types pt ON p.property_type_id = pt.property_type_id
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
  LEFT JOIN property_assessments pa ON pa.assessment_id = (
    SELECT a.assessment_id FROM property_assessments a 
    WHERE a.property_id = p.property_id 
    ORDER BY a.assessment_date DESC, a.assessment_id DESC LIMIT 1
  )
  LEFT JOIN users u ON u.user_id = COALESCE(lah.assessor_user_id, pa.assessor_user_id)
  LEFT JOIN assessment_assignments aa ON aa.assignment_id = (
    SELECT a2.assignment_id FROM assessment_assignments a2 
    WHERE a2.property_type = 'lot' AND (a2.target_id_int = l.lot_id OR a2.target_id_str = l.lot_number)
    AND a2.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted')
    ORDER BY a2.assignment_id DESC LIMIT 1
  )
  LEFT JOIN users assign_u ON assign_u.user_id = aa.assigned_to_user_id
`

const BLDG_GIS_QUERY = `
  SELECT 
    b.building_id AS id,
    b.building_id,
    b.property_id,
    b.building_name AS title,
    b.building_type,
    b.floor_area AS area,
    b.floor_count,
    b.construction_type,
    b.year_constructed,
    b.building_status AS status,
    'building' AS type,
    p.property_status,
    pc.classification_name,
    pt.property_type_name,
    COALESCE(b.property_photo, p.property_photo, bah.property_photo) AS property_photo,
    o.owner_id,
    CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner,
    o.contact_number AS owner_contact,
    o.email AS owner_email,
    CONCAT_WS(', ', NULLIF(oad.street, ''), obr.barangay_name, omu.municipality_name, opr.province_name) AS owner_address,
    ad.house_number,
    ad.street,
    br.barangay_name,
    mu.municipality_name,
    pr.province_name,
    CONCAT_WS(', ', NULLIF(ad.street, ''), br.barangay_name, mu.municipality_name, pr.province_name) AS full_address,
    g.gis_id,
    g.geometry_type,
    g.coordinates,
    g.area_sqm,
    g.perimeter_m,
    COALESCE(bah.assessment_status, pa.assessment_status, 'unassessed') AS assessment_status,
    COALESCE(bah.assessor_level, pa.assessor_level) AS assessor_level,
    COALESCE(bah.market_value, pa.market_value, 0) AS market_value,
    COALESCE(bah.assessed_value, pa.assessed_value, 0) AS assessed_value,
    COALESCE(bah.assessment_date, pa.assessment_date) AS assessment_date,
    CONCAT_WS(' ', u.first_name, u.last_name) AS assessor_name,
    aa.assignment_id,
    aa.assignment_status,
    aa.due_date AS assignment_due_date,
    CONCAT_WS(' ', assign_u.first_name, assign_u.last_name) AS assigned_assessor_name
  FROM property_buildings b
  JOIN properties p ON b.property_id = p.property_id
  LEFT JOIN property_owners o ON p.owner_id = o.owner_id
  LEFT JOIN owner_addresses oa ON oa.owner_address_id = (
    SELECT oa2.owner_address_id FROM owner_addresses oa2 WHERE oa2.owner_id = o.owner_id LIMIT 1
  )
  LEFT JOIN addresses oad ON oad.address_id = oa.address_id
  LEFT JOIN barangays obr ON obr.barangay_id = oad.barangay_id
  LEFT JOIN municipalities omu ON omu.municipality_id = obr.municipality_id
  LEFT JOIN provinces opr ON opr.province_id = omu.province_id
  LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
  LEFT JOIN property_types pt ON p.property_type_id = pt.property_type_id
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
  LEFT JOIN property_assessments pa ON pa.assessment_id = (
    SELECT a.assessment_id FROM property_assessments a 
    WHERE a.property_id = p.property_id 
    ORDER BY a.assessment_date DESC, a.assessment_id DESC LIMIT 1
  )
  LEFT JOIN users u ON u.user_id = COALESCE(bah.assessor_user_id, pa.assessor_user_id)
  LEFT JOIN assessment_assignments aa ON aa.assignment_id = (
    SELECT a2.assignment_id FROM assessment_assignments a2 
    WHERE a2.property_type = 'building' AND (a2.target_id_int = b.building_id OR a2.target_id_str = b.building_name)
    AND a2.assignment_status IN ('assigned', 'in_progress', 'pending', 'submitted')
    ORDER BY a2.assignment_id DESC LIMIT 1
  )
  LEFT JOIN users assign_u ON assign_u.user_id = aa.assigned_to_user_id
`

// Admin/Staff/Assessor/SuperAdmin view all properties (both mapped and unmapped)
router.get('/gis/properties', authenticate, allowRoles('admin', 'assessor', 'staff', 'super_admin'), async (req, res, next) => {
  try {
    const [lots] = await pool.query(LOT_GIS_QUERY + ' ORDER BY l.lot_id DESC')
    const [buildings] = await pool.query(BLDG_GIS_QUERY + ' ORDER BY b.building_id DESC')
    res.json({ lots, buildings })
  } catch (e) {
    next(e)
  }
})

// Client view their own properties
router.get('/gis/client-properties', authenticate, allowRoles('client', 'owner'), async (req, res, next) => {
  try {
    const owner_id = req.user.owner_id
    if (!owner_id) {
      return res.json({ lots: [], buildings: [] })
    }

    const [lots] = await pool.query(`${LOT_GIS_QUERY} WHERE p.owner_id = ? ORDER BY l.lot_id DESC`, [owner_id])
    const [buildings] = await pool.query(`${BLDG_GIS_QUERY} WHERE p.owner_id = ? ORDER BY b.building_id DESC`, [owner_id])
    res.json({ lots, buildings })
  } catch (e) {
    next(e)
  }
})

// Get single property details by unique entity or property id
router.get('/gis/property/:id', authenticate, allowRoles('admin', 'assessor', 'staff', 'super_admin', 'client', 'owner'), async (req, res, next) => {
  try {
    const id = req.params.id
    // Check if it's a lot
    const [lotRows] = await pool.query(`${LOT_GIS_QUERY} WHERE l.lot_id = ? OR l.property_id = ? OR l.lot_number = ? LIMIT 1`, [id, id, id])
    if (lotRows.length > 0) {
      return res.json({ ...lotRows[0], type: 'lot' })
    }

    // Check if it's a building
    const [bldgRows] = await pool.query(`${BLDG_GIS_QUERY} WHERE b.building_id = ? OR b.property_id = ? OR b.building_name = ? LIMIT 1`, [id, id, id])
    if (bldgRows.length > 0) {
      return res.json({ ...bldgRows[0], type: 'building' })
    }

    return res.status(404).json({ message: 'Property not found' })
  } catch (e) {
    next(e)
  }
})

// Save Lot GIS
router.post('/gis/lots/:lotId', authenticate, allowRoles('admin', 'assessor', 'super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const lot_id = req.params.lotId
    let { coordinates, area_sqm, perimeter_m, property_id } = req.body
    
    if (!coordinates || !property_id) {
      return res.status(400).json({ message: 'Coordinates and property_id are required' })
    }

    let coordJson = coordinates
    if (typeof coordJson === 'string') {
      try { coordJson = JSON.parse(coordJson) } catch (e) {}
    }

    await connection.beginTransaction()
    
    // Check if lot exists
    const [lotCheck] = await connection.query('SELECT lot_id FROM property_lots WHERE lot_id = ?', [lot_id])
    if (!lotCheck.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Lot not found' })
    }

    // Prevent duplicates: Check if GIS already exists for this lot
    const [existingGis] = await connection.query('SELECT gis_id FROM gis_locations WHERE lot_id = ?', [lot_id])
    if (existingGis.length > 0) {
      await connection.query(`
        UPDATE gis_locations 
        SET property_id = ?, geometry_type = 'Polygon', coordinates = ?, area_sqm = ?, perimeter_m = ?
        WHERE lot_id = ?
      `, [property_id, JSON.stringify(coordJson), Number(area_sqm) || 0, Number(perimeter_m) || 0, lot_id])
    } else {
      await connection.query(`
        INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m) 
        VALUES (?, ?, 'Polygon', ?, ?, ?)
      `, [property_id, lot_id, JSON.stringify(coordJson), Number(area_sqm) || 0, Number(perimeter_m) || 0])
    }
    
    await logActivity(connection, req, 'CREATE', 'GIS', `Lot ${lot_id}`, `Updated GIS boundary for Lot ${lot_id}`)
    
    await connection.commit()
    res.status(201).json({ message: 'Lot GIS saved successfully' })
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

// Save Building GIS
router.post('/gis/buildings/:buildingId', authenticate, allowRoles('admin', 'assessor', 'super_admin'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const building_id = req.params.buildingId
    let { coordinates, area_sqm, perimeter_m, property_id } = req.body
    
    if (!coordinates || !property_id) {
      return res.status(400).json({ message: 'Coordinates and property_id are required' })
    }

    let coordJson = coordinates
    if (typeof coordJson === 'string') {
      try { coordJson = JSON.parse(coordJson) } catch (e) {}
    }

    await connection.beginTransaction()
    
    // Check if building exists
    const [bldgCheck] = await connection.query('SELECT building_id FROM property_buildings WHERE building_id = ?', [building_id])
    if (!bldgCheck.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Building not found' })
    }

    // Prevent duplicates: Check if GIS already exists for this building
    const [existingGis] = await connection.query('SELECT gis_id FROM gis_locations WHERE building_id = ?', [building_id])
    if (existingGis.length > 0) {
      await connection.query(`
        UPDATE gis_locations 
        SET property_id = ?, geometry_type = 'Polygon', coordinates = ?, area_sqm = ?, perimeter_m = ?
        WHERE building_id = ?
      `, [property_id, JSON.stringify(coordJson), Number(area_sqm) || 0, Number(perimeter_m) || 0, building_id])
    } else {
      await connection.query(`
        INSERT INTO gis_locations (property_id, building_id, geometry_type, coordinates, area_sqm, perimeter_m) 
        VALUES (?, ?, 'Polygon', ?, ?, ?)
      `, [property_id, building_id, JSON.stringify(coordJson), Number(area_sqm) || 0, Number(perimeter_m) || 0])
    }
    
    await logActivity(connection, req, 'CREATE', 'GIS', `Building ${building_id}`, `Updated GIS boundary for Building ${building_id}`)
    
    await connection.commit()
    res.status(201).json({ message: 'Building GIS saved successfully' })
  } catch (e) {
    await connection.rollback()
    next(e)
  } finally {
    connection.release()
  }
})

// Delete Lot GIS
router.delete('/gis/lots/:lotId', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM gis_locations WHERE lot_id = ?', [req.params.lotId])
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

// Delete Building GIS
router.delete('/gis/buildings/:buildingId', authenticate, allowRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM gis_locations WHERE building_id = ?', [req.params.buildingId])
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

export default router
