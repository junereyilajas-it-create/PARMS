import { Check, ChevronRight, MapPin, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useModal } from '../../contexts/ModalContext'
import { useFormValidation, validateRequired, validateNumber } from '../../lib/validation'
import '../../styles/MultiStepModal.css'

export type PropertyRegistrationForm = { owner: string; taxId: string; street: string; barangay: string; type: string; lot: string; market: string; coordinates: string; document: string; lotNumber: string; titleNumber: string }
const steps = ['Property Info', 'Owner Info', 'Lot Info', 'Confirmation']

export function RegisterPropertyModal({ close, onSave }: { close: () => void; onSave: (form: PropertyRegistrationForm) => Promise<void> }) {
  const { showError } = useModal()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  
  const { values, setValue, setFieldTouched, getFieldError, getFieldClass, markAllTouched, isValid } = useFormValidation<PropertyRegistrationForm>({
    type: { initialValue: 'Residential', rules: [validateRequired] },
    taxId: { initialValue: '' },
    street: { initialValue: '', rules: [validateRequired] },
    barangay: { initialValue: 'Poblacion', rules: [validateRequired] },
    owner: { initialValue: '', rules: [validateRequired] },
    lot: { initialValue: '', rules: [validateRequired, validateNumber] },
    market: { initialValue: '', rules: [validateNumber] },
    lotNumber: { initialValue: '' },
    titleNumber: { initialValue: '' },
    coordinates: { initialValue: '' },
    document: { initialValue: '' }
  })

  const [stepError, setStepError] = useState('')

  const validateStep = (currentStep: number) => {
    if (currentStep === 0) {
      setFieldTouched('type'); setFieldTouched('street'); setFieldTouched('barangay')
      return !getFieldError('type') && !getFieldError('street') && !getFieldError('barangay')
    }
    if (currentStep === 1) {
      setFieldTouched('owner')
      return !getFieldError('owner')
    }
    if (currentStep === 2) {
      setFieldTouched('lot'); setFieldTouched('market')
      return !getFieldError('lot') && !getFieldError('market')
    }
    return true
  }

  const submit = async () => {
    markAllTouched()
    if (!isValid()) {
      setStepError('Please fix the errors before submitting.')
      return
    }

    setBusy(true)
    setStepError('')
    try { 
      await onSave(values as PropertyRegistrationForm)
      close() 
    } catch (err: any) { 
      showError(err instanceof Error ? err.message : 'Unable to register the property.') 
    } finally { 
      setBusy(false) 
    }
  }

  const next = () => {
    if (step < steps.length - 1) {
      if (validateStep(step)) {
        setStepError('')
        setStep(value => value + 1)
      } else {
        setStepError('Please fix the highlighted fields before proceeding.')
      }
      return
    }

    void submit()
  }

  return (
    <div className="workflow-backdrop" onMouseDown={close}>
      <section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="register-property-title" onMouseDown={event => event.stopPropagation()}>
        <header className="workflow-header">
          <h2 id="register-property-title">Register New Property</h2>
          <button aria-label="Close" disabled={busy} onClick={close}><X size={18}/></button>
        </header>
        <WorkflowSteps current={step} labels={steps}/>
        <div className="workflow-body">
          {stepError && <p className="error-message" style={{marginBottom: '10px', color: '#de4e4e'}}>{stepError}</p>}
          
          {step === 0 && (
            <>
              <div className="workflow-two-columns">
                <label>
                  Property Type <span className="required">*</span>
                  <select 
                    className={getFieldClass('type')}
                    value={values.type} 
                    onChange={event => setValue('type', event.target.value)}
                    onBlur={() => setFieldTouched('type')}
                  >
                    <option>Residential</option>
                    <option>Commercial</option>
                    <option>Industrial</option>
                    <option>Agricultural</option>
                  </select>
                </label>
                <label>
                  Tax ID
                  <input 
                    className={getFieldClass('taxId')}
                    value={values.taxId} 
                    onChange={event => setValue('taxId', event.target.value)}
                    onBlur={() => setFieldTouched('taxId')}
                    placeholder="e.g. 84928-A"
                  />
                </label>
              </div>
              <div className="workflow-two-columns">
                <label>
                  Street or Purok <span className="required">*</span>
                  <input 
                    className={getFieldClass('street')} 
                    value={values.street} 
                    onChange={event => setValue('street', event.target.value)}
                    onBlur={() => setFieldTouched('street')}
                    placeholder="Enter street or purok"
                  />
                </label>
                <label>
                  Barangay <span className="required">*</span>
                  <select 
                    className={getFieldClass('barangay')}
                    value={values.barangay} 
                    onChange={event => setValue('barangay', event.target.value)}
                    onBlur={() => setFieldTouched('barangay')}
                  >
                    <option>Banglay</option><option>Dampil</option><option>Gaston</option>
                    <option>Kabulawan</option><option>Kauswagan</option><option>Lumbo</option>
                    <option>Manaol</option><option>Poblacion</option><option>Tabok</option><option>Umagos</option>
                  </select>
                </label>
              </div>
              <p className="workflow-note">Municipality: Lagonglong, Province: Misamis Oriental</p>
            </>
          )}
          
          {step === 1 && (
            <>
              <label>
                Primary Owner Name <span className="required">*</span>
                <div className={`input-icon ${getFieldClass('owner')}`}>
                  <Search size={15}/>
                  <input 
                    style={{border: 'none'}}
                    value={values.owner} 
                    onChange={event => setValue('owner', event.target.value)}
                    onBlur={() => setFieldTouched('owner')}
                    placeholder="Owner full name"
                  />
                </div>
                <small>Cannot be blank.</small>
              </label>
            </>
          )}
          
          {step === 2 && (
            <>
              <div className="workflow-two-columns">
                <label>
                  Lot Area (sqm) <span className="required">*</span>
                  <input 
                    type="number" 
                    className={getFieldClass('lot')} 
                    value={values.lot} 
                    onChange={event => setValue('lot', event.target.value)}
                    onBlur={() => setFieldTouched('lot')}
                    placeholder="Only numbers allowed"
                  />
                </label>
                <label>
                  Declared market value
                  <input 
                    className={getFieldClass('market')}
                    value={values.market} 
                    onChange={event => setValue('market', event.target.value)}
                    onBlur={() => setFieldTouched('market')}
                    placeholder="₱ 0.00"
                  />
                </label>
              </div>
              <div className="workflow-two-columns">
                <label>
                  Lot Number
                  <input 
                    className={getFieldClass('lotNumber')}
                    value={values.lotNumber} 
                    onChange={event => setValue('lotNumber', event.target.value)}
                    onBlur={() => setFieldTouched('lotNumber')}
                    placeholder="e.g. LOT-123"
                  />
                </label>
                <label>
                  Title Number
                  <input 
                    className={getFieldClass('titleNumber')}
                    value={values.titleNumber} 
                    onChange={event => setValue('titleNumber', event.target.value)}
                    onBlur={() => setFieldTouched('titleNumber')}
                    placeholder="e.g. TCT-123"
                  />
                </label>
              </div>
              <label>
                GPS Coordinates 
                <div className={`input-icon ${getFieldClass('coordinates')}`}>
                  <MapPin size={15}/>
                  <input 
                    style={{border: 'none'}}
                    value={values.coordinates} 
                    onChange={event => setValue('coordinates', event.target.value)}
                    onBlur={() => setFieldTouched('coordinates')}
                    placeholder="e.g. 14.5995, 120.9842"
                  />
                </div>
              </label>
            </>
          )}
          
          {step === 3 && (
            <>
              <div style={{background: '#f8fafc', padding: '15px', borderRadius: '6px', fontSize: '12px'}}>
                <h3 style={{marginBottom: '10px'}}>Review Information</h3>
                <p><strong>Property:</strong> {values.type} in {values.street}, {values.barangay}</p>
                <p><strong>Owner:</strong> {values.owner}</p>
                <p><strong>Lot Details:</strong> {values.lot} sqm (Lot {values.lotNumber || 'N/A'})</p>
                <p style={{marginTop: '10px'}} className="workflow-note">Please ensure all details are correct before submitting.</p>
              </div>
            </>
          )}
        </div>
        <footer className="workflow-footer">
          <button className="workflow-cancel" disabled={busy} onClick={step ? () => {setStepError(''); setStep(value => value - 1)} : close}>
            {step ? 'Back' : 'Cancel'}
          </button>
          <button className="workflow-next" disabled={busy} onClick={next}>
            {step === steps.length - 1 ? (busy ? 'Saving...' : 'Save Property') : 'Next Step'} {step < steps.length - 1 && <ChevronRight size={16}/>}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function WorkflowSteps({ current, labels }: { current: number; labels: string[] }) { 
  return (
    <div className="workflow-steps">
      {labels.map((label, index) => (
        <div className="workflow-step" key={label}>
          <span className={index < current ? 'done' : index === current ? 'active' : ''}>
            {index < current ? <Check size={13}/> : index + 1}
          </span>
          <strong>{label}</strong>
          {index < labels.length - 1 && <i className={index < current ? 'complete' : ''}/>}
        </div>
      ))}
    </div>
  ) 
}
