import { Check, ChevronRight, MapPin, SquareDashed, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { WorkflowSteps } from './RegisterPropertyModal'
import { useFormValidation, validateRequired, validateNumber } from '../../lib/validation'
import '../../styles/MultiStepModal.css'

type LotForm = { property_id: string; lot_number: string; title_number: string; location: string; lot_area: string; latitude: string; longitude: string; lot_status: string }
const steps = ['Parcel Details', 'Location', 'Review & Register']

export function LotRegistrationModal({ close, onSave, initialValues, title = 'Add Property Lot' }: { close: () => void; onSave: (values: Record<string, string>) => Promise<void> | void; initialValues?: Partial<Record<keyof LotForm, string | number | null>>; title?: string }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const isEditing = Boolean(initialValues)
  
  const initial = { 
    property_id: '', lot_number: '', title_number: '', location: '', lot_area: '', latitude: '', longitude: '', lot_status: 'active', 
    ...Object.fromEntries(Object.entries(initialValues ?? {}).map(([key, value]) => [key, value == null ? '' : String(value)])) 
  }

  const { values, setValue, setFieldTouched, getFieldError, getFieldClass, markAllTouched, isValid } = useFormValidation({
    property_id: { initialValue: initial.property_id, rules: [validateRequired, validateNumber] },
    lot_number: { initialValue: initial.lot_number, rules: [validateRequired] },
    title_number: { initialValue: initial.title_number },
    location: { initialValue: initial.location, rules: [validateRequired] },
    lot_area: { initialValue: initial.lot_area, rules: [validateNumber] },
    latitude: { initialValue: initial.latitude, rules: [validateNumber] },
    longitude: { initialValue: initial.longitude, rules: [validateNumber] },
    lot_status: { initialValue: initial.lot_status }
  })

  const [stepError, setStepError] = useState('')

  const validateStep = (currentStep: number) => {
    // Touch fields in the current step to show errors
    if (currentStep === 0) {
      setFieldTouched('property_id'); setFieldTouched('lot_number'); setFieldTouched('lot_area'); setFieldTouched('title_number');
      return !getFieldError('property_id') && !getFieldError('lot_number') && !getFieldError('lot_area')
    }
    if (currentStep === 1) {
      setFieldTouched('location'); setFieldTouched('latitude'); setFieldTouched('longitude');
      return !getFieldError('location') && !getFieldError('latitude') && !getFieldError('longitude')
    }
    return true
  }

  const next = async () => { 
    if (step < 2) {
      if (validateStep(step)) {
        setStepError('')
        setStep(current => current + 1)
      } else {
        setStepError('Please fix the highlighted fields before proceeding.')
      }
      return
    }

    markAllTouched()
    if (!isValid()) return setStepError('Please fix the highlighted fields before proceeding.')
    
    setBusy(true)
    try { 
      await onSave(values)
      close() 
    } finally { 
      setBusy(false) 
    } 
  }

  return (
    <div className="workflow-backdrop" onMouseDown={close}>
      <section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="add-lot-title" onMouseDown={event => event.stopPropagation()}>
        <header className="workflow-header">
          <div>
            <h2 id="add-lot-title"><SquareDashed size={16}/>{title}</h2>
            <small>Step {step + 1} of {steps.length}: {steps[step]}</small>
          </div>
          <button aria-label="Close" onClick={close}><X size={18}/></button>
        </header>
        <WorkflowSteps current={step} labels={steps}/>
        <div className="workflow-body">
          {stepError && <p className="error-message" style={{marginBottom: '5px', color: '#de4e4e'}}>{stepError}</p>}
          
          {step === 0 && (
            <>
              <label>
                Property ID <span className="required">*</span>
                <input 
                  required 
                  className={getFieldClass('property_id')} 
                  type="number" 
                  value={values.property_id} 
                  onChange={event => setValue('property_id', event.target.value)} 
                  onBlur={() => setFieldTouched('property_id')}
                  placeholder="Existing property ID, e.g. 1"
                />
                <small>Link this lot to an existing property record.</small>
              </label>
              <div className="workflow-two-columns">
                <label>
                  Lot number <span className="required">*</span>
                  <input 
                    className={getFieldClass('lot_number')} 
                    value={values.lot_number} 
                    onChange={event => setValue('lot_number', event.target.value)} 
                    onBlur={() => setFieldTouched('lot_number')}
                    placeholder="e.g. LOT-2026-001"
                  />
                </label>
                <label>
                  Title number
                  <input 
                    className={getFieldClass('title_number')} 
                    value={values.title_number} 
                    onChange={event => setValue('title_number', event.target.value)} 
                    onBlur={() => setFieldTouched('title_number')}
                    placeholder="e.g. T-12345"
                  />
                </label>
              </div>
              <label>
                Lot area (sqm)
                <input 
                  type="number" min="0" 
                  className={getFieldClass('lot_area')} 
                  value={values.lot_area} 
                  onChange={event => setValue('lot_area', event.target.value)} 
                  onBlur={() => setFieldTouched('lot_area')}
                  placeholder="e.g. 450"
                />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <label>
                Location <span className="required">*</span>
                <div className={`input-icon ${getFieldClass('location')}`}>
                  <MapPin size={15}/>
                  <input 
                    style={{border: 'none'}}
                    value={values.location} 
                    onChange={event => setValue('location', event.target.value)} 
                    onBlur={() => setFieldTouched('location')}
                    placeholder="Barangay, street, or landmark"
                  />
                </div>
              </label>
              <div className="workflow-two-columns">
                <label>
                  Latitude
                  <input 
                    type="number" step="any" 
                    className={getFieldClass('latitude')} 
                    value={values.latitude} 
                    onChange={event => setValue('latitude', event.target.value)} 
                    onBlur={() => setFieldTouched('latitude')}
                    placeholder="e.g. 8.5881"
                  />
                </label>
                <label>
                  Longitude
                  <input 
                    type="number" step="any" 
                    className={getFieldClass('longitude')} 
                    value={values.longitude} 
                    onChange={event => setValue('longitude', event.target.value)} 
                    onBlur={() => setFieldTouched('longitude')}
                    placeholder="e.g. 124.7562"
                  />
                </label>
              </div>
              <label>
                Record status
                <select 
                  className={getFieldClass('lot_status')} 
                  value={values.lot_status} 
                  onChange={event => setValue('lot_status', event.target.value)}
                  onBlur={() => setFieldTouched('lot_status')}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <p className="workflow-note">Confirm the lot information before saving it to the property register.</p>
              <div className="workflow-two-columns">
                <label>Property ID<input readOnly value={values.property_id}/></label>
                <label>Lot number<input readOnly value={values.lot_number}/></label>
              </div>
              <label>Location<input readOnly value={values.location}/></label>
            </>
          )}
        </div>
        <footer className="workflow-footer">
          <button className="workflow-cancel" onClick={step ? () => setStep(current => current - 1) : close}>
            {step ? '← Previous Step' : 'Cancel'}
          </button>
          <button className="workflow-next" disabled={busy} onClick={next}>
            {step === 2 ? <><Check size={16}/> {busy ? (isEditing ? 'Saving…' : 'Adding…') : (isEditing ? 'Save Changes' : 'Add Lot')}</> : <>Next: {steps[step + 1]} <ChevronRight size={16}/></>}
          </button>
        </footer>
      </section>
    </div>
  )
}
