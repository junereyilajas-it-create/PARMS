import { ClipboardCheck, FileText, MapPin, Plus, Search, ShieldCheck, Upload, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Item = { eyebrow: string; title: string; description: string; action: string; icon: LucideIcon; metrics: string[]; headers: string[]; records: string[][] }
const defaults = { metrics: ['18 Pending', '94% On-time', '3.2 days avg.'], headers: ['REFERENCE', 'PROPERTY / SUBJECT', 'ASSIGNED TO', 'DATE', 'STATUS'], records: [['REF-2026-018', 'TD-2024-01842 · Maria L. Santos', 'Admin User', 'Aug 02, 2026', 'For review'], ['REF-2026-017', 'TD-2024-01841 · Jose R. Dela Cruz', 'J. Dela Cruz', 'Aug 01, 2026', 'Active'], ['REF-2026-016', 'TD-2024-01840 · Ana P. Reyes', 'A. Reyes', 'Jul 31, 2026', 'Completed']] }
const definitions: Record<string, Omit<Item, keyof typeof defaults>> = {
  Dashboard: { eyebrow: 'DASHBOARD', title: 'Administrative Overview', description: 'Monitor property inventory, owner activity, and valuation performance.', action: 'Create report', icon: Search },
  Owners: { eyebrow: 'OWNER DIRECTORY', title: 'Property Owner Management', description: 'Manage legal records and contact information for registered owners.', action: 'Register owner', icon: UsersRound },
  Lots: { eyebrow: 'LOT REGISTRY', title: 'Lot and Parcel Records', description: 'Review lot inventories, ownership, and parcel identifiers.', action: 'Add lot', icon: ClipboardCheck },
  Buildings: { eyebrow: 'BUILDING DATABASE', title: 'Building Records', description: 'Track building details, conditions, and assessments.', action: 'Register building', icon: ClipboardCheck },
  Assessments: { eyebrow: 'VALUATION WORKSPACE', title: 'Property Assessments', description: 'Review, update, and approve lot and building assessments.', action: 'New assessment', icon: ClipboardCheck },
  'AI Valuation': { eyebrow: 'AI ESTIMATES', title: 'AI Valuation', description: 'Run machine learning-driven estimates for property market value.', action: 'Generate estimate', icon: Search },
  'GIS Map': { eyebrow: 'MAP PORTAL', title: 'GIS Map', description: 'Visualize property locations and geographic insights on the map.', action: 'Open map', icon: MapPin },
  Reports: { eyebrow: 'ANALYTICS & EXPORTS', title: 'Reports Center', description: 'Create official property, assessment, GIS, and activity reports.', action: 'Create report', icon: FileText },
  Settings: { eyebrow: 'SYSTEM SETTINGS', title: 'Configure application settings', description: 'Manage system preferences, roles, and support options.', action: 'Open settings', icon: ShieldCheck },
}
export function OperationsView({ page }: { page: string }) {
  const data: Item = { ...defaults, ...definitions[page] }
  const Icon = data.icon
  return (
    <>
      <div className="title-row">
        <div>
          <p className="eyebrow">{data.eyebrow}</p>
          <h1>{data.title}</h1>
          <p className="subhead">{data.description}</p>
        </div>
        <button className="primary"><Plus size={18} />{data.action}</button>
      </div>
      <div className="operation-stats">
        {data.metrics.map((metric, index) => (
          <section className="card operation-stat" key={metric}>
            <Icon />
            <strong>{metric}</strong>
            <span>{['Current workload', 'Service standard', 'Processing average'][index]}</span>
          </section>
        ))}
      </div>
      <section className="card operation-table">
        <div className="card-head">
          <div>
            <h2>Current records</h2>
            <p>Search and filter the records in this module.</p>
          </div>
          <button className="text-button"><Upload size={14} /> Export</button>
        </div>
        <div className="table-tools">
          <label><Search size={15} /><input placeholder="Search records…" /></label>
          <button className="filter">All statuses</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{data.headers.map(header => <th key={header}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {data.records.map((record, i) => (
                <tr key={i}>{record.map((cell, j) => <td key={j}>{j === 4 ? <span className="status active">{cell}</span> : cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
