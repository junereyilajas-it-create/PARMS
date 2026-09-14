import axios from 'axios';
import mysql from 'mysql2/promise';

const api = axios.create({ baseURL: 'http://localhost:5000/api' });
let token = '';

async function runTests() {
  console.log('--- STARTING CRUD TESTS ---');
  
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'property_management_db'
    });
    await connection.end();

    console.log('1. Authentication');
    const loginRes = await api.post('/login', { username: 'junerey', password: 'junerey123' });
    token = loginRes.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('✅ Login successful');

    const uniq = Date.now();
    console.log('\n2. Properties Module');
    // CREATE Property
    const propRes = await api.post('/properties/register', {
      owner: 'Test Owner', street: 'Test St', barangay: 'Poblacion', type: 'Residential', lot_area: '500', market_value: '100000', lot_number: `LOT-TEST-${uniq}-1`
    });
    const propertyId = propRes.data.id;
    console.log(`✅ Create Property successful (ID: ${propertyId})`);
    
    // READ Properties
    const propRead = await api.get('/property-records');
    if (!propRead.data.find(p => p.property_id === propertyId)) throw new Error('Property not found in read');
    console.log('✅ Read Properties successful');
    
    console.log('\n3. Owners Module');
    // CREATE Owner
    const ownerRes = await api.post('/owners', { first_name: 'Jane', last_name: `Doe${uniq}`, contact_number: '12345', email: `jane${uniq}@example.com` });
    const ownerId = ownerRes.data.record.owner_id;
    console.log(`✅ Create Owner successful (ID: ${ownerId})`);
    
    // READ Owners
    const ownerRead = await api.get('/owners');
    if (!ownerRead.data.find(o => o.owner_id === ownerId)) throw new Error('Owner not found in read');
    console.log('✅ Read Owners successful');

    // UPDATE Owner
    await api.put(`/owners/${ownerId}`, { first_name: 'Janet', last_name: `Doe${uniq}`, contact_number: '12345', email: `jane${uniq}@example.com` });
    console.log('✅ Update Owner successful');

    // DELETE Owner
    await api.delete(`/owners/${ownerId}`);
    console.log('✅ Delete Owner successful');

    console.log('\n4. Lots Module');
    // CREATE Lot
    const lotRes = await api.post('/lots', { property_id: propertyId, lot_number: `LOT-TEST-${uniq}-2`, lot_area: 250, latitude: 14.0, longitude: 121.0 });
    const lotId = lotRes.data.id;
    console.log(`✅ Create Lot successful (ID: ${lotId})`);

    // READ Lots
    const lotRead = await api.get('/lots');
    if (!lotRead.data.find(l => l.lot_id === lotId)) throw new Error('Lot not found in read');
    console.log('✅ Read Lots successful');
    
    // UPDATE Lot
    await api.put(`/lots/${lotId}`, { property_id: propertyId, lot_number: `LOT-TEST-${uniq}-2-UPDATED`, lot_area: 300, latitude: 14.1, longitude: 121.1, lot_status: 'active' });
    console.log('✅ Update Lot successful');

    // DELETE Lot
    await api.delete(`/lots/${lotId}`);
    console.log('✅ Delete Lot successful');
    
    console.log('\n5. Buildings Module');
    // CREATE Building
    const bldgRes = await api.post('/buildings', { property_id: propertyId, building_name: 'TEST-BLDG', building_type: 'Residential', floor_area: 100, market_value: 500000 });
    const bldgId = bldgRes.data.id;
    console.log(`✅ Create Building successful (ID: ${bldgId})`);

    // READ Buildings
    const bldgRead = await api.get('/buildings');
    if (!bldgRead.data.find(b => b.building_id === bldgId)) throw new Error('Building not found in read');
    console.log('✅ Read Buildings successful');

    // UPDATE Building
    await api.put(`/buildings/${bldgId}`, { property_id: propertyId, building_name: 'TEST-BLDG-UPDATED', building_type: 'Residential', floor_area: 120, assessed_value: 100000, building_status: 'active' });
    console.log('✅ Update Building successful');

    // DELETE Building
    await api.delete(`/buildings/${bldgId}`);
    console.log('✅ Delete Building successful');

    console.log('\n6. Assessments Module');
    // CREATE Assessment
    const assmtRes = await api.post('/assessments', { property_id: propertyId, assessor_user_id: 1, assessor_level: 20, market_value: 100000, assessed_value: 20000, assessment_date: '2024-01-01' });
    const assmtId = assmtRes.data.record.assessment_id;
    console.log(`✅ Create Assessment successful (ID: ${assmtId})`);

    // READ Assessments
    const assmtRead = await api.get('/assessments');
    if (!assmtRead.data.find(a => a.assessment_id === assmtId)) throw new Error('Assessment not found in read');
    console.log('✅ Read Assessments successful');

    // UPDATE Assessment
    await api.put(`/assessments/${assmtId}`, { property_id: propertyId, assessor_user_id: 1, assessor_level: 20, market_value: 120000, assessed_value: 24000, assessment_date: '2024-01-01' });
    console.log('✅ Update Assessment successful');

    // DELETE Assessment
    await api.delete(`/assessments/${assmtId}`);
    console.log('✅ Delete Assessment successful');

    console.log('\n--- CLEANUP ---');
    // We must delete the property we created
    await api.delete(`/properties/${propertyId}`);
    console.log(`✅ Delete Property successful (ID: ${propertyId})`);

    console.log('\n✅ ALL API CRUD TESTS PASSED');
  } catch (err) {
    console.error('❌ TEST FAILED:', err.response?.data || err.message);
  }
}

runTests();
