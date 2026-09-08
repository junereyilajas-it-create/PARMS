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
  user_id: number;
  property_id?: number | null;
  certificate_type: string;
  purpose: string;
  remarks?: string | null;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'READY_FOR_CLAIMING' | 'COMPLETED' | 'CANCELLED';
  rejection_reason?: string | null;
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  completed_at?: string | null;
  location?: string;
  property_type_id?: number;
  client_name?: string;
  owner_name?: string;
  reviewer_name?: string;
}
