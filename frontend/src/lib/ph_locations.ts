export type Province = {
  name: string;
};

export type Municipality = {
  name: string;
  province: string;
  zipCode: string;
};

export type Barangay = {
  name: string;
  municipality: string;
};

export const PROVINCES: Province[] = [
  { name: 'Misamis Oriental' },
  { name: 'Cebu' }
];

export const MUNICIPALITIES: Municipality[] = [
  { name: 'Balingasag', province: 'Misamis Oriental', zipCode: '9005' },
  { name: 'Binuangan', province: 'Misamis Oriental', zipCode: '9008' },
  { name: 'Claveria', province: 'Misamis Oriental', zipCode: '9004' },
  { name: 'El Salvador', province: 'Misamis Oriental', zipCode: '9017' },
  { name: 'Gitagum', province: 'Misamis Oriental', zipCode: '9020' },
  { name: 'Initao', province: 'Misamis Oriental', zipCode: '9022' },
  { name: 'Jasaan', province: 'Misamis Oriental', zipCode: '9003' },
  { name: 'Lagonglong', province: 'Misamis Oriental', zipCode: '9006' },
  { name: 'Laguindingan', province: 'Misamis Oriental', zipCode: '9019' },
  { name: 'Libertad', province: 'Misamis Oriental', zipCode: '9021' },
  { name: 'Lugait', province: 'Misamis Oriental', zipCode: '9025' },
  { name: 'Magsaysay', province: 'Misamis Oriental', zipCode: '9015' },
  { name: 'Manticao', province: 'Misamis Oriental', zipCode: '9024' },
  { name: 'Medina', province: 'Misamis Oriental', zipCode: '9013' },
  { name: 'Naawan', province: 'Misamis Oriental', zipCode: '9023' },
  { name: 'Opol', province: 'Misamis Oriental', zipCode: '9016' },
  { name: 'Salay', province: 'Misamis Oriental', zipCode: '9007' },
  { name: 'Sugbongcogon', province: 'Misamis Oriental', zipCode: '9009' },
  { name: 'Tagoloan', province: 'Misamis Oriental', zipCode: '9001' },
  { name: 'Villanueva', province: 'Misamis Oriental', zipCode: '9002' },
  
  { name: 'Cebu City', province: 'Cebu', zipCode: '6000' }
];

export const BARANGAYS: Barangay[] = [
  { name: 'Banglay', municipality: 'Lagonglong' },
  { name: 'Dampil', municipality: 'Lagonglong' },
  { name: 'Gaston', municipality: 'Lagonglong' },
  { name: 'Kabulawan', municipality: 'Lagonglong' },
  { name: 'Kauswagan', municipality: 'Lagonglong' },
  { name: 'Lumbo', municipality: 'Lagonglong' },
  { name: 'Manaol', municipality: 'Lagonglong' },
  { name: 'Poblacion', municipality: 'Lagonglong' },
  { name: 'Tabok', municipality: 'Lagonglong' },
  { name: 'Umagos', municipality: 'Lagonglong' },
  { name: 'San Isidro', municipality: 'Balingasag' }
];

export function getProvinces() {
  return PROVINCES.map(p => p.name).sort();
}

export function getMunicipalities(province: string) {
  return MUNICIPALITIES.filter(m => m.province === province).sort((a, b) => a.name.localeCompare(b.name));
}

export function getBarangays(municipality: string) {
  return BARANGAYS.filter(b => b.municipality === municipality).map(b => b.name).sort();
}

export function getZipCode(municipalityName: string) {
  const mun = MUNICIPALITIES.find(m => m.name === municipalityName);
  return mun ? mun.zipCode : '';
}
