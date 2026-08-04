import { Download, Filter, Grid, Plus } from 'lucide-react'

const stats = [
  { label: 'Total Structures', value: '12,482', detail: '+1.2% this quarter' },
  { label: 'Residential Units', value: '8,904', detail: '' },
  { label: 'Commercial Lots', value: '3,578', detail: '' },
  { label: 'Pending Valuation', value: '142', detail: 'High Priority', warning: true },
]

const buildings = [
  { id: 'BLDG-10294-A', type: 'Residential', pin: '12-04-100-022', year: '1988', last: '₱425,000', status: 'APPROVED' },
  { id: 'BLDG-88219-C', type: 'Commercial', pin: '12-04-210-005', year: '2012', last: '₱1,850,000', status: 'APPROVED' },
  { id: 'BLDG-30042-B', type: 'Residential', pin: '12-05-142-011', year: '1965', last: '₱780,200', status: 'ARCHIVED' },
  { id: 'BLDG-99201-F', type: 'Industrial', pin: '12-08-900-112', year: '2023', last: '₱3,120,000', status: 'PENDING' },
  { id: 'BLDG-44102-X', type: 'Mixed Use', pin: '12-04-110-098', year: '2005', last: '₱920,000', status: 'APPROVED' },
]

export default function BuildingsPage() {
  return (
    <div className="buildings-page">
      <div className="title-row">
        <div>
          <p className="eyebrow">Building Directory</p>
          <h1>Building Directory</h1>
          <p className="subhead">Manage structural assets and linked parcels across municipal districts.</p>
        </div>
        <button className="primary"><Plus size={18} />Add Building Structure</button>
      </div>

      <div className="stats-grid">
        {stats.map((item) => (
          <section key={item.label} className={`card stat-card${item.warning ? ' warning' : ''}`}>
            <span>{item.label}</span>
            <h2>{item.value}</h2>
            <p>{item.detail}</p>
          </section>
        ))}
      </div>

      <section className="card building-table-card">
        <div className="table-header">
          <div className="filters-row">
            <select>
              <option>All Districts</option>
            </select>
            <select>
              <option>Building Type</option>
            </select>
            <select>
              <option>Year Range</option>
            </select>
          </div>
          <div className="table-actions">
            <button className="outline"><Filter size={16} /> Filter</button>
            <button className="text-button"><Download size={16} /> Export</button>
            <button className="text-button"><Grid size={16} /> Grid</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Building ID</th>
                <th>Type</th>
                <th>Lot PIN</th>
                <th>Year Built</th>
                <th>Last Assessment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((building) => (
                <tr key={building.id}>
                  <td>{building.id}</td>
                  <td>{building.type}</td>
                  <td>{building.pin}</td>
                  <td>{building.year}</td>
                  <td>{building.last}</td>
                  <td><span className={`status ${building.status.toLowerCase()}`}>{building.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="buildings-lower">
        <section className="card chart-card">
          <div className="card-head"><h2>Construction Trends (District 04)</h2></div>
          <div className="bar-chart">
            {[2019, 2020, 2021, 2022, 2023, 2024].map((year, index) => (
              <div key={year} className={`bar bar-${index + 1}`}><span>{year}</span></div>
            ))}
          </div>
        </section>
        <section className="card insight-card">
          <div className="card-head"><h2>AI Insights</h2></div>
          <p>District 04 is seeing a 14% increase in Mixed-Use building renovations. System suggests prioritized assessment for structural permits issued in the last 6 months.</p>
          <button className="primary">Generate Risk Report</button>
        </section>
      </div>
    </div>
  )
}
