import { PropertyMapView } from '../maps/PropertyMapView'
import type { Property } from '../../types/property'

export default function GisMapPage({ query, onQueryChange, rows, selected, onSelect }: { query: string; onQueryChange: (value: string) => void; rows: Property[]; selected: Property; onSelect: (property: Property) => void }) {
  return <PropertyMapView query={query} onQueryChange={onQueryChange} rows={rows} selected={selected} onSelect={onSelect} />
}
