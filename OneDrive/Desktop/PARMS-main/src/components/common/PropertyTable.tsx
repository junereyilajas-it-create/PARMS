import { MapPin, MoreHorizontal } from 'lucide-react'
import type { Property } from '../../types/property'
export function PropertyTable({ rows }: { rows: Property[] }) {
  return <div className="table-wrap"><table><thead><tr><th>PROPERTY ID</th><th>OWNER</th><th>LOCATION</th><th>TYPE</th><th>ASSESSED VALUE</th><th>STATUS</th><th/></tr></thead><tbody>{rows.map(p => <tr key={p.id}><td className="id">{p.id}</td><td><strong>{p.owner}</strong></td><td><span className="location"><MapPin size={14}/>{p.location}</span></td><td>{p.type}</td><td><strong>{p.assessed}</strong></td><td><span className={`status ${p.status.toLowerCase()}`}>{p.status}</span></td><td><button className="more" aria-label={`More actions for ${p.id}`}><MoreHorizontal size={19}/></button></td></tr>)}</tbody></table></div>
}
