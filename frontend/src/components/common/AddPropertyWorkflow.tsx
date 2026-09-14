import { Check, ChevronRight, X, Building2, SquareDashed, MapPin, Lock } from 'lucide-react'
import { useState } from 'react'
import { useFormValidation, validateRequired, validateNumber } from '../../lib/validation'
import '../../styles/MultiStepModal.css'

export type UnifiedPropertyRegistration = {
  propertyType: 'LOT' | 'BUILDING' | '';
  ownerFirstName: string;
  ownerMiddleName: string;
  ownerLastName: string;
  
  ownerHouseNumber: string;
  ownerStreet: string;
  ownerPurok: string;
  ownerBarangay: string;
  ownerMunicipality: string;
  ownerProvince: string;
  ownerZipCode: string;
  
  propertyPurok: string;
  propertyBarangay: string;
  propertyStreet: string;
  
  // LOT
  lotNumber: string;
  titleNumber: string;
  lotArea: string;
  latitude: string;
  longitude: string;
  lotStatus: string;
  lotClassification: string;
  lotTypeUse: string;
  
  // BUILDING
  buildingName: string;
  buildingType: string;
  floorArea: string;
  floorCount: string;
  constructionType: string;
  yearConstructed: string;
  buildingStatus: string;
  buildingClassification: string;
  buildingUse: string;
  
  // Building structural
  foundation: string;
  foundationOther: string;
  structuralFrame: string;
  structuralFrameOther: string;
  exteriorWalls: string;
  exteriorWallsOther: string;
  roofing: string;
  roofingOther: string;
  flooring: string;
  flooringOther: string;
  ceiling: string;
  ceilingOther: string;
  doors: string;
  doorsOther: string;
  windows: string;
  windowsOther: string;
}

function LocalWorkflowSteps({ current, maxUnlocked, labels, onStepClick }: { current: number, maxUnlocked: number, labels: string[], onStepClick: (i: number) => void }) {
  return (
    <div className="workflow-steps">
      {labels.map((label, index) => {
        const isCompleted = index < maxUnlocked || (index === maxUnlocked && index < current);
        const isCurrent = index === current;
        const isLocked = index > maxUnlocked;
        
        let icon: any = index + 1;
        if (isLocked) {
          icon = <Lock size={12} />;
        } else if (index < maxUnlocked && !isCurrent) {
          icon = <Check size={13}/>;
        } else if (isCurrent && index < maxUnlocked) {
          icon = index + 1;
        }

        return (
          <div 
            className={`workflow-step`} 
            key={label}
            onClick={() => !isLocked && onStepClick(index)}
            style={{ cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.6 : 1 }}
          >
            <span 
              className={(!isCurrent && index < maxUnlocked) ? 'done' : isCurrent ? 'active' : ''}
              style={isLocked ? { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #cbd5e1' } : {}}
            >
              {icon}
            </span>
            <strong>{label}</strong>
            {index < labels.length - 1 && <i className={index < maxUnlocked ? 'complete' : ''} style={isLocked ? { background: '#e2e8f0' } : {}} />}
          </div>
        )
      })}
    </div>
  )
}

export function AddPropertyWorkflow({ close, onSave }: { close: () => void; onSave: (data: UnifiedPropertyRegistration) => Promise<void> | void }) {
  const [step, setStep] = useState(0)
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  
  const stepsList = ['Property Type', 'Owner Info', 'Owner Address', 'Property Address', 'Details', 'Review & Save']

  const { values, setValue, setFieldTouched, getFieldError, getFieldClass, markAllTouched, isValid } = useFormValidation({
    propertyType: { initialValue: '' as UnifiedPropertyRegistration['propertyType'], rules: [validateRequired] },
    
    ownerFirstName: { initialValue: '', rules: [validateRequired] },
    ownerMiddleName: { initialValue: '' },
    ownerLastName: { initialValue: '', rules: [validateRequired] },
    
    ownerHouseNumber: { initialValue: '' },
    ownerStreet: { initialValue: '' },
    ownerPurok: { initialValue: '' },
    ownerBarangay: { initialValue: '', rules: [validateRequired] },
    ownerMunicipality: { initialValue: '', rules: [validateRequired] },
    ownerProvince: { initialValue: '', rules: [validateRequired] },
    ownerZipCode: { initialValue: '' },
    
    propertyPurok: { initialValue: '' },
    propertyBarangay: { initialValue: '', rules: [validateRequired] },
    propertyStreet: { initialValue: '' },
    
    lotNumber: { initialValue: '' },
    titleNumber: { initialValue: '' },
    lotArea: { initialValue: '', rules: [v => values.propertyType === 'LOT' ? (validateRequired(v) || validateNumber(v)) : null] },
    latitude: { initialValue: '' },
    longitude: { initialValue: '' },
    lotStatus: { initialValue: 'active' },
    lotClassification: { initialValue: '', rules: [v => values.propertyType === 'LOT' ? validateRequired(v) : null] },
    lotTypeUse: { initialValue: '' },
    
    buildingName: { initialValue: '' },
    buildingType: { initialValue: '', rules: [v => values.propertyType === 'BUILDING' ? validateRequired(v) : null] },
    floorArea: { initialValue: '', rules: [v => values.propertyType === 'BUILDING' ? (validateRequired(v) || validateNumber(v)) : null] },
    floorCount: { initialValue: '', rules: [v => values.propertyType === 'BUILDING' ? (validateRequired(v) || validateNumber(v)) : null] },
    constructionType: { initialValue: '' },
    yearConstructed: { initialValue: '', rules: [v => values.propertyType === 'BUILDING' ? (validateRequired(v) || validateNumber(v)) : null] },
    buildingStatus: { initialValue: 'active' },
    buildingClassification: { initialValue: '', rules: [v => values.propertyType === 'BUILDING' ? validateRequired(v) : null] },
    buildingUse: { initialValue: '' },
    
    foundation: { initialValue: '' },
    foundationOther: { initialValue: '', rules: [v => values.foundation === 'Other' ? validateRequired(v) : null] },
    structuralFrame: { initialValue: '' },
    structuralFrameOther: { initialValue: '', rules: [v => values.structuralFrame === 'Other' ? validateRequired(v) : null] },
    exteriorWalls: { initialValue: '' },
    exteriorWallsOther: { initialValue: '', rules: [v => values.exteriorWalls === 'Other' ? validateRequired(v) : null] },
    roofing: { initialValue: '' },
    roofingOther: { initialValue: '', rules: [v => values.roofing === 'Other' ? validateRequired(v) : null] },
    flooring: { initialValue: '' },
    flooringOther: { initialValue: '', rules: [v => values.flooring === 'Other' ? validateRequired(v) : null] },
    ceiling: { initialValue: '' },
    ceilingOther: { initialValue: '', rules: [v => values.ceiling === 'Other' ? validateRequired(v) : null] },
    doors: { initialValue: '' },
    doorsOther: { initialValue: '', rules: [v => values.doors === 'Other' ? validateRequired(v) : null] },
    windows: { initialValue: '' },
    windowsOther: { initialValue: '', rules: [v => values.windows === 'Other' ? validateRequired(v) : null] }
  })
  
  const [stepError, setStepError] = useState('')

  const handleCancelClick = () => {
    setShowCancelConfirm(true)
  }

  const validateStep = (currentStep: number) => {
    if (currentStep === 0) {
      setFieldTouched('propertyType')
      return !getFieldError('propertyType')
    } else if (currentStep === 1) {
      setFieldTouched('ownerFirstName')
      setFieldTouched('ownerLastName')
      return !getFieldError('ownerFirstName') && !getFieldError('ownerLastName')
    } else if (currentStep === 2) {
      setFieldTouched('ownerBarangay')
      setFieldTouched('ownerMunicipality')
      setFieldTouched('ownerProvince')
      return !getFieldError('ownerBarangay') && !getFieldError('ownerMunicipality') && !getFieldError('ownerProvince')
    } else if (currentStep === 3) {
      setFieldTouched('propertyBarangay')
      return !getFieldError('propertyBarangay')
    } else if (currentStep === 4) {
      if (values.propertyType === 'LOT') {
        setFieldTouched('lotArea')
        setFieldTouched('lotClassification')
        return !getFieldError('lotArea') && !getFieldError('lotClassification')
      } else {
        setFieldTouched('floorArea')
        setFieldTouched('floorCount')
        setFieldTouched('yearConstructed')
        setFieldTouched('buildingType')
        setFieldTouched('buildingClassification')
        if (values.foundation === 'Other') setFieldTouched('foundationOther')
        if (values.structuralFrame === 'Other') setFieldTouched('structuralFrameOther')
        if (values.exteriorWalls === 'Other') setFieldTouched('exteriorWallsOther')
        if (values.roofing === 'Other') setFieldTouched('roofingOther')
        if (values.flooring === 'Other') setFieldTouched('flooringOther')
        if (values.ceiling === 'Other') setFieldTouched('ceilingOther')
        if (values.doors === 'Other') setFieldTouched('doorsOther')
        if (values.windows === 'Other') setFieldTouched('windowsOther')
        
        return !getFieldError('floorArea') && !getFieldError('floorCount') && !getFieldError('yearConstructed') && !getFieldError('buildingType') && !getFieldError('buildingClassification') && !getFieldError('foundationOther') && !getFieldError('structuralFrameOther') && !getFieldError('exteriorWallsOther') && !getFieldError('roofingOther') && !getFieldError('flooringOther') && !getFieldError('ceilingOther') && !getFieldError('doorsOther') && !getFieldError('windowsOther')
      }
    }
    return true
  }

  const handleStepClick = (targetStep: number) => {
    if (targetStep > maxUnlockedStep) return;
    if (targetStep > step) {
      for (let i = step; i < targetStep; i++) {
        if (!validateStep(i)) {
          setStepError('Please fix the highlighted fields before proceeding.');
          setStep(i);
          return;
        }
      }
    }
    setStepError('');
    setStep(targetStep);
  }

  const next = async () => {
    if (step < 5) {
      if (validateStep(step)) {
        setStepError('')
        const nextStep = step + 1;
        setStep(nextStep)
        setMaxUnlockedStep(prev => Math.max(prev, nextStep))
      } else {
        setStepError('Please fix the highlighted fields before proceeding.')
      }
      return
    }

    markAllTouched()
    if (!isValid()) {
      setStepError('Please fix the highlighted fields before saving.')
      return
    }
    
    setBusy(true)
    try {
      await onSave(values as UnifiedPropertyRegistration)
    } finally {
      setBusy(false)
    }
  }

  if (showCancelConfirm) {
    return (
      <div className="workflow-backdrop" style={{ zIndex: 9999 }}>
        <section className="workflow-modal p-6 text-center" role="dialog" style={{ maxWidth: '400px' }}>
          <h3 className="text-xl font-bold mb-4">Are you sure you want to cancel?</h3>
          <p className="mb-6">All unsaved information will be lost.</p>
          <div className="flex justify-center gap-4">
            <button 
              className="px-4 py-2 border rounded hover:bg-gray-100" 
              onClick={() => setShowCancelConfirm(false)}
            >
              Continue Editing
            </button>
            <button 
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={close}
            >
              Cancel Property
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="workflow-backdrop" onMouseDown={handleCancelClick}>
      <section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="add-property-title" onMouseDown={e => e.stopPropagation()}>
        <header className="workflow-header">
          <div>
            <h2 id="add-property-title"><SquareDashed size={16}/> Add Property</h2>
            <small>Step {step + 1} of {stepsList.length}: {stepsList[step]}</small>
          </div>
          <button aria-label="Close" onClick={handleCancelClick}><X size={18}/></button>
        </header>
        
        <LocalWorkflowSteps current={step} maxUnlocked={maxUnlockedStep} labels={stepsList} onStepClick={handleStepClick} />
        
        <div className="workflow-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {stepError && <p className="error-message" style={{marginBottom: '15px', color: '#de4e4e'}}>{stepError}</p>}
          
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-center mb-4 text-gray-600">Select the type of property you are registering.</p>
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  className={`p-6 border-2 rounded-xl flex flex-col items-center justify-center transition-all ${values.propertyType === 'LOT' ? 'border-green-600 bg-green-50 text-green-800 shadow-sm' : 'border-gray-200 hover:border-green-300 bg-white'}`}
                  onClick={() => {
                    setValue('propertyType', 'LOT')
                    setStepError('')
                  }}
                >
                  <SquareDashed size={48} className="mb-2" />
                  <span className="text-xl font-bold">LOT</span>
                  <span className="text-sm">Land / Parcel Property</span>
                </button>
                
                <button
                  type="button"
                  className={`p-6 border-2 rounded-xl flex flex-col items-center justify-center transition-all ${values.propertyType === 'BUILDING' ? 'border-green-600 bg-green-50 text-green-800 shadow-sm' : 'border-gray-200 hover:border-green-300 bg-white'}`}
                  onClick={() => {
                    setValue('propertyType', 'BUILDING')
                    setStepError('')
                  }}
                >
                  <Building2 size={48} className="mb-2" />
                  <span className="text-xl font-bold">BUILDING</span>
                  <span className="text-sm">Building / Structural Property</span>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="workflow-two-columns">
                <label>
                  First Name <span className="required">*</span>
                  <input 
                    className={getFieldClass('ownerFirstName')} 
                    value={values.ownerFirstName} 
                    onChange={e => setValue('ownerFirstName', e.target.value)}
                    onBlur={() => setFieldTouched('ownerFirstName')}
                  />
                </label>
                <label>
                  Last Name <span className="required">*</span>
                  <input 
                    className={getFieldClass('ownerLastName')} 
                    value={values.ownerLastName} 
                    onChange={e => setValue('ownerLastName', e.target.value)}
                    onBlur={() => setFieldTouched('ownerLastName')}
                  />
                </label>
              </div>
              <label>
                Middle Name
                <input 
                  className={getFieldClass('ownerMiddleName')} 
                  value={values.ownerMiddleName} 
                  onChange={e => setValue('ownerMiddleName', e.target.value)}
                />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div className="workflow-two-columns">
                <label>House/Building No.
                  <input value={values.ownerHouseNumber} onChange={e => setValue('ownerHouseNumber', e.target.value)} />
                </label>
                <label>Street
                  <input value={values.ownerStreet} onChange={e => setValue('ownerStreet', e.target.value)} />
                </label>
              </div>
              <div className="workflow-two-columns">
                <label>Purok
                  <input value={values.ownerPurok} onChange={e => setValue('ownerPurok', e.target.value)} />
                </label>
                <label>Barangay <span className="required">*</span>
                  <input className={getFieldClass('ownerBarangay')} value={values.ownerBarangay} onChange={e => setValue('ownerBarangay', e.target.value)} onBlur={() => setFieldTouched('ownerBarangay')} />
                </label>
              </div>
              <div className="workflow-two-columns">
                <label>Municipality/City <span className="required">*</span>
                  <input className={getFieldClass('ownerMunicipality')} value={values.ownerMunicipality} onChange={e => setValue('ownerMunicipality', e.target.value)} onBlur={() => setFieldTouched('ownerMunicipality')} />
                </label>
                <label>Province <span className="required">*</span>
                  <input className={getFieldClass('ownerProvince')} value={values.ownerProvince} onChange={e => setValue('ownerProvince', e.target.value)} onBlur={() => setFieldTouched('ownerProvince')} />
                </label>
              </div>
              <label>ZIP Code
                <input value={values.ownerZipCode} onChange={e => setValue('ownerZipCode', e.target.value)} />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <div className="workflow-two-columns">
                <label>Barangay <span className="required">*</span>
                  <select className={getFieldClass('propertyBarangay')} value={values.propertyBarangay} onChange={e => setValue('propertyBarangay', e.target.value)} onBlur={() => setFieldTouched('propertyBarangay')}>
                    <option value="">Select Barangay ▼</option>
                    <option value="Banglay">Banglay</option>
                    <option value="Dampil">Dampil</option>
                    <option value="Gaston">Gaston</option>
                    <option value="Kabulawan">Kabulawan</option>
                    <option value="Kauswagan">Kauswagan</option>
                    <option value="Lumbo">Lumbo</option>
                    <option value="Manaol">Manaol</option>
                    <option value="Poblacion">Poblacion</option>
                    <option value="Tabok">Tabok</option>
                    <option value="Umagos">Umagos</option>
                  </select>
                </label>
                <label>Purok
                  <input value={values.propertyPurok} onChange={e => setValue('propertyPurok', e.target.value)} placeholder="Enter Purok" />
                </label>
              </div>
              <label>Street/Location
                <input value={values.propertyStreet} onChange={e => setValue('propertyStreet', e.target.value)} />
              </label>
              <div className="workflow-two-columns">
                <label>Municipality
                  <input value="Lagonglong" readOnly className="bg-gray-100 cursor-not-allowed" />
                </label>
                <label>Province
                  <input value="Misamis Oriental" readOnly className="bg-gray-100 cursor-not-allowed" />
                </label>
              </div>
            </>
          )}

          {step === 4 && values.propertyType === 'LOT' && (
            <div className="space-y-4">
              <h3 className="font-bold border-b pb-2 mb-4">Basic Lot Information</h3>
              <div className="workflow-two-columns">
                <label>Lot Area <span className="required">*</span>
                  <div className={`flex border rounded items-center bg-white ${getFieldClass('lotArea')}`}>
                    <input className="border-none w-full outline-none p-2" type="number" min="0" value={values.lotArea} onChange={e => setValue('lotArea', e.target.value)} onBlur={() => setFieldTouched('lotArea')} />
                    <span className="pr-3 text-gray-500 font-medium">sqm</span>
                  </div>
                </label>
                <label>Lot Classification <span className="required">*</span>
                  <select className={getFieldClass('lotClassification')} value={values.lotClassification} onChange={e => setValue('lotClassification', e.target.value)} onBlur={() => setFieldTouched('lotClassification')}>
                    <option value="">Select Classification ▼</option>
                    <option value="Residential Lot">Residential</option>
                    <option value="Commercial Lot">Commercial</option>
                    <option value="Agricultural Land">Agricultural</option>
                    <option value="Industrial Lot">Industrial</option>
                  </select>
                </label>
              </div>

              <div className="workflow-two-columns">
                <label>Lot Type / Use
                  <select value={values.lotTypeUse} onChange={e => setValue('lotTypeUse', e.target.value)}>
                    <option value="">Select Lot Use ▼</option>
                    <option>Residential</option>
                    <option>Commercial</option>
                    <option>Agricultural</option>
                    <option>Industrial</option>
                    <option>Institutional</option>
                    <option>Government</option>
                    <option>Mixed-Use</option>
                    <option>Vacant</option>
                    <option>Other</option>
                  </select>
                </label>
                <label>Lot Status
                  <select value={values.lotStatus} onChange={e => setValue('lotStatus', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
              </div>

              <div className="workflow-two-columns">
                <label>Lot Number
                  <input value={values.lotNumber} onChange={e => setValue('lotNumber', e.target.value)} placeholder="(Auto-generated if empty)" />
                </label>
                <label>Title Number
                  <input value={values.titleNumber} onChange={e => setValue('titleNumber', e.target.value)} placeholder="Optional" />
                </label>
              </div>

              <div className="workflow-two-columns">
                <label>Latitude
                  <input type="number" step="any" value={values.latitude} onChange={e => setValue('latitude', e.target.value)} placeholder="e.g. 8.8471" />
                </label>
                <label>Longitude
                  <input type="number" step="any" value={values.longitude} onChange={e => setValue('longitude', e.target.value)} placeholder="e.g. 124.7892" />
                </label>
              </div>
            </div>
          )}

          {step === 4 && values.propertyType === 'BUILDING' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold border-b pb-2 mb-4">Building Details</h3>
                <div className="workflow-two-columns">
                  <label>Building Type <span className="required">*</span>
                    <select className={getFieldClass('buildingType')} value={values.buildingType} onChange={e => setValue('buildingType', e.target.value)} onBlur={() => setFieldTouched('buildingType')}>
                      <option value="">Select Building Type ▼</option>
                      <option>Residential</option>
                      <option>Commercial</option>
                      <option>Industrial</option>
                      <option>Agricultural</option>
                      <option>Institutional</option>
                      <option>Government</option>
                      <option>Religious</option>
                      <option>Educational</option>
                      <option>Mixed-Use</option>
                      <option>Storage/Warehouse</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>Building Classification <span className="required">*</span>
                    <select className={getFieldClass('buildingClassification')} value={values.buildingClassification} onChange={e => setValue('buildingClassification', e.target.value)} onBlur={() => setFieldTouched('buildingClassification')}>
                      <option value="">Select Classification ▼</option>
                      <option value="Residential Lot">Residential</option>
                      <option value="Commercial Lot">Commercial</option>
                      <option value="Agricultural Land">Agricultural</option>
                      <option value="Industrial Lot">Industrial</option>
                    </select>
                  </label>
                </div>
                
                <div className="workflow-two-columns">
                  <label>Building Use
                    <select value={values.buildingUse} onChange={e => setValue('buildingUse', e.target.value)}>
                      <option value="">Select Building Use ▼</option>
                      <option>Residential</option>
                      <option>Commercial</option>
                      <option>Office</option>
                      <option>Retail</option>
                      <option>Warehouse</option>
                      <option>School</option>
                      <option>Church</option>
                      <option>Government</option>
                      <option>Storage</option>
                      <option>Agricultural</option>
                      <option>Mixed-Use</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>Building Status
                    <select value={values.buildingStatus} onChange={e => setValue('buildingStatus', e.target.value)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <label>Floor Area <span className="required">*</span>
                    <div className={`flex border rounded items-center bg-white ${getFieldClass('floorArea')}`}>
                      <input className="border-none w-full outline-none p-2" type="number" min="0" value={values.floorArea} onChange={e => setValue('floorArea', e.target.value)} onBlur={() => setFieldTouched('floorArea')} />
                      <span className="pr-3 text-gray-500 font-medium">sqm</span>
                    </div>
                  </label>
                  <label>Number of Floors <span className="required">*</span>
                    <input className={getFieldClass('floorCount')} type="number" min="1" value={values.floorCount} onChange={e => setValue('floorCount', e.target.value)} onBlur={() => setFieldTouched('floorCount')} />
                  </label>
                  <label>Year Built <span className="required">*</span>
                    <input className={getFieldClass('yearConstructed')} type="number" value={values.yearConstructed} onChange={e => setValue('yearConstructed', e.target.value)} onBlur={() => setFieldTouched('yearConstructed')} />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-bold border-b pb-2 mb-4">Structural Details</h3>
                <div className="workflow-two-columns">
                  <div>
                    <label>Foundation
                      <select value={values.foundation} onChange={e => setValue('foundation', e.target.value)}>
                        <option value="">Select Foundation ▼</option>
                        <option>Reinforced Concrete</option>
                        <option>Concrete</option>
                        <option>Concrete Footing</option>
                        <option>Reinforced Concrete Footing</option>
                        <option>Concrete Piles</option>
                        <option>Steel</option>
                        <option>Wood</option>
                        <option>Masonry</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {values.foundation === 'Other' && (
                      <input className={`mt-2 ${getFieldClass('foundationOther')}`} value={values.foundationOther} onChange={e => setValue('foundationOther', e.target.value)} onBlur={() => setFieldTouched('foundationOther')} placeholder="Specify Other Foundation" />
                    )}
                  </div>
                  <div>
                    <label>Structural Frame
                      <select value={values.structuralFrame} onChange={e => setValue('structuralFrame', e.target.value)}>
                        <option value="">Select Structural Frame ▼</option>
                        <option>Reinforced Concrete</option>
                        <option>Steel</option>
                        <option>Wood</option>
                        <option>Concrete and Steel</option>
                        <option>Masonry</option>
                        <option>Mixed</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {values.structuralFrame === 'Other' && (
                      <input className={`mt-2 ${getFieldClass('structuralFrameOther')}`} value={values.structuralFrameOther} onChange={e => setValue('structuralFrameOther', e.target.value)} onBlur={() => setFieldTouched('structuralFrameOther')} placeholder="Specify Other Frame" />
                    )}
                  </div>
                </div>
                <div className="workflow-two-columns">
                  <div>
                    <label>Exterior Walls
                      <select value={values.exteriorWalls} onChange={e => setValue('exteriorWalls', e.target.value)}>
                        <option value="">Select Exterior Wall Material ▼</option>
                        <option>Concrete</option>
                        <option>Reinforced Concrete</option>
                        <option>Concrete Hollow Blocks</option>
                        <option>Brick</option>
                        <option>Wood</option>
                        <option>Metal</option>
                        <option>Glass</option>
                        <option>Mixed Materials</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {values.exteriorWalls === 'Other' && (
                      <input className={`mt-2 ${getFieldClass('exteriorWallsOther')}`} value={values.exteriorWallsOther} onChange={e => setValue('exteriorWallsOther', e.target.value)} onBlur={() => setFieldTouched('exteriorWallsOther')} placeholder="Specify Other Walls" />
                    )}
                  </div>
                  <div>
                    <label>Roofing
                      <select value={values.roofing} onChange={e => setValue('roofing', e.target.value)}>
                        <option value="">Select Roofing Material ▼</option>
                        <option>Long Span Metal</option>
                        <option>GI Sheet</option>
                        <option>Pre-painted Metal Sheet</option>
                        <option>Corrugated Metal</option>
                        <option>Concrete Roof Deck</option>
                        <option>Clay Tile</option>
                        <option>Metal Tile</option>
                        <option>Mixed</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {values.roofing === 'Other' && (
                      <input className={`mt-2 ${getFieldClass('roofingOther')}`} value={values.roofingOther} onChange={e => setValue('roofingOther', e.target.value)} onBlur={() => setFieldTouched('roofingOther')} placeholder="Specify Other Roofing" />
                    )}
                  </div>
                </div>
                <div className="workflow-two-columns">
                  <div>
                    <label>Flooring
                      <select value={values.flooring} onChange={e => setValue('flooring', e.target.value)}>
                        <option value="">Select Flooring Material ▼</option>
                        <option>Concrete</option>
                        <option>Ceramic Tile</option>
                        <option>Vinyl</option>
                        <option>Wood</option>
                        <option>Marble</option>
                        <option>Granite</option>
                        <option>Cement Finish</option>
                        <option>Mixed</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {values.flooring === 'Other' && (
                      <input className={`mt-2 ${getFieldClass('flooringOther')}`} value={values.flooringOther} onChange={e => setValue('flooringOther', e.target.value)} onBlur={() => setFieldTouched('flooringOther')} placeholder="Specify Other Flooring" />
                    )}
                  </div>
                  <div>
                    <label>Ceiling
                      <select value={values.ceiling} onChange={e => setValue('ceiling', e.target.value)}>
                        <option value="">Select Ceiling Type ▼</option>
                        <option>Concrete</option>
                        <option>Gypsum Board</option>
                        <option>Fiber Cement Board</option>
                        <option>PVC</option>
                        <option>Wood</option>
                        <option>Metal</option>
                        <option>None</option>
                        <option>Mixed</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {values.ceiling === 'Other' && (
                      <input className={`mt-2 ${getFieldClass('ceilingOther')}`} value={values.ceilingOther} onChange={e => setValue('ceilingOther', e.target.value)} onBlur={() => setFieldTouched('ceilingOther')} placeholder="Specify Other Ceiling" />
                    )}
                  </div>
                </div>
                <div className="workflow-two-columns">
                  <div>
                    <label>Doors
                      <select value={values.doors} onChange={e => setValue('doors', e.target.value)}>
                        <option value="">Select Door Material ▼</option>
                        <option>Wood</option>
                        <option>Steel</option>
                        <option>Aluminum</option>
                        <option>Glass</option>
                        <option>PVC</option>
                        <option>Metal</option>
                        <option>Mixed</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {values.doors === 'Other' && (
                      <input className={`mt-2 ${getFieldClass('doorsOther')}`} value={values.doorsOther} onChange={e => setValue('doorsOther', e.target.value)} onBlur={() => setFieldTouched('doorsOther')} placeholder="Specify Other Doors" />
                    )}
                  </div>
                  <div>
                    <label>Windows
                      <select value={values.windows} onChange={e => setValue('windows', e.target.value)}>
                        <option value="">Select Window Material ▼</option>
                        <option>Aluminum</option>
                        <option>Glass</option>
                        <option>Steel</option>
                        <option>Wood</option>
                        <option>PVC</option>
                        <option>Mixed</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {values.windows === 'Other' && (
                      <input className={`mt-2 ${getFieldClass('windowsOther')}`} value={values.windowsOther} onChange={e => setValue('windowsOther', e.target.value)} onBlur={() => setFieldTouched('windowsOther')} placeholder="Specify Other Windows" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-bold border-b pb-2">Property Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Property Type:</span> <br/>{values.propertyType}</div>
                <div><span className="text-gray-500">Property ID:</span> <br/>(Generated on Save)</div>
              </div>

              <h3 className="font-bold border-b pb-2">Owner Information</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-500">First Name:</span> <br/>{values.ownerFirstName}</div>
                <div><span className="text-gray-500">Middle Name:</span> <br/>{values.ownerMiddleName || '-'}</div>
                <div><span className="text-gray-500">Last Name:</span> <br/>{values.ownerLastName}</div>
              </div>

              <h3 className="font-bold border-b pb-2">Owner Address</h3>
              <div className="text-sm">
                {[values.ownerHouseNumber, values.ownerStreet, values.ownerPurok, values.ownerBarangay, values.ownerMunicipality, values.ownerProvince, values.ownerZipCode].filter(Boolean).join(', ')}
              </div>

              <h3 className="font-bold border-b pb-2">Property Address</h3>
              <div className="text-sm">
                {[values.propertyStreet, values.propertyPurok, values.propertyBarangay, 'Lagonglong', 'Misamis Oriental'].filter(Boolean).join(', ')}
              </div>

              <h3 className="font-bold border-b pb-2">{values.propertyType === 'LOT' ? 'Lot Details' : 'Building Details'}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {values.propertyType === 'LOT' ? (
                  <>
                    <div><span className="text-gray-500">Classification:</span> <br/>{values.lotClassification}</div>
                    <div><span className="text-gray-500">Area:</span> <br/>{values.lotArea} sqm</div>
                    <div><span className="text-gray-500">Status:</span> <br/>{values.lotStatus}</div>
                    <div><span className="text-gray-500">Coordinates:</span> <br/>{values.latitude ? `${values.latitude}, ${values.longitude}` : '-'}</div>
                  </>
                ) : (
                  <>
                    <div><span className="text-gray-500">Classification:</span> <br/>{values.buildingClassification}</div>
                    <div><span className="text-gray-500">Type:</span> <br/>{values.buildingType}</div>
                    <div><span className="text-gray-500">Floor Area:</span> <br/>{values.floorArea} sqm</div>
                    <div><span className="text-gray-500">Floors:</span> <br/>{values.floorCount}</div>
                    <div><span className="text-gray-500">Year Built:</span> <br/>{values.yearConstructed}</div>
                    <div><span className="text-gray-500">Material/Frame:</span> <br/>{values.structuralFrame === 'Other' ? values.structuralFrameOther : values.structuralFrame || '-'}</div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
        
        <footer className="workflow-footer flex justify-between px-6 py-4 border-t">
          <button className="workflow-cancel px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors" onClick={step ? () => setStep(current => current - 1) : handleCancelClick}>
            {step ? '← Back' : 'Cancel'}
          </button>
          <button 
            className="workflow-next px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 transition-colors" 
            disabled={busy || (step === 0 && !values.propertyType)} 
            onClick={next}
          >
            {step === 5 ? <><Check size={16}/> {busy ? 'Saving...' : 'Save Property'}</> : <>Next <ChevronRight size={16}/></>}
          </button>
        </footer>
      </section>
    </div>
  )
}
