import { Check, ChevronRight, MapPin, Search, X } from 'lucide-react'
import { useState } from 'react'
import type { Property } from '../../types/property'
import '../../styles/MultiStepModal.css'

type PropertyForm = { owner: string; taxId: string; address: string; type: string; lot: string; market: string; coordinates: string; document: string }
const steps = ['Owner Information', 'Property Specs', 'GIS & Documentation']

export function RegisterPropertyModal({ close, onSave }: { close: () => void; onSave: (property: Property) => void }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<PropertyForm>({ owner: '', taxId: '', address: '', type: 'Residential', lot: '', market: '', coordinates: '', document: '' })
  const update = (key: keyof PropertyForm, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = () => {
    onSave({ id: `TD-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, owner: form.owner || 'New Property Owner', location: form.address || `Lot ${form.lot}`, type: form.type, assessed: form.market || '₱ 0', market: form.market || '₱ 0', status: 'Pending', x: 50, y: 50, color: '#2864d7' })
    close()
  }
  const next = () => step === steps.length - 1 ? submit() : setStep(value => value + 1)

  return <div className="workflow-backdrop" onMouseDown={close}><section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="register-property-title" onMouseDown={event => event.stopPropagation()}>
    <header className="workflow-header"><h2 id="register-property-title">Register New Property</h2><button aria-label="Close" onClick={close}><X size={18}/></button></header>
    <WorkflowSteps current={step} labels={steps}/>
    <div className="workflow-body">
      {step === 0 && <><label>Primary Owner <span className="required">*</span><div className="input-icon"><Search size={15}/><input value={form.owner} onChange={event => update('owner', event.target.value)} placeholder="Search owner name or ID"/></div><small>Select the primary entity responsible for taxation.</small></label><label>Tax ID<input value={form.taxId} onChange={event => update('taxId', event.target.value)} placeholder="e.g. 84928-A"/></label><label>Property Address <span className="required">*</span><textarea value={form.address} onChange={event => update('address', event.target.value)} placeholder="Enter full street address, unit number, city, state, and zip..."/></label></>}
      {step === 1 && <><div className="workflow-two-columns"><label>Property type<select value={form.type} onChange={event => update('type', event.target.value)}><option>Residential</option><option>Commercial</option><option>Industrial</option><option>Agricultural</option></select></label><label>Lot area (sqm)<input type="number" value={form.lot} onChange={event => update('lot', event.target.value)} placeholder="e.g. 450"/></label></div><label>Declared market value<input value={form.market} onChange={event => update('market', event.target.value)} placeholder="₱ 0.00"/></label></>}
      {step === 2 && <><label>GPS Coordinates <div className="input-icon"><MapPin size={15}/><input value={form.coordinates} onChange={event => update('coordinates', event.target.value)} placeholder="e.g. 14.5995, 120.9842"/></div></label><label>Supporting document reference<input value={form.document} onChange={event => update('document', event.target.value)} placeholder="Title, deed, or survey reference"/></label><p className="workflow-note">Review the property details before completing registration.</p></>}
    </div>
    <footer className="workflow-footer"><button className="workflow-cancel" onClick={step ? () => setStep(value => value - 1) : close}>{step ? '← Previous Step' : 'Cancel'}</button><button className="workflow-next" onClick={next}>{step === steps.length - 1 ? 'Complete Registration' : 'Next Step'} {step < steps.length - 1 && <ChevronRight size={16}/>}</button></footer>
  </section></div>
}

export function WorkflowSteps({ current, labels }: { current: number; labels: string[] }) { return <div className="workflow-steps">{labels.map((label, index) => <div className="workflow-step" key={label}><span className={index < current ? 'done' : index === current ? 'active' : ''}>{index < current ? <Check size={13}/> : index + 1}</span><strong>{label}</strong>{index < labels.length - 1 && <i className={index < current ? 'complete' : ''}/>}</div>)}</div> }
