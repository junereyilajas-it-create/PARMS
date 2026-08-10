import { useState } from 'react'
import type { Property } from '../../types/property'

export function RegisterPropertyModal({ close, onSave }: { close: () => void; onSave: (property: Property) => void }) {
  const [form, setForm] = useState({ type: 'Residential', lot: '', owner: '', market: '' })
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  const save = () => {
    if (!form.lot || !form.owner || !form.market) return
    onSave({ id: `TD-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, owner: form.owner, location: `Lot ${form.lot}`, type: form.type, assessed: form.market, market: form.market, status: 'Pending', x: 50, y: 50, color: '#2864d7' })
    close()
  }
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={close}>×</button><p className="eyebrow">PROPERTY RECORD</p><h2>Register property</h2><p>Add a property record to begin an assessment.</p><div className="form-grid"><label>Property type<select value={form.type} onChange={e => update('type', e.target.value)}><option>Residential</option><option>Commercial</option><option>Agricultural</option></select></label><label>Lot number<input required value={form.lot} onChange={e => update('lot', e.target.value)} placeholder="e.g., Lot 18"/></label><label>Owner name<input required value={form.owner} onChange={e => update('owner', e.target.value)} placeholder="Full name"/></label><label>Market value<input required value={form.market} onChange={e => update('market', e.target.value)} placeholder="₱ 0.00"/></label></div><button className="primary full" onClick={save}>Save property record</button></div></div>
}
