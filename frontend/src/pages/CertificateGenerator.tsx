import { useState, useEffect } from 'react'
import PrintableCertificate from '../components/PrintableCertificate'
import type { CertificatePropertyInfo } from '../types/Certificate'
import { Search, Printer, ArrowLeft } from 'lucide-react'

export interface Owner {
  owner_id: number
  first_name: string
  middle_name: string | null
  last_name: string
  contact_number: string | null
  email: string | null
}

export default function CertificateGenerator() {
  const token = localStorage.getItem('accessor_token')
  const [owners, setOwners] = useState<Owner[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  
  // Form State
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null)
  const [properties, setProperties] = useState<CertificatePropertyInfo[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | ''>('')
  const [certificateType, setCertificateType] = useState<string>('Template 1: Standard Certification')
  const [requestorName, setRequestorName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [certificateDate, setCertificateDate] = useState(new Date().toISOString().split('T')[0])
  
  // UI State
  const [isPreview, setIsPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/owners`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setOwners(data)
        }
      } catch (err) {
        console.error('Failed to fetch owners:', err)
      }
    }
    fetchOwners()
  }, [token])

  useEffect(() => {
    if (selectedOwner) {
      const fetchProperties = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/generator/owners/${selectedOwner.owner_id}/properties`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            const data = await res.json()
            setProperties(data)
            // If they have properties, auto-select the first one by default if it's Template 1
            if (data.length > 0) {
              setSelectedPropertyId(data[0].property_id)
            } else {
              setSelectedPropertyId('')
            }
          }
        } catch (err) {
          console.error('Failed to fetch properties:', err)
        }
      }
      fetchProperties()
    } else {
      setProperties([])
      setSelectedPropertyId('')
    }
  }, [selectedOwner, token])

  const filteredOwners = searchTerm.trim() 
    ? owners.filter(o => `${o.first_name} ${o.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
    : []

  const handleGeneratePreview = () => {
    setError('')
    if (!selectedOwner) return setError('Please select an owner.')
    
    // For template 1, we require a property. For template 2 (List of properties), we don't strictly require one selected.
    if (certificateType.includes('Template 1') && properties.length === 0) {
      return setError('Selected owner has no property records.')
    }
    
    if (certificateType.includes('Template 1') && !selectedPropertyId) {
      return setError('Please select a property.')
    }
    
    if (!requestorName.trim()) return setError('Please enter a requestor name.')
    if (!purpose.trim()) return setError('Please enter a purpose.')
    
    setIsPreview(true)
  }

  const handleSaveAndPrint = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/generator/certificates`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          certificate_type: certificateType,
          owner_id: selectedOwner?.owner_id,
          property_id: selectedPropertyId || null,
          requestor_name: requestorName,
          purpose: purpose
        })
      })
      if (res.ok) {
        window.print()
      } else {
        const errorData = await res.json()
        alert(errorData.message || 'Failed to save certificate record.')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred while saving.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isPreview) {
    const selectedProperty = properties.find(p => String(p.property_id) === String(selectedPropertyId))
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between no-print mb-4">
          <button className="flex items-center px-4 py-2 border rounded-md hover:bg-slate-50 transition" onClick={() => setIsPreview(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Editor
          </button>
          <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50" onClick={handleSaveAndPrint} disabled={isSaving}>
            <Printer className="w-4 h-4 mr-2" /> 
            {isSaving ? 'Saving...' : 'Save & Print Certificate'}
          </button>
        </div>

        <div className="printable-certificate-container bg-white p-8 rounded-lg shadow-sm">
          <PrintableCertificate 
            type={certificateType}
            owner={selectedOwner!}
            properties={properties}
            selectedProperty={selectedProperty}
            requestorName={requestorName}
            purpose={purpose}
            date={certificateDate}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Generate Certificate</h1>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold">Certificate Details</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Certificate Type</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value)}
              >
                <option value="Template 1: Standard Certification">Template 1: Standard Certification</option>
                <option value="Template 2: List of Properties">Template 2: List of Properties</option>
                <option value="Template 3: Assessment Certification">Template 3: Assessment Certification</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Certificate Date</label>
              <input 
                type="date" 
                className="w-full h-10 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={certificateDate}
                onChange={(e) => setCertificateDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 relative">
            <label className="text-sm font-medium">Search Owner</label>
            {!selectedOwner ? (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Type to search owner..."
                  className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && filteredOwners.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredOwners.map(owner => (
                      <div 
                        key={owner.owner_id}
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                        onClick={() => {
                          setSelectedOwner(owner)
                          setSearchTerm('')
                        }}
                      >
                        <div className="font-medium">{owner.first_name} {owner.last_name}</div>
                        <div className="text-slate-500 text-xs">{owner.contact_number || owner.email || 'No contact info'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-md bg-slate-50">
                <div className="font-medium">{selectedOwner.first_name} {selectedOwner.last_name}</div>
                <button className="text-sm text-green-600 hover:text-green-700 font-medium" onClick={() => setSelectedOwner(null)}>Change Owner</button>
              </div>
            )}
          </div>

          {selectedOwner && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Property</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                disabled={certificateType.includes('Template 2')}
              >
                <option value="">-- Select a Property --</option>
                {properties.map(p => (
                  <option key={p.property_id} value={p.property_id}>
                    T/D No: {p.tax_declaration_no || 'N/A'} - {p.location} ({p.property_type_name})
                  </option>
                ))}
              </select>
              {certificateType.includes('Template 2') && (
                <p className="text-xs text-slate-500 mt-1">For Template 2, all properties belonging to this owner will be listed.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Requestor Name</label>
              <input 
                type="text" 
                placeholder="e.g. Ms. Sarah Marie Abaao"
                className="w-full h-10 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={requestorName}
                onChange={(e) => setRequestorName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Purpose</label>
              <input 
                type="text" 
                placeholder="e.g. Legal Purpose"
                className="w-full h-10 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition" onClick={handleGeneratePreview}>
          Generate Preview
        </button>
      </div>
    </div>
  )
}
