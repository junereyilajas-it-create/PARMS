import { MapPin, MoreHorizontal, FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Property } from '../../types/property'
import { CertificationPrintModal } from './CertificationPrintModal'

type Props = { 
  rows: Property[]
  onView?: (property: Property) => void
  onMap?: (property: Property) => void
  onEdit?: (property: Property) => void
  onDelete?: (property: Property) => void
  onSelect?: (property: Property) => void
}

export function PropertyTable({ rows, onView, onMap, onEdit, onDelete, onSelect }: Props) {
  const navigate = useNavigate()
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Property | null>(null)
  const [printCertFor, setPrintCertFor] = useState<Property | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => { 
    const close = (event: MouseEvent) => { 
      if (!tableRef.current?.contains(event.target as Node)) setOpenId(null) 
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close) 
  }, [])

  const handleRowClick = (property: Property) => {
    if (onSelect) {
      onSelect(property)
    } else {
      const cleanId = property.id.replace('PROPERTY-', '')
      navigate(`/documents?propertyId=${cleanId}`)
    }
  }

  const view = (property: Property, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setOpenId(null)
    if (onView) onView(property)
    else setSelected(property)
  }

  const map = (property: Property, e?: React.MouseEvent) => { 
    e?.stopPropagation()
    setOpenId(null)
    if (onMap) onMap(property)
    else window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.location)}`, '_blank', 'noopener,noreferrer') 
  }

  const printCert = (property: Property, e?: React.MouseEvent) => { 
    e?.stopPropagation()
    setOpenId(null)
    if (onSelect) {
      onSelect(property)
    } else {
      const cleanId = property.id.replace('PROPERTY-', '')
      navigate(`/documents?propertyId=${cleanId}`)
    }
  }

  return (
    <>
      <div className="table-wrap" ref={tableRef}>
        <table>
          <thead>
            <tr>
              <th>PROPERTY ID</th>
              <th>OWNER</th>
              <th>LOCATION</th>
              <th>TYPE</th>
              <th>ASSESSED VALUE</th>
              <th>STATUS</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr 
                key={p.id}
                className="cursor-pointer hover:bg-green-50/60 dark:hover:bg-gray-800/60 transition-colors"
                onClick={() => handleRowClick(p)}
                title={`Click to open certificate workspace for ${p.id}`}
              >
                <td className="id">
                  <span className="font-semibold text-green-700 dark:text-green-400 hover:underline">
                    {p.id}
                  </span>
                </td>
                <td><strong>{p.owner}</strong></td>
                <td>
                  <span className="location">
                    <MapPin size={14} />
                    {p.location}
                  </span>
                </td>
                <td>{p.type}</td>
                <td><strong>{p.assessed}</strong></td>
                <td><span className={`badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                <td className="property-actions" onClick={e => e.stopPropagation()}>
                  <button 
                    className="more" 
                    aria-label={`More actions for ${p.id}`} 
                    aria-expanded={openId === p.id} 
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenId(id => id === p.id ? null : p.id)
                    }}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                  {openId === p.id && (
                    <div className="property-menu" role="menu">
                      <button role="menuitem" onClick={() => handleRowClick(p)}>
                        <FileText size={14} className="inline mr-1 text-green-600" />
                        Open Certificate
                      </button>
                      <button role="menuitem" onClick={(e) => view(p, e)}>
                        View property record
                      </button>
                      <button role="menuitem" onClick={(e) => map(p, e)}>
                        View on map
                      </button>
                      {onEdit && (
                        <button role="menuitem" onClick={(e) => { 
                          e.stopPropagation()
                          setOpenId(null)
                          onEdit(p) 
                        }}>
                          Edit property
                        </button>
                      )}
                      <button role="menuitem" className="text-green-600 font-medium" onClick={(e) => printCert(p, e)}>
                        Print Cert
                      </button>
                      {onDelete && (
                        <button role="menuitem" className="text-red-600 font-medium" onClick={(e) => { 
                          e.stopPropagation()
                          setOpenId(null)
                          onDelete(p) 
                        }}>
                          Delete property
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="property-detail-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section className="property-detail-dialog" role="dialog" aria-modal="true" aria-label={`Property record ${selected.id}`} onMouseDown={event => event.stopPropagation()}>
            <button className="property-detail-close" aria-label="Close" onClick={() => setSelected(null)}>×</button>
            <p className="eyebrow">PROPERTY RECORD</p>
            <h2>{selected.id}</h2>
            <dl>
              <div><dt>Owner</dt><dd>{selected.owner}</dd></div>
              <div><dt>Location</dt><dd>{selected.location}</dd></div>
              <div><dt>Property type</dt><dd>{selected.type}</dd></div>
              <div><dt>Market value</dt><dd>{selected.market}</dd></div>
              <div><dt>Assessed value</dt><dd>{selected.assessed}</dd></div>
              <div><dt>Status</dt><dd>{selected.status}</dd></div>
            </dl>
            <div className="flex gap-2 mt-4">
              <button 
                className="btn-save" 
                onClick={() => {
                  const prop = selected;
                  setSelected(null);
                  handleRowClick(prop);
                }}
              >
                Generate Certificate
              </button>
              <button className="btn-cancel" onClick={() => setSelected(null)}>Close record</button>
            </div>
          </section>
        </div>
      )}

      {printCertFor && <CertificationPrintModal property={printCertFor} close={() => setPrintCertFor(null)} />}
    </>
  )
}
