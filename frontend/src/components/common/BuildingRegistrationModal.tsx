import { Building2, Check, ChevronRight, Home, X } from 'lucide-react'
import { useState } from 'react'
import { WorkflowSteps } from './RegisterPropertyModal'
import { useFormValidation, validateRequired, validateNumber } from '../../lib/validation'
import '../../styles/MultiStepModal.css'

export type BuildingRegistration = { property_id: string; building_name: string; building_type: string; floor_area: string; floor_count: string; construction_type: string; year_constructed: string; market_value: string; assessed_value: string; building_status: string }
const steps = ['Basic Info', 'Structural Specs', 'Occupancy & Use']

export function BuildingRegistrationModal({ close, onSave }: { close: () => void; onSave: (building: BuildingRegistration) => void }) {
  const [step, setStep] = useState(0)

  const { values, setValue, setFieldTouched, getFieldError, getFieldClass, markAllTouched, isValid } = useFormValidation({
    lotPin: { initialValue: '', rules: [validateRequired, validateNumber] },
    id: { initialValue: '', rules: [validateRequired] },
    yearBuilt: { initialValue: '', rules: [validateNumber] },
    type: { initialValue: 'Residential', rules: [validateRequired] },
    floorArea: { initialValue: '', rules: [validateNumber] },
    stories: { initialValue: '', rules: [validateNumber] },
    material: { initialValue: '' },
    foundation: { initialValue: '' },
    roof: { initialValue: '' },
    occupant: { initialValue: '', rules: [validateRequired] },
    permit: { initialValue: '' },
    rooms: { initialValue: '', rules: [validateNumber] },
    utilities: { initialValue: [] as string[] },
    remarks: { initialValue: '' }
  })
  
  const [stepError, setStepError] = useState('')

  const toggleUtility = (utility: string) => setValue('utilities', values.utilities.includes(utility) ? values.utilities.filter(item => item !== utility) : [...values.utilities, utility])
  
  const validateStep = (currentStep: number) => {
    if (currentStep === 0) {
      setFieldTouched('lotPin'); setFieldTouched('id'); setFieldTouched('yearBuilt')
      return !getFieldError('lotPin') && !getFieldError('id') && !getFieldError('yearBuilt')
    } else if (currentStep === 1) {
      setFieldTouched('floorArea'); setFieldTouched('stories')
      return !getFieldError('floorArea') && !getFieldError('stories')
    } else if (currentStep === 2) {
      setFieldTouched('occupant'); setFieldTouched('rooms')
      return !getFieldError('occupant') && !getFieldError('rooms')
    }
    return true
  }

  const handleNext = () => {
    if (step < 2) {
      if (validateStep(step)) {
        setStepError('')
        setStep(value => value + 1)
      } else {
        setStepError('Please fix the highlighted fields before proceeding.')
      }
      return
    }

    markAllTouched()
    if (!isValid()) return setStepError('Please fix the highlighted fields before proceeding.')
    
    if (!values.lotPin) return
    onSave({ 
      property_id: values.lotPin, 
      building_name: values.id || `BLDG-${Date.now().toString().slice(-5)}`, 
      building_type: values.type, 
      floor_area: values.floorArea || '0', 
      floor_count: values.stories || '1', 
      construction_type: values.material || 'Not specified', 
      year_constructed: values.yearBuilt || new Date().getFullYear().toString(), 
      market_value: '0', 
      assessed_value: '0', 
      building_status: 'active' 
    })
  }

  return (
    <div className="workflow-backdrop" onMouseDown={close}>
      <section className="workflow-modal building-workflow" role="dialog" aria-modal="true" aria-labelledby="add-building-title" onMouseDown={event => event.stopPropagation()}>
        <header className="workflow-header">
          <div>
            <h2 id="add-building-title"><Building2 size={16}/> Add Building Structure</h2>
            <small>Step {step + 1} of 3: {steps[step]}</small>
          </div>
          <button aria-label="Close" onClick={close}><X size={18}/></button>
        </header>
        <WorkflowSteps current={step} labels={steps}/>
        <div className="workflow-body">
          {stepError && <p className="error-message" style={{marginBottom: '5px', color: '#de4e4e'}}>{stepError}</p>}
          
          {step === 0 && (
            <>
              <label>
                Linked Property ID <span className="required">*</span>
                <input 
                  type="number" 
                  className={getFieldClass('lotPin')} 
                  value={values.lotPin} 
                  onChange={event => setValue('lotPin', event.target.value)}
                  onBlur={() => setFieldTouched('lotPin')}
                  placeholder="Existing property ID, e.g. 1"
                />
                <small>Select the property where this structure resides.</small>
              </label>
              <div className="workflow-two-columns">
                <label>
                  Building Name / ID <span className="required">*</span>
                  <input 
                    className={getFieldClass('id')} 
                    value={values.id} 
                    onChange={event => setValue('id', event.target.value)}
                    onBlur={() => setFieldTouched('id')}
                    placeholder="e.g., Main Residence, Bldg A"
                  />
                </label>
                <label>
                  Year Built
                  <input 
                    className={getFieldClass('yearBuilt')} 
                    value={values.yearBuilt} 
                    onChange={event => setValue('yearBuilt', event.target.value)}
                    onBlur={() => setFieldTouched('yearBuilt')}
                    placeholder="YYYY"
                  />
                </label>
              </div>
              <fieldset>
                <legend>Building Type Classification <span className="required">*</span></legend>
                <div className="type-options">
                  {[['Residential', Home], ['Commercial', Building2], ['Industrial', Building2], ['Mixed Use', Building2]].map(([type, Icon]) => (
                    <button 
                      type="button" 
                      className={values.type === type ? 'selected' : ''} 
                      onClick={() => setValue('type', type as string)} 
                      key={type as string}
                    >
                      {/* @ts-ignore */}
                      <Icon size={15}/>{type as string}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {step === 1 && (
            <>
              <div className="workflow-two-columns">
                <label>
                  Total Floor Area (sqm)
                  <input 
                    className={getFieldClass('floorArea')} 
                    value={values.floorArea} 
                    onChange={event => setValue('floorArea', event.target.value)}
                    onBlur={() => setFieldTouched('floorArea')}
                    placeholder="e.g. 1500"
                  />
                </label>
                <label>
                  Number of Storeys
                  <input 
                    className={getFieldClass('stories')} 
                    value={values.stories} 
                    onChange={event => setValue('stories', event.target.value)}
                    onBlur={() => setFieldTouched('stories')}
                    placeholder="e.g. 3"
                  />
                </label>
              </div>
              <label>
                Primary Construction Material
                <select 
                  value={values.material} 
                  onChange={event => setValue('material', event.target.value)}
                  onBlur={() => setFieldTouched('material')}
                >
                  <option value="">Select primary material</option>
                  <option>Concrete</option>
                  <option>Steel</option>
                  <option>Wood</option>
                  <option>Mixed</option>
                </select>
              </label>
              <div className="workflow-two-columns">
                <label>
                  Foundation Type
                  <select 
                    value={values.foundation} 
                    onChange={event => setValue('foundation', event.target.value)}
                    onBlur={() => setFieldTouched('foundation')}
                  >
                    <option value="">Select foundation</option>
                    <option>Slab</option>
                    <option>Footing</option>
                    <option>Pile</option>
                  </select>
                </label>
                <label>
                  Roof Structure
                  <select 
                    value={values.roof} 
                    onChange={event => setValue('roof', event.target.value)}
                    onBlur={() => setFieldTouched('roof')}
                  >
                    <option value="">Select roof type</option>
                    <option>Concrete</option>
                    <option>Metal</option>
                    <option>Tile</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="workflow-two-columns">
                <label>
                  Primary Occupant / Business Name <span className="required">*</span>
                  <input 
                    className={getFieldClass('occupant')} 
                    value={values.occupant} 
                    onChange={event => setValue('occupant', event.target.value)}
                    onBlur={() => setFieldTouched('occupant')}
                    placeholder="e.g., Acme Corp or John Doe"
                  />
                </label>
                <label>
                  Occupancy Permit Number
                  <input 
                    value={values.permit} 
                    onChange={event => setValue('permit', event.target.value)}
                    onBlur={() => setFieldTouched('permit')}
                    placeholder="e.g., OCP-2023-441A"
                  />
                </label>
              </div>
              <label>
                Number of Units / Rooms
                <input 
                  className={getFieldClass('rooms')} 
                  value={values.rooms} 
                  onChange={event => setValue('rooms', event.target.value)}
                  onBlur={() => setFieldTouched('rooms')}
                  placeholder="0"
                />
              </label>
              <fieldset>
                <legend>Utilities Connection Status</legend>
                <div className="utility-options">
                  {['Water', 'Electricity', 'Gas'].map(utility => (
                    <label key={utility}>
                      <input 
                        type="checkbox" 
                        checked={values.utilities.includes(utility)} 
                        onChange={() => toggleUtility(utility)}
                      />
                      {utility}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                Additional Remarks
                <textarea 
                  value={values.remarks} 
                  onChange={event => setValue('remarks', event.target.value)}
                  onBlur={() => setFieldTouched('remarks')}
                  placeholder="Any specific notes regarding occupancy or structural use..."
                />
              </label>
            </>
          )}
        </div>
        <footer className="workflow-footer">
          <button className="workflow-cancel" onClick={step ? () => setStep(value => value - 1) : close}>
            {step ? '← Previous Step' : 'Cancel'}
          </button>
          <button className="workflow-next" onClick={handleNext}>
            {step === 2 ? <><Check size={16}/> Complete Registration</> : <>Next: {steps[step + 1]} <ChevronRight size={16}/></>}
          </button>
        </footer>
      </section>
    </div>
  )
}
