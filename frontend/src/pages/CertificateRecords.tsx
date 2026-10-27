import { useNavigate } from 'react-router-dom'
import { CertificateTable } from '../components/common/CertificateTable'

export default function CertificateRecords() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 fade-in">
      <div>
        <span className="eyebrow text-xs uppercase font-bold tracking-widest text-green-700 dark:text-green-500">
          DOCUMENT SERVICES
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-green-800 dark:text-green-400 mt-1">
          Certificate Records
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Browse, search, review, and print official property certifications and document records issued by the Assessor's Office.
        </p>
      </div>

      <CertificateTable
        onOpenWorkspace={(propertyId) => navigate(`/documents?propertyId=${propertyId}`)}
        onIssueNewCertificate={() => navigate('/documents')}
      />
    </div>
  )
}

