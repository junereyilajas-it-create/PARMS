import { Download, Eye, Filter, MoreHorizontal, Plus, RefreshCcw } from 'lucide-react'

const lots = [
  { id: 'LOT-2024-0891', location: 'San Lorenzo', barangay: 'Block 12, Phase 4', area: '450.00', classification: 'Residential', owner: 'Juan Dela Cruz', status: 'Active' },
  { id: 'LOT-2024-0902', location: 'Bel-Air', barangay: 'Makati Ave Core', area: '1,250.50', classification: 'Commercial', owner: 'Maria Pineda', status: 'Active' },
  { id: 'LOT-2023-1104', location: 'Poblacion', barangay: 'Riverside Area', area: '320.15', classification: 'Residential', owner: 'Ricardo Santos', status: 'Under Review' },
  { id: 'LOT-2024-0812', location: 'Magallanes', barangay: 'Village West', area: '2,400.00', classification: 'Institutional', owner: 'City Hall Assets', status: 'Active' },
  { id: 'LOT-2024-1055', location: 'San Lorenzo', barangay: 'Arniz Ext', area: '580.00', classification: 'Commercial', owner: 'Elena Lopez', status: 'Pending Transfer' },
  { id: 'LOT-2024-2113', location: 'Bel-Air', barangay: 'Phase 2 Lot 4', area: '1,100.00', classification: 'Residential', owner: 'Arthur M.', status: 'Active' },
]

function statusVariant(status: string) {
  if (status === 'Active') return 'active'
  if (status === 'Under Review') return 'review'
  if (status === 'Pending Transfer') return 'pending'
  return 'default'
}

function classificationVariant(classification: string) {
  const key = classification.toLowerCase().replace(/\s+/g, '-')
  return `classification ${key}`
}

export default function LotsPage() {
  return (
    <div className="lots-page">
      <div className="title-row">
        <div>
          <p className="eyebrow">Dashboard / Lot Registry</p>
          <h1>Property Lot Management</h1>
          <p className="subhead">Oversee municipal land assets, classifications, and ownership linkages.</p>
        </div>
        <button className="primary"><Plus size={18} />Register New Lot</button>
      </div>

      <section className="lots-filters card">
        <div className="filter-grid">
          <label>
            Barangay District
            <select>
              <option>All Barangays</option>
              <option>San Lorenzo</option>
              <option>Bel-Air</option>
              <option>Poblacion</option>
              <option>Magallanes</option>
            </select>
          </label>
          <label>
            Land Use Classification
            <select>
              <option>All Classifications</option>
              <option>Residential</option>
              <option>Commercial</option>
              <option>Institutional</option>
            </select>
          </label>
          <label>
            Assessment Status
            <select>
              <option>All Status</option>
              <option>Active</option>
              <option>Under Review</option>
              <option>Pending Transfer</option>
            </select>
          </label>
          <div className="filter-actions">
            <button className="outline"><Filter size={16} /> More Filters</button>
            <button className="text-button"><RefreshCcw size={16} /> Reset</button>
          </div>
        </div>
      </section>

      <div className="lots-summary">
        <span>Displaying 152 Registered Lots</span>
        <div className="summary-actions">
          <button className="text-button"><Download size={16} /> Export</button>
          <button className="text-button"><MoreHorizontal size={16} /> Print</button>
        </div>
      </div>

      <section className="card lots-table">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>LOT ID</th>
                <th>LOCATION / BARANGAY</th>
                <th>AREA (SQM)</th>
                <th>CLASSIFICATION</th>
                <th>CURRENT OWNER</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td><strong>{lot.id}</strong></td>
                  <td>
                    <div className="lot-location">
                      <strong>{lot.location}</strong>
                      <span>{lot.barangay}</span>
                    </div>
                  </td>
                  <td>{lot.area}</td>
                  <td><span className={classificationVariant(lot.classification)}>{lot.classification}</span></td>
                  <td>{lot.owner}</td>
                  <td><span className={`status ${statusVariant(lot.status)}`}>{lot.status}</span></td>
                  <td className="actions-cell">
                    <button className="icon-btn secondary" aria-label="View lot"><Eye size={16} /></button>
                    <button className="icon-btn outline" aria-label="Edit lot"><MoreHorizontal size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="lots-footer">
        <span>Showing 1 - 6 of 152</span>
        <div className="pagination">
          <button className="outline">1</button>
          <button className="text-button">2</button>
          <button className="text-button">3</button>
          <button className="outline">›</button>
        </div>
      </div>
    </div>
  )
}
