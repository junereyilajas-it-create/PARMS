export type Property = {
  id: string; owner: string; location: string; type: string; assessed: string; market: string
  status: 'Active' | 'Pending'; x: number; y: number; color: string
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
