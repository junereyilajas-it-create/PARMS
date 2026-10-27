import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (postData) {
      if (typeof postData === 'object') {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'accessor-office-local-development-secret-2026-change-before-production';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const tokens = {
  assessor: createToken({ user_id: 2, role: 'assessor', email: 'assessor@lagonglong.gov.ph' }),
  admin: createToken({ user_id: 1, role: 'admin', email: 'admin@lagonglong.gov.ph' }),
  super_admin: createToken({ user_id: 3, role: 'super_admin', email: 'superadmin@lagonglong.gov.ph' })
};

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING ACCEPTANCE CRITERIA VERIFICATION SUITE');
  console.log('====================================================\n');

  const assessorToken = tokens.assessor;
  const adminToken = tokens.admin;
  const superAdminToken = tokens.super_admin;
  console.log('✓ Successfully authenticated test users (Assessor, Admin, Super Admin).\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✓ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`✗ [FAIL] ${message}`);
    }
  }

  // TEST 1: All Properties Tax Report Endpoint
  console.log('--- Test 1: All Property Tax Reports Endpoint ---');
  const allReportsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/tax-computations/all-properties-report?year=2026',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${assessorToken}` }
  });

  console.log('Status:', allReportsRes.statusCode, 'Body:', allReportsRes.raw);

  assert(allReportsRes.statusCode === 200, 'GET /all-properties-report returns 200 OK');
  assert(allReportsRes.body.properties && allReportsRes.body.properties.length > 0, `Returned ${allReportsRes.body.properties?.length} assessed properties`);
  assert(allReportsRes.body.disclaimer.includes('FOR REFERENCE ONLY'), 'Mandatory disclaimer present in API response');
  assert(allReportsRes.body.stats && allReportsRes.body.stats.total_computed_tax > 0, `Total computed tax calculated: ₱${allReportsRes.body.stats?.total_computed_tax}`);
  assert(allReportsRes.body.stats.approved_computed_count > 0, `Approved complete calculations count: ${allReportsRes.body.stats?.approved_computed_count}`);

  // TEST 2: All Properties Filter & Search
  console.log('\n--- Test 2: Search & Filter on All Properties ---');
  const searchRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/tax-computations/all-properties-report?year=2026&q=LOT_KW-101',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${assessorToken}` }
  });
  assert(searchRes.statusCode === 200, 'Search by LOT_KW-101 returns 200 OK');
  assert(searchRes.body.properties?.some(p => p.target_id_str === 'LOT_KW-101'), 'Found LOT_KW-101 in search results');

  // TEST 3: Specific Property Report Endpoint
  console.log('\n--- Test 3: Specific Property Tax Report Endpoint ---');
  const specificRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/tax-computations/property-report/lot/LOT_KW-101?year=2026',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${assessorToken}` }
  });
  assert(specificRes.statusCode === 200, 'GET /property-report/lot/LOT_KW-101 returns 200 OK');
  assert(specificRes.body.breakdown_table && specificRes.body.breakdown_table.length === 9, 'Breakdown table has 9 itemized rows matching prompt format');
  assert(specificRes.body.disclaimer.includes('PROPERTY TAX COMPUTATION REPORT — FOR REFERENCE ONLY'), 'Specific report has statutory disclaimer');
  const marketValItem = specificRes.body.breakdown_table?.find(i => i.description === 'Market Value');
  const totalTaxItem = specificRes.body.breakdown_table?.find(i => i.description === 'Total Computed Tax');
  assert(marketValItem && Number(marketValItem.amount) > 0, `Market Value row present: ${marketValItem?.formatted}`);
  assert(totalTaxItem && Number(totalTaxItem.amount) > 0, `Total Computed Tax row present: ${totalTaxItem?.formatted}`);

  // TEST 4: CSV Export: All Properties
  console.log('\n--- Test 4: Export All Property Tax Reports to CSV ---');
  const exportAllRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/tax-computations/all-properties-report/export-csv?year=2026',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${assessorToken}` }
  });
  assert(exportAllRes.statusCode === 200, 'CSV export returns 200 OK');
  assert(exportAllRes.headers['content-type']?.includes('text/csv'), 'Content-Type header is text/csv');
  assert(exportAllRes.raw.includes('Property ID') && exportAllRes.raw.includes('Basic Real Property Tax'), 'CSV contains all statutory column headers');
  assert(exportAllRes.raw.includes('LOT_KW-101'), 'CSV contains property rows');

  // TEST 5: CSV Export: Specific Property
  console.log('\n--- Test 5: Export Specific Property Report to CSV ---');
  const exportSpecificRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/tax-computations/property-report/lot/LOT_KW-101/export-csv?year=2026',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${assessorToken}` }
  });
  assert(exportSpecificRes.statusCode === 200, 'Specific property CSV export returns 200 OK');
  assert(exportSpecificRes.headers['content-type']?.includes('text/csv'), 'Content-Type header is text/csv');
  assert(exportSpecificRes.raw.includes('FOR REFERENCE ONLY. NOT AN OFFICIAL TAX BILL OR RECEIPT.'), 'Specific CSV includes disclaimer');
  assert(exportSpecificRes.raw.includes('LOT_KW-101'), 'Specific CSV includes property data');

  // TEST 6: Tax Billing Decommissioned Verification
  console.log('\n--- Test 6: Verify Legacy Tax Billing Generation is Blocked ---');
  const billGenRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/tax-bills',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { property_id: 1, tax_year: 2026 });
  assert(billGenRes.statusCode === 400, 'POST /tax-bills is blocked with 400 Bad Request');
  assert(billGenRes.body.message?.includes('decommissioned') || billGenRes.body.message?.includes('Property Tax Reports'), 'Returns official decommission notice pointing to Property Tax Reports');

  // TEST 7: Cashier Creation Blocked Verification
  console.log('\n--- Test 7: Verify Cashier Creation is Blocked ---');
  const cashierRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/users',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` }
  }, {
    username: 'test_cashier_block',
    email: 'cashier@test.com',
    password: 'Password@123',
    first_name: 'Cashier',
    last_name: 'Test',
    role: 'cashier'
  });
  assert(cashierRes.statusCode === 400, 'Creating user with cashier role is blocked with 400 Bad Request');
  assert(cashierRes.body.message?.includes('Cashier') || cashierRes.body.message?.includes('decommissioned'), 'Error message clearly references Cashier decommission');

  // TEST 8: Super Admin Assessment Assignment Restricted
  console.log('\n--- Test 8: Verify Super Admin Cannot Assign Assessments ---');
  const superAssignRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/assessments/assign',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` }
  }, {
    property_type: 'lot',
    target_id_int: 1,
    target_id_str: 'LOT_KW-101',
    assigned_to_user_id: 2
  });
  assert(superAssignRes.statusCode === 403, 'Super Admin POST /assessments/assign is blocked with 403 Forbidden');

  // Summary
  console.log('\n====================================================');
  console.log(`SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================');
  if (passedTests === totalTests) {
    console.log('ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
