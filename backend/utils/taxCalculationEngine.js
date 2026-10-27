import { pool } from '../config/db.js';

/**
 * Decimal-safe arithmetic helper (rounds to 2 decimal places)
 */
export function round2(num) {
  return Number((Math.round(Number(num) * 100) / 100).toFixed(2));
}

/**
 * Evaluates tax rules for a property classification and computes itemized RPT charges.
 * Follows statutory formulas:
 * - Market Value: from approved property assessment / SMV
 * - Assessed Value = Market Value × Assessment Level
 * - Basic Real Property Tax = Assessed Value × Applicable Basic Tax Rate
 * - SEF Tax = Assessed Value × SEF Rate
 * - Discounts / Penalties / Levies
 * 
 * If required data is missing or unapproved, flags isComplete = false and marks computation as incomplete.
 * 
 * @param {Object} params
 * @param {number} params.marketValue
 * @param {number} params.assessmentLevelPct - (e.g., 20 for 20%)
 * @param {string} params.classification - 'Residential', 'Commercial', 'Agricultural', etc.
 * @param {number} params.taxYear - e.g., 2026
 * @param {boolean} params.isAdvancePayment - whether prompt discount applies
 * @param {number} params.monthsDelayed - months overdue for penalty calculation
 * @param {number} params.priorDelinquency - unpaid balance from past years
 * @param {boolean} params.isExempt - whether property is tax exempt
 * @param {string} params.exemptionReason - legal basis for exemption
 */
export async function calculateRealPropertyTax(params) {
  const {
    marketValue = 0,
    assessmentLevelPct = null,
    classification = 'Residential',
    taxYear = new Date().getFullYear(),
    isAdvancePayment = false,
    monthsDelayed = 0,
    priorDelinquency = 0,
    isExempt = false,
    exemptionReason = null
  } = params;

  // 1. Fetch active tax configurations for the classification and tax year
  const [rules] = await pool.query(`
    SELECT * FROM tax_configurations
    WHERE (tax_year IS NULL OR tax_year = ?)
      AND (property_classification = 'ALL' OR LOWER(property_classification) = LOWER(?))
      AND (effective_end_date IS NULL OR effective_end_date >= CURRENT_DATE)
  `, [taxYear, classification]);

  const approvedRules = rules.filter(r => r.verification_status === 'approved' || r.verification_status === 'active');
  const unapprovedRules = rules.filter(r => r.verification_status !== 'approved' && r.verification_status !== 'active');

  // Track completeness
  const missingRequirements = [];

  // Check market value
  const mv = round2(marketValue);
  if (mv <= 0 && !isExempt) {
    missingRequirements.push('Property market value is zero or unassessed. An approved valuation is required.');
  }

  // Check Schedule of Market Values
  const [smvRules] = await pool.query(`
    SELECT * FROM tax_configurations 
    WHERE category = 'smv' AND verification_status IN ('approved', 'active')
      AND (effective_end_date IS NULL OR effective_end_date >= CURRENT_DATE)
  `);
  if (smvRules.length === 0) {
    missingRequirements.push('Schedule of Market Values (SMV) has not yet been approved by the Sangguniang Panlalawigan.');
  }

  // Resolve Assessment Level
  const approvedAlRule = approvedRules.find(r => r.category === 'assessment_level');
  let effectiveAlPct = assessmentLevelPct !== null ? Number(assessmentLevelPct) : null;

  if (effectiveAlPct === null) {
    if (approvedAlRule) {
      const val = Number(approvedAlRule.value_numeric);
      effectiveAlPct = val > 1 ? val : round2(val * 100);
    } else {
      missingRequirements.push(`Approved assessment level rule for '${classification}' is missing from tax settings.`);
      effectiveAlPct = 20.00; // Fallback placeholder
    }
  }

  // Resolve Basic RPT rate (Statutory 1% for municipalities)
  const approvedBasicRateRule = approvedRules.find(r => r.category === 'tax_rate');
  let basicRate = 0.0100;
  let basicRateCode = 'RPT_BASIC_STATUTORY_RA7160';
  let basicRateRef = 'RA 7160 Sec. 233';

  if (approvedBasicRateRule) {
    basicRate = Number(approvedBasicRateRule.value_numeric) || 0.0100;
    basicRateCode = approvedBasicRateRule.rule_code;
    basicRateRef = approvedBasicRateRule.legal_reference || basicRateRef;
  } else {
    missingRequirements.push('Approved Basic Real Property Tax rate rule is missing from tax settings.');
  }

  // Resolve SEF levy rate (Statutory 1%)
  const approvedSefRule = approvedRules.find(r => r.category === 'sef_levy');
  let sefRate = 0.0100;
  let sefRateCode = 'SEF_STATUTORY_RA7160';
  let sefRateRef = 'RA 7160 Sec. 235';

  if (approvedSefRule) {
    sefRate = Number(approvedSefRule.value_numeric) || 0.0100;
    sefRateCode = approvedSefRule.rule_code;
    sefRateRef = approvedSefRule.legal_reference || sefRateRef;
  } else {
    missingRequirements.push('Approved Special Education Fund (SEF) levy rule is missing from tax settings.');
  }

  // Resolve Prompt Payment Discount
  const approvedDiscountRule = approvedRules.find(r => r.category === 'discount');
  const discountRate = (isAdvancePayment && approvedDiscountRule) 
    ? Number(approvedDiscountRule.value_numeric) 
    : (isAdvancePayment ? 0.1000 : 0.0000);

  // Resolve Monthly Penalty (Statutory 2% per month, capped at 72%)
  const approvedPenaltyRule = approvedRules.find(r => r.category === 'penalty_interest');
  const monthlyPenaltyRate = approvedPenaltyRule ? Number(approvedPenaltyRule.value_numeric) : 0.0200;
  const effectivePenaltyPct = Math.min(Number(monthsDelayed) * monthlyPenaltyRate, 0.7200);

  // Determine completeness
  const isComplete = missingRequirements.length === 0;
  const incompleteReason = isComplete ? null : missingRequirements.join(' ');

  // Compute values
  const al = round2(effectiveAlPct);
  const assessedValue = round2(mv * (al / 100));

  let basicTaxAmount = 0.00;
  let sefTaxAmount = 0.00;
  let discountAmount = 0.00;
  let penaltyInterestAmount = 0.00;
  let priorDelinquencyAmount = round2(priorDelinquency);
  let totalAmountDue = 0.00;

  const items = [];

  if (isExempt) {
    items.push({
      charge_type: 'exemption',
      description: `Tax Exempt: ${exemptionReason || 'Statutory Local Government Exemption'}`,
      rate: 0.0000,
      amount: 0.00,
      period_covered: `Tax Year ${taxYear}`
    });
  } else {
    basicTaxAmount = round2(assessedValue * basicRate);
    sefTaxAmount = round2(assessedValue * sefRate);
    const grossCurrentTax = round2(basicTaxAmount + sefTaxAmount);

    discountAmount = isAdvancePayment ? round2(grossCurrentTax * discountRate) : 0.00;
    penaltyInterestAmount = Number(monthsDelayed) > 0 ? round2(grossCurrentTax * effectivePenaltyPct) : 0.00;
    totalAmountDue = round2(grossCurrentTax - discountAmount + penaltyInterestAmount + priorDelinquencyAmount);

    items.push({
      charge_type: 'basic_rpt',
      description: `Basic Real Property Tax (${(basicRate * 100).toFixed(2)}%)`,
      rate: basicRate,
      amount: basicTaxAmount,
      period_covered: `Tax Year ${taxYear}`,
      legal_reference: basicRateRef
    });

    items.push({
      charge_type: 'sef',
      description: `Special Education Fund Levy (${(sefRate * 100).toFixed(2)}%)`,
      rate: sefRate,
      amount: sefTaxAmount,
      period_covered: `Tax Year ${taxYear}`,
      legal_reference: sefRateRef
    });

    if (discountAmount > 0) {
      items.push({
        charge_type: 'discount',
        description: `Prompt Payment Discount (${(discountRate * 100).toFixed(2)}%)`,
        rate: discountRate,
        amount: -discountAmount,
        period_covered: `Tax Year ${taxYear}`,
        legal_reference: approvedDiscountRule?.legal_reference || 'Municipal Tax Ordinance'
      });
    }

    if (penaltyInterestAmount > 0) {
      items.push({
        charge_type: 'penalty',
        description: `Delinquency Surcharge & Interest (${(effectivePenaltyPct * 100).toFixed(2)}% for ${monthsDelayed} months overdue)`,
        rate: effectivePenaltyPct,
        amount: penaltyInterestAmount,
        period_covered: `Tax Year ${taxYear}`,
        legal_reference: 'RA 7160 Sec. 255'
      });
    }

    if (priorDelinquencyAmount > 0) {
      items.push({
        charge_type: 'prior_year',
        description: 'Prior Year Unpaid Delinquent Balance',
        rate: 0.0000,
        amount: priorDelinquencyAmount,
        period_covered: `Pre-${taxYear}`
      });
    }
  }

  const snapshot = {
    calculated_at: new Date().toISOString(),
    tax_year: taxYear,
    classification,
    market_value: mv,
    assessment_level_pct: al,
    assessed_value: assessedValue,
    basic_rate: basicRate,
    basic_rate_code: basicRateCode,
    sef_rate: sefRate,
    sef_rate_code: sefRateCode,
    discount_applied: discountAmount > 0,
    discount_rate: discountRate,
    months_delayed: monthsDelayed,
    penalty_rate: effectivePenaltyPct,
    is_complete: isComplete,
    missing_requirements: missingRequirements,
    smv_rule_code: smvRules[0]?.rule_code || 'UNAPPROVED_SMV',
    verified_rules_count: approvedRules.length,
    unverified_rules_count: unapprovedRules.length
  };

  return {
    taxYear,
    classification,
    marketValue: mv,
    assessmentLevelPct: al,
    assessedValue,
    basicTaxRate: basicRate,
    basicTaxAmount,
    sefTaxRate: sefRate,
    sefTaxAmount,
    otherLeviesAmount: 0.00,
    discountAmount,
    discountRate,
    penaltyInterestAmount,
    penaltyRate: effectivePenaltyPct,
    monthsDelayed,
    priorDelinquencyAmount,
    totalAmountDue,
    isComplete,
    incompleteReason,
    isExempt,
    ruleVersionSnapshot: snapshot,
    items,
    // snake_case aliases for API and test compatibility
    market_value: marketValue,
    assessment_level: assessmentLevelPct > 1 ? assessmentLevelPct / 100 : assessmentLevelPct,
    assessed_value: assessedValue,
    basic_tax_rate: basicRate,
    basic_tax_amount: basicTaxAmount,
    sef_tax_rate: sefRate,
    sef_tax_amount: sefTaxAmount,
    other_levies_amount: 0.00,
    discount_amount: discountAmount,
    penalty_interest_amount: penaltyInterestAmount,
    total_computed_tax: totalAmountDue,
    statutory_charges: items
  };
}
