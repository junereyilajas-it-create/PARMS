import { Router } from 'express'
import { pool } from '../config/db.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { logActivity, logPropertyHistory } from '../utils/logger.js'

const router = Router()

async function getOrInsertProvince(connection, provinceName) {
  if (!provinceName) return null
  const [rows] = await connection.query('SELECT province_id FROM provinces WHERE province_name = ?', [provinceName.trim()])
  if (rows.length > 0) return rows[0].province_id
  const [result] = await connection.query('INSERT INTO provinces (province_name) VALUES (?)', [provinceName.trim()])
  return result.insertId
}

async function getOrInsertMunicipality(connection, provinceId, municipalityName) {
  if (!municipalityName) return null
  const [rows] = await connection.query('SELECT municipality_id FROM municipalities WHERE municipality_name = ? AND province_id = ?', [municipalityName.trim(), provinceId])
  if (rows.length > 0) return rows[0].municipality_id
  const [result] = await connection.query('INSERT INTO municipalities (municipality_id, province_id, municipality_name) VALUES (NULL, ?, ?)', [provinceId, municipalityName.trim()])
  return result.insertId
}

async function getOrInsertBarangay(connection, municipalityId, barangayName) {
  if (!barangayName) return null
  const [rows] = await connection.query('SELECT barangay_id FROM barangays WHERE barangay_name = ? AND municipality_id = ?', [barangayName.trim(), municipalityId])
  if (rows.length > 0) return rows[0].barangay_id
  const [result] = await connection.query('INSERT INTO barangays (municipality_id, barangay_name) VALUES (?, ?)', [municipalityId, barangayName.trim()])
  return result.insertId
}

router.post('/properties/unified', authenticate, allowRoles('admin', 'assessor', 'staff'), async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const data = req.body
    await connection.beginTransaction()

    // 1. Validate the request basic fields
    if (!data.propertyType || !['LOT', 'BUILDING'].includes(data.propertyType)) {
      throw Object.assign(new Error('Invalid or missing Property Type.'), { status: 400 })
    }
    // 2. Create Owner or Use Existing
    let ownerId = data.ownerId;
    if (!ownerId) {
      if (!data.ownerFirstName || !data.ownerLastName) {
        throw Object.assign(new Error('Owner First Name and Last Name are required.'), { status: 400 })
      }
      const [ownerResult] = await connection.query(
        'INSERT INTO property_owners (first_name, middle_name, last_name, contact_number) VALUES (?, ?, ?, ?)',
        [data.ownerFirstName.trim(), data.ownerMiddleName?.trim() || null, data.ownerLastName.trim(), data.ownerContactNumber?.trim() || null]
      )
      ownerId = ownerResult.insertId
    }

    // 3. Create/Resolve Owner Address
    const ownerProvId = await getOrInsertProvince(connection, data.ownerProvince || 'Misamis Oriental')
    const ownerMunId = await getOrInsertMunicipality(connection, ownerProvId, data.ownerMunicipality || 'Lagonglong')
    const ownerBrgyId = await getOrInsertBarangay(connection, ownerMunId, data.ownerBarangay || 'Unknown')

    const ownerStreet = [data.ownerPurok, data.ownerStreet].filter(Boolean).join(', ')
    const [ownerAddrResult] = await connection.query(
      'INSERT INTO addresses (house_number, street, barangay_id, postal_code) VALUES (?, ?, ?, ?)',
      [data.ownerHouseNumber?.trim() || null, ownerStreet || null, ownerBrgyId, data.ownerZipCode?.trim() || null]
    )
    const ownerAddressId = ownerAddrResult.insertId

    await connection.query('INSERT INTO owner_addresses (owner_id, address_id) VALUES (?, ?)', [ownerId, ownerAddressId])

    // 4 & 5. Create/Resolve Property Address
    const propProvId = await getOrInsertProvince(connection, 'Misamis Oriental')
    const propMunId = await getOrInsertMunicipality(connection, propProvId, 'Lagonglong')
    const propBrgyId = await getOrInsertBarangay(connection, propMunId, data.propertyBarangay || 'Unknown')
    const propStreet = [data.propertyPurok, data.propertyStreet].filter(Boolean).join(', ')
    
    const [propAddrResult] = await connection.query(
      'INSERT INTO addresses (house_number, street, barangay_id, postal_code) VALUES (NULL, ?, ?, NULL)',
      [propStreet || null, propBrgyId]
    )
    const propertyAddressId = propAddrResult.insertId

    // Map the Property Type & Classification
    let typeName = data.propertyType === 'LOT' ? 'Residential' : (data.buildingType || 'Residential');
    let [typeRows] = await connection.query('SELECT property_type_id FROM property_types WHERE property_type_name = ?', [typeName]);
    let propertyTypeId;
    if (typeRows.length === 0) {
      const [insertType] = await connection.query('INSERT INTO property_types (property_type_name) VALUES (?)', [typeName]);
      propertyTypeId = insertType.insertId;
    } else {
      propertyTypeId = typeRows[0].property_type_id;
    }

    let classificationName = data.propertyType === 'LOT' ? (data.lotClassification || 'Residential Lot') : (data.buildingClassification || 'Residential');
    let [classRows] = await connection.query('SELECT classification_id FROM property_classifications WHERE classification_name = ?', [classificationName]);
    let classificationId;
    if (classRows.length === 0) {
      const [insertClass] = await connection.query('INSERT INTO property_classifications (classification_name) VALUES (?)', [classificationName]);
      classificationId = insertClass.insertId;
    } else {
      classificationId = classRows[0].classification_id;
    }

    // Helper to extract purok
    function getPurokString(addressStr) {
      if (!addressStr) return 'PX';
      const match = addressStr.match(/Purok\s*(\d+)/i);
      if (match) return `P${match[1]}`;
      return 'PX';
    }

    const purokStr = getPurokString(propStreet);

    // Generate Property ID
    const [pRows] = await connection.query(
      "SELECT property_id FROM properties WHERE property_id LIKE ? ORDER BY CAST(SUBSTRING_INDEX(property_id, '-A', -1) AS UNSIGNED) DESC LIMIT 1",
      [`LP-${purokStr}-A%`]
    );
    let nextPropSeq = 1;
    if (pRows.length > 0) {
      const match = pRows[0].property_id.match(/-A(\d+)$/);
      if (match) nextPropSeq = parseInt(match[1]) + 1;
    }
    const propertyId = `LP-${purokStr}-A${nextPropSeq}`;

    // Create Property
    await connection.query(
      'INSERT INTO properties (property_id, owner_id, address_id, property_type_id, classification_id, property_status) VALUES (?, ?, ?, ?, ?, ?)',
      [propertyId, ownerId, propertyAddressId, propertyTypeId, classificationId, 'active']
    )

    // 6 & 7. Create LOT or BUILDING
    let buildingIdStr = null;
    if (data.propertyType === 'LOT') {
      // Generate Lot ID
      const [lRows] = await connection.query(
        "SELECT lot_id FROM property_lots WHERE lot_id LIKE ? ORDER BY CAST(SUBSTRING_INDEX(lot_id, '-L', -1) AS UNSIGNED) DESC LIMIT 1",
        [`LP-${purokStr}-L%`]
      );
      let nextLotSeq = 1;
      if (lRows.length > 0) {
        const match = lRows[0].lot_id.match(/-L(\d+)$/);
        if (match) nextLotSeq = parseInt(match[1]) + 1;
      }
      const lotId = `LP-${purokStr}-L${nextLotSeq}`;

      const lotNumber = data.lotNumber?.trim() || `LOT-${propertyId}`
      const lotArea = Number(data.lotArea)
      
      await connection.query(
        'INSERT INTO property_lots (lot_id, property_id, lot_number, title_number, lot_area, lot_status) VALUES (?, ?, ?, ?, ?, ?)',
        [
          lotId,
          propertyId,
          lotNumber,
          data.titleNumber?.trim() || null,
          Number.isFinite(lotArea) ? lotArea : null,
          (data.lotStatus || 'active').toLowerCase()
        ]
      )

      if (data.coordinates) {
        await connection.query(
          'INSERT INTO gis_locations (property_id, lot_id, geometry_type, coordinates, area_sqm, perimeter_m) VALUES (?, ?, ?, ?, ?, ?)',
          [propertyId, lotId, 'Polygon', data.coordinates, Number(data.area_sqm) || 0, Number(data.perimeter_m) || 0]
        )
      }
    } else if (data.propertyType === 'BUILDING') {
      const bldgName = data.buildingName?.trim() || `BLDG-${propertyId}`
      const floorArea = Number(data.floorArea)
      const floorCount = Number(data.floorCount)
      
      const getVal = (val, other) => val === 'Other' ? (other || null) : (val || null);

      // Generate Building ID
      const [bRows] = await connection.query(
        "SELECT building_id FROM property_buildings WHERE building_id LIKE ? ORDER BY CAST(SUBSTRING_INDEX(building_id, '-A', -1) AS UNSIGNED) DESC LIMIT 1",
        [`LBP-${purokStr}-A%`]
      );
      let nextBldgSeq = 1;
      if (bRows.length > 0) {
        const match = bRows[0].building_id.match(/-A(\d+)$/);
        if (match) nextBldgSeq = parseInt(match[1]) + 1;
      }
      buildingIdStr = `LBP-${purokStr}-A${nextBldgSeq}`;
      
      await connection.query(
        `INSERT INTO property_buildings (
          building_id, property_id, building_name, building_type, floor_area, floor_count, 
          construction_type, year_constructed, building_status,
          foundation, structural_frame, exterior_walls, roofing, flooring, ceiling, doors, windows, building_use
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          buildingIdStr,
          propertyId,
          bldgName,
          data.buildingType || 'Residential',
          Number.isFinite(floorArea) ? floorArea : null,
          Number.isFinite(floorCount) ? floorCount : null,
          getVal(data.structuralFrame, data.structuralFrameOther),
          data.yearConstructed || null,
          (data.buildingStatus || 'active').toLowerCase(),
          getVal(data.foundation, data.foundationOther),
          getVal(data.structuralFrame, data.structuralFrameOther),
          getVal(data.exteriorWalls, data.exteriorWallsOther),
          getVal(data.roofing, data.roofingOther),
          getVal(data.flooring, data.flooringOther),
          getVal(data.ceiling, data.ceilingOther),
          getVal(data.doors, data.doorsOther),
          getVal(data.windows, data.windowsOther),
          data.buildingUse || null
        ]
      )
      
      // If there's an assessed/market value provided
      if (Number(data.marketValue) > 0 || Number(data.assessedValue) > 0) {
        await connection.query(
          'INSERT INTO building_assessment_history (building_id, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date, assessment_reason) VALUES (?, ?, ?, ?, ?, CURDATE(), ?)',
          [buildingIdStr, req.user.id, 20.00, Number(data.marketValue) || 0, Number(data.assessedValue) || 0, 'Initial registration']
        )
      }

      if (data.coordinates) {
        await connection.query(
          'INSERT INTO gis_locations (property_id, building_id, geometry_type, coordinates, area_sqm, perimeter_m) VALUES (?, ?, ?, ?, ?, ?)',
          [propertyId, buildingIdStr, 'Polygon', data.coordinates, Number(data.area_sqm) || 0, Number(data.perimeter_m) || 0]
        )
      }
    }

    // 10. Log Activity
    await logActivity(connection, req, 'CREATE', 'Properties', `Property ID ${propertyId}`, `Registered unified property for ${data.ownerFirstName} ${data.ownerLastName}`)
    await logPropertyHistory(connection, req, propertyId, 'Property Created', null, { owner: `${data.ownerFirstName} ${data.ownerLastName}`, type: data.propertyType })

    // 11. Commit transaction
    await connection.commit()
    res.status(201).json({ 
      id: propertyId, 
      buildingId: buildingIdStr,
      message: 'Property successfully added.',
      record: {
        property_id: propertyId,
        building_id: buildingIdStr,
        owner: `${data.ownerFirstName} ${data.ownerLastName}`,
        address: propStreet,
        type: data.propertyType,
        lot_area: data.lotArea || null
      }
    })
  } catch (e) {
    await connection.rollback()
    if (e.status === 400) return res.status(400).json({ message: e.message })
    next(e)
  } finally {
    connection.release()
  }
})

export default router
