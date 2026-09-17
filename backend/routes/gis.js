import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// Admin/Staff/Assessor view all mapped properties
router.get('/gis/properties', authenticate, allowRoles('admin', 'assessor', 'staff'), async (req, res, next) => {
  try {
    const [lots] = await pool.query(`
      SELECT 
        l.lot_id as id,
        l.property_id,
        l.lot_number as title,
        l.lot_area as area,
        l.lot_status as status,
        g.gis_id,
        g.geometry_type,
        g.coordinates,
        g.area_sqm,
        g.perimeter_m,
        CONCAT_WS(' ', o.first_name, o.last_name) AS owner,
        p.property_status
      FROM property_lots l
      JOIN properties p ON l.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      JOIN gis_locations g ON g.lot_id = l.lot_id
    `)

    const [buildings] = await pool.query(`
      SELECT 
        b.building_id as id,
        b.property_id,
        b.building_name as title,
        b.floor_area as area,
        b.building_status as status,
        g.gis_id,
        g.geometry_type,
        g.coordinates,
        g.area_sqm,
        g.perimeter_m,
        CONCAT_WS(' ', o.first_name, o.last_name) AS owner,
        p.property_status
      FROM property_buildings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      JOIN gis_locations g ON g.building_id = b.building_id
    `)

    res.json({ lots, buildings })
  } catch (e) {
    next(e)
  }
})

// Client view their own properties
router.get('/gis/client-properties', authenticate, allowRoles('client'), async (req, res, next) => {
  try {
    const owner_id = req.user.owner_id
    if (!owner_id) {
        return res.json({ lots: [], buildings: [] })
    }

    const [lots] = await pool.query(`
      SELECT 
        l.lot_id as id,
        l.property_id,
        l.lot_number as title,
        l.lot_area as area,
        l.lot_status as status,
        g.gis_id,
        g.geometry_type,
        g.coordinates,
        g.area_sqm,
        g.perimeter_m,
        CONCAT_WS(' ', o.first_name, o.last_name) AS owner,
        p.property_status
      FROM property_lots l
      JOIN properties p ON l.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      JOIN gis_locations g ON g.lot_id = l.lot_id
      WHERE p.owner_id = ?
    `, [owner_id])

    const [buildings] = await pool.query(`
      SELECT 
        b.building_id as id,
        b.property_id,
        b.building_name as title,
        b.floor_area as area,
        b.building_status as status,
        g.gis_id,
        g.geometry_type,
        g.coordinates,
        g.area_sqm,
        g.perimeter_m,
        CONCAT_WS(' ', o.first_name, o.last_name) AS owner,
        p.property_status
      FROM property_buildings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN property_owners o ON p.owner_id = o.owner_id
      JOIN gis_locations g ON g.building_id = b.building_id
      WHERE p.owner_id = ?
    `, [owner_id])

    res.json({ lots, buildings })
  } catch (e) {
    next(e)
  }
})

// Save Lot GIS
router.post('/gis/lots/:lotId', authenticate, allowRoles('admin', 'assessor'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const lot_id = req.params.lotId
    const { coordinates, area_sqm, perimeter_m, property_id } = req.body
    
    if (!coordinates || !property_id) {
      return res.status(400).json({ message: 'Coordinates and property_id are required' })
    }

    await connection.beginTransaction()
    
    // Check if lot exists
    const [lotCheck] = await connection.query('SELECT lot_id FROM property_lots WHERE lot_id = ?', [lot_id])
    if (!lotCheck.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Lot not found' })
    }

    // Upsert GIS location
    await connection.query(`
      INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m) 
      VALUES (?, ?, 'Polygon', ?, ?, ?)
    `, [property_id, lot_id, JSON.stringify(coordinates), area_sqm, perimeter_m])
    
    await logActivity(connection, req, 'CREATE', 'GIS', `Lot ${lot_id}`, `Drawn GIS boundary for Lot ${lot_id}`)
    
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
router.post('/gis/buildings/:buildingId', authenticate, allowRoles('admin', 'assessor'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const building_id = req.params.buildingId
    const { coordinates, area_sqm, perimeter_m, property_id } = req.body
    
    if (!coordinates || !property_id) {
      return res.status(400).json({ message: 'Coordinates and property_id are required' })
    }

    await connection.beginTransaction()
    
    // Check if building exists
    const [bldgCheck] = await connection.query('SELECT building_id FROM property_buildings WHERE building_id = ?', [building_id])
    if (!bldgCheck.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Building not found' })
    }

    // Upsert GIS location
    await connection.query(`
      INSERT INTO gis_locations (property_id, building_id, geometry_type, coordinates, area_sqm, perimeter_m) 
      VALUES (?, ?, 'Polygon', ?, ?, ?)
    `, [property_id, building_id, JSON.stringify(coordinates), area_sqm, perimeter_m])
    
    await logActivity(connection, req, 'CREATE', 'GIS', `Building ${building_id}`, `Drawn GIS boundary for Building ${building_id}`)
    
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
router.delete('/gis/lots/:lotId', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM gis_locations WHERE lot_id = ?', [req.params.lotId])
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

// Delete Building GIS
router.delete('/gis/buildings/:buildingId', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM gis_locations WHERE building_id = ?', [req.params.buildingId])
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

export default router
