import { pool } from './config/db.js'

async function run() {
  try {
    // 1. Simulate LOT registration with new dropdown values
    const lotRes = await fetch('http://localhost:5000/properties/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer 1' },
      body: JSON.stringify({
        propertyType: 'LOT',
        ownerFirstName: 'Test',
        ownerLastName: 'User',
        ownerBarangay: 'Banglay',
        ownerMunicipality: 'Lagonglong',
        ownerProvince: 'Misamis Oriental',
        propertyBarangay: 'Poblacion',
        lotArea: '500',
        lotClassification: 'Residential Lot',
        lotTypeUse: 'Residential',
        lotStatus: 'active'
      })
    })
    console.log('LOT Response:', await lotRes.text())

    // 2. Simulate BUILDING registration with Other structural fields
    const bldgRes = await fetch('http://localhost:5000/properties/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer 1' },
      body: JSON.stringify({
        propertyType: 'BUILDING',
        ownerFirstName: 'Test',
        ownerLastName: 'Builder',
        ownerBarangay: 'Banglay',
        ownerMunicipality: 'Lagonglong',
        ownerProvince: 'Misamis Oriental',
        propertyBarangay: 'Poblacion',
        buildingType: 'Commercial',
        buildingClassification: 'Commercial Lot',
        floorArea: '200',
        floorCount: '2',
        yearConstructed: '2023',
        buildingStatus: 'active',
        foundation: 'Other',
        foundationOther: 'Custom Concrete Type X',
        roofing: 'Long Span Metal'
      })
    })
    console.log('BUILDING Response:', await bldgRes.text())
    
    // Check DB
    const [rows] = await pool.query('SELECT foundation, roofing, building_type FROM property_buildings ORDER BY building_id DESC LIMIT 1')
    console.log('Latest Building DB Record:', rows[0])
    
  } catch (err) {
    console.error(err)
  } finally {
    process.exit(0)
  }
}
run()
