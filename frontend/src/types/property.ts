export type Property = {
  id: string; owner: string; location: string; type: string; assessed: string; market: string
  status: 'Active' | 'Inactive' | 'Pending'; x: number; y: number; color: string
  latitude: number | null; longitude: number | null;
}

export type TaxDeclaration = {
  id: string
  owner: string
  location: string
  declarationNumber: string
  taxYear: string
  issueDate: string
  assessedValue: string
  status: 'Active' | 'Pending'
}

export type EstimateInput = { type: string; lot: string; building: string; age: string }

export type CertificateRequest = {
  request_id: number;
  reference_number?: string;
  user_id: number;
  property_id?: number | null;
  certificate_type: string;
  purpose: string;
  remarks?: string | null;
  contact_number?: string | null;
  status: 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'PROCESSING' | 'UNDER_REVIEW' | 'READY_FOR_PICKUP' | 'READY_FOR_CLAIMING' | 'RELEASED' | 'COMPLETED' | 'REJECTED' | 'RETURNED' | 'CANCELLED';
  rejection_reason?: string | null;
  processing_notes?: string | null;
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  assigned_to?: number | null;
  completed_at?: string | null;
  released_at?: string | null;
  released_by?: number | null;
  released_by_name?: string | null;
  certificate_id?: number | null;
  certificate_number?: string | null;
  certificate_issued_at?: string | null;
  location?: string;
  property_type_id?: number;
  property_type_name?: string;
  lot_number?: string | null;
  title_number?: string | null;
  tax_declaration_no?: string | null;
  client_name?: string;
  client_username?: string;
  client_email?: string;
  owner_name?: string;
  owner_id?: number;
  owner_contact?: string | null;
  reviewer_name?: string;
  assigned_staff_name?: string;
}

