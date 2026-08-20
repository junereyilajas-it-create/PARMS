import { Check, ChevronRight, MapPin, Search, X } from 'lucide-react'
import { useState } from 'react'
import '../../styles/MultiStepModal.css'

export type PropertyRegistrationForm = { owner: string; taxId: string; street: string; barangay: string; type: string; lot: string; market: string; coordinates: string; document: string; lotNumber: string; titleNumber: string }
const steps = ['Owner Information', 'Property Specs', 'GIS & Documentation']

export function RegisterPropertyModal({ close, onSave }: { close: () => void; onSave: (form: PropertyRegistrationForm) => Promise<void> }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<PropertyRegistrationForm>({ owner: '', taxId: '', street: '', barangay: 'Poblacion', type: 'Residential', lot: '', market: '', coordinates: '', document: '', lotNumber: '', titleNumber: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key: keyof PropertyRegistrationForm, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = async () => {
    if (!form.owner.trim() || !form.street.trim() || !form.barangay.trim()) return setError('Owner name, street, and barangay are required.')
    setBusy(true); setError('')
    try { await onSave(form); close() } catch (error) { setError(error instanceof Error ? error.message : 'Unable to register the property.') } finally { setBusy(false) }
  }
  const next = () => step === steps.length - 1 ? void submit() : setStep(value => value + 1)

  return <div className="workflow-backdrop" onMouseDown={close}><section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="register-property-title" onMouseDown={event => event.stopPropagation()}>
    <header className="workflow-header"><h2 id="register-property-title">Register New Property</h2><button aria-label="Close" disabled={busy} onClick={close}><X size={18}/></button></header>
    <WorkflowSteps current={step} labels={steps}/>
    <div className="workflow-body">
      {error && <p className="text-red-700">{error}</p>}
      {step === 0 && <><label>Primary Owner <span className="required">*</span><div className="input-icon"><Search size={15}/><input value={form.owner} onChange={event => update('owner', event.target.value)} placeholder="Owner full name"/></div><small>This creates the owner record in the database.</small></label><label>Tax ID<input value={form.taxId} onChange={event => update('taxId', event.target.value)} placeholder="e.g. 84928-A"/></label><div className="workflow-two-columns"><label>Street or Purok <span className="required">*</span><input value={form.street} onChange={event => update('street', event.target.value)} placeholder="Enter street or purok"/></label><label>Barangay <span className="required">*</span><select value={form.barangay} onChange={event => update('barangay', event.target.value)}><option>Banglay</option><option>Dampil</option><option>Gaston</option><option>Kabulawan</option><option>Kauswagan</option><option>Lumbo</option><option>Manaol</option><option>Poblacion</option><option>Tabok</option><option>Umagos</option></select></label></div><p className="workflow-note">Municipality: Lagonglong, Province: Misamis Oriental</p></>}
      {step === 1 && <><div className="workflow-two-columns"><label>Property type<select value={form.type} onChange={event => update('type', event.target.value)}><option>Residential</option><option>Commercial</option><option>Industrial</option><option>Agricultural</option></select></label><label>Lot area (sqm)<input type="number" value={form.lot} onChange={event => update('lot', event.target.value)} placeholder="e.g. 450"/></label></div><label>Declared market value<input value={form.market} onChange={event => update('market', event.target.value)} placeholder="₱ 0.00"/></label></>}
      {step === 2 && <><div className="workflow-two-columns"><label>Lot Number<input value={form.lotNumber} onChange={event => update('lotNumber', event.target.value)} placeholder="e.g. LOT-123"/></label><label>Title Number<input value={form.titleNumber} onChange={event => update('titleNumber', event.target.value)} placeholder="e.g. TCT-123"/></label></div><label>GPS Coordinates <div className="input-icon"><MapPin size={15}/><input value={form.coordinates} onChange={event => update('coordinates', event.target.value)} placeholder="e.g. 14.5995, 120.9842"/></div></label><label>Supporting document reference<input value={form.document} onChange={event => update('document', event.target.value)} placeholder="Title, deed, or survey reference"/></label><p className="workflow-note">Review the property details before completing registration.</p></>}
    </div>
    <footer className="workflow-footer"><button className="workflow-cancel" disabled={busy} onClick={step ? () => setStep(value => value - 1) : close}>{step ? '← Previous Step' : 'Cancel'}</button><button className="workflow-next" disabled={busy} onClick={next}>{step === steps.length - 1 ? (busy ? 'Registering…' : 'Complete Registration') : 'Next Step'} {step < steps.length - 1 && <ChevronRight size={16}/>}</button></footer>
  </section></div>
}

export function WorkflowSteps({ current, labels }: { current: number; labels: string[] }) { return <div className="workflow-steps">{labels.map((label, index) => <div className="workflow-step" key={label}><span className={index < current ? 'done' : index === current ? 'active' : ''}>{index < current ? <Check size={13}/> : index + 1}</span><strong>{label}</strong>{index < labels.length - 1 && <i className={index < current ? 'complete' : ''}/>}</div>)}</div> }
