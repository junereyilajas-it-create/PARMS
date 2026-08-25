import { Building2, Check, ChevronRight, Home, X } from 'lucide-react'
import { useState } from 'react'
import { WorkflowSteps } from './RegisterPropertyModal'
import '../../styles/MultiStepModal.css'

type BuildingForm = { lotPin: string; id: string; yearBuilt: string; type: string; floorArea: string; stories: string; material: string; foundation: string; roof: string; occupant: string; permit: string; rooms: string; utilities: string[]; remarks: string }
export type BuildingRegistration = { property_id: string; building_name: string; building_type: string; floor_area: string; floor_count: string; construction_type: string; year_constructed: string; market_value: string; assessed_value: string; building_status: string }
const steps = ['Basic Info', 'Structural Specs', 'Occupancy & Use']

export function BuildingRegistrationModal({ close, onSave }: { close: () => void; onSave: (building: BuildingRegistration) => void }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<BuildingForm>({ lotPin: '', id: '', yearBuilt: '', type: 'Residential', floorArea: '', stories: '', material: '', foundation: '', roof: '', occupant: '', permit: '', rooms: '', utilities: [], remarks: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const update = (key: keyof BuildingForm, value: string | string[]) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })); }
  const toggleUtility = (utility: string) => update('utilities', form.utilities.includes(utility) ? form.utilities.filter(item => item !== utility) : [...form.utilities, utility])
  
  const validateStep = (currentStep: number) => {
    const newErrors: Record<string, string> = {}
    if (currentStep === 0) {
      if (!form.lotPin) newErrors.lotPin = 'Linked Property ID is required.'
      if (!form.id) newErrors.id = 'Building Name/ID is required.'
      if (form.yearBuilt && isNaN(Number(form.yearBuilt))) newErrors.yearBuilt = 'Year must be a number.'
    } else if (currentStep === 1) {
      if (form.floorArea && isNaN(Number(form.floorArea))) newErrors.floorArea = 'Area must be a number.'
      if (form.stories && isNaN(Number(form.stories))) newErrors.stories = 'Storeys must be a number.'
    } else if (currentStep === 2) {
      if (!form.occupant) newErrors.occupant = 'Occupant is required.'
      if (form.rooms && isNaN(Number(form.rooms))) newErrors.rooms = 'Rooms must be a number.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      if (step === 2) finish()
      else setStep(value => value + 1)
    }
  }

  const finish = () => { if (!form.lotPin) return; onSave({ property_id: form.lotPin, building_name: form.id || `BLDG-${Date.now().toString().slice(-5)}`, building_type: form.type, floor_area: form.floorArea || '0', floor_count: form.stories || '1', construction_type: form.material || 'Not specified', year_constructed: form.yearBuilt || new Date().getFullYear().toString(), market_value: '0', assessed_value: '0', building_status: 'active' }) }
  return <div className="workflow-backdrop" onMouseDown={close}><section className="workflow-modal building-workflow" role="dialog" aria-modal="true" aria-labelledby="add-building-title" onMouseDown={event => event.stopPropagation()}>
    <header className="workflow-header"><div><h2 id="add-building-title"><Building2 size={16}/> Add Building Structure</h2><small>Step {step + 1} of 3: {steps[step]}</small></div><button aria-label="Close" onClick={close}><X size={18}/></button></header>
    <WorkflowSteps current={step} labels={steps}/>
    <div className="workflow-body">
      {step === 0 && <><label>Linked Property ID <span className="required">*</span><input type="number" className={errors.lotPin ? 'input-error' : ''} value={form.lotPin} onChange={event => update('lotPin', event.target.value)} placeholder="Existing property ID, e.g. 1"/>{errors.lotPin && <span className="error-message">{errors.lotPin}</span>}<small>Select the property where this structure resides.</small></label><div className="workflow-two-columns"><label>Building Name / ID <span className="required">*</span><input className={errors.id ? 'input-error' : ''} value={form.id} onChange={event => update('id', event.target.value)} placeholder="e.g., Main Residence, Bldg A"/>{errors.id && <span className="error-message">{errors.id}</span>}</label><label>Year Built<input className={errors.yearBuilt ? 'input-error' : ''} value={form.yearBuilt} onChange={event => update('yearBuilt', event.target.value)} placeholder="YYYY"/>{errors.yearBuilt && <span className="error-message">{errors.yearBuilt}</span>}</label></div><fieldset><legend>Building Type Classification <span className="required">*</span></legend><div className="type-options">{[['Residential', Home], ['Commercial', Building2], ['Industrial', Building2], ['Mixed Use', Building2]].map(([type, Icon]) => <button type="button" className={form.type === type ? 'selected' : ''} onClick={() => update('type', type as string)} key={type as string}><Icon size={15}/>{type as string}</button>)}</div></fieldset></>}
      {step === 1 && <><div className="workflow-two-columns"><label>Total Floor Area (sqm)<input className={errors.floorArea ? 'input-error' : ''} value={form.floorArea} onChange={event => update('floorArea', event.target.value)} placeholder="e.g. 1500"/>{errors.floorArea && <span className="error-message">{errors.floorArea}</span>}</label><label>Number of Storeys<input className={errors.stories ? 'input-error' : ''} value={form.stories} onChange={event => update('stories', event.target.value)} placeholder="e.g. 3"/>{errors.stories && <span className="error-message">{errors.stories}</span>}</label></div><label>Primary Construction Material<select value={form.material} onChange={event => update('material', event.target.value)}><option value="">Select primary material</option><option>Concrete</option><option>Steel</option><option>Wood</option><option>Mixed</option></select></label><div className="workflow-two-columns"><label>Foundation Type<select value={form.foundation} onChange={event => update('foundation', event.target.value)}><option value="">Select foundation</option><option>Slab</option><option>Footing</option><option>Pile</option></select></label><label>Roof Structure<select value={form.roof} onChange={event => update('roof', event.target.value)}><option value="">Select roof type</option><option>Concrete</option><option>Metal</option><option>Tile</option></select></label></div></>}
      {step === 2 && <><div className="workflow-two-columns"><label>Primary Occupant / Business Name <span className="required">*</span><input className={errors.occupant ? 'input-error' : ''} value={form.occupant} onChange={event => update('occupant', event.target.value)} placeholder="e.g., Acme Corp or John Doe"/>{errors.occupant && <span className="error-message">{errors.occupant}</span>}</label><label>Occupancy Permit Number<input value={form.permit} onChange={event => update('permit', event.target.value)} placeholder="e.g., OCP-2023-441A"/></label></div><label>Number of Units / Rooms<input className={errors.rooms ? 'input-error' : ''} value={form.rooms} onChange={event => update('rooms', event.target.value)} placeholder="0"/>{errors.rooms && <span className="error-message">{errors.rooms}</span>}</label><fieldset><legend>Utilities Connection Status</legend><div className="utility-options">{['Water', 'Electricity', 'Gas'].map(utility => <label key={utility}><input type="checkbox" checked={form.utilities.includes(utility)} onChange={() => toggleUtility(utility)}/>{utility}</label>)}</div></fieldset><label>Additional Remarks<textarea value={form.remarks} onChange={event => update('remarks', event.target.value)} placeholder="Any specific notes regarding occupancy or structural use..."/></label></>}
    </div>
    <footer className="workflow-footer"><button className="btn-cancel" onClick={step ? () => setStep(value => value - 1) : close}>{step ? '← Previous Step' : 'Cancel'}</button><button className="btn-save" onClick={handleNext}>{step === 2 ? <><Check size={16}/> Complete Registration</> : <>Next: {steps[step + 1]} <ChevronRight size={16}/></>}</button></footer>
  </section></div>
}
