export type GISFeature = {
  id: string | number;
  lot_id?: number | null;
  building_id?: number | null;
  property_id: string | number;
  title: string;
  title_number?: string | null;
  area: string | number;
  status: string;
  property_status: string;
  type: 'lot' | 'building';
  classification_name?: string | null;
  property_type_name?: string | null;

  // Owner information
  owner_id?: number | null;
  owner: string;
  owner_contact?: string | null;
  owner_email?: string | null;
  owner_address?: string | null;

  // Address information
  house_number?: string | null;
  street?: string | null;
  barangay_name?: string | null;
  municipality_name?: string | null;
  province_name?: string | null;
  full_address?: string | null;

  // GIS geometry and measurements
  gis_id?: number | null;
  geometry_type?: string | null;
  coordinates?: any;
  area_sqm?: number | null;
  perimeter_m?: number | null;
  mapping_status?: 'verified' | 'approximate' | 'draft' | string | null;
  has_gis?: boolean;
  latitude?: number | null;
  longitude?: number | null;

  // Assessment details
  assessment_status?: string | null;
  is_assessed?: boolean | number;
  assessor_level?: string | number | null;
  market_value?: string | number | null;
  assessed_value?: string | number | null;
  assessment_date?: string | null;
  assessor_name?: string | null;

  // Assignment details
  assignment_id?: number | null;
  assignment_status?: string | null;
  assignment_due_date?: string | null;
  assigned_assessor_name?: string | null;

  // Building specifics
  building_type?: string | null;
  floor_count?: number | null;
  construction_type?: string | null;
  year_constructed?: number | null;

  // Media
  property_photo?: string | null;
  photos?: Array<{
    photo_id?: number;
    property_id?: number | string;
    lot_id?: number | null;
    building_id?: number | null;
    file_path: string;
    file_name?: string | null;
    file_size?: number | null;
    mime_type?: string | null;
    is_primary?: number | boolean;
  }>;
}

export type MapMode = 'street' | 'satellite' | 'streetview'

export interface ParsedGeometry {
  positions: [number, number][]
  centroid: [number, number]
  bounds: [[number, number], [number, number]] | null
  sideLengths: {
    start: [number, number]
    end: [number, number]
    midPoint: [number, number]
    lengthMeters: number
  }[]
  areaSqm: number
  perimeterMeters: number
}
