// Re-export PropertyTaxReports for backward compatibility while completely replacing legacy tax billing
export { PropertyTaxReports, default as TaxBilling } from './PropertyTaxReports';
export type { PropertyTaxRow, ReportStats, BreakdownItem, PropertyTaxReportsProps as TaxBillingProps } from './PropertyTaxReports';
