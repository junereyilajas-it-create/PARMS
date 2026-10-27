import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { calculateRealPropertyTax, round2 } from '../utils/taxCalculationEngine.js';
import { createNotification } from '../utils/notifications.js';
import { logTaxAuditEvent } from '../utils/taxAudit.js';

const router = Router();

// =========================================================================
// Helper: Generate Sequential Computation Reference Number (e.g. COMP-2026-0001)
// =========================================================================
async function generateComputationNumber(connection, year) {
  const currentYear = year || new Date().getFullYear();
  const [rows] = await connection.query(`
    SELECT computation_number FROM property_tax_computations
    WHERE tax_year = ?
    ORDER BY computation_id DESC
    LIMIT 1
  `, [currentYear]);

  let seq = 1;
  if (rows.length > 0 && rows[0].computation_number) {
    const parts = rows[0].computation_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) seq = lastNum + 1;
  }
  return `COMP-${currentYear}-${String(seq).padStart(4, '0')}`;
}

// =========================================================================
// Helper: Retrieve and Compute Real Property Taxes for All Assessed Properties
// =========================================================================
export async function getAllAssessedPropertiesComputed(taxYear, filters = {}) {
  const currentYear = taxYear ? parseInt(taxYear, 10) : new Date().getFullYear();

  // Unified query retrieving distinct latest assessments for all lots, buildings, and general properties
  const [assessedRows] = await pool.query(`
    SELECT 
      'lot' AS property_type,
      lah.lot_assessment_history_id AS assessment_id,
      l.lot_id AS target_id_int,
      COALESCE(l.lot_number, CONCAT('LOT_', l.lot_id)) AS target_id_str,
      l.property_id,
      p.property_code,
      p.owner_id,
      CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
      o.email AS owner_email,
      o.contact_number AS owner_contact,
      COALESCE(pc.classification_name, 'Residential') AS classification,
      'Residential' AS actual_use,
      COALESCE(b.barangay_name, 'Lagonglong') AS barangay,
      COALESCE(
        NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), b.barangay_name), ''),
        b.barangay_name,
        'Lagonglong, Misamis Oriental'
      ) AS property_address,
      l.lot_area AS land_area,
      NULL AS building_area,
      lah.market_value,
      lah.assessor_level AS assessment_level,
      lah.assessed_value,
      lah.assessment_status,
      lah.created_at AS assessment_date
    FROM lot_assessment_history lah
    JOIN property_lots l ON lah.lot_id = l.lot_id
    JOIN properties p ON l.property_id = p.property_id
    LEFT JOIN property_owners o ON p.owner_id = o.owner_id
    LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
    LEFT JOIN addresses addr ON p.address_id = addr.address_id
    LEFT JOIN barangays b ON addr.barangay_id = b.barangay_id
    WHERE lah.lot_assessment_history_id = (
      SELECT MAX(sub.lot_assessment_history_id) 
      FROM lot_assessment_history sub 
      WHERE sub.lot_id = lah.lot_id
    )

    UNION ALL

    SELECT 
      'building' AS property_type,
      bah.building_assessment_history_id AS assessment_id,
      bldg.building_id AS target_id_int,
      COALESCE(bldg.building_code, bldg.building_name, CONCAT('BUILDING_', bldg.building_id)) AS target_id_str,
      bldg.property_id,
      p.property_code,
      p.owner_id,
      CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
      o.email AS owner_email,
      o.contact_number AS owner_contact,
      COALESCE(pc.classification_name, 'Residential') AS classification,
      COALESCE(bldg.building_type, 'Residential') AS actual_use,
      COALESCE(b.barangay_name, 'Lagonglong') AS barangay,
      COALESCE(
        NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), b.barangay_name), ''),
        b.barangay_name,
        'Lagonglong, Misamis Oriental'
      ) AS property_address,
      NULL AS land_area,
      bldg.floor_area AS building_area,
      bah.market_value,
      bah.assessor_level AS assessment_level,
      bah.assessed_value,
      bah.assessment_status,
      bah.created_at AS assessment_date
    FROM building_assessment_history bah
    JOIN property_buildings bldg ON bah.building_id = bldg.building_id
    JOIN properties p ON bldg.property_id = p.property_id
    LEFT JOIN property_owners o ON p.owner_id = o.owner_id
    LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
    LEFT JOIN addresses addr ON p.address_id = addr.address_id
    LEFT JOIN barangays b ON addr.barangay_id = b.barangay_id
    WHERE bah.building_assessment_history_id = (
      SELECT MAX(sub.building_assessment_history_id) 
      FROM building_assessment_history sub 
      WHERE sub.building_id = bah.building_id
    )

    UNION ALL

    SELECT 
      'property' AS property_type,
      pa.assessment_id,
      pa.property_id AS target_id_int,
      COALESCE(p.property_code, CONCAT('PROP_', pa.property_id)) AS target_id_str,
      p.property_id,
      p.property_code,
      p.owner_id,
      CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
      o.email AS owner_email,
      o.contact_number AS owner_contact,
      COALESCE(pc.classification_name, 'Residential') AS classification,
      'Residential' AS actual_use,
      COALESCE(b.barangay_name, 'Lagonglong') AS barangay,
      COALESCE(
        NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), b.barangay_name), ''),
        b.barangay_name,
        'Lagonglong, Misamis Oriental'
      ) AS property_address,
      NULL AS land_area,
      NULL AS building_area,
      pa.market_value,
      pa.assessor_level AS assessment_level,
      pa.assessed_value,
      pa.assessment_status,
      pa.assessment_date
    FROM property_assessments pa
    JOIN properties p ON pa.property_id = p.property_id
    LEFT JOIN property_owners o ON p.owner_id = o.owner_id
    LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
    LEFT JOIN addresses addr ON p.address_id = addr.address_id
    LEFT JOIN barangays b ON addr.barangay_id = b.barangay_id
    WHERE pa.assessment_id = (
      SELECT MAX(sub.assessment_id) 
      FROM property_assessments sub 
      WHERE sub.property_id = pa.property_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM property_lots pl WHERE pl.property_id = pa.property_id
    )
  `);

  // Fetch all saved approved/submitted tax computations for this tax year to link them
  const [savedComps] = await pool.query(`
    SELECT * FROM property_tax_computations
    WHERE tax_year = ?
  `, [currentYear]);

  const savedCompsMap = new Map();
  for (const sc of savedComps) {
    const key = `${sc.property_type}_${sc.target_id_str}`;
    savedCompsMap.set(key, sc);
    const keyProp = `property_${sc.property_id}`;
    if (!savedCompsMap.has(keyProp)) savedCompsMap.set(keyProp, sc);
  }

  // Calculate taxes dynamically for all assessed properties
  const computedProperties = [];

  for (const r of assessedRows) {
    const key = `${r.property_type}_${r.target_id_str}`;
    const saved = savedCompsMap.get(key) || savedCompsMap.get(`property_${r.property_id}`);

    const mv = round2(Number(r.market_value) || 0);
    const rawAl = Number(r.assessment_level) || 20;
    const al = rawAl > 1 ? rawAl / 100 : rawAl;

    const calc = await calculateRealPropertyTax({
      marketValue: mv,
      assessmentLevelPct: rawAl,
      classification: r.classification,
      taxYear: currentYear
    });

    const isAssessmentApproved = r.assessment_status === 'approved';
    const isComplete = isAssessmentApproved && calc.isComplete && mv > 0;

    let incompleteReason = null;
    if (!isAssessmentApproved) {
      incompleteReason = `Assessment is in '${r.assessment_status}' status. Requires official approval before tax computation can be finalized.`;
    } else if (!calc.isComplete) {
      incompleteReason = calc.incompleteReason || 'Missing required statutory tax rate or assessment schedule.';
    }

    let computationStatus = 'incomplete';
    if (saved) {
      computationStatus = saved.computation_status;
    } else if (isComplete) {
      computationStatus = 'approved';
    }

    const basicTax = isComplete ? round2(calc.basicTaxAmount) : 0.00;
    const sefTax = isComplete ? round2(calc.sefTaxAmount) : 0.00;
    const otherLevies = isComplete ? round2(calc.otherLeviesAmount || 0) : 0.00;
    const discount = isComplete ? round2(calc.discountAmount || 0) : 0.00;
    const penalty = isComplete ? round2(calc.penaltyInterestAmount || 0) : 0.00;
    const totalTax = isComplete ? round2(basicTax + sefTax + otherLevies - discount + penalty) : 0.00;

    computedProperties.push({
      computation_id: saved ? saved.computation_id : null,
      computation_number: saved ? saved.computation_number : `CALC-${currentYear}-${r.property_type[0].toUpperCase()}${r.target_id_int || r.property_id}`,
      property_id: r.property_id,
      property_code: r.property_code || `PROP_${r.property_id}`,
      property_type: r.property_type,
      target_id_int: r.target_id_int,
      target_id_str: r.target_id_str,
      owner_id: r.owner_id,
      owner_name: r.owner_name || 'Property Owner',
      owner_email: r.owner_email,
      owner_contact: r.owner_contact,
      property_address: r.property_address,
      barangay: r.barangay,
      classification: r.classification,
      actual_use: r.actual_use,
      land_area: r.land_area,
      building_area: r.building_area,
      tax_year: currentYear,
      market_value: mv,
      assessment_level: round2(al),
      assessed_value: round2(mv * al),
      basic_tax_rate: round2(calc.basicTaxRate),
      basic_tax_amount: basicTax,
      sef_tax_rate: round2(calc.sefTaxRate),
      sef_tax_amount: sefTax,
      other_levies_amount: otherLevies,
      discount_amount: discount,
      penalty_interest_amount: penalty,
      total_computed_tax: totalTax,
      computation_status: computationStatus,
      assessment_approval_status: r.assessment_status,
      is_complete: isComplete,
      incomplete_reason: incompleteReason,
      computation_date: saved ? saved.created_at : new Date().toISOString(),
      rule_version_snapshot: calc.ruleVersionSnapshot,
      disclaimer: "PROPERTY TAX COMPUTATION REPORT — FOR REFERENCE ONLY. NOT AN OFFICIAL TAX BILL OR RECEIPT."
    });
  }

  // Filter
  let filtered = computedProperties;

  if (filters.barangay && filters.barangay !== 'ALL') {
    filtered = filtered.filter(p => p.barangay.toLowerCase() === filters.barangay.toLowerCase());
  }

  if (filters.property_type && filters.property_type !== 'ALL') {
    filtered = filtered.filter(p => p.property_type.toLowerCase() === filters.property_type.toLowerCase());
  }

  if (filters.classification && filters.classification !== 'ALL') {
    filtered = filtered.filter(p => p.classification.toLowerCase() === filters.classification.toLowerCase());
  }

  if (filters.status && filters.status !== 'ALL') {
    if (filters.status === 'approved') {
      filtered = filtered.filter(p => p.is_complete && (p.computation_status === 'approved' || p.computation_status === 'calculated'));
    } else if (filters.status === 'incomplete') {
      filtered = filtered.filter(p => !p.is_complete || p.computation_status === 'incomplete');
    } else {
      filtered = filtered.filter(p => p.computation_status === filters.status);
    }
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    filtered = filtered.filter(p => 
      String(p.property_id).includes(q) ||
      p.property_code?.toLowerCase().includes(q) ||
      p.target_id_str?.toLowerCase().includes(q) ||
      p.owner_name?.toLowerCase().includes(q) ||
      p.barangay?.toLowerCase().includes(q) ||
      p.computation_number?.toLowerCase().includes(q)
    );
  }

  // Sorting
  if (filters.sort_by) {
    const dir = filters.sort_dir === 'desc' ? -1 : 1;
    const sortField = filters.sort_by;
    filtered.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  // Summary statistics (calculated ONLY on completed approved computations)
  const completeApprovedList = filtered.filter(p => p.is_complete && p.assessment_approval_status === 'approved');

  const stats = {
    total_eligible_properties: filtered.length,
    approved_computed_count: completeApprovedList.length,
    incomplete_count: filtered.length - completeApprovedList.length,
    total_market_value: round2(completeApprovedList.reduce((sum, p) => sum + p.market_value, 0)),
    total_assessed_value: round2(completeApprovedList.reduce((sum, p) => sum + p.assessed_value, 0)),
    total_basic_tax: round2(completeApprovedList.reduce((sum, p) => sum + p.basic_tax_amount, 0)),
    total_sef_tax: round2(completeApprovedList.reduce((sum, p) => sum + p.sef_tax_amount, 0)),
    total_computed_tax: round2(completeApprovedList.reduce((sum, p) => sum + p.total_computed_tax, 0)),
    tax_year: currentYear,
    generated_at: new Date().toISOString()
  };

  return { currentYear, filtered, stats, totalAll: computedProperties.length };
}

// =========================================================================
// ENDPOINT: ALL PROPERTY TAX REPORTS (Computed taxes for all assessed properties)
// =========================================================================
router.get('/tax-computations/all-properties-report', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const { year, q, barangay, property_type, classification, status, sort_by, sort_dir, page = 1, limit = 50 } = req.query;
    const { currentYear, filtered, stats } = await getAllAssessedPropertiesComputed(year, {
      q,
      barangay,
      property_type,
      classification,
      status,
      sort_by,
      sort_dir
    });

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const startIndex = (pageNum - 1) * pageSize;
    const pagedResults = filtered.slice(startIndex, startIndex + pageSize);

    res.json({
      tax_year: currentYear,
      stats,
      properties: pagedResults,
      pagination: {
        total_records: filtered.length,
        current_page: pageNum,
        total_pages: Math.ceil(filtered.length / pageSize) || 1,
        page_size: pageSize
      },
      generated_at: new Date().toISOString(),
      disclaimer: "PROPERTY TAX COMPUTATION REPORT — FOR REFERENCE ONLY. NOT AN OFFICIAL TAX BILL OR RECEIPT."
    });
  } catch (err) {
    console.error('Error generating all-properties tax report:', err);
    next(err);
  }
});

// =========================================================================
// ENDPOINT: EXPORT ALL PROPERTY TAX REPORTS TO CSV
// =========================================================================
router.get('/tax-computations/all-properties-report/export-csv', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const { year, q, barangay, property_type, classification, status } = req.query;
    const { currentYear, filtered } = await getAllAssessedPropertiesComputed(year, {
      q,
      barangay,
      property_type,
      classification,
      status
    });

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/\r\n|\r|\n/g, ' ');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    // 18 Statutory Columns matching Prompt Requirements
    const headers = [
      'Property ID',
      'Lot ID or Building ID',
      'Property Owner',
      'Property Type',
      'Classification',
      'Barangay',
      'Tax Year',
      'Market Value',
      'Assessment Level',
      'Assessed Value',
      'Basic Real Property Tax',
      'SEF Tax',
      'Other Applicable Levies',
      'Discounts and Exemptions',
      'Penalties and Interest',
      'Total Computed Tax',
      'Computation Status',
      'Assessment Approval Status'
    ];

    const lines = [headers.join(',')];

    for (const p of filtered) {
      const alPct = `${(p.assessment_level * 100).toFixed(0)}%`;
      const basicAmt = p.is_complete ? Number(p.basic_tax_amount).toFixed(2) : '0.00';
      const sefAmt = p.is_complete ? Number(p.sef_tax_amount).toFixed(2) : '0.00';
      const otherAmt = p.is_complete ? Number(p.other_levies_amount).toFixed(2) : '0.00';
      const discAmt = p.is_complete ? Number(p.discount_amount).toFixed(2) : '0.00';
      const penAmt = p.is_complete ? Number(p.penalty_interest_amount).toFixed(2) : '0.00';
      const totAmt = p.is_complete ? Number(p.total_computed_tax).toFixed(2) : '0.00';

      const rowValues = [
        escapeCsv(p.property_id),
        escapeCsv(p.target_id_str || `PROP-${p.property_id}`),
        escapeCsv(p.owner_name),
        escapeCsv(p.property_type),
        escapeCsv(p.classification),
        escapeCsv(p.barangay),
        escapeCsv(p.tax_year),
        Number(p.market_value).toFixed(2),
        escapeCsv(alPct),
        Number(p.assessed_value).toFixed(2),
        basicAmt,
        sefAmt,
        otherAmt,
        discAmt,
        penAmt,
        totAmt,
        escapeCsv(p.computation_status.toUpperCase()),
        escapeCsv(p.assessment_approval_status.toUpperCase())
      ];
      lines.push(rowValues.join(','));
    }

    const csvContent = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="All_Property_Tax_Reports_${currentYear}_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting all properties CSV:', err);
    next(err);
  }
});

// =========================================================================
// ENDPOINT: SPECIFIC PROPERTY TAX REPORT (Detailed calculation breakdown)
// =========================================================================
router.get('/tax-computations/property-report/:type/:id', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { year } = req.query;
    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();

    const { filtered } = await getAllAssessedPropertiesComputed(currentYear, {});
    const matched = filtered.find(p => {
      const typeMatches = !type || type === 'any' || type === 'all' || p.property_type.toLowerCase() === type.toLowerCase();
      const idMatches = String(p.target_id_int) === String(id) || 
                        p.target_id_str?.toLowerCase() === String(id).toLowerCase() || 
                        String(p.property_id) === String(id) ||
                        p.property_code?.toLowerCase() === String(id).toLowerCase();
      return typeMatches && idMatches;
    }) || filtered.find(p => 
      String(p.target_id_int) === String(id) || 
      p.target_id_str?.toLowerCase() === String(id).toLowerCase() || 
      String(p.property_id) === String(id) ||
      p.property_code?.toLowerCase() === String(id).toLowerCase()
    );

    if (!matched) {
      return res.status(404).json({ message: `No assessed property record found for identifier '${id}'.` });
    }

    res.json({
      report_title: "Property Tax Computation Report",
      disclaimer: "PROPERTY TAX COMPUTATION REPORT — FOR REFERENCE ONLY. NOT AN OFFICIAL TAX BILL OR RECEIPT.",
      office_name: "Municipality of Lagonglong — Office of the Municipal Assessor",
      generated_at: new Date().toISOString(),
      tax_year: currentYear,
      property: matched,
      breakdown_table: [
        { description: "Market Value", amount: matched.market_value, formatted: `₱${matched.market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { description: "Assessment Level", amount: matched.assessment_level, formatted: `${(matched.assessment_level * 100).toFixed(0)}%` },
        { description: "Assessed Value", amount: matched.assessed_value, formatted: `₱${matched.assessed_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { description: `Basic Real Property Tax (${(matched.basic_tax_rate * 100).toFixed(1)}%)`, amount: matched.basic_tax_amount, formatted: `₱${matched.basic_tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { description: `SEF Tax (${(matched.sef_tax_rate * 100).toFixed(1)}%)`, amount: matched.sef_tax_amount, formatted: `₱${matched.sef_tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { description: "Other Applicable Levies", amount: matched.other_levies_amount, formatted: `₱${matched.other_levies_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { description: "Discounts and Exemptions", amount: matched.discount_amount, formatted: `₱${matched.discount_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { description: "Penalties and Interest", amount: matched.penalty_interest_amount, formatted: `₱${matched.penalty_interest_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { description: "Total Computed Tax", amount: matched.total_computed_tax, formatted: `₱${matched.total_computed_tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, is_total: true }
      ]
    });
  } catch (err) {
    console.error('Error in property-report:', err);
    next(err);
  }
});

// =========================================================================
// ENDPOINT: EXPORT SPECIFIC PROPERTY TAX REPORT TO CSV
// =========================================================================
router.get('/tax-computations/property-report/:type/:id/export-csv', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { year } = req.query;
    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();

    const { filtered } = await getAllAssessedPropertiesComputed(currentYear, {});
    const matched = filtered.find(p => {
      const typeMatches = !type || type === 'any' || type === 'all' || p.property_type.toLowerCase() === type.toLowerCase();
      const idMatches = String(p.target_id_int) === String(id) || 
                        p.target_id_str?.toLowerCase() === String(id).toLowerCase() || 
                        String(p.property_id) === String(id) ||
                        p.property_code?.toLowerCase() === String(id).toLowerCase();
      return typeMatches && idMatches;
    }) || filtered.find(p => 
      String(p.target_id_int) === String(id) || 
      p.target_id_str?.toLowerCase() === String(id).toLowerCase() || 
      String(p.property_id) === String(id) ||
      p.property_code?.toLowerCase() === String(id).toLowerCase()
    );

    if (!matched) {
      return res.status(404).json({ message: `No assessed property record found for identifier '${id}'.` });
    }

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/\r\n|\r|\n/g, ' ');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Property ID',
      'Lot ID or Building ID',
      'Property Owner',
      'Property Type',
      'Classification',
      'Barangay',
      'Tax Year',
      'Market Value',
      'Assessment Level',
      'Assessed Value',
      'Basic Real Property Tax',
      'SEF Tax',
      'Other Applicable Levies',
      'Discounts and Exemptions',
      'Penalties and Interest',
      'Total Computed Tax',
      'Computation Status',
      'Assessment Approval Status'
    ];

    const alPct = `${(matched.assessment_level * 100).toFixed(0)}%`;
    const rowValues = [
      escapeCsv(matched.property_id),
      escapeCsv(matched.target_id_str),
      escapeCsv(matched.owner_name),
      escapeCsv(matched.property_type),
      escapeCsv(matched.classification),
      escapeCsv(matched.barangay),
      escapeCsv(matched.tax_year),
      Number(matched.market_value).toFixed(2),
      escapeCsv(alPct),
      Number(matched.assessed_value).toFixed(2),
      Number(matched.basic_tax_amount).toFixed(2),
      Number(matched.sef_tax_amount).toFixed(2),
      Number(matched.other_levies_amount).toFixed(2),
      Number(matched.discount_amount).toFixed(2),
      Number(matched.penalty_interest_amount).toFixed(2),
      Number(matched.total_computed_tax).toFixed(2),
      escapeCsv(matched.computation_status.toUpperCase()),
      escapeCsv(matched.assessment_approval_status.toUpperCase())
    ];

    const lines = [
      `"MUNICIPALITY OF LAGONGLONG — PROPERTY TAX COMPUTATION REPORT"`,
      `"FOR REFERENCE ONLY. NOT AN OFFICIAL TAX BILL OR RECEIPT."`,
      `""`,
      headers.join(','),
      rowValues.join(',')
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Property_Tax_Report_${matched.target_id_str}_${currentYear}.csv"`);
    res.send(lines.join('\r\n'));
  } catch (err) {
    console.error('Error exporting specific property CSV:', err);
    next(err);
  }
});

// =========================================================================
// 1. GET ALL PROPERTY TAX COMPUTATIONS (Searchable & Filterable)
// =========================================================================
router.get('/tax-computations', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff'), async (req, res, next) => {
  try {
    const { status, year, barangay, classification, q } = req.query;
    const rawQ = q ? String(q).trim() : '';
    const qWildcard = `%${rawQ}%`;
    const numericQ = !isNaN(Number(rawQ)) && rawQ !== '' ? Number(rawQ) : null;

    let query = `
      SELECT 
        ptc.*,
        td.declaration_number,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        o.email AS owner_email,
        o.contact_number AS owner_contact,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), brgy.barangay_name), ''),
          brgy.barangay_name,
          'Lagonglong, Misamis Oriental'
        ) AS property_address,
        u_comp.first_name AS computer_first_name, u_comp.last_name AS computer_last_name,
        u_rev.first_name AS reviewer_first_name, u_rev.last_name AS reviewer_last_name
      FROM property_tax_computations ptc
      JOIN properties p ON ptc.property_id = p.property_id
      JOIN property_owners o ON ptc.owner_id = o.owner_id
      LEFT JOIN tax_declarations td ON ptc.tax_declaration_id = td.tax_declaration_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      LEFT JOIN users u_comp ON ptc.computed_by_user_id = u_comp.user_id
      LEFT JOIN users u_rev ON ptc.reviewed_by_user_id = u_rev.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ' AND ptc.computation_status = ?';
      params.push(status);
    }

    if (year && year !== 'ALL') {
      query += ' AND ptc.tax_year = ?';
      params.push(year);
    }

    if (classification && classification !== 'ALL') {
      query += ' AND LOWER(ptc.classification) = LOWER(?)';
      params.push(classification);
    }

    if (barangay && barangay !== 'ALL') {
      query += ' AND LOWER(brgy.barangay_name) = LOWER(?)';
      params.push(barangay);
    }

    if (rawQ) {
      query += `
        AND (
          ptc.computation_number LIKE ?
          OR td.declaration_number LIKE ?
          OR ptc.target_id_str LIKE ?
          OR (? = 1 AND ptc.computation_id = ?)
          OR (? = 1 AND ptc.property_id = ?)
          OR o.first_name LIKE ?
          OR o.last_name LIKE ?
          OR CONCAT_WS(' ', o.first_name, o.last_name) LIKE ?
        )
      `;
      params.push(
        qWildcard, qWildcard, qWildcard,
        numericQ !== null ? 1 : 0, numericQ || 0,
        numericQ !== null ? 1 : 0, numericQ || 0,
        qWildcard, qWildcard, qWildcard
      );
    }

    query += ' ORDER BY ptc.computation_id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 2. GET SINGLE PROPERTY TAX COMPUTATION DETAILS
// =========================================================================
router.get('/tax-computations/:id', authenticate, allowRoles('assessor', 'admin', 'super_admin', 'staff', 'client'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const isNum = /^\d+$/.test(String(id).trim());
    const numId = isNum ? parseInt(id, 10) : null;

    const [rows] = await pool.query(`
      SELECT 
        ptc.*,
        td.declaration_number,
        td.land_area,
        td.building_area,
        p.property_code,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        o.email AS owner_email,
        o.contact_number AS owner_contact,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        COALESCE(
          NULLIF(CONCAT_WS(', ', NULLIF(TRIM(addr.street), ''), brgy.barangay_name), ''),
          brgy.barangay_name,
          'Lagonglong, Misamis Oriental'
        ) AS property_address,
        u_comp.first_name AS computer_first_name, u_comp.last_name AS computer_last_name,
        u_rev.first_name AS reviewer_first_name, u_rev.last_name AS reviewer_last_name
      FROM property_tax_computations ptc
      JOIN properties p ON ptc.property_id = p.property_id
      JOIN property_owners o ON ptc.owner_id = o.owner_id
      LEFT JOIN tax_declarations td ON ptc.tax_declaration_id = td.tax_declaration_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      LEFT JOIN users u_comp ON ptc.computed_by_user_id = u_comp.user_id
      LEFT JOIN users u_rev ON ptc.reviewed_by_user_id = u_rev.user_id
      WHERE (? = 1 AND ptc.computation_id = ?) OR ptc.computation_number = ?
    `, [numId !== null ? 1 : 0, numId || 0, String(id).trim()]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Property tax computation record not found.' });
    }

    const record = rows[0];

    // Client ownership authorization
    if (req.user.role === 'client') {
      if (!req.user.owner_id || record.owner_id !== req.user.owner_id) {
        return res.status(403).json({ message: 'You are not authorized to view this computation.' });
      }
    }

    res.json(record);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 3. PREVIEW PROPERTY TAX COMPUTATION (Real-time calculation engine)
// =========================================================================
router.post('/tax-computations/calculate-preview', authenticate, allowRoles('assessor', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const {
      property_id,
      market_value,
      assessment_level,
      classification = 'Residential',
      tax_year = new Date().getFullYear(),
      is_advance_payment = true,
      months_delayed = 0,
      prior_delinquency = 0,
      is_exempt = false,
      exemption_reason = null
    } = req.body;

    let mv = Number(market_value) || 0;
    let al = assessment_level !== undefined && assessment_level !== null ? Number(assessment_level) : null;
    let propClass = classification || 'Residential';

    if ((!mv || mv === 0) && property_id) {
      const { filtered } = await getAllAssessedPropertiesComputed(tax_year, {});
      const matched = filtered.find(p => String(p.property_id) === String(property_id));
      if (matched) {
        mv = matched.market_value;
        al = al !== null ? al : (matched.assessment_level * 100);
        propClass = matched.classification || propClass;
      }
    }

    const calcResult = await calculateRealPropertyTax({
      marketValue: mv,
      assessmentLevelPct: al,
      classification: propClass,
      taxYear: Number(tax_year) || new Date().getFullYear(),
      isAdvancePayment: Boolean(is_advance_payment),
      monthsDelayed: Number(months_delayed) || 0,
      priorDelinquency: Number(prior_delinquency) || 0,
      isExempt: Boolean(is_exempt),
      exemptionReason: exemption_reason
    });

    res.json(calcResult);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 4. CREATE PROPERTY TAX COMPUTATION (Assessor Only)
// =========================================================================
router.post('/tax-computations', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const {
      property_id,
      tax_declaration_id,
      tax_year = new Date().getFullYear(),
      is_advance_payment = true,
      months_delayed = 0,
      prior_delinquency = 0,
      is_exempt = false,
      exemption_reason = null,
      notes
    } = req.body;

    if (!property_id && !tax_declaration_id) {
      return res.status(400).json({ message: 'Property ID or Tax Declaration ID is required to calculate property tax.' });
    }

    await connection.beginTransaction();

    // 1. Resolve property, owner, and valuation details from database
    let propRecord = null;
    let tdRecord = null;

    if (tax_declaration_id) {
      const [tdRows] = await connection.query(`
        SELECT td.*, p.property_id, p.property_code, p.owner_id
        FROM tax_declarations td
        JOIN properties p ON td.property_id = p.property_id
        WHERE td.tax_declaration_id = ?
        FOR UPDATE
      `, [tax_declaration_id]);

      if (tdRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Tax declaration not found.' });
      }
      tdRecord = tdRows[0];
      propRecord = {
        property_id: tdRecord.property_id,
        owner_id: tdRecord.owner_id,
        property_code: tdRecord.property_code,
        property_type: tdRecord.property_type,
        target_id_str: tdRecord.target_id_str,
        target_id_int: tdRecord.target_id_int,
        classification: tdRecord.classification,
        actual_use: tdRecord.actual_use,
        market_value: tdRecord.market_value,
        assessment_level: tdRecord.assessment_level,
        assessed_value: tdRecord.assessed_value
      };
    } else {
      const [pRows] = await connection.query(`
        SELECT p.*, pc.classification_name
        FROM properties p
        LEFT JOIN property_classifications pc ON p.classification_id = pc.classification_id
        WHERE p.property_id = ?
        FOR UPDATE
      `, [property_id]);

      if (pRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Property record not found.' });
      }
      const p = pRows[0];

      // Retrieve latest approved assessment valuation from lots or buildings
      const [lotAssess] = await connection.query(`
        SELECT lah.market_value, lah.assessed_value, pl.lot_number, pl.lot_id
        FROM property_lots pl
        JOIN lot_assessment_history lah ON pl.lot_id = lah.lot_id
        WHERE pl.property_id = ? AND lah.assessment_status = 'approved'
        ORDER BY lah.lot_assessment_history_id DESC LIMIT 1
      `, [property_id]);

      const [bldgAssess] = await connection.query(`
        SELECT bah.market_value, bah.assessed_value, pb.building_code, pb.building_id
        FROM property_buildings pb
        JOIN building_assessment_history bah ON pb.building_id = bah.building_id
        WHERE pb.property_id = ? AND bah.assessment_status = 'approved'
        ORDER BY bah.building_assessment_history_id DESC LIMIT 1
      `, [property_id]);

      const assess = lotAssess[0] || bldgAssess[0];
      propRecord = {
        property_id: p.property_id,
        owner_id: p.owner_id,
        property_code: p.property_code,
        property_type: lotAssess[0] ? 'lot' : (bldgAssess[0] ? 'building' : 'lot'),
        target_id_str: lotAssess[0]?.lot_number || bldgAssess[0]?.building_code || p.property_code,
        target_id_int: lotAssess[0]?.lot_id || bldgAssess[0]?.building_id || null,
        classification: p.classification_name || 'Residential',
        actual_use: p.classification_name || 'Residential',
        market_value: assess ? assess.market_value : 0.00,
        assessment_level: null,
        assessed_value: assess ? assess.assessed_value : 0.00
      };
    }

    // 2. Perform statutory real property tax calculation
    const calc = await calculateRealPropertyTax({
      marketValue: Number(propRecord.market_value) || 0,
      assessmentLevelPct: propRecord.assessment_level ? Number(propRecord.assessment_level) : null,
      classification: propRecord.classification,
      taxYear: Number(tax_year),
      isAdvancePayment: Boolean(is_advance_payment),
      monthsDelayed: Number(months_delayed),
      priorDelinquency: Number(prior_delinquency),
      isExempt: Boolean(is_exempt),
      exemptionReason: exemption_reason
    });

    // 3. Generate sequential computation reference number (NOT a bill number)
    const compNumber = await generateComputationNumber(connection, tax_year);

    // Initial status: draft or pending_approval
    const initialStatus = 'draft';

    const [insertResult] = await connection.query(`
      INSERT INTO property_tax_computations (
        computation_number, property_id, property_type, target_id_int, target_id_str,
        tax_declaration_id, owner_id, tax_year, classification, actual_use,
        market_value, assessment_level, assessed_value, basic_tax_rate, basic_tax_amount,
        sef_tax_rate, sef_tax_amount, other_levies_amount, discount_rate, discount_amount,
        penalty_interest_rate, penalty_interest_amount, months_delayed, prior_delinquency_amount,
        total_computed_tax, computation_status, is_complete, incomplete_reason,
        rule_version_snapshot, computed_by_user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      compNumber, propRecord.property_id, propRecord.property_type, propRecord.target_id_int, propRecord.target_id_str,
      tax_declaration_id || null, propRecord.owner_id, tax_year, propRecord.classification, propRecord.actual_use,
      calc.marketValue, (calc.assessmentLevelPct / 100), calc.assessedValue, calc.basicTaxRate, calc.basicTaxAmount,
      calc.sefTaxRate, calc.sefTaxAmount, calc.otherLeviesAmount, calc.discountRate, calc.discountAmount,
      calc.penaltyRate, calc.penaltyInterestAmount, calc.monthsDelayed, calc.priorDelinquencyAmount,
      calc.totalAmountDue, initialStatus, calc.isComplete ? 1 : 0, calc.incompleteReason,
      JSON.stringify(calc.ruleVersionSnapshot), req.user.id, notes || null
    ]);

    const compId = insertResult.insertId;

    await logTaxAuditEvent(connection, req, 'tax_computation', compId, 'CALCULATE_RPT', null, {
      computation_number: compNumber,
      total_computed_tax: calc.totalAmountDue,
      is_complete: calc.isComplete
    }, `Real property tax computed for ${propRecord.target_id_str}`);

    await connection.commit();

    res.status(201).json({
      message: `Property Tax Computation ${compNumber} prepared successfully.`,
      computation_id: compId,
      computation_number: compNumber,
      market_value: calc.marketValue,
      assessment_level: calc.assessmentLevelPct,
      assessed_value: calc.assessedValue,
      total_computed_tax: calc.totalAmountDue,
      is_complete: calc.isComplete,
      incomplete_reason: calc.incompleteReason,
      computation_status: initialStatus
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 5. SUBMIT COMPUTATION FOR ADMIN REVIEW (Assessor Only)
// =========================================================================
router.post('/tax-computations/:id/submit-review', authenticate, allowRoles('assessor'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM property_tax_computations WHERE computation_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Computation record not found.' });
    }

    const current = rows[0];
    if (current.computation_status !== 'draft' && current.computation_status !== 'rejected') {
      await connection.rollback();
      return res.status(400).json({ message: `Cannot submit computation with status '${current.computation_status}'.` });
    }

    await connection.query(`
      UPDATE property_tax_computations
      SET computation_status = 'pending_approval', updated_at = CURRENT_TIMESTAMP
      WHERE computation_id = ?
    `, [id]);

    await logTaxAuditEvent(connection, req, 'tax_computation', id, 'SUBMIT_COMPUTATION_REVIEW', { status: current.computation_status }, { status: 'pending_approval' });
    await connection.commit();

    // Broadcast to Admin
    const [admins] = await pool.query("SELECT user_id FROM users WHERE role = 'admin' AND status = 'active'");
    for (const a of admins) {
      await createNotification(
        a.user_id,
        'Property Tax Computation Submitted',
        `Tax computation ${current.computation_number} (₱${Number(current.total_computed_tax).toLocaleString()}) submitted for review.`,
        'TAX_COMPUTATION_PENDING',
        id
      );
    }

    res.json({ message: `Computation ${current.computation_number} submitted for Admin review.`, computation_status: 'pending_approval' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 6. APPROVE TAX COMPUTATION (Admin Only)
// =========================================================================
router.post('/tax-computations/:id/approve', authenticate, allowRoles('admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM property_tax_computations WHERE computation_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Computation record not found.' });
    }

    const current = rows[0];
    if (current.computation_status !== 'pending_approval' && current.computation_status !== 'draft') {
      await connection.rollback();
      return res.status(400).json({ message: `Cannot approve computation with status '${current.computation_status}'.` });
    }

    await connection.query(`
      UPDATE property_tax_computations
      SET computation_status = 'approved',
          reviewed_by_user_id = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE computation_id = ?
    `, [req.user.id, id]);

    await logTaxAuditEvent(connection, req, 'tax_computation', id, 'APPROVE_COMPUTATION', { status: current.computation_status }, { status: 'approved' });
    await connection.commit();

    // Notify Assessor
    if (current.computed_by_user_id) {
      await createNotification(
        current.computed_by_user_id,
        'Tax Computation Approved',
        `Property tax computation ${current.computation_number} has been approved by the Municipal Administrator.`,
        'TAX_COMPUTATION_APPROVED',
        id
      );
    }

    res.json({ message: `Property Tax Computation ${current.computation_number} approved successfully.`, computation_status: 'approved' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 7. REJECT TAX COMPUTATION (Admin Only - Returns to Assessor with Comment)
// =========================================================================
router.post('/tax-computations/:id/reject', authenticate, allowRoles('admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = req.params.id;
    const { rejection_reason, reason } = req.body;
    const comment = rejection_reason || reason;

    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ message: 'Rejection reason/comment is required when returning a tax computation to the Assessor.' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM property_tax_computations WHERE computation_id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Computation record not found.' });
    }

    const current = rows[0];
    await connection.query(`
      UPDATE property_tax_computations
      SET computation_status = 'rejected',
          rejection_reason = ?,
          reviewed_by_user_id = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE computation_id = ?
    `, [String(comment).trim(), req.user.id, id]);

    await logTaxAuditEvent(connection, req, 'tax_computation', id, 'REJECT_COMPUTATION', { status: current.computation_status }, { status: 'rejected', reason: comment });
    await connection.commit();

    // Notify Assessor
    if (current.computed_by_user_id) {
      await createNotification(
        current.computed_by_user_id,
        'Tax Computation Returned for Correction',
        `Computation ${current.computation_number} was returned by Admin: ${comment}`,
        'TAX_COMPUTATION_REJECTED',
        id
      );
    }

    res.json({ message: `Computation ${current.computation_number} returned to Assessor for correction.`, computation_status: 'rejected' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// =========================================================================
// 8. EXPORT CSV FOR TAX COMPUTATION REPORTS (18 Required Columns)
// =========================================================================
router.get('/tax-computations/export-csv', authenticate, allowRoles('assessor', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const { status, year, barangay, classification } = req.query;
    let query = `
      SELECT 
        ptc.property_id,
        ptc.target_id_str,
        CONCAT_WS(' ', o.first_name, NULLIF(o.middle_name, ''), o.last_name) AS owner_name,
        ptc.property_type,
        ptc.classification,
        COALESCE(brgy.barangay_name, 'Lagonglong') AS barangay,
        ptc.tax_year,
        ptc.market_value,
        ptc.assessment_level,
        ptc.assessed_value,
        ptc.basic_tax_rate,
        ptc.basic_tax_amount,
        ptc.sef_tax_rate,
        ptc.sef_tax_amount,
        ptc.other_levies_amount,
        ptc.discount_amount,
        ptc.penalty_interest_amount,
        ptc.total_computed_tax,
        DATE_FORMAT(ptc.created_at, '%Y-%m-%d') AS computation_date,
        ptc.computation_status
      FROM property_tax_computations ptc
      JOIN properties p ON ptc.property_id = p.property_id
      JOIN property_owners o ON ptc.owner_id = o.owner_id
      LEFT JOIN addresses addr ON p.address_id = addr.address_id
      LEFT JOIN barangays brgy ON addr.barangay_id = brgy.barangay_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ' AND ptc.computation_status = ?';
      params.push(status);
    }
    if (year && year !== 'ALL') {
      query += ' AND ptc.tax_year = ?';
      params.push(year);
    }
    if (barangay && barangay !== 'ALL') {
      query += ' AND LOWER(brgy.barangay_name) = LOWER(?)';
      params.push(barangay);
    }
    if (classification && classification !== 'ALL') {
      query += ' AND LOWER(ptc.classification) = LOWER(?)';
      params.push(classification);
    }

    query += ' ORDER BY ptc.computation_id DESC';
    const [rows] = await pool.query(query, params);

    // Escape CSV cell and guard against formula injection (=, +, -, @)
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/\r\n|\r|\n/g, ' ');
      // Formula injection protection: prepend single quote if cell starts with dangerous formula trigger
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    // 18 Standard Government Report Columns
    const headers = [
      'Property ID',
      'Lot ID or Building ID',
      'Property Owner',
      'Property Type',
      'Classification',
      'Barangay',
      'Tax Year',
      'Market Value',
      'Assessment Level',
      'Assessed Value',
      'Basic Tax Rate',
      'Basic Property Tax',
      'SEF Rate and Amount',
      'Other Applicable Levies',
      'Applicable Discounts and Exemptions',
      'Penalties and Interest',
      'Total Computed Tax',
      'Computation Date and Approval Status'
    ];

    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const sefCombined = `${(Number(r.sef_tax_rate) * 100).toFixed(1)}% (₱${Number(r.sef_tax_amount).toFixed(2)})`;
      const dateAndStatus = `${r.computation_date} [${r.computation_status.toUpperCase()}]`;
      const basicRatePct = `${(Number(r.basic_tax_rate) * 100).toFixed(1)}%`;
      const alPct = `${(Number(r.assessment_level) * 100).toFixed(1)}%`;

      const rowValues = [
        escapeCsv(r.property_id),
        escapeCsv(r.target_id_str || `PROP-${r.property_id}`),
        escapeCsv(r.owner_name),
        escapeCsv(r.property_type),
        escapeCsv(r.classification),
        escapeCsv(r.barangay),
        escapeCsv(r.tax_year),
        Number(r.market_value).toFixed(2),
        escapeCsv(alPct),
        Number(r.assessed_value).toFixed(2),
        escapeCsv(basicRatePct),
        Number(r.basic_tax_amount).toFixed(2),
        escapeCsv(sefCombined),
        Number(r.other_levies_amount).toFixed(2),
        Number(r.discount_amount).toFixed(2),
        Number(r.penalty_interest_amount).toFixed(2),
        Number(r.total_computed_tax).toFixed(2),
        escapeCsv(dateAndStatus)
      ];
      csvLines.push(rowValues.join(','));
    }

    const csvContent = csvLines.join('\r\n');
    const selectedYear = year || new Date().getFullYear();
    const filename = `Property_Tax_Computation_Report_${selectedYear}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

export default router;
