
import { PropertyTable } from '../components/common/PropertyTable'
import { SearchBox } from '../components/common/SearchBox'
import type { Property } from '../types/property'

export function Certifications({ query, onQueryChange, rows, onDelete }: { query: string; onQueryChange: (val: string) => void; rows: Property[]; onDelete?: (property: Property) => void }) {
  return (
    <>
      <div className="title-row">
        <div>
          <p className="eyebrow">DOCUMENT SERVICES</p>
          <h1>Print Certifications</h1>
          <p className="subhead">Locate a property and print its official certification or tax declaration.</p>
        </div>
      </div>
      
      <div className="card records mt-6" style={{ marginTop: '1.5rem' }}>
        <div className="card-head">
          <div>
            <h2>Select Property</h2>
            <p>Click the three-dot menu (⋯) on any property row to print its certification.</p>
          </div>
        </div>
        <SearchBox value={query} onChange={onQueryChange} />
        <PropertyTable rows={rows} onDelete={onDelete} />
      </div>
    </>
  )
}
