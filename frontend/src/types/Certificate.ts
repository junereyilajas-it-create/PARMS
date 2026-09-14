export interface GeneratedCertificate {
  certificate_id: number
  certificate_number: string
  certificate_type: string
  owner_id: number
  property_id: number | null
  requestor_name: string
  purpose: string
  status: 'Generated' | 'Cancelled'
  issued_at: string
  issued_by_user_id: number
  owner_name: string
  generated_by_name: string
}

export interface CertificatePropertyInfo {
  property_id: number
  property_status: string
  property_type_name: string
  classification_name: string
  location: string
  barangay_name: string
  municipality_name: string
  province_name: string
  lot_area: number | null
  floor_area: number | null
  tax_declaration_no: string | null
  assessed_value: number | null
  market_value: number | null
  first_name: string
  middle_name: string | null
  last_name: string
  contact_number: string | null
}
