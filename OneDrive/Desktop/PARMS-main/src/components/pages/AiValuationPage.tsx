import { AiValuationView } from '../valuation/AiValuationView'
import type { EstimateInput } from '../../types/property'

export default function AiValuationPage({ value, onChange }: { value: EstimateInput; onChange: (value: EstimateInput) => void }) {
  return <AiValuationView value={value} onChange={onChange} />
}
