import { Check, ChevronRight, MapPin, Search, X } from 'lucide-react'
import { useState } from 'react'
import '../../styles/MultiStepModal.css'

export type PropertyRegistrationForm = { owner: string; taxId: string; street: string; barangay: string; type: string; lot: string; market: string; coordinates: string; document: string; lotNumber: string; titleNumber: string }
const steps = ['Property Info', 'Owner Info', 'Lot Info', 'Confirmation']

export function RegisterPropertyModal({ close, onSave }: { close: () => void; onSave: (form: PropertyRegistrationForm) => Promise<void> }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<PropertyRegistrationForm>({ owner: '', taxId: '', street: '', barangay: 'Poblacion', type: 'Residential', lot: '', market: '', coordinates: '', document: '', lotNumber: '', titleNumber: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key: keyof PropertyRegistrationForm, value: string) => setForm(current => ({ ...current, [key]: value }))
  
  const validateStep = (currentStep: number) => {
    if (currentStep === 0) {
      if (!form.type || !form.street.trim() || !form.barangay.trim()) return 'Property type, street, and barangay cannot be blank.'
    }
    if (currentStep === 1) {
      if (!form.owner.trim()) return 'Owner name cannot be blank.'
    }
    if (currentStep === 2) {
      if (!form.lot.trim() || isNaN(Number(form.lot))) return 'Lot area must be a valid number.'
    }
    return ''
  }

  const submit = async () => {
    setBusy(true); setError('')
    try { await onSave(form); close() } catch (error) { setError(error instanceof Error ? error.message : 'Unable to register the property.') } finally { setBusy(false) }
  }

  const next = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    step === steps.length - 1 ? void submit() : setStep(value => value + 1)
  }

  return <div className="workflow-backdrop" onMouseDown={close}><section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="register-property-title" onMouseDown={event => event.stopPropagation()}>
    <header className="workflow-header"><h2 id="register-property-title">Register New Property</h2><button aria-label="Close" disabled={busy} onClick={close}><X size={18}/></button></header>
    <WorkflowSteps current={step} labels={steps}/>
    <div className="workflow-body">
      {error && <p className="error-message" style={{marginBottom: '10px'}}>{error}</p>}
      
      {step === 0 && <><div className="workflow-two-columns"><label>Property Type <span className="required">*</span><select value={form.type} onChange={event => update('type', event.target.value)}><option>Residential</option><option>Commercial</option><option>Industrial</option><option>Agricultural</option></select></label><label>Tax ID<input value={form.taxId} onChange={event => update('taxId', event.target.value)} placeholder="e.g. 84928-A"/></label></div><div className="workflow-two-columns"><label>Street or Purok <span className="required">*</span><input className={error.includes('street') ? 'input-error' : ''} value={form.street} onChange={event => update('street', event.target.value)} placeholder="Enter street or purok"/></label><label>Barangay <span className="required">*</span><select value={form.barangay} onChange={event => update('barangay', event.target.value)}><option>Banglay</option><option>Dampil</option><option>Gaston</option><option>Kabulawan</option><option>Kauswagan</option><option>Lumbo</option><option>Manaol</option><option>Poblacion</option><option>Tabok</option><option>Umagos</option></select></label></div><p className="workflow-note">Municipality: Lagonglong, Province: Misamis Oriental</p></>}
      
      {step === 1 && <><label>Primary Owner Name <span className="required">*</span><div className="input-icon"><Search size={15}/><input className={error.includes('Owner') ? 'input-error' : ''} value={form.owner} onChange={event => update('owner', event.target.value)} placeholder="Owner full name"/></div><small>Cannot be blank.</small></label></>}
      
      {step === 2 && <><div className="workflow-two-columns"><label>Lot Area (sqm) <span className="required">*</span><input type="number" className={error.includes('Lot area') ? 'input-error' : ''} value={form.lot} onChange={event => update('lot', event.target.value)} placeholder="Only numbers allowed"/></label><label>Declared market value<input value={form.market} onChange={event => update('market', event.target.value)} placeholder="₱ 0.00"/></label></div><div className="workflow-two-columns"><label>Lot Number<input value={form.lotNumber} onChange={event => update('lotNumber', event.target.value)} placeholder="e.g. LOT-123"/></label><label>Title Number<input value={form.titleNumber} onChange={event => update('titleNumber', event.target.value)} placeholder="e.g. TCT-123"/></label></div><label>GPS Coordinates <div className="input-icon"><MapPin size={15}/><input value={form.coordinates} onChange={event => update('coordinates', event.target.value)} placeholder="e.g. 14.5995, 120.9842"/></div></label></>}
      
      {step === 3 && <><div style={{background: '#f8fafc', padding: '15px', borderRadius: '6px', fontSize: '12px'}}>
        <h3 style={{marginBottom: '10px'}}>Review Information</h3>
        <p><strong>Property:</strong> {form.type} in {form.street}, {form.barangay}</p>
        <p><strong>Owner:</strong> {form.owner}</p>
        <p><strong>Lot Details:</strong> {form.lot} sqm (Lot {form.lotNumber || 'N/A'})</p>
        <p style={{marginTop: '10px'}} className="workflow-note">Please ensure all details are correct before submitting.</p>
      </div></>}
    </div>
    <footer className="workflow-footer">
      <button className="btn-cancel" disabled={busy} onClick={step ? () => {setError(''); setStep(value => value - 1)} : close}>{step ? 'Back' : 'Cancel'}</button>
      <button className={step === steps.length - 1 ? 'btn-save' : 'btn-edit'} disabled={busy} onClick={next}>
        {step === steps.length - 1 ? (busy ? 'Saving...' : 'Save Property') : 'Next Step'} {step < steps.length - 1 && <ChevronRight size={16}/>}
      </button>
    </footer>
  </section></div>
}

export function WorkflowSteps({ current, labels }: { current: number; labels: string[] }) { return <div className="workflow-steps">{labels.map((label, index) => <div className="workflow-step" key={label}><span className={index < current ? 'done' : index === current ? 'active' : ''}>{index < current ? <Check size={13}/> : index + 1}</span><strong>{label}</strong>{index < labels.length - 1 && <i className={index < current ? 'complete' : ''}/>}</div>)}</div> }
