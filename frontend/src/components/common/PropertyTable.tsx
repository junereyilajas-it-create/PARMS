import { MapPin, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Property } from '../../types/property'
import { CertificationPrintModal } from './CertificationPrintModal'

type Props = { rows: Property[]; onView?: (property: Property) => void; onMap?: (property: Property) => void; onDelete?: (property: Property) => void }

export function PropertyTable({ rows, onView, onMap, onDelete }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Property | null>(null)
  const [printCertFor, setPrintCertFor] = useState<Property | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => { const close = (event: MouseEvent) => { if (!tableRef.current?.contains(event.target as Node)) setOpenId(null) }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close) }, [])

  const view = (property: Property) => { setOpenId(null); onView ? onView(property) : setSelected(property) }
  const map = (property: Property) => { setOpenId(null); if (onMap) onMap(property); else window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.location)}`, '_blank', 'noopener,noreferrer') }
  const printCert = (property: Property) => { setOpenId(null); setPrintCertFor(property) }

  return <><div className="table-wrap" ref={tableRef}><table><thead><tr><th>PROPERTY ID</th><th>OWNER</th><th>LOCATION</th><th>TYPE</th><th>ASSESSED VALUE</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(p => <tr key={p.id}><td className="id">{p.id}</td><td><strong>{p.owner}</strong></td><td><span className="location"><MapPin size={14} />{p.location}</span></td><td>{p.type}</td><td><strong>{p.assessed}</strong></td><td><span className={`status ${p.status.toLowerCase()}`}>{p.status}</span></td><td className="property-actions"><button className="more" aria-label={`More actions for ${p.id}`} aria-expanded={openId === p.id} onClick={() => setOpenId(id => id === p.id ? null : p.id)}><MoreHorizontal size={19} /></button>{openId === p.id && <div className="property-menu" role="menu"><button role="menuitem" onClick={() => view(p)}>View property record</button><button role="menuitem" onClick={() => map(p)}>View on map</button><button role="menuitem" className="text-green-600 font-medium" onClick={() => printCert(p)}>Print Cert</button>{onDelete && <button role="menuitem" className="text-red-600 font-medium" onClick={() => { setOpenId(null); onDelete(p); }}>Delete property</button>}</div>}</td></tr>)}</tbody></table></div>{selected && <div className="property-detail-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><section className="property-detail-dialog" role="dialog" aria-modal="true" aria-label={`Property record ${selected.id}`} onMouseDown={event => event.stopPropagation()}><button className="property-detail-close" aria-label="Close" onClick={() => setSelected(null)}>×</button><p className="eyebrow">PROPERTY RECORD</p><h2>{selected.id}</h2><dl><div><dt>Owner</dt><dd>{selected.owner}</dd></div><div><dt>Location</dt><dd>{selected.location}</dd></div><div><dt>Property type</dt><dd>{selected.type}</dd></div><div><dt>Market value</dt><dd>{selected.market}</dd></div><div><dt>Assessed value</dt><dd>{selected.assessed}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div></dl><button className="primary" onClick={() => setSelected(null)}>Close record</button></section></div>}{printCertFor && <CertificationPrintModal property={printCertFor} close={() => setPrintCertFor(null)} />}</>
}
