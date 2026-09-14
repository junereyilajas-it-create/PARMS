import type { Owner } from '../pages/CertificateGenerator'
import type { CertificatePropertyInfo } from '../types/Certificate'
import { format } from 'date-fns'
import '../styles/PrintCertificate.css'

interface PrintableCertificateProps {
  type: string
  owner: Owner
  properties: CertificatePropertyInfo[]
  selectedProperty?: CertificatePropertyInfo
  requestorName: string
  purpose: string
  date: string
}

export default function PrintableCertificate({ 
  type, 
  owner, 
  properties, 
  selectedProperty, 
  requestorName, 
  purpose, 
  date 
}: PrintableCertificateProps) {

  const formattedDate = format(new Date(date), 'do \'day of\' MMMM, yyyy')
  const shortDate = format(new Date(date), 'MMMM dd, yyyy')
  const formattedOwnerName = `${owner.first_name} ${owner.middle_name ? owner.middle_name + ' ' : ''}${owner.last_name}`.toUpperCase()

  const renderHeader = (includeDate = false) => (
    <div className="text-center mb-8">
      <p className="text-sm">Republic of the Philippines</p>
      <p className="text-sm">Province of Misamis Oriental</p>
      <p className="text-sm font-bold">MUNICIPALITY OF LAGONGLONG</p>
      <div className="my-2 border-b-2 border-black w-full"></div>
      <h2 className="text-xl font-bold mt-4 tracking-wider">Office of the Municipal Assessor</h2>
      {includeDate && <p className="text-sm mt-4 text-left font-bold">{shortDate}</p>}
    </div>
  )

  const renderSignatures = (signerName = 'PINKY T. BAGONGON, REA', title = 'Municipal Assessor') => (
    <div className="mt-16">
      <div className="flex justify-between">
        <div className="w-1/2">
          <div className="mt-16 text-sm leading-tight">
            <p>Paid under OR No: _________________</p>
            <p>Amount: Php _________________</p>
            <p>Doc. Stamp: Php _________________</p>
            <p>Issued at: Lagonglong, Mis. Or.</p>
            <p>Issued On: _________________</p>
          </div>
        </div>
        <div className="w-1/2 text-center mt-12">
          <p className="mb-8 text-left italic">Approved by:</p>
          <div className="border-b border-black w-64 mx-auto mb-1"></div>
          <p className="font-bold uppercase">{signerName}</p>
          <p className="text-sm italic">{title}</p>
        </div>
      </div>
    </div>
  )

  if (type.includes('Template 3')) {
    const prop = selectedProperty
    return (
      <div className="certificate-page">
        <h3 className="text-center text-lg font-bold underline mb-8 mt-8 uppercase tracking-widest">REAL PROPERTY HISTORICAL OWNERSHIP</h3>
        
        <div className="mb-6 text-sm grid grid-cols-2 gap-4">
          <div>
            <p>Survey Lot No. <strong>____________________</strong></p>
            <p>OCT / TCT: <strong>____________________</strong></p>
            <p>Location of Property: <strong>{prop?.location || '____________________'}</strong></p>
            <p>PIN: <strong>____________________</strong></p>
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-xs mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-center">T. D No.</th>
              <th className="border border-black p-2 text-center">DECLARANT</th>
              <th className="border border-black p-2 text-center">KIND OF LAND</th>
              <th className="border border-black p-2 text-center">AREA</th>
              <th className="border border-black p-2 text-center">ASSESSED VALUE</th>
              <th className="border border-black p-2 text-center">TAX EFFECTIVITY</th>
              <th className="border border-black p-2 text-center">CANCELLED BY TAX DECLARATION NUMBER</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 text-center">{prop?.tax_declaration_no || 'N/A'}</td>
              <td className="border border-black p-2">{formattedOwnerName}</td>
              <td className="border border-black p-2 text-center">{prop?.classification_name}</td>
              <td className="border border-black p-2 text-right">{prop?.lot_area || prop?.floor_area || 0}</td>
              <td className="border border-black p-2 text-right">{prop?.assessed_value?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2}) || '0.00'}</td>
              <td className="border border-black p-2 text-center">EXISTING</td>
              <td className="border border-black p-2 text-center"></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-8">
          <p className="font-bold mb-2 text-sm">Memoranda:</p>
          <p className="text-sm">Prepared By: ____________________</p>
          <p className="text-sm italic">Masso Staff</p>
        </div>

        {renderSignatures()}
      </div>
    )
  }

  if (type.includes('Template 2')) {
    return (
      <div className="certificate-page">
        {renderHeader(true)}
        
        <h3 className="text-center text-lg font-bold underline mb-8 mt-4 tracking-widest">C E R T I F I C A T I O N</h3>
        
        <div className="mb-6 text-justify leading-loose">
          <p>TO WHOM IT MAY CONCERN:</p>
          <p className="mt-4 indent-8">
            THIS IS TO CERTIFY that according to the records in this Office, <strong>{formattedOwnerName}</strong>, 
            resident of {owner.contact_number ? 'their registered address' : 'Lagonglong, Mis. Or.'} has have real properties declared in her/his name for taxation purposes in this municipality as follows:
          </p>
        </div>

        <table className="w-full border-collapse border border-black text-sm mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-center">T/D NO.</th>
              <th className="border border-black p-2 text-center">LOCATION OF PROPERTY</th>
              <th className="border border-black p-2 text-center">KIND OF LAND</th>
              <th className="border border-black p-2 text-center">AREA</th>
              <th className="border border-black p-2 text-center">ASSESSED VALUE</th>
            </tr>
          </thead>
          <tbody>
            {properties.map(p => (
              <tr key={p.property_id}>
                <td className="border border-black p-2 text-center">{p.tax_declaration_no || 'N/A'}</td>
                <td className="border border-black p-2">{p.location}</td>
                <td className="border border-black p-2 text-center">{p.classification_name}</td>
                <td className="border border-black p-2 text-right">{p.lot_area || p.floor_area || 0}</td>
                <td className="border border-black p-2 text-right">{p.assessed_value?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2}) || '0.00'}</td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={5} className="border border-black p-4 text-center italic">No property records found.</td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="text-center mb-8">XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</p>

        <div className="mb-8 text-justify leading-loose">
          <p>
            Issued upon request of <strong>{requestorName}</strong>.
          </p>
          <p>
            Purpose: {purpose}
          </p>
        </div>

        {renderSignatures('MARIE MAE P. UBALDE', 'OIC- Municipal Assessor')}
      </div>
    )
  }

  // Template 1 (Standard Certification)
  const prop = selectedProperty
  
  return (
    <div className="certificate-page">
      {renderHeader()}
      
      <h3 className="text-center text-lg font-bold mb-8 mt-8 tracking-widest">C E R T I F I C A T I O N</h3>
      
      <div className="mb-8 text-justify leading-loose">
        <p>TO WHOM IT MAY CONCERN:</p>
        <p className="mt-4 indent-8">
          THIS IS TO CERTIFY THAT as per records file in this Office, a parcel of land 
          declared in the name of <strong>{formattedOwnerName}</strong> 
          under Tax Declaration No. <strong>{prop?.tax_declaration_no || '____________________'}</strong> 
          (PIN-____________________) 
          situated at Barangay <strong>{prop?.barangay_name || '____________________'}</strong>, 
          {prop?.municipality_name || 'Lagonglong'}, {prop?.province_name || 'Misamis Oriental'} 
          is classified as <strong>{prop?.classification_name || '____________________'}</strong> having no improvements.
        </p>
        <p className="indent-8 mt-4">
          THIS IS TO CERTIFY further that the Tax Declaration Number written above is LATEST and EXISTING.
        </p>
        <p className="indent-8 mt-4">
          This certification is issued upon request of {requestorName}, whatever legal purpose it may serve.
        </p>
        <p className="indent-8 mt-4">
          Done this {formattedDate} at {prop?.municipality_name || 'Lagonglong'}, {prop?.province_name || 'Misamis Oriental'}, Philippines.
        </p>
      </div>

      {renderSignatures()}
    </div>
  )
}
