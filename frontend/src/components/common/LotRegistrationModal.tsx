import { Check, ChevronRight, MapPin, SquareDashed, X } from 'lucide-react'
import { useState } from 'react'
import { WorkflowSteps } from './RegisterPropertyModal'
import { useFormValidation, validateRequired, validateNumber } from '../../lib/validation'
import '../../styles/MultiStepModal.css'

import { GISDrawMap } from './GISDrawMap'

type LotForm = { property_id: string; lot_number: string; title_number: string; location: string; lot_area: string; lot_status: string; coordinates: string; area_sqm: string; perimeter_m: string }
const steps = ['Parcel Details', 'Location', 'Review & Register']

export function LotRegistrationModal({ close, onSave, initialValues, title = 'Add Property Lot' }: { close: () => void; onSave: (values: Record<string, string>) => Promise<void> | void; initialValues?: Partial<Record<keyof LotForm, string | number | null>>; title?: string }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const isEditing = Boolean(initialValues)
  
  const initial = { 
    property_id: '', lot_number: '', title_number: '', location: '', lot_area: '', lot_status: 'active', coordinates: '', area_sqm: '', perimeter_m: '',
    ...Object.fromEntries(Object.entries(initialValues ?? {}).map(([key, value]) => [key, value == null ? '' : String(value)])) 
  }

  const { values, setValue, setFieldTouched, getFieldError, getFieldClass, markAllTouched, isValid } = useFormValidation<LotForm>({
    property_id: { initialValue: initial.property_id as string, rules: [validateRequired, validateNumber] },
    lot_number: { initialValue: initial.lot_number, rules: [validateRequired] },
    title_number: { initialValue: initial.title_number },
    location: { initialValue: initial.location, rules: [validateRequired] },
    lot_area: { initialValue: initial.lot_area, rules: [validateNumber] },
    lot_status: { initialValue: initial.lot_status },
    coordinates: { initialValue: initial.coordinates },
    area_sqm: { initialValue: initial.area_sqm },
    perimeter_m: { initialValue: initial.perimeter_m },
  })

  const [stepError, setStepError] = useState('')
  const [showMap, setShowMap] = useState(false)

  const validateStep = (currentStep: number) => {
    // Touch fields in the current step to show errors
    if (currentStep === 0) {
      setFieldTouched('property_id'); setFieldTouched('lot_number'); setFieldTouched('lot_area'); setFieldTouched('title_number');
      return !getFieldError('property_id') && !getFieldError('lot_number') && !getFieldError('lot_area')
    }
    if (currentStep === 1) {
      setFieldTouched('location');
      return !getFieldError('location')
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
      await onSave(values as Record<string, string>)
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
          
          {showMap && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Draw Lot Boundary</h3>
                  <button type="button" onClick={() => setShowMap(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                    <X size={24}/>
                  </button>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900 relative">
                  <GISDrawMap 
                    entityType="lot"
                    initialGeometry={values.coordinates ? JSON.parse(values.coordinates) : null}
                    onGeometryChange={(geom, area, perim) => {
                      setValue('coordinates', geom ? JSON.stringify(geom) : '')
                      setValue('area_sqm', String(area))
                      setValue('perimeter_m', String(perim))
                      // Auto-update lot area text input if it's empty
                      if (area > 0) setValue('lot_area', String(area))
                    }}
                  />
                  {values.area_sqm && (
                    <div className="absolute bottom-6 left-6 z-[500] bg-white dark:bg-gray-800 p-3 rounded-lg shadow border border-gray-200 dark:border-gray-700 text-sm">
                      <p className="font-semibold mb-1 text-gray-800 dark:text-gray-200">Measurements</p>
                      <p>Area: <span className="font-mono text-green-600">{values.area_sqm} m²</span></p>
                      <p>Perimeter: <span className="font-mono text-green-600">{values.perimeter_m} m</span></p>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button type="button" onClick={() => setShowMap(false)} className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">Done</button>
                </div>
              </div>
            </div>
          )}
          
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
              
              <div className="workflow-two-columns mt-4">
                <div className="col-span-2">
                  <label className="block mb-2">GIS Boundary</label>
                  <button 
                    type="button" 
                    onClick={() => setShowMap(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-500 hover:text-blue-600 transition-all font-medium"
                  >
                    <MapPin size={18} />
                    {values.coordinates ? 'Edit Lot on Map' : 'Draw Lot on Map'}
                  </button>
                  {values.area_sqm && (
                     <div className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                       <Check size={14}/> Boundary drawn ({values.area_sqm} m²)
                     </div>
                  )}
                </div>
              </div>

              <label className="mt-4 block">
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
