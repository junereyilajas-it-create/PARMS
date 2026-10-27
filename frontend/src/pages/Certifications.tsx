import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  FileText, 
  Printer, 
  Save, 
  RotateCcw, 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react'
import api from '../lib/api'
import { useModal } from '../contexts/ModalContext'
import { PropertyTable } from '../components/common/PropertyTable'
import { CertificateTable } from '../components/common/CertificateTable'
import { AdminCertificateRequests } from './AdminCertificateRequests'
import { SearchBox } from '../components/common/SearchBox'
import type { Property } from '../types/property'
import { format } from 'date-fns'

interface DetailedProperty {
  property_id: number
  property_status: string
  owner_id: number
  property_type_name: string
  classification_name: string
  location: string
  street?: string | null
  barangay_name: string
  municipality_name: string
  province_name: string
  lot_id?: number | null
  lot_number?: string | null
  title_number?: string | null
  lot_area?: string | number | null
  building_id?: number | null
  building_name?: string | null
  floor_area?: string | number | null
  tax_declaration_no?: string | null
  assessed_value?: string | number | null
  market_value?: string | number | null
  first_name: string
  middle_name?: string | null
  last_name: string
  contact_number?: string | null
  email?: string | null
}

interface LatestCert {
  certificate_id: number
  certificate_number: string
  certificate_type: string
  owner_id: number
  property_id: number | null
  requestor_name: string
  purpose: string
  custom_owner_name?: string | null
  custom_tax_declaration_no?: string | null
  signer_name?: string | null
  signer_title?: string | null
  or_number?: string | null
  issued_at: string
}

interface CertificationsProps {
  query: string
  onQueryChange: (val: string) => void
  rows: Property[]
  onDelete?: (property: Property) => void
}

export function Certifications({ query, onQueryChange, rows, onDelete }: CertificationsProps) {
  const { showSuccess, showError } = useModal()
  const [searchParams, setSearchParams] = useSearchParams()

  const paramPropertyId = searchParams.get('propertyId')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(paramPropertyId)
  const [subTab, setSubTab] = useState<'requests' | 'records' | 'properties'>('requests')
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Track pending count for tab badge
  useEffect(() => {
    api.get('/admin/certificate-requests')
      .then(res => {
        if (Array.isArray(res.data)) {
          const count = res.data.filter((r: any) => r.status === 'PENDING').length
          setPendingRequestsCount(count)
        }
      })
      .catch(() => {})
  }, [refreshTrigger])

  // Remote data state
  const [propertyData, setPropertyData] = useState<DetailedProperty | null>(null)
  const [latestCert, setLatestCert] = useState<LatestCert | null>(null)
  const [ownerProperties, setOwnerProperties] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Template 1: Standard Certification')

  // Editable Certificate Fields
  const [ownerName, setOwnerName] = useState('')
  const [taxDeclarationNo, setTaxDeclarationNo] = useState('')
  const [requestorName, setRequestorName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [certificateDate, setCertificateDate] = useState(() => new Date().toISOString().split('T')[0])
  const [signerName, setSignerName] = useState('MARIE MAE P. UBALDE')
  const [signerTitle, setSignerTitle] = useState('OIC - Municipal Assessor')
  const [orNumber, setOrNumber] = useState('4567695')
  const [amountPaid, setAmountPaid] = useState('60.50')
  const [docStamp, setDocStamp] = useState('30.00')

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Last saved baseline for Cancel/Reset
  const [lastSavedValues, setLastSavedValues] = useState<{
    ownerName: string
    taxDeclarationNo: string
    requestorName: string
    purpose: string
    certificateDate: string
    signerName: string
    signerTitle: string
    orNumber: string
    amountPaid: string
    docStamp: string
    template: string
  } | null>(null)

  // Keep state synced with URL search params
  useEffect(() => {
    if (paramPropertyId !== selectedPropertyId) {
      setSelectedPropertyId(paramPropertyId)
    }
  }, [paramPropertyId])

  // Load property record and certificate when propertyId changes
  useEffect(() => {
    if (!selectedPropertyId) {
      setPropertyData(null)
      setLatestCert(null)
      setOwnerProperties([])
      setFetchError(null)
      return
    }

    const loadPropertyAndCertificate = async () => {
      setIsLoading(true)
      setFetchError(null)
      try {
        const cleanId = String(selectedPropertyId).replace(/[^0-9]/g, '')
        const res = await api.get(`/generator/properties/${cleanId}`)
        const prop: DetailedProperty = res.data.property
        const cert: LatestCert | null = res.data.latestCertificate
        const ownProps = res.data.ownerProperties || []

        setPropertyData(prop)
        setLatestCert(cert)
        setOwnerProperties(ownProps)

        // Compute prefilled values from actual DB records or latest cert overrides
        const fullDbOwnerName = [prop.first_name, prop.middle_name, prop.last_name]
          .filter(Boolean)
          .join(' ')
          .trim()

        const initialOwner = cert?.custom_owner_name?.trim() || fullDbOwnerName || 'Unknown Owner'
        const initialTaxDec = cert?.custom_tax_declaration_no?.trim() || 
          prop.tax_declaration_no?.trim() || 
          `23-09000-${String(prop.property_id).padStart(4, '0')}`

        const initialRequestor = cert?.requestor_name?.trim() || initialOwner
        const initialPurpose = cert?.purpose?.trim() || 'For any legal purpose it may serve.'
        const initialTemplate = cert?.certificate_type || 'Template 1: Standard Certification'
        const initialSigner = cert?.signer_name || (initialTemplate.includes('Template 3') ? 'PINKY T. BAGONGON, REA' : 'MARIE MAE P. UBALDE')
        const initialTitle = cert?.signer_title || (initialTemplate.includes('Template 3') ? 'Municipal Assessor' : 'OIC - Municipal Assessor')
        const initialOr = cert?.or_number || '4567695'
        const initialDate = new Date().toISOString().split('T')[0]

        setOwnerName(initialOwner)
        setTaxDeclarationNo(initialTaxDec)
        setRequestorName(initialRequestor)
        setPurpose(initialPurpose)
        setSelectedTemplate(initialTemplate)
        setSignerName(initialSigner)
        setSignerTitle(initialTitle)
        setOrNumber(initialOr)
        setCertificateDate(initialDate)

        // Store snapshot for Cancel / Reset
        setLastSavedValues({
          ownerName: initialOwner,
          taxDeclarationNo: initialTaxDec,
          requestorName: initialRequestor,
          purpose: initialPurpose,
          certificateDate: initialDate,
          signerName: initialSigner,
          signerTitle: initialTitle,
          orNumber: initialOr,
          amountPaid: '60.50',
          docStamp: '30.00',
          template: initialTemplate
        })

        setValidationErrors({})
      } catch (err: any) {
        console.error('Failed to load property certificate details:', err)
        const msg = err.response?.data?.message || 'Failed to load property certificate records from the database.'
        setFetchError(msg)
        showError(msg)
      } finally {
        setIsLoading(false)
      }
    }

    loadPropertyAndCertificate()
  }, [selectedPropertyId])

  const handleSelectProperty = (property: Property) => {
    const cleanId = property.id.replace('PROPERTY-', '')
    setSelectedPropertyId(cleanId)
    setSearchParams({ propertyId: cleanId })
  }

  const handleBackToList = () => {
    setSelectedPropertyId(null)
    setSearchParams({})
    setPropertyData(null)
    setLatestCert(null)
  }

  // Validation
  const validateFields = () => {
    const errors: Record<string, string> = {}
    if (!ownerName.trim()) {
      errors.ownerName = "Property owner's full name is required."
    }
    if (!taxDeclarationNo.trim()) {
      errors.taxDeclarationNo = 'Tax Declaration Number is required.'
    }
    if (!requestorName.trim()) {
      errors.requestorName = 'Requestor name is required.'
    }
    if (!purpose.trim()) {
      errors.purpose = 'Certificate purpose is required.'
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Cancel / Discard Changes
  const handleCancel = () => {
    if (!lastSavedValues) return
    setOwnerName(lastSavedValues.ownerName)
    setTaxDeclarationNo(lastSavedValues.taxDeclarationNo)
    setRequestorName(lastSavedValues.requestorName)
    setPurpose(lastSavedValues.purpose)
    setCertificateDate(lastSavedValues.certificateDate)
    setSignerName(lastSavedValues.signerName)
    setSignerTitle(lastSavedValues.signerTitle)
    setOrNumber(lastSavedValues.orNumber)
    setAmountPaid(lastSavedValues.amountPaid)
    setDocStamp(lastSavedValues.docStamp)
    setSelectedTemplate(lastSavedValues.template)
    setValidationErrors({})
    showSuccess('Unsaved changes discarded. Restored last saved database values.')
  }

  // Save Changes to Database
  const handleSaveChanges = async () => {
    if (!validateFields()) {
      showError('Please fix the validation errors before saving.')
      return
    }

    if (!propertyData) return

    setIsSaving(true)
    try {
      const payload = {
        certificate_type: selectedTemplate,
        owner_id: propertyData.owner_id,
        property_id: propertyData.property_id,
        requestor_name: requestorName.trim(),
        purpose: purpose.trim(),
        custom_owner_name: ownerName.trim(),
        custom_tax_declaration_no: taxDeclarationNo.trim(),
        signer_name: signerName.trim(),
        signer_title: signerTitle.trim(),
        or_number: orNumber.trim()
      }

      let res
      if (latestCert?.certificate_id) {
        res = await api.put(`/generator/certificates/${latestCert.certificate_id}`, payload)
      } else {
        res = await api.post('/generator/certificates', payload)
      }

      const updated = res.data
      setLatestCert(updated)
      setRefreshTrigger(prev => prev + 1)

      // Update checkpoint
      setLastSavedValues({
        ownerName: ownerName.trim(),
        taxDeclarationNo: taxDeclarationNo.trim(),
        requestorName: requestorName.trim(),
        purpose: purpose.trim(),
        certificateDate,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        orNumber: orNumber.trim(),
        amountPaid,
        docStamp,
        template: selectedTemplate
      })

      showSuccess('Certificate changes saved successfully to database records.')
    } catch (err: any) {
      console.error('Failed to save certificate:', err)
      showError(err.response?.data?.message || 'Failed to save certificate changes.')
    } finally {
      setIsSaving(false)
    }
  }

  // Print Document
  const handlePrint = () => {
    if (!validateFields()) {
      showError('Please correct invalid fields before printing.')
      return
    }
    window.print()
  }

  // Formatted date representations
  const formattedFullDate = useMemo(() => {
    try {
      return format(new Date(certificateDate), "do 'day of' MMMM, yyyy")
    } catch {
      return certificateDate
    }
  }, [certificateDate])

  const formattedShortDate = useMemo(() => {
    try {
      return format(new Date(certificateDate), 'MMMM dd, yyyy')
    } catch {
      return certificateDate
    }
  }, [certificateDate])

  // Check if dirty
  const isDirty = useMemo(() => {
    if (!lastSavedValues) return false
    return (
      ownerName !== lastSavedValues.ownerName ||
      taxDeclarationNo !== lastSavedValues.taxDeclarationNo ||
      requestorName !== lastSavedValues.requestorName ||
      purpose !== lastSavedValues.purpose ||
      signerName !== lastSavedValues.signerName ||
      signerTitle !== lastSavedValues.signerTitle ||
      orNumber !== lastSavedValues.orNumber ||
      selectedTemplate !== lastSavedValues.template
    )
  }, [ownerName, taxDeclarationNo, requestorName, purpose, signerName, signerTitle, orNumber, selectedTemplate, lastSavedValues])

  return (
    <div className="space-y-6 fade-in print:p-0 print:m-0 print:space-y-0">
      {/* Page Header (Hidden on Print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow text-xs uppercase font-bold tracking-widest text-green-700 dark:text-green-500">
              DOCUMENT SERVICES
            </span>
            {selectedPropertyId && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                PROPERTY-{selectedPropertyId}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-green-800 dark:text-green-400">
            {selectedPropertyId 
              ? 'Official Certificate Workspace' 
              : subTab === 'requests'
                ? 'Owner Certificate Requests'
                : subTab === 'records' 
                  ? 'Issued Official Certificates' 
                  : 'Select Property to Generate Certificate'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {selectedPropertyId
              ? 'Preview, customize, save, and print official certified documents with live database synchronization.'
              : subTab === 'requests'
                ? 'Review, verify, and process official certificate applications submitted by property owners.'
                : subTab === 'records'
                  ? 'Review issued certificates, check document numbers, search records, or print official copies.'
                  : 'Locate a property record and click on any row to open its official Certificate workspace.'}
          </p>
        </div>

        {selectedPropertyId ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm cursor-pointer"
            >
              <ArrowLeft size={16} /> Back to Certificate Desk
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200 dark:border-gray-700/60 self-start md:self-auto flex-wrap">
            <button
              id="tab-certificate-requests"
              onClick={() => setSubTab('requests')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-2 ${
                subTab === 'requests'
                  ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-sm border border-gray-200/60 dark:border-gray-700/60'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>Certificate Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
            <button
              id="tab-issued-certificates"
              onClick={() => setSubTab('records')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                subTab === 'records'
                  ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-sm border border-gray-200/60 dark:border-gray-700/60'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Issued Certificates
            </button>
            <button
              id="tab-select-property"
              onClick={() => setSubTab('properties')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                subTab === 'properties'
                  ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-sm border border-gray-200/60 dark:border-gray-700/60'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Direct Generator
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: WHEN NO PROPERTY IS SELECTED */}
      {!selectedPropertyId && (
        <>
          {subTab === 'requests' ? (
            <AdminCertificateRequests
              isEmbedded={true}
              onOpenWorkspace={(propertyId) => {
                const cleanId = String(propertyId).replace(/[^0-9]/g, '')
                setSelectedPropertyId(cleanId)
                setSearchParams({ propertyId: cleanId })
              }}
            />
          ) : subTab === 'records' ? (
            <CertificateTable
              onOpenWorkspace={(propertyId) => {
                const cleanId = String(propertyId).replace(/[^0-9]/g, '')
                setSelectedPropertyId(cleanId)
                setSearchParams({ propertyId: cleanId })
              }}
              onIssueNewCertificate={() => setSubTab('properties')}
              refreshTrigger={refreshTrigger}
            />
          ) : (
            <div className="card records mt-4">
              <div className="card-head flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Property for Certification</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    Click any property row below to automatically retrieve the property's database records and open its certificate workspace.
                  </p>
                </div>
                <button
                  onClick={() => setSubTab('records')}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition cursor-pointer"
                >
                  ← Back to Certificates
                </button>
              </div>

              <div className="mb-4">
                <SearchBox value={query} onChange={onQueryChange} />
              </div>

              <div className="border border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-950/20 p-3 rounded-lg flex items-center gap-3 text-sm text-green-800 dark:text-green-300 mb-4">
                <ShieldCheck size={20} className="shrink-0 text-green-600 dark:text-green-400" />
                <span>
                  <strong>Tip:</strong> Click anywhere on a property row to open the Certificate workspace. Property details and owner records will be pre-filled automatically from the live database.
                </span>
              </div>

              <PropertyTable 
                rows={rows} 
                onDelete={onDelete} 
                onSelect={handleSelectProperty}
              />
            </div>
          )}
        </>
      )}

      {/* VIEW 2: CERTIFICATE WORKSPACE (SIMILAR TO REPORT PAGE) */}
      {selectedPropertyId && (
        <>
          {isLoading && (
            <div className="glass-panel p-12 text-center rounded-2xl bg-white dark:bg-gray-900">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">Retrieving property and certificate records from database...</p>
            </div>
          )}

          {fetchError && !isLoading && (
            <div className="glass-panel p-8 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-center">
              <AlertCircle size={36} className="mx-auto text-red-600 dark:text-red-400 mb-2" />
              <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Error Loading Property</h3>
              <p className="text-red-600 dark:text-red-400 mt-1">{fetchError}</p>
              <button 
                onClick={handleBackToList}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
              >
                Return to Property List
              </button>
            </div>
          )}

          {propertyData && !isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
              {/* LEFT COLUMN: Controls & Editable Configuration (Hidden on Print) */}
              <div className="lg:col-span-1 space-y-6 print:hidden">
                {/* 1. Property Summary Card */}
                <div className="glass-panel p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-800/70">
                  <div className="flex items-center justify-between border-b pb-3 mb-3 border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
                      Selected Property
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300">
                      ID: {propertyData.property_id}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block font-medium">Master Owner</span>
                      <strong className="text-gray-900 dark:text-gray-100 text-sm">
                        {[propertyData.first_name, propertyData.middle_name, propertyData.last_name].filter(Boolean).join(' ')}
                      </strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block">Type</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
                          {propertyData.property_type_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block">Classification</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
                          {propertyData.classification_name}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Lot / Building No.</span>
                      <span className="font-mono text-gray-800 dark:text-gray-200">
                        {propertyData.lot_number || propertyData.building_name || `LOT-${propertyData.property_id}`}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Location</span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {propertyData.location}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block">Lot Area</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {propertyData.lot_area || propertyData.floor_area ? `${propertyData.lot_area || propertyData.floor_area} sq m` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block">Assessed Value</span>
                        <span className="font-semibold text-green-700 dark:text-green-400">
                          {propertyData.assessed_value ? `₱${Number(propertyData.assessed_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '₱0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Certificate Configuration Form */}
                <div className="glass-panel p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-800/70 space-y-4">
                  <div className="border-b pb-2 border-gray-200 dark:border-gray-700">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText size={18} className="text-green-600 dark:text-green-400" />
                      Certificate Settings
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Edit certificate fields below. Changes update the preview in real-time.
                    </p>
                  </div>

                  {/* Template Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Certificate Template
                    </label>
                    <select
                      id="cert-template-select"
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                      <option value="Template 1: Standard Certification">Template 1: Standard Certification</option>
                      <option value="Template 2: Property Holdings Certification">Template 2: Property Holdings Certification</option>
                      <option value="Template 3: Real Property Historical Ownership">Template 3: Real Property Historical Ownership</option>
                    </select>
                  </div>

                  {/* Editable Fields */}
                  <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                    {/* Owner's Full Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Owner's Full Name <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] text-gray-400">Certificate override</span>
                      </div>
                      <input
                        id="cert-owner-name"
                        type="text"
                        value={ownerName}
                        onChange={(e) => {
                          setOwnerName(e.target.value)
                          if (validationErrors.ownerName) {
                            setValidationErrors(prev => ({ ...prev, ownerName: '' }))
                          }
                        }}
                        placeholder="e.g. JUAN DELA CRUZ"
                        className={`w-full text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border ${validationErrors.ownerName ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none`}
                      />
                      {validationErrors.ownerName && (
                        <p className="text-[11px] text-red-500 mt-1">{validationErrors.ownerName}</p>
                      )}
                    </div>

                    {/* Tax Declaration Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Tax Declaration Number <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] text-gray-400">Certificate override</span>
                      </div>
                      <input
                        id="cert-tax-dec"
                        type="text"
                        value={taxDeclarationNo}
                        onChange={(e) => {
                          setTaxDeclarationNo(e.target.value)
                          if (validationErrors.taxDeclarationNo) {
                            setValidationErrors(prev => ({ ...prev, taxDeclarationNo: '' }))
                          }
                        }}
                        placeholder="e.g. 23-09000-0012"
                        className={`w-full text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border ${validationErrors.taxDeclarationNo ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none`}
                      />
                      {validationErrors.taxDeclarationNo && (
                        <p className="text-[11px] text-red-500 mt-1">{validationErrors.taxDeclarationNo}</p>
                      )}
                    </div>

                    {/* Requestor Name */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Requestor Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="cert-requestor"
                        type="text"
                        value={requestorName}
                        onChange={(e) => {
                          setRequestorName(e.target.value)
                          if (validationErrors.requestorName) {
                            setValidationErrors(prev => ({ ...prev, requestorName: '' }))
                          }
                        }}
                        placeholder="Name of requesting person"
                        className={`w-full text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border ${validationErrors.requestorName ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none`}
                      />
                      {validationErrors.requestorName && (
                        <p className="text-[11px] text-red-500 mt-1">{validationErrors.requestorName}</p>
                      )}
                    </div>

                    {/* Purpose */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Purpose <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="cert-purpose"
                        rows={2}
                        value={purpose}
                        onChange={(e) => {
                          setPurpose(e.target.value)
                          if (validationErrors.purpose) {
                            setValidationErrors(prev => ({ ...prev, purpose: '' }))
                          }
                        }}
                        placeholder="Purpose of certificate"
                        className={`w-full text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border ${validationErrors.purpose ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none`}
                      />
                      {validationErrors.purpose && (
                        <p className="text-[11px] text-red-500 mt-1">{validationErrors.purpose}</p>
                      )}
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Date of Issuance
                      </label>
                      <input
                        id="cert-date"
                        type="date"
                        value={certificateDate}
                        onChange={(e) => setCertificateDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                      />
                    </div>

                    {/* Signer Name & Title */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Signer Name
                        </label>
                        <input
                          id="cert-signer-name"
                          type="text"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Signer Title
                        </label>
                        <input
                          id="cert-signer-title"
                          type="text"
                          value={signerTitle}
                          onChange={(e) => setSignerTitle(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* OR Number */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        OR / Receipt Number
                      </label>
                      <input
                        id="cert-or-number"
                        type="text"
                        value={orNumber}
                        onChange={(e) => setOrNumber(e.target.value)}
                        placeholder="e.g. 4567695"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Action Buttons Card */}
                <div className="glass-panel p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-800/70 space-y-3">
                  <button
                    id="btn-save-cert"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Save size={16} />
                    {isSaving ? 'Saving to Database...' : 'Save Changes'}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="btn-cancel-cert"
                      onClick={handleCancel}
                      disabled={!isDirty}
                      className="w-full flex justify-center items-center gap-1.5 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg font-medium text-xs transition-colors disabled:opacity-50"
                      title="Discard unsaved edits and restore last saved database values"
                    >
                      <RotateCcw size={14} /> Cancel
                    </button>

                    <button
                      id="btn-print-cert"
                      onClick={handlePrint}
                      className="w-full flex justify-center items-center gap-1.5 py-2 px-3 bg-gray-900 hover:bg-black text-white dark:bg-gray-600 dark:hover:bg-gray-500 rounded-lg font-medium text-xs transition-colors shadow-sm"
                    >
                      <Printer size={14} /> Print Certificate
                    </button>
                  </div>

                  <button
                    onClick={handleBackToList}
                    className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    Select Another Property
                  </button>

                  {isDirty && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>You have unsaved changes. Click "Save Changes" to persist.</span>
                    </div>
                  )}

                  {latestCert && !isDirty && (
                    <div className="flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-2 rounded-md">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span>Certificate record is saved ({latestCert.certificate_number}).</span>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Official Document Preview Container (Similar to Report Page) */}
              <div 
                id="certificate-preview-container"
                className="lg:col-span-3 glass-panel p-8 md:p-12 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 min-h-[900px] text-gray-900 dark:text-gray-100 shadow-sm print:shadow-none print:border-none print:w-full print:absolute print:left-0 print:top-0 print:bg-white print:text-black print:p-0"
              >
                <div className="max-w-3xl mx-auto font-serif">
                  {/* Official Philippine Seal & Municipal Header */}
                  <div className="flex items-center justify-between mb-8 border-b-2 border-black dark:border-white print:border-black pb-6">
                    <div className="w-20 h-20 flex items-center justify-center">
                      <img 
                        src="/logo.png" 
                        alt="Philippine Official Seal" 
                        className="w-full h-full object-contain grayscale"
                        onError={(e) => {
                          // Fallback if image fails
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="text-center flex-1 px-4">
                      <h2 className="text-base font-bold uppercase tracking-wider">Republic of the Philippines</h2>
                      <h3 className="text-sm font-semibold">Province of Misamis Oriental</h3>
                      <h3 className="text-sm font-bold uppercase">Municipality of Lagonglong</h3>
                      <h1 className="text-xl font-black uppercase mt-3 tracking-wide">
                        Office of the Municipal Assessor
                      </h1>
                    </div>
                    <div className="w-20 h-20 flex items-center justify-center">
                      <img 
                        src="/assessor-logo.png" 
                        alt="Assessor Seal" 
                        className="w-full h-full object-contain grayscale"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>

                  {/* Header Date for Templates */}
                  <div className="text-right text-sm font-semibold mb-6">
                    {formattedShortDate}
                  </div>

                  {/* ============================================================== */}
                  {/* TEMPLATE 1: STANDARD CERTIFICATION (Certified True Copy)       */}
                  {/* ============================================================== */}
                  {selectedTemplate.includes('Template 1') && (
                    <div className="space-y-6 text-justify leading-relaxed">
                      <h2 className="text-2xl font-bold text-center tracking-widest my-8 underline underline-offset-8">
                        C E R T I F I C A T I O N
                      </h2>

                      <p className="font-bold text-base mt-6">
                        TO WHOM IT MAY CONCERN:
                      </p>

                      <p className="indent-8 text-base">
                        THIS IS TO CERTIFY THAT as per records on file in this Office, a parcel of land 
                        declared in the name of <span className="font-bold uppercase underline underline-offset-2">{ownerName || '____________________'}</span> under 
                        Tax Declaration No. <span className="font-bold underline underline-offset-2">{taxDeclarationNo || '____________________'}</span> (PIN: ____________________) 
                        situated at Barangay <span className="font-bold capitalize">{propertyData.barangay_name || '____________________'}</span>, 
                        {propertyData.municipality_name || 'Lagonglong'}, {propertyData.province_name || 'Misamis Oriental'} is classified as{' '}
                        <span className="font-bold capitalize">{propertyData.classification_name || 'Agricultural'}</span> with a total registered area of{' '}
                        <span className="font-bold">{propertyData.lot_area || propertyData.floor_area ? `${propertyData.lot_area || propertyData.floor_area} sq m` : 'standard lot'}</span> and an assessed valuation of{' '}
                        <span className="font-bold">₱{Number(propertyData.assessed_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>.
                      </p>

                      <p className="indent-8 text-base">
                        THIS IS TO CERTIFY FURTHER that the Tax Declaration Number specified above is LATEST and EXISTING in the official property registry of this municipality.
                      </p>

                      <p className="indent-8 text-base">
                        This certification is issued upon the request of <span className="font-bold underline underline-offset-2">{requestorName || 'the declared owner'}</span> for{' '}
                        <span className="font-semibold">{purpose || 'any legal purpose it may serve'}</span>.
                      </p>

                      <p className="indent-8 text-base mt-6">
                        Done this <span className="font-semibold">{formattedFullDate}</span> at {propertyData.municipality_name || 'Lagonglong'}, {propertyData.province_name || 'Misamis Oriental'}, Philippines.
                      </p>
                    </div>
                  )}

                  {/* ============================================================== */}
                  {/* TEMPLATE 2: PROPERTY HOLDINGS CERTIFICATION                    */}
                  {/* ============================================================== */}
                  {selectedTemplate.includes('Template 2') && (
                    <div className="space-y-6 text-justify leading-relaxed">
                      <h2 className="text-2xl font-bold text-center tracking-widest my-8 underline underline-offset-8">
                        C E R T I F I C A T I O N
                      </h2>

                      <p className="font-bold text-base mt-6">
                        TO WHOM IT MAY CONCERN:
                      </p>

                      <p className="indent-8 text-base">
                        THIS IS TO CERTIFY that according to the records on file in this Office,{' '}
                        <span className="font-bold uppercase underline underline-offset-2">{ownerName || '____________________'}</span>, 
                        resident of <span className="capitalize">{propertyData.location || 'Lagonglong, Misamis Oriental'}</span>, has real properties declared in her/his name for taxation purposes in this municipality as follows:
                      </p>

                      {/* Property Holdings Table */}
                      <table className="w-full border-collapse border border-black dark:border-white print:border-black text-sm my-6">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-black dark:border-white print:border-black p-2 font-bold text-center">T/D NO.</th>
                            <th className="border border-black dark:border-white print:border-black p-2 font-bold text-left">LOCATION OF PROPERTY</th>
                            <th className="border border-black dark:border-white print:border-black p-2 font-bold text-center">KIND OF LAND</th>
                            <th className="border border-black dark:border-white print:border-black p-2 font-bold text-right">AREA</th>
                            <th className="border border-black dark:border-white print:border-black p-2 font-bold text-right">ASSESSED VALUE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Active / selected property row with live overrides */}
                          <tr>
                            <td className="border border-black dark:border-white print:border-black p-2 text-center font-bold font-mono">
                              {taxDeclarationNo}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 capitalize">
                              {propertyData.location}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 text-center capitalize">
                              {propertyData.classification_name}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 text-right">
                              {propertyData.lot_area || propertyData.floor_area ? `${propertyData.lot_area || propertyData.floor_area} sq m` : '2,400 sq m'}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 text-right font-medium">
                              ₱{Number(propertyData.assessed_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* Other properties owned by the same owner if any */}
                          {ownerProperties
                            .filter(p => String(p.property_id) !== String(propertyData.property_id))
                            .map((otherProp, idx) => (
                              <tr key={idx}>
                                <td className="border border-black dark:border-white print:border-black p-2 text-center font-mono">
                                  {otherProp.tax_declaration_no || `23-09000-${String(otherProp.property_id).padStart(4, '0')}`}
                                </td>
                                <td className="border border-black dark:border-white print:border-black p-2 capitalize">
                                  {otherProp.location}
                                </td>
                                <td className="border border-black dark:border-white print:border-black p-2 text-center capitalize">
                                  {otherProp.classification_name}
                                </td>
                                <td className="border border-black dark:border-white print:border-black p-2 text-right">
                                  {otherProp.lot_area || otherProp.floor_area ? `${otherProp.lot_area || otherProp.floor_area} sq m` : 'N/A'}
                                </td>
                                <td className="border border-black dark:border-white print:border-black p-2 text-right">
                                  ₱{Number(otherProp.assessed_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}

                          {/* Official XXXXXX closing row */}
                          <tr>
                            <td colSpan={5} className="border border-black dark:border-white print:border-black p-1 text-center font-mono text-gray-400 print:text-black">
                              xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx NOTHING FOLLOWS xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <p className="indent-8 text-base">
                        Issued upon the request of <span className="font-bold underline underline-offset-2">{requestorName}</span> for{' '}
                        <span className="font-semibold">{purpose}</span>.
                      </p>

                      <p className="indent-8 text-base">
                        Given this <span className="font-semibold">{formattedFullDate}</span> at {propertyData.municipality_name || 'Lagonglong'}, {propertyData.province_name || 'Misamis Oriental'}, Philippines.
                      </p>
                    </div>
                  )}

                  {/* ============================================================== */}
                  {/* TEMPLATE 3: REAL PROPERTY HISTORICAL OWNERSHIP                 */}
                  {/* ============================================================== */}
                  {selectedTemplate.includes('Template 3') && (
                    <div className="space-y-6">
                      <h2 className="text-xl font-bold text-center uppercase tracking-widest my-8 underline underline-offset-8">
                        REAL PROPERTY HISTORICAL OWNERSHIP
                      </h2>

                      <div className="grid grid-cols-2 gap-4 text-sm my-6">
                        <div className="space-y-1">
                          <p>Survey Lot No: <strong>{propertyData.lot_number || `LOT-${propertyData.property_id}`}</strong></p>
                          <p>OCT / TCT No: <strong>{propertyData.title_number || 'None on record'}</strong></p>
                        </div>
                        <div className="space-y-1">
                          <p>Location: <strong>{propertyData.location}</strong></p>
                          <p>PIN: <strong>038-09-001-{String(propertyData.property_id).padStart(4, '0')}</strong></p>
                        </div>
                      </div>

                      <table className="w-full border-collapse border border-black dark:border-white print:border-black text-xs my-6">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 print:bg-transparent">
                            <th className="border border-black dark:border-white print:border-black p-2 text-center">T.D. NO.</th>
                            <th className="border border-black dark:border-white print:border-black p-2 text-left">DECLARANT</th>
                            <th className="border border-black dark:border-white print:border-black p-2 text-center">KIND OF LAND</th>
                            <th className="border border-black dark:border-white print:border-black p-2 text-right">AREA</th>
                            <th className="border border-black dark:border-white print:border-black p-2 text-right">ASSESSED VALUE</th>
                            <th className="border border-black dark:border-white print:border-black p-2 text-center">TAX EFFECTIVITY</th>
                            <th className="border border-black dark:border-white print:border-black p-2 text-center">CANCELLED BY</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-black dark:border-white print:border-black p-2 text-center font-bold font-mono">
                              {taxDeclarationNo}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 uppercase font-bold">
                              {ownerName}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 text-center capitalize">
                              {propertyData.classification_name}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 text-right">
                              {propertyData.lot_area || propertyData.floor_area ? `${propertyData.lot_area || propertyData.floor_area} sq m` : '2,400 sq m'}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 text-right font-semibold">
                              ₱{Number(propertyData.assessed_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 text-center font-semibold">
                              EXISTING
                            </td>
                            <td className="border border-black dark:border-white print:border-black p-2 text-center">
                              —
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="text-sm space-y-1">
                        <p className="font-bold">Memoranda:</p>
                        <p>Issued upon request of <strong>{requestorName}</strong> for <em>{purpose}</em>.</p>
                        <p className="text-xs text-gray-500 print:text-black">Prepared By: Assessor Office Masso Staff</p>
                      </div>
                    </div>
                  )}

                  {/* Signature Approval Block */}
                  <div className="mt-16 pt-8">
                    <div className="flex justify-between items-end">
                      {/* Receipt & Fee details */}
                      <div className="w-1/2 text-xs space-y-1 leading-normal">
                        <p>Paid under OR No: <strong>{orNumber || '_________________'}</strong></p>
                        <p>Amount: <strong>Php {amountPaid}</strong></p>
                        <p>Doc. Stamp: <strong>Php {docStamp}</strong></p>
                        <p>Issued at: <strong>Lagonglong, Mis. Or.</strong></p>
                        <p>Issued on: <strong>{formattedShortDate}</strong></p>
                      </div>

                      {/* Assessor Signature */}
                      <div className="w-1/2 text-center">
                        <p className="mb-8 text-left italic text-sm">Approved by:</p>
                        <div className="border-b border-black dark:border-white print:border-black w-64 mx-auto mb-1"></div>
                        <p className="font-bold uppercase tracking-wider text-base">{signerName}</p>
                        <p className="text-sm italic">{signerTitle}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
export default Certifications
