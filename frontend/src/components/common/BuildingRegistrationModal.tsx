import { Building2, Check, ChevronRight, Home, X } from 'lucide-react'
import { useState } from 'react'
import { WorkflowSteps } from './RegisterPropertyModal'
import { useFormValidation, validateRequired, validateNumber } from '../../lib/validation'
import '../../styles/MultiStepModal.css'

import { GISDrawMap } from './GISDrawMap'

export type BuildingRegistration = { property_id: string; building_name: string; building_type: string; floor_area: string; floor_count: string; construction_type: string; year_constructed: string; market_value: string; assessed_value: string; building_status: string; coordinates?: string; area_sqm?: string; perimeter_m?: string }
const steps = ['Basic Info', 'Structural Specs', 'Occupancy & Use']

export function BuildingRegistrationModal({ close, onSave }: { close: () => void; onSave: (building: BuildingRegistration) => void }) {
  const [step, setStep] = useState(0)

  const { values, setValue, setFieldTouched, getFieldError, getFieldClass, markAllTouched, isValid } = useFormValidation<{ lotPin: string; id: string; yearBuilt: string; type: string; floorArea: string; stories: string; material: string; foundation: string; roof: string; occupant: string; permit: string; rooms: string; utilities: string[]; remarks: string; coordinates: string; area_sqm: string; perimeter_m: string }>({
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
    remarks: { initialValue: '' },
    coordinates: { initialValue: '' },
    area_sqm: { initialValue: '' },
    perimeter_m: { initialValue: '' },
  })
  
  const [stepError, setStepError] = useState('')
  const [showMap, setShowMap] = useState(false)

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
      building_status: 'active',
      coordinates: values.coordinates,
      area_sqm: values.area_sqm,
      perimeter_m: values.perimeter_m
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

          {showMap && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Draw Building Footprint Boundary</h3>
                  <button type="button" onClick={() => setShowMap(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                    <X size={24}/>
                  </button>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900 relative">
                  <GISDrawMap 
                    entityType="building"
                    initialGeometry={values.coordinates ? JSON.parse(values.coordinates) : null}
                    onGeometryChange={(geom, area, perim) => {
                      setValue('coordinates', geom ? JSON.stringify(geom) : '')
                      setValue('area_sqm', String(area))
                      setValue('perimeter_m', String(perim))
                      if (area > 0 && (!values.floorArea || values.floorArea === '0')) {
                        setValue('floorArea', String(area))
                      }
                    }}
                  />
                  {values.area_sqm && (
                    <div className="absolute bottom-6 left-6 z-[500] bg-white dark:bg-gray-800 p-3 rounded-lg shadow border border-gray-200 dark:border-gray-700 text-sm">
                      <p className="font-semibold mb-1 text-gray-800 dark:text-gray-200">Measurements</p>
                      <p>Footprint Area: <span className="font-mono text-green-600">{values.area_sqm} m²</span></p>
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

              <div className="workflow-two-columns mt-2 mb-4">
                <div className="col-span-2">
                  <label className="block mb-2">GIS Footprint Boundary</label>
                  <button 
                    type="button" 
                    onClick={() => setShowMap(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-purple-500 hover:text-purple-600 transition-all font-medium"
                  >
                    <Building2 size={18} />
                    {values.coordinates ? 'Edit Building on Map' : 'Draw Building on Map'}
                  </button>
                  {values.area_sqm && (
                     <div className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                       <Check size={14}/> Boundary drawn ({values.area_sqm} m² footprint)
                     </div>
                  )}
                </div>
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
