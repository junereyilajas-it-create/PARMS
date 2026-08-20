import { Check, ChevronRight, MapPin, SquareDashed, X } from 'lucide-react'
import { useState } from 'react'
import { WorkflowSteps } from './RegisterPropertyModal'
import '../../styles/MultiStepModal.css'

type LotForm = { property_id: string; lot_number: string; title_number: string; location: string; lot_area: string; latitude: string; longitude: string; lot_status: string }
const steps = ['Parcel Details', 'Location', 'Review & Register']

export function LotRegistrationModal({ close, onSave, initialValues, title = 'Add Property Lot' }: { close: () => void; onSave: (values: Record<string, string>) => Promise<void> | void; initialValues?: Partial<Record<keyof LotForm, string | number | null>>; title?: string }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const isEditing = Boolean(initialValues)
  const [form, setForm] = useState<LotForm>({ property_id: '', lot_number: '', title_number: '', location: '', lot_area: '', latitude: '', longitude: '', lot_status: 'active', ...Object.fromEntries(Object.entries(initialValues ?? {}).map(([key, value]) => [key, value == null ? '' : String(value)])) } as LotForm)
  const update = (key: keyof LotForm, value: string) => setForm(current => ({ ...current, [key]: value }))
  const next = async () => { if (step < 2) return setStep(current => current + 1); if (!form.property_id || !form.lot_number || !form.location) return; setBusy(true); try { await onSave(form); close() } finally { setBusy(false) } }
  return <div className="workflow-backdrop" onMouseDown={close}><section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="add-lot-title" onMouseDown={event => event.stopPropagation()}>
    <header className="workflow-header"><div><h2 id="add-lot-title"><SquareDashed size={16}/>{title}</h2><small>Step {step + 1} of {steps.length}: {steps[step]}</small></div><button aria-label="Close" onClick={close}><X size={18}/></button></header>
    <WorkflowSteps current={step} labels={steps}/>
    <div className="workflow-body">
      {step === 0 && <><label>Property ID <span className="required">*</span><input required type="number" value={form.property_id} onChange={event => update('property_id', event.target.value)} placeholder="Existing property ID, e.g. 1"/><small>Link this lot to an existing property record.</small></label><div className="workflow-two-columns"><label>Lot number <span className="required">*</span><input value={form.lot_number} onChange={event => update('lot_number', event.target.value)} placeholder="e.g. LOT-2026-001"/></label><label>Title number<input value={form.title_number} onChange={event => update('title_number', event.target.value)} placeholder="e.g. T-12345"/></label></div><label>Lot area (sqm)<input type="number" min="0" value={form.lot_area} onChange={event => update('lot_area', event.target.value)} placeholder="e.g. 450"/></label></>}
      {step === 1 && <><label>Location <span className="required">*</span><div className="input-icon"><MapPin size={15}/><input value={form.location} onChange={event => update('location', event.target.value)} placeholder="Barangay, street, or landmark"/></div></label><div className="workflow-two-columns"><label>Latitude<input type="number" step="any" value={form.latitude} onChange={event => update('latitude', event.target.value)} placeholder="e.g. 8.5881"/></label><label>Longitude<input type="number" step="any" value={form.longitude} onChange={event => update('longitude', event.target.value)} placeholder="e.g. 124.7562"/></label></div><label>Record status<select value={form.lot_status} onChange={event => update('lot_status', event.target.value)}><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></label></>}
      {step === 2 && <><p className="workflow-note">Confirm the lot information before saving it to the property register.</p><div className="workflow-two-columns"><label>Property ID<input readOnly value={form.property_id}/></label><label>Lot number<input readOnly value={form.lot_number}/></label></div><label>Location<input readOnly value={form.location}/></label></>}
    </div>
    <footer className="workflow-footer"><button className="workflow-cancel" onClick={step ? () => setStep(current => current - 1) : close}>{step ? '← Previous Step' : 'Cancel'}</button><button className="workflow-next" disabled={busy} onClick={next}>{step === 2 ? <><Check size={16}/> {busy ? (isEditing ? 'Saving…' : 'Adding…') : (isEditing ? 'Save Changes' : 'Add Lot')}</> : <>Next: {steps[step + 1]} <ChevronRight size={16}/></>}</button></footer>
  </section></div>
}
