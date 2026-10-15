import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  SquareDashed, 
  User, 
  MapPin, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  AlertCircle, 
  Info, 
  Layers, 
  Save, 
  CheckCircle2, 
  ShieldCheck, 
  FileText,
  Search,
  Camera,
  UploadCloud,
  Trash2,
  RefreshCw,
  Edit
} from 'lucide-react';
import { OwnerAutocomplete } from './OwnerAutocomplete';
import { GISDrawMap } from './GISDrawMap';
import { getProvinces, getMunicipalities, getBarangays, getZipCode } from '../../lib/ph_locations';
import api from '../../lib/api';

export interface UnifiedPropertyRegistration {
  ownerId?: number | null;
  propertyType: 'LOT' | 'BUILDING' | '';
  ownerFirstName: string;
  ownerMiddleName?: string;
  ownerLastName: string;
  ownerSuffix?: string;
  ownerContactNumber?: string;
  
  ownerHouseNumber?: string;
  ownerStreet?: string;
  ownerPurok?: string;
  ownerBarangay: string;
  ownerMunicipality: string;
  ownerProvince: string;
  ownerZipCode?: string;
  
  propertyPurok?: string;
  propertyBarangay: string;
  propertyStreet?: string;
  
  // LOT
  lotNumber?: string;
  titleNumber?: string;
  lotArea: string;
  latitude?: string;
  longitude?: string;
  lotStatus?: string;
  lotClassification?: string;
  lotTypeUse?: string;
  surveyPlanNumber?: string;
  taxDeclarationNumber?: string;
  
  // BUILDING
  buildingName?: string;
  buildingType?: string;
  floorArea?: string;
  floorCount?: string;
  constructionType?: string;
  yearConstructed?: string;
  buildingStatus?: string;
  buildingClassification?: string;
  buildingUse?: string;
  
  // Building structural components
  foundation?: string;
  foundationOther?: string;
  structuralFrame?: string;
  structuralFrameOther?: string;
  exteriorWalls?: string;
  exteriorWallsOther?: string;
  roofing?: string;
  roofingOther?: string;
  flooring?: string;
  flooringOther?: string;
  ceiling?: string;
  ceilingOther?: string;
  doors?: string;
  doorsOther?: string;
  windows?: string;
  windowsOther?: string;
  
  // GIS
  coordinates?: string;
  area_sqm?: string;
  perimeter_m?: string;

  // Media
  propertyPhoto?: string;
}

export interface AddPropertyWorkflowProps {
  close: () => void;
  onSave: (data: UnifiedPropertyRegistration) => Promise<void> | void;
  initialType?: 'LOT' | 'BUILDING' | 'lot' | 'building';
}

const LAGONGLONG_BARANGAYS = [
  'Banglay',
  'Dampil',
  'Gaston',
  'Kabulawan',
  'Kauswagan',
  'Lumbo',
  'Manaol',
  'Poblacion',
  'Tabok',
  'Umagos'
];

export function AddPropertyWorkflow({ close, onSave, initialType = 'LOT' }: AddPropertyWorkflowProps) {
  // Normalize initial property type
  const normalizedInitialType: 'LOT' | 'BUILDING' = 
    String(initialType).toUpperCase() === 'BUILDING' ? 'BUILDING' : 'LOT';

  // 4-step workflow: 0: Property Information, 1: Owner Information, 2: Property Details & Location, 3: Review
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string>('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [ownerMode, setOwnerMode] = useState<'search' | 'manual'>('search');

  // Photo Upload State
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [photoError, setPhotoError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const validExtensions = /\.(jpg|jpeg|png|webp)$/i;

    if (!validMimes.includes(file.type.toLowerCase()) && !file.name.match(validExtensions)) {
      setPhotoError('Invalid image format. Please select a JPG, PNG, or WebP photo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Image file size exceeds the 10MB limit. Please choose a smaller photo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setSelectedPhotoFile(file);
    const localPreview = URL.createObjectURL(file);
    setPhotoPreviewUrl(localPreview);
  };

  const handleRemovePhoto = () => {
    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl('');
    setPhotoError('');
    setFormData(prev => ({ ...prev, propertyPhoto: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Form State
  const [formData, setFormData] = useState<UnifiedPropertyRegistration>({
    propertyType: normalizedInitialType,
    ownerId: null,
    ownerFirstName: '',
    ownerMiddleName: '',
    ownerLastName: '',
    ownerSuffix: '',
    ownerContactNumber: '',
    
    ownerHouseNumber: '',
    ownerStreet: '',
    ownerPurok: '',
    ownerProvince: 'Misamis Oriental',
    ownerMunicipality: 'Lagonglong',
    ownerBarangay: 'Poblacion',
    ownerZipCode: '9006',
    
    propertyPurok: 'Purok 1',
    propertyBarangay: 'Poblacion',
    propertyStreet: '',
    
    // LOT
    lotNumber: '',
    titleNumber: '',
    lotArea: '',
    latitude: '',
    longitude: '',
    lotStatus: 'active',
    lotClassification: 'Residential Lot',
    lotTypeUse: 'Residential',
    surveyPlanNumber: '',
    taxDeclarationNumber: '',
    
    // BUILDING
    buildingName: '',
    buildingType: 'Single Family Residential',
    floorArea: '',
    floorCount: '1',
    constructionType: 'Reinforced Concrete',
    yearConstructed: new Date().getFullYear().toString(),
    buildingStatus: 'active',
    buildingClassification: 'Residential',
    buildingUse: 'Residential',
    
    foundation: 'Reinforced Concrete',
    foundationOther: '',
    structuralFrame: 'Reinforced Concrete',
    structuralFrameOther: '',
    exteriorWalls: 'Concrete Hollow Blocks (CHB)',
    exteriorWallsOther: '',
    roofing: 'Galvanized Iron (GI Sheet)',
    roofingOther: '',
    flooring: 'Concrete',
    flooringOther: '',
    ceiling: 'Plywood',
    ceilingOther: '',
    doors: 'Wood Panel',
    doorsOther: '',
    windows: 'Glass Jalousie',
    windowsOther: '',
    
    coordinates: '',
    area_sqm: '',
    perimeter_m: ''
  });

  // Validation Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  // Ensure initial type is set on mount
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      propertyType: normalizedInitialType
    }));
  }, [normalizedInitialType]);

  // Handle generic field change
  const handleChange = (field: keyof UnifiedPropertyRegistration, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    // Clear field error on change
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    setServerError('');
  };

  // Check if form is dirty for cancel confirmation
  const isFormDirty = Object.keys(touchedFields).length > 0;

  // Step 1 Validation: Property Details
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.propertyType === 'LOT') {
      if (!formData.lotArea || !formData.lotArea.trim()) {
        newErrors.lotArea = 'Lot area in square meters is required.';
      } else {
        const areaNum = Number(formData.lotArea);
        if (isNaN(areaNum) || areaNum <= 0) {
          newErrors.lotArea = 'Lot area must be a valid positive number.';
        }
      }

      if (!formData.lotClassification) {
        newErrors.lotClassification = 'Please select a property classification.';
      }
    } else {
      // BUILDING
      if (!formData.buildingName || !formData.buildingName.trim()) {
        newErrors.buildingName = 'Building Name or Identifier is required.';
      }

      if (!formData.buildingType) {
        newErrors.buildingType = 'Please select a building type.';
      }

      if (!formData.buildingClassification) {
        newErrors.buildingClassification = 'Please select a building classification.';
      }

      if (!formData.floorArea || !formData.floorArea.trim()) {
        newErrors.floorArea = 'Building floor area is required.';
      } else {
        const floorAreaNum = Number(formData.floorArea);
        if (isNaN(floorAreaNum) || floorAreaNum <= 0) {
          newErrors.floorArea = 'Building floor area must be a valid positive number.';
        }
      }

      if (!formData.floorCount || !formData.floorCount.trim()) {
        newErrors.floorCount = 'Number of floors is required.';
      } else {
        const floorCountNum = Number(formData.floorCount);
        if (isNaN(floorCountNum) || floorCountNum < 1) {
          newErrors.floorCount = 'Must have at least 1 floor.';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 2 Validation: Owner Information & Address
  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.ownerFirstName || !formData.ownerFirstName.trim()) {
      newErrors.ownerFirstName = "Owner's first name is required.";
    }

    if (!formData.ownerLastName || !formData.ownerLastName.trim()) {
      newErrors.ownerLastName = "Owner's last name is required.";
    }

    if (!formData.ownerProvince || !formData.ownerProvince.trim()) {
      newErrors.ownerProvince = 'Owner province is required.';
    }

    if (!formData.ownerMunicipality || !formData.ownerMunicipality.trim()) {
      newErrors.ownerMunicipality = 'Owner municipality is required.';
    }

    if (!formData.ownerBarangay || !formData.ownerBarangay.trim()) {
      newErrors.ownerBarangay = 'Owner barangay is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 3 Validation: Property Address & Location
  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.propertyBarangay || !formData.propertyBarangay.trim()) {
      newErrors.propertyBarangay = 'Please select the barangay where this property is located.';
    } else if (!LAGONGLONG_BARANGAYS.includes(formData.propertyBarangay)) {
      newErrors.propertyBarangay = 'Property must be located within one of the 10 barangays of Lagonglong.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation handlers
  const handleNext = () => {
    setServerError('');
    if (currentStep === 0) {
      if (validateStep1()) setCurrentStep(1);
    } else if (currentStep === 1) {
      if (validateStep2()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep3()) setCurrentStep(3);
    }
  };

  const handleBack = () => {
    setServerError('');
    setErrors({});
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setServerError('');

    // Revalidate all steps
    if (!validateStep1()) {
      setCurrentStep(0);
      setServerError('Please fix the required fields in Step 1 (Property Information).');
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(1);
      setServerError('Please fix the required fields in Step 2 (Owner Information).');
      return;
    }
    if (!validateStep3()) {
      setCurrentStep(2);
      setServerError('Please fix the required fields in Step 3 (Property Details & Location).');
      return;
    }

    setIsSaving(true);
    try {
      let finalPhotoPath = formData.propertyPhoto || '';

      // Upload photo if a new file is attached
      if (selectedPhotoFile) {
        try {
          const photoFormData = new FormData();
          photoFormData.append('photo', selectedPhotoFile);
          const uploadRes = await api.post('/properties/upload-photo', photoFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (uploadRes.data?.url) {
            finalPhotoPath = uploadRes.data.url;
          }
        } catch (uploadErr: any) {
          const errMsg = uploadErr.response?.data?.message || uploadErr.message || 'Failed to upload photo.';
          setServerError(`Photo Upload Failed: ${errMsg}. Please remove or replace the photo, or try again.`);
          setIsSaving(false);
          return;
        }
      }

      const submissionData: UnifiedPropertyRegistration = {
        ...formData,
        propertyPhoto: finalPhotoPath || undefined
      };

      await onSave(submissionData);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save property. Please check input values and retry.';
      setServerError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isFormDirty) {
      setShowCancelConfirm(true);
    } else {
      close();
    }
  };

  // Existing owner selection handler
  const handleSelectExistingOwner = (owner: any) => {
    if (owner) {
      setFormData(prev => ({
        ...prev,
        ownerId: owner.owner_id,
        ownerFirstName: owner.first_name || '',
        ownerMiddleName: owner.middle_name || '',
        ownerLastName: owner.last_name || '',
        ownerContactNumber: owner.contact_number || prev.ownerContactNumber
      }));
      setTouchedFields(prev => ({ ...prev, ownerFirstName: true, ownerLastName: true }));
    }
  };

  const handleClearSelectedOwner = () => {
    setFormData(prev => ({
      ...prev,
      ownerId: null,
      ownerFirstName: '',
      ownerMiddleName: '',
      ownerLastName: '',
      ownerContactNumber: ''
    }));
  };

  const stepLabels = [
    { title: 'Property Information', subtitle: formData.propertyType === 'LOT' ? 'Lot specifications' : 'Building specifications' },
    { title: 'Owner Information', subtitle: 'Owner details & address' },
    { title: 'Property Details & Location', subtitle: 'Physical location & photo' },
    { title: 'Review', subtitle: 'Summary & confirmation' }
  ];

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        onMouseDown={handleCancel}
      >
        <div 
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
          onMouseDown={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-property-modal-title"
        >
          {/* ================= MODAL HEADER (VISIBILITY OF SYSTEM STATUS) ================= */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-green-50 dark:from-gray-800/90 dark:to-gray-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center shadow-md">
                {formData.propertyType === 'LOT' ? <SquareDashed size={22} /> : <Building2 size={22} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="add-property-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                    Add Property
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    formData.propertyType === 'LOT'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                  }`}>
                    {formData.propertyType}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Step {currentStep + 1} of 4 — <span className="font-semibold text-green-700 dark:text-green-400">{stepLabels[currentStep].title}</span>
                </p>
              </div>
            </div>

            <button
              id="close-add-property-btn"
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800 transition cursor-pointer"
              title="Close modal"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* ================= STEPPER PROGRESS BAR (SYSTEM STATUS) ================= */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800 shrink-0">
            <div className="flex items-center justify-between max-w-xl mx-auto relative">
              {stepLabels.map((s, idx) => {
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={s.title} className="flex-1 flex flex-col items-center relative z-10">
                    <button
                      type="button"
                      id={`step-indicator-${idx + 1}`}
                      onClick={() => {
                        if (idx < currentStep) {
                          setCurrentStep(idx);
                        } else if (idx === 1 && currentStep === 0) {
                          if (validateStep1()) setCurrentStep(1);
                        } else if (idx === 2 && currentStep <= 1) {
                          if (validateStep1() && validateStep2()) setCurrentStep(2);
                        } else if (idx === 3 && currentStep <= 2) {
                          if (validateStep1() && validateStep2() && validateStep3()) setCurrentStep(3);
                        }
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isCompleted
                          ? 'bg-green-600 text-white shadow-sm'
                          : isCurrent
                            ? 'bg-green-600 text-white ring-4 ring-green-100 dark:ring-green-900/40 shadow-sm'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      {isCompleted ? <Check size={14} /> : idx + 1}
                    </button>
                    <span className={`text-[11px] font-semibold mt-1 text-center ${
                      isCurrent 
                        ? 'text-green-700 dark:text-green-400' 
                        : isCompleted
                          ? 'text-gray-900 dark:text-gray-200'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {s.title}
                    </span>
                  </div>
                );
              })}

              {/* Connecting progress line */}
              <div className="absolute top-4 left-1/8 right-1/8 h-0.5 bg-gray-200 dark:bg-gray-700 -z-0">
                <div 
                  className="h-full bg-green-600 transition-all duration-300"
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* ================= MODAL BODY (SCROLLABLE) ================= */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
            {/* Server Error Alert (Help Users Recognize and Recover) */}
            {serverError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-sm text-red-800 dark:text-red-300 animate-shake">
                <AlertCircle size={20} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <strong className="font-semibold block mb-0.5">Registration Failed</strong>
                  <span>{serverError}</span>
                </div>
                <button 
                  onClick={() => setServerError('')}
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Helper Info Banner (Recognition & Documentation) */}
            <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-300">
              <Info size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>HCI Notice:</strong> Property ID will be automatically generated upon saving.
                {formData.propertyType === 'LOT' 
                  ? ' Enter parcel land area in square meters (m²).' 
                  : ' Enter building floor area in square meters (m²).'}
              </span>
            </div>

            {/* ---------------- STEP 1: PROPERTY DETAILS ---------------- */}
            {currentStep === 0 && (
              <div className="space-y-5 animate-fade-in">
                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700/80">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {formData.propertyType === 'LOT' ? <SquareDashed size={16} className="text-green-600" /> : <Building2 size={16} className="text-blue-600" />}
                      {formData.propertyType === 'LOT' ? 'Lot Property Information' : 'Building Asset Information'}
                    </h3>
                    <span className="text-xs text-gray-500">
                      Fields marked with <span className="text-red-500 font-bold">*</span> are required
                    </span>
                  </div>

                  {formData.propertyType === 'LOT' ? (
                    /* LOT SPECIFIC FIELDS */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Lot Number */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Lot Number <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          id="lot-number-input"
                          type="text"
                          value={formData.lotNumber || ''}
                          onChange={e => handleChange('lotNumber', e.target.value)}
                          placeholder="e.g. LOT-101 (Auto-generated if blank)"
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        />
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 block">
                          Cadastral or subdivision lot number
                        </span>
                      </div>

                      {/* Lot Area (m²) */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Lot Area (m²) <span className="text-red-500 font-bold">* (Required)</span>
                        </label>
                        <input
                          id="lot-area-input"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={formData.lotArea || ''}
                          onChange={e => handleChange('lotArea', e.target.value)}
                          placeholder="e.g. 250.00"
                          className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white ${
                            errors.lotArea ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-700'
                          }`}
                        />
                        {errors.lotArea ? (
                          <span className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.lotArea}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 block">
                            Total land area in square meters
                          </span>
                        )}
                      </div>

                      {/* Property Classification */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Classification <span className="text-red-500 font-bold">* (Required)</span>
                        </label>
                        <select
                          id="lot-classification-select"
                          value={formData.lotClassification}
                          onChange={e => handleChange('lotClassification', e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        >
                          <option value="Residential Lot">Residential Lot</option>
                          <option value="Commercial Lot">Commercial Lot</option>
                          <option value="Agricultural Land">Agricultural Land</option>
                          <option value="Industrial Lot">Industrial Lot</option>
                          <option value="Special">Special Purpose</option>
                        </select>
                      </div>

                      {/* Land Use / Property Type Use */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Actual Land Use <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                        </label>
                        <select
                          id="lot-use-select"
                          value={formData.lotTypeUse}
                          onChange={e => handleChange('lotTypeUse', e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        >
                          <option value="Residential">Residential</option>
                          <option value="Commercial">Commercial</option>
                          <option value="Agricultural">Agricultural</option>
                          <option value="Industrial">Industrial</option>
                          <option value="Institutional">Institutional</option>
                          <option value="Vacant / Open Space">Vacant / Open Space</option>
                        </select>
                      </div>

                      {/* Title Number */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Certificate of Title (OCT/TCT) <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          id="lot-title-input"
                          type="text"
                          value={formData.titleNumber || ''}
                          onChange={e => handleChange('titleNumber', e.target.value)}
                          placeholder="e.g. TCT-0123456"
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Tax Declaration Number */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Tax Declaration No. (TDN) <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          id="lot-tdn-input"
                          type="text"
                          value={formData.taxDeclarationNumber || ''}
                          onChange={e => handleChange('taxDeclarationNumber', e.target.value)}
                          placeholder="e.g. TD-2026-00123"
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  ) : (
                    /* BUILDING SPECIFIC FIELDS */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Building Name */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Building Name / Identifier <span className="text-red-500 font-bold">* (Required)</span>
                        </label>
                        <input
                          id="building-name-input"
                          type="text"
                          required
                          value={formData.buildingName || ''}
                          onChange={e => handleChange('buildingName', e.target.value)}
                          placeholder="e.g. 2-Storey Concrete Residence, Commercial Arcade Bldg B"
                          className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white ${
                            errors.buildingName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-700'
                          }`}
                        />
                        {errors.buildingName && (
                          <span className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.buildingName}
                          </span>
                        )}
                      </div>

                      {/* Building Floor Area */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Building Floor Area (m²) <span className="text-red-500 font-bold">* (Required)</span>
                        </label>
                        <input
                          id="floor-area-input"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={formData.floorArea || ''}
                          onChange={e => handleChange('floorArea', e.target.value)}
                          placeholder="e.g. 180.00"
                          className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white ${
                            errors.floorArea ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-700'
                          }`}
                        />
                        {errors.floorArea ? (
                          <span className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.floorArea}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 block">
                            Enclosed usable floor space across all storeys
                          </span>
                        )}
                      </div>

                      {/* Number of Floors */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Number of Floors / Storeys <span className="text-red-500 font-bold">* (Required)</span>
                        </label>
                        <input
                          id="floor-count-input"
                          type="number"
                          min="1"
                          max="50"
                          required
                          value={formData.floorCount || ''}
                          onChange={e => handleChange('floorCount', e.target.value)}
                          placeholder="e.g. 1, 2, 3"
                          className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white ${
                            errors.floorCount ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-700'
                          }`}
                        />
                        {errors.floorCount && (
                          <span className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.floorCount}
                          </span>
                        )}
                      </div>

                      {/* Building Type */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Building Type <span className="text-red-500 font-bold">*</span>
                        </label>
                        <select
                          id="building-type-select"
                          value={formData.buildingType}
                          onChange={e => handleChange('buildingType', e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        >
                          <option value="Single Family Residential">Single Family Residential</option>
                          <option value="Multi-Family / Apartment">Multi-Family / Apartment</option>
                          <option value="Commercial Retail / Office">Commercial Retail / Office</option>
                          <option value="Warehouse / Industrial">Warehouse / Industrial</option>
                          <option value="Agricultural / Storage">Agricultural / Storage</option>
                          <option value="Institutional">Institutional</option>
                        </select>
                      </div>

                      {/* Building Classification */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Classification <span className="text-red-500 font-bold">*</span>
                        </label>
                        <select
                          id="building-classification-select"
                          value={formData.buildingClassification}
                          onChange={e => handleChange('buildingClassification', e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        >
                          <option value="Residential">Residential</option>
                          <option value="Commercial">Commercial</option>
                          <option value="Industrial">Industrial</option>
                          <option value="Institutional">Institutional</option>
                        </select>
                      </div>

                      {/* Construction Type / Materials */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Construction Materials
                        </label>
                        <select
                          id="construction-materials-select"
                          value={formData.constructionType}
                          onChange={e => handleChange('constructionType', e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        >
                          <option value="Reinforced Concrete">Reinforced Concrete</option>
                          <option value="Mixed Concrete & Wood">Mixed Concrete & Wood</option>
                          <option value="Structural Steel">Structural Steel</option>
                          <option value="Timber / Wood">Timber / Wood</option>
                          <option value="Light Materials">Light Materials</option>
                        </select>
                      </div>

                      {/* Year Constructed */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Year Constructed <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          id="year-constructed-input"
                          type="number"
                          min="1900"
                          max={new Date().getFullYear()}
                          value={formData.yearConstructed || ''}
                          onChange={e => handleChange('yearConstructed', e.target.value)}
                          placeholder="e.g. 2021"
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---------------- STEP 2: OWNER INFORMATION & OWNER ADDRESS ---------------- */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-fade-in">
                {/* Section A: Owner Personal Info */}
                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700/80 pb-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <User size={16} className="text-green-600" />
                      Owner's Personal Information
                    </h3>

                    {/* Toggle between Select Existing Owner or New */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOwnerMode(m => m === 'search' ? 'manual' : 'search');
                          if (ownerMode === 'manual') handleClearSelectedOwner();
                        }}
                        className="text-xs font-semibold text-green-700 dark:text-green-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {ownerMode === 'search' ? 'Switch to Manual Entry' : 'Search Existing Owner'}
                      </button>
                    </div>
                  </div>

                  {/* Existing Owner Search Bar */}
                  {ownerMode === 'search' && (
                    <div className="p-3 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800/60 rounded-xl">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                        <Search size={14} className="text-green-600" />
                        Search Registered Owners
                      </label>
                      <OwnerAutocomplete onSelect={handleSelectExistingOwner} />
                      {formData.ownerId && (
                        <div className="mt-2 text-xs text-green-700 dark:text-green-400 flex items-center justify-between bg-green-50 dark:bg-green-950/40 p-2 rounded-lg">
                          <span>
                            Linked to existing owner ID: <strong className="font-mono">#{formData.ownerId}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={handleClearSelectedOwner}
                            className="text-xs text-red-600 hover:underline cursor-pointer"
                          >
                            Unlink
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* First Name */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        First Name <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        id="owner-first-name-input"
                        type="text"
                        required
                        value={formData.ownerFirstName}
                        onChange={e => handleChange('ownerFirstName', e.target.value)}
                        placeholder="e.g. Juan"
                        className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white ${
                          errors.ownerFirstName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                      />
                      {errors.ownerFirstName && (
                        <span className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                          <AlertCircle size={12} /> {errors.ownerFirstName}
                        </span>
                      )}
                    </div>

                    {/* Middle Name */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Middle Name <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="owner-middle-name-input"
                        type="text"
                        value={formData.ownerMiddleName || ''}
                        onChange={e => handleChange('ownerMiddleName', e.target.value)}
                        placeholder="e.g. Santos"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Last Name <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        id="owner-last-name-input"
                        type="text"
                        required
                        value={formData.ownerLastName}
                        onChange={e => handleChange('ownerLastName', e.target.value)}
                        placeholder="e.g. Dela Cruz"
                        className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white ${
                          errors.ownerLastName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                      />
                      {errors.ownerLastName && (
                        <span className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                          <AlertCircle size={12} /> {errors.ownerLastName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Suffix */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Suffix <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="owner-suffix-input"
                        type="text"
                        value={formData.ownerSuffix || ''}
                        onChange={e => handleChange('ownerSuffix', e.target.value)}
                        placeholder="e.g. Jr., Sr., III"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Contact Number */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Contact Number <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="owner-contact-input"
                        type="text"
                        value={formData.ownerContactNumber || ''}
                        onChange={e => handleChange('ownerContactNumber', e.target.value)}
                        placeholder="e.g. 0917-123-4567"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Owner Residential Address */}
                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-4">
                  <div className="border-b border-gray-200 dark:border-gray-700/80 pb-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <MapPin size={16} className="text-green-600" />
                      Owner's Residential / Mailing Address
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      The official mailing address of the property owner (kept distinct from the physical property address).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Province */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Province <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        id="owner-province-select"
                        value={formData.ownerProvince}
                        onChange={e => {
                          const prov = e.target.value;
                          handleChange('ownerProvince', prov);
                          const muns = getMunicipalities(prov);
                          if (muns.length > 0) {
                            handleChange('ownerMunicipality', muns[0].name);
                            handleChange('ownerZipCode', muns[0].zipCode);
                            const brgys = getBarangays(muns[0].name);
                            if (brgys.length > 0) handleChange('ownerBarangay', brgys[0]);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      >
                        {getProvinces().map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Municipality */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Municipality / City <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        id="owner-municipality-select"
                        value={formData.ownerMunicipality}
                        onChange={e => {
                          const mun = e.target.value;
                          handleChange('ownerMunicipality', mun);
                          handleChange('ownerZipCode', getZipCode(mun));
                          const brgys = getBarangays(mun);
                          if (brgys.length > 0) handleChange('ownerBarangay', brgys[0]);
                        }}
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      >
                        {getMunicipalities(formData.ownerProvince).map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Barangay */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Barangay <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        id="owner-barangay-select"
                        value={formData.ownerBarangay}
                        onChange={e => handleChange('ownerBarangay', e.target.value)}
                        className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white ${
                          errors.ownerBarangay ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {getBarangays(formData.ownerMunicipality).map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Street or Sitio */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Street, Sitio, or Purok <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="owner-street-input"
                        type="text"
                        value={formData.ownerStreet || ''}
                        onChange={e => handleChange('ownerStreet', e.target.value)}
                        placeholder="e.g. Purok 3, Rizal Street"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* House / Unit No. & Zip */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        ZIP / Postal Code
                      </label>
                      <input
                        id="owner-zip-input"
                        type="text"
                        value={formData.ownerZipCode || ''}
                        onChange={e => handleChange('ownerZipCode', e.target.value)}
                        placeholder="e.g. 9006"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- STEP 3: PROPERTY ADDRESS, LOCATION & SUMMARY ---------------- */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-fade-in">
                {/* Physical Location Card */}
                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-4">
                  <div className="border-b border-gray-200 dark:border-gray-700/80 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <MapPin size={16} className="text-green-600" />
                        Physical Property Location
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Location of the physical parcel or building in Lagonglong, Misamis Oriental.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Province - Fixed Constraint */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Province (Jurisdiction)
                      </label>
                      <div className="px-3.5 py-2.5 bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                        <span>Misamis Oriental</span>
                        <ShieldCheck size={16} className="text-green-600" />
                      </div>
                    </div>

                    {/* Municipality - Fixed Constraint */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Municipality
                      </label>
                      <div className="px-3.5 py-2.5 bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                        <span>Lagonglong</span>
                        <ShieldCheck size={16} className="text-green-600" />
                      </div>
                    </div>

                    {/* Barangay - Restricted to Lagonglong's 10 official barangays */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Barangay <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        id="property-barangay-select"
                        required
                        value={formData.propertyBarangay}
                        onChange={e => handleChange('propertyBarangay', e.target.value)}
                        className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white ${
                          errors.propertyBarangay ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {LAGONGLONG_BARANGAYS.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      {errors.propertyBarangay && (
                        <span className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                          <AlertCircle size={12} /> {errors.propertyBarangay}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Purok / Sitio */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Purok or Zone
                      </label>
                      <select
                        id="property-purok-select"
                        value={formData.propertyPurok}
                        onChange={e => handleChange('propertyPurok', e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      >
                        <option value="Purok 1">Purok 1</option>
                        <option value="Purok 2">Purok 2</option>
                        <option value="Purok 3">Purok 3</option>
                        <option value="Purok 4">Purok 4</option>
                        <option value="Purok 5">Purok 5</option>
                        <option value="Purok 6">Purok 6</option>
                        <option value="Purok 7">Purok 7</option>
                        <option value="Sitio">Sitio</option>
                      </select>
                    </div>

                    {/* Street or Landmark */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Street Address or Landmark <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="property-street-input"
                        type="text"
                        value={formData.propertyStreet || ''}
                        onChange={e => handleChange('propertyStreet', e.target.value)}
                        placeholder="e.g. National Highway, Near Barangay Hall"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Optional GIS Boundaries */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-semibold block text-gray-800 dark:text-gray-200">GIS Coordinates & Spatial Boundary</span>
                      <span>Optional spatial polygon mapping for GIS integration.</span>
                    </div>

                    <button
                      type="button"
                      id="open-gis-map-btn"
                      onClick={() => setShowMapModal(true)}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Layers size={14} />
                      {formData.coordinates ? 'Edit Map Boundary' : 'Pin / Draw on Map'}
                    </button>
                  </div>

                  {formData.coordinates && (
                    <div className="p-2.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-800 dark:text-green-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                        <span>GIS Boundary mapped: <strong>{formData.area_sqm ? `${Number(formData.area_sqm).toFixed(2)} m²` : 'Polygon captured'}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleChange('coordinates', '')}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* ---------------- OPTIONAL PROPERTY PHOTO SECTION ---------------- */}
                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700/80 pb-2">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Camera size={16} className="text-green-600" />
                        {formData.propertyType === 'LOT' ? 'Upload Lot Photo (Optional)' : 'Upload Building Photo (Optional)'}
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Attach a ground-level photo of this {formData.propertyType === 'LOT' ? 'lot parcel' : 'building structure'} if available. JPG, PNG, or WebP up to 10MB.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      Optional
                    </span>
                  </div>

                  {photoError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                      <AlertCircle size={15} className="shrink-0 text-red-500" />
                      <span>{photoError}</span>
                    </div>
                  )}

                  {photoPreviewUrl ? (
                    /* Image Preview Card */
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800/60 rounded-xl">
                      <div className="relative w-36 h-28 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 shrink-0 shadow-sm">
                        <img
                          src={photoPreviewUrl}
                          alt="Property preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 space-y-1.5 w-full text-left">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {selectedPhotoFile ? selectedPhotoFile.name : 'Selected Photo'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {selectedPhotoFile ? `${(selectedPhotoFile.size / 1024).toFixed(1)} KB` : 'Ready'} • Photo will be uploaded and stored securely with this property.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            id="replace-photo-btn"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                          >
                            <RefreshCw size={13} />
                            Replace Photo
                          </button>
                          <button
                            type="button"
                            id="remove-photo-btn"
                            onClick={handleRemovePhoto}
                            className="px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Trash2 size={13} />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Friendly Empty State Card */
                    <div
                      id="lot-photo-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-5 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition bg-white/50 dark:bg-gray-800/30 hover:bg-green-50/30 dark:hover:bg-green-950/20 group"
                    >
                      <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-green-100 dark:group-hover:bg-green-900/40 text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-300 flex items-center justify-center transition mb-2">
                        <UploadCloud size={20} />
                      </div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {formData.propertyType === 'LOT'
                          ? 'Click to browse or drop lot photo'
                          : 'Click to browse or drop building photo'}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {formData.propertyType === 'LOT' 
                          ? 'No lot photo uploaded. You can continue without a photo.' 
                          : 'No building photo uploaded. You can continue without a photo.'}
                      </p>
                      <span className="mt-2.5 px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-[11px] font-semibold text-gray-700 dark:text-gray-300 group-hover:border-green-500 group-hover:text-green-700 dark:group-hover:text-green-300 shadow-sm transition">
                        Browse Image
                      </span>
                    </div>
                  )}

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    id="property-photo-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* ---------------- STEP 4: REVIEW & CONFIRMATION ---------------- */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                {/* Review Header Banner */}
                <div className="p-3.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-gray-800 border border-green-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Review Registration Details
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Please verify the accuracy of the entered property information before submitting to the database.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-green-600 text-white text-[11px] font-bold rounded-lg shadow-sm">
                    Step 4 of 4
                  </span>
                </div>

                {/* Section A: Property Information */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-600" />
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        A. Property Information
                      </h4>
                    </div>
                    <button
                      type="button"
                      id="edit-step-1-btn"
                      onClick={() => setCurrentStep(0)}
                      className="text-xs text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={13} />
                      Edit Information
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Property Type:</span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                        formData.propertyType === 'LOT'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}>
                        {formData.propertyType}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Property ID:</span>
                      <span className="text-gray-600 dark:text-gray-400 italic">
                        (Auto-generated upon save)
                      </span>
                    </div>

                    {formData.propertyType === 'LOT' ? (
                      <>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Lot Number:</span>
                          <strong className="text-gray-900 dark:text-white">
                            {formData.lotNumber || '(Auto-generated cadastral format)'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Land Lot Area:</span>
                          <strong className="text-green-600 dark:text-green-400 font-bold">
                            {formData.lotArea ? `${formData.lotArea} m²` : 'N/A'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Classification:</span>
                          <strong className="text-gray-900 dark:text-white">
                            {formData.lotClassification || 'Residential Lot'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Actual Land Use:</span>
                          <strong className="text-gray-900 dark:text-white">
                            {formData.lotTypeUse || 'Residential'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Certificate of Title:</span>
                          <span className="text-gray-900 dark:text-white">
                            {formData.titleNumber || 'Not specified'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Tax Declaration (TDN):</span>
                          <span className="text-gray-900 dark:text-white">
                            {formData.taxDeclarationNumber || 'Not specified'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Building Identifier:</span>
                          <strong className="text-gray-900 dark:text-white">
                            {formData.buildingName}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Floor Area:</span>
                          <strong className="text-green-600 dark:text-green-400 font-bold">
                            {formData.floorArea ? `${formData.floorArea} m²` : 'N/A'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Number of Floors:</span>
                          <strong className="text-gray-900 dark:text-white">
                            {formData.floorCount} Storey(s)
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Building Type:</span>
                          <strong className="text-gray-900 dark:text-white">
                            {formData.buildingType}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Classification:</span>
                          <strong className="text-gray-900 dark:text-white">
                            {formData.buildingClassification}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Construction Materials:</span>
                          <strong className="text-gray-900 dark:text-white">
                            {formData.constructionType || 'Reinforced Concrete'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Year Constructed:</span>
                          <span className="text-gray-900 dark:text-white">
                            {formData.yearConstructed || 'Not recorded'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section B: Owner Information */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        B. Owner Information & Address
                      </h4>
                    </div>
                    <button
                      type="button"
                      id="edit-step-2-btn"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={13} />
                      Edit Owner
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Owner Full Name:</span>
                      <strong className="text-gray-900 dark:text-white">
                        {`${formData.ownerFirstName} ${formData.ownerMiddleName || ''} ${formData.ownerLastName} ${formData.ownerSuffix || ''}`.replace(/\s+/g, ' ').trim()}
                      </strong>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Contact Number:</span>
                      <span className="text-gray-900 dark:text-white">
                        {formData.ownerContactNumber || 'Not provided'}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Owner Registration Status:</span>
                      <span className="text-gray-900 dark:text-white">
                        {formData.ownerId ? `Linked to existing Owner #${formData.ownerId}` : 'New Owner Record'}
                      </span>
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Owner Residential / Mailing Address:</span>
                      <strong className="text-gray-900 dark:text-white">
                        {[
                          formData.ownerHouseNumber && `House #${formData.ownerHouseNumber}`,
                          formData.ownerStreet,
                          formData.ownerBarangay,
                          formData.ownerMunicipality,
                          formData.ownerProvince,
                          formData.ownerZipCode
                        ].filter(Boolean).join(', ')}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Section C: Property Details & Location */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        C. Property Details & Location
                      </h4>
                    </div>
                    <button
                      type="button"
                      id="edit-step-3-btn"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={13} />
                      Edit Location
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Province:</span>
                      <strong className="text-gray-900 dark:text-white">Misamis Oriental</strong>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Municipality:</span>
                      <strong className="text-gray-900 dark:text-white">Lagonglong</strong>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Barangay:</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {formData.propertyBarangay}
                      </strong>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Purok / Zone:</span>
                      <span className="text-gray-900 dark:text-white">
                        {formData.propertyPurok || 'Purok 1'}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">Street Address / Landmark:</span>
                      <span className="text-gray-900 dark:text-white">
                        {formData.propertyStreet || 'Not specified'}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5">GIS Spatial Mapping:</span>
                      {formData.coordinates ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                          <CheckCircle2 size={13} /> Boundary Mapped ({Number(formData.area_sqm || 0).toFixed(2)} m²)
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Needs Mapping (Can be mapped in GIS later)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section D: Property Photo */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-600" />
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        D. Property Photo
                      </h4>
                    </div>
                    <button
                      type="button"
                      id="edit-photo-btn"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={13} />
                      {photoPreviewUrl ? 'Change Photo' : 'Add Photo'}
                    </button>
                  </div>
                  <div className="p-4 text-xs">
                    {photoPreviewUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-40 h-28 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 shadow-sm shrink-0">
                          <img
                            src={photoPreviewUrl}
                            alt="Property review preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="space-y-1 text-left">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 rounded text-[11px] font-bold">
                            <CheckCircle2 size={12} /> Photo Attached
                          </span>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {selectedPhotoFile ? selectedPhotoFile.name : 'Uploaded Property Photo'}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {selectedPhotoFile ? `${(selectedPhotoFile.size / 1024).toFixed(1)} KB` : ''} • Image will be securely stored and linked to this {formData.propertyType.toLowerCase()} record.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-2.5 text-gray-500 dark:text-gray-400">
                        <Camera size={16} className="text-gray-400 shrink-0" />
                        <span>No photo uploaded — optional. A property photo can be added later during assessment.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================= MODAL FOOTER ACTIONS (USER CONTROL & FREEDOM) ================= */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
            {/* Cancel Button */}
            <button
              type="button"
              id="cancel-add-property-btn"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>

            {/* Back & Next/Save Buttons */}
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  type="button"
                  id="back-step-btn"
                  onClick={handleBack}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  id="next-step-btn"
                  onClick={handleNext}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>{currentStep === 2 ? 'Proceed to Review' : 'Next Step'}</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  id="save-property-submit-btn"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving Property...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Property
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= CANCEL CONFIRMATION MODAL (USER CONTROL & FREEDOM) ================= */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle size={26} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Discard Property Registration?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                You have unsaved changes in this form. Closing will discard all entered property details.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                id="continue-editing-btn"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                id="confirm-discard-btn"
                onClick={() => {
                  setShowCancelConfirm(false);
                  close();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= GIS MAP MODAL (OPTIONAL BOUNDARY MAPPING) ================= */}
      {showMapModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers size={18} className="text-green-600" />
                  GIS Boundary Mapping
                </h3>
                <p className="text-xs text-gray-500">
                  Draw or adjust the polygon boundary for this {formData.propertyType.toLowerCase()}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 relative">
              <GISDrawMap
                entityType={formData.propertyType === 'LOT' ? 'lot' : 'building'}
                onGeometryChange={(geom, area, perim) => {
                  if (geom) {
                    handleChange('coordinates', JSON.stringify(geom.geometry.coordinates));
                    handleChange('area_sqm', String(area));
                    handleChange('perimeter_m', String(perim));
                  }
                }}
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold"
              >
                Done Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
