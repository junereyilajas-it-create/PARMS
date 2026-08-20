import { useEffect, useMemo, useState } from 'react'
import './styles/App.css'
import './styles/WorkspaceTheme.css'
import './styles/WorkspaceFilters.css'
import './styles/SidebarSizing.css'
import './styles/WorkspaceLayout.css'
import './styles/WorkspacePolish.css'
import './styles/HeaderSidebarRefinement.css'
import './styles/ReferenceHeader.css'
import './styles/ProfilePolish.css'
import './styles/DashboardHeaderColor.css'
import { AiPropertyValuation, BuildingDirectory, DashboardView, LandingPage, LoginPage, OperationalIntelligenceReports, PropertyLotManagement, PropertyMapView, PropertyOwnershipTransfer, RegisterPage, Certifications } from './pages'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { RegisterPropertyModal } from './components/common/RegisterPropertyModal'
import { MessageModal } from './components/common/MessageModal'
import api, { ensureSession } from './lib/api'
import type { Property } from './types/property'

function toProperty(row: Record<string, unknown>, index: number): Property {
  const status = String(row.property_status ?? 'pending')
  return {
    id: `PROPERTY-${row.property_id}`,
    owner: String(row.owner ?? 'Unassigned owner'),
    location: String(row.location ?? 'Address not yet mapped'),
    type: String(row.property_type ?? 'Unclassified'),
    assessed: `₱${Number(row.assessed_value ?? 0).toLocaleString()}`,
    market: `₱${Number(row.market_value ?? 0).toLocaleString()}`,
    status: `${status[0].toUpperCase()}${status.slice(1)}` as Property['status'],
    x: typeof row.longitude === 'number' ? 50 + ((Number(row.longitude) % 1) * 40) : 20 + ((index * 17) % 60),
    y: typeof row.latitude === 'number' ? 50 - ((Number(row.latitude) % 1) * 40) : 20 + ((index * 23) % 60),
    latitude: typeof row.latitude === 'number' ? Number(row.latitude) : null,
    longitude: typeof row.longitude === 'number' ? Number(row.longitude) : null,
    color: '#2864d7',
  }
}

function App() {
  const [activePage, setActivePage] = useState(() => localStorage.getItem('active_page') || 'Landing')
  useEffect(() => { localStorage.setItem('active_page', activePage) }, [activePage])
  const [query, setQuery] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [messageModal, setMessageModal] = useState<{title: string, message: string, type: 'success' | 'error' | 'confirm', onConfirm?: () => void} | null>(null)
  const [propertyRecords, setPropertyRecords] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const filteredProperties = useMemo(() => propertyRecords.filter(property => `${property.id} ${property.owner} ${property.location}`.toLowerCase().includes(query.toLowerCase())), [query, propertyRecords])

  const loadPropertyRecords = async () => {
    await ensureSession()
    const { data } = await api.get('/property-records')
    const records: Property[] = (data as Record<string, unknown>[]).map(toProperty)
    setPropertyRecords(records)
    setSelectedProperty(current => records.find(record => record.id === current?.id) ?? records[0] ?? null)
  }

  useEffect(() => {
    if (!['Landing', 'Login', 'Register'].includes(activePage) && localStorage.getItem('accessor_token')) {
      loadPropertyRecords().catch(() => setPropertyRecords([]))
    }
  }, [activePage])

  if (activePage === 'Landing') return <LandingPage onNavigate={setActivePage} />
  if (activePage === 'Login') return <LoginPage onNavigate={setActivePage} />
  if (activePage === 'Register') return <RegisterPage onNavigate={setActivePage} />

  const deleteProperty = async (property: Property) => {
    setMessageModal({
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete ${property.id}?`,
      type: 'confirm',
      onConfirm: async () => {
        setMessageModal(null)
        try {
          await ensureSession()
          const numericId = property.id.replace('PROPERTY-', '')
          await api.delete(`/properties/${numericId}`)
          await loadPropertyRecords()
          setMessageModal({ title: 'Success', message: `${property.id} was successfully deleted.`, type: 'success' })
        } catch (e: any) {
          setMessageModal({ title: 'Error', message: e.response?.data?.message || 'Could not delete property. It may be referenced by other records.', type: 'error' })
        }
      }
    })
  }

  const sharedDashboardProps = { active: activePage, query, onQueryChange: setQuery, rows: filteredProperties, onNavigate: setActivePage, onRegister: () => setShowRegisterModal(true), onDelete: deleteProperty }
  const page = (() => {
    switch (activePage) {
      case 'Lot Management': return <PropertyLotManagement query={query} />
      case 'Ownership Transfer': return <PropertyOwnershipTransfer />
      case 'Property Valuation': return <AiPropertyValuation />
      case 'Building Directory': return <BuildingDirectory query={query} />
      case 'GIS Map': return selectedProperty && <PropertyMapView query={query} onQueryChange={setQuery} rows={filteredProperties} selected={selectedProperty} onSelect={setSelectedProperty}/>
      case 'Reports': return <OperationalIntelligenceReports />
      case 'Certifications': return <Certifications query={query} onQueryChange={setQuery} rows={filteredProperties} onDelete={deleteProperty} />
      default: return <DashboardView {...sharedDashboardProps}/>
    }
  })()

  const registerProperty = async (form: { owner: string; street: string; barangay: string; type: string; lot: string; market: string; coordinates: string; document: string; lotNumber: string; titleNumber: string }) => {
    await ensureSession()
    const { data } = await api.post('/properties/register', { owner: form.owner, street: form.street, barangay: form.barangay, type: form.type, lot_area: form.lot, market_value: form.market, coordinates: form.coordinates, document: form.document, lot_number: form.lotNumber, title_number: form.titleNumber })
    await loadPropertyRecords()
    setMessageModal({ title: 'Registration Successful', message: `Property #${data.id} was successfully added to the database.`, type: 'success' })
  }

  return <div className="app-shell"><AppSidebar active={activePage} onNavigate={setActivePage}/><main><AppHeader active={activePage} searchValue={query} onSearchChange={setQuery} onNavigate={setActivePage} /><section className="content">{page}</section></main>{showRegisterModal && <RegisterPropertyModal close={() => setShowRegisterModal(false)} onSave={registerProperty}/>}{messageModal && <MessageModal {...messageModal} onClose={() => setMessageModal(null)} />}</div>
}
export default App
