import { useEffect, useMemo, useState } from 'react'
import './styles/App.css'
// import './styles/WorkspaceTheme.css'
// import './styles/WorkspaceFilters.css'
// import './styles/SidebarSizing.css'
// import './styles/WorkspaceLayout.css'
// import './styles/WorkspacePolish.css'
// import './styles/HeaderSidebarRefinement.css'
// import './styles/ReferenceHeader.css'
// import './styles/ProfilePolish.css'
// import './styles/DashboardHeaderColor.css'
// import './styles/DesignSystem.css'
import { AiPropertyValuation, BuildingDirectory, DashboardView, LandingPage, LoginPage, OperationalIntelligenceReports, PropertyLotManagement, PropertyMapView, PropertyOwnershipTransfer, RegisterPage, Certifications, SystemSettings } from './pages'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { RegisterPropertyModal } from './components/common/RegisterPropertyModal'
import { MessageModal } from './components/common/MessageModal'
import { CrudModal, type CrudField } from './components/common/CrudModal'
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('accessor_theme') === 'dark' ? 'dark' : 'light')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('accessor_sidebar_collapsed') === 'true')
  useEffect(() => { localStorage.setItem('active_page', activePage) }, [activePage])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('accessor_theme', theme)
  }, [theme])
  useEffect(() => { localStorage.setItem('accessor_sidebar_collapsed', String(sidebarCollapsed)) }, [sidebarCollapsed])
  const [query, setQuery] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [messageModal, setMessageModal] = useState<{title: string, message: string, type: 'success' | 'error' | 'confirm', onConfirm?: () => void} | null>(null)
  const [editModal, setEditModal] = useState<{ mode: 'edit'; record: any } | null>(null)
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

  const editProperty = async (property: Property) => {
    try {
      await ensureSession()
      const numericId = property.id.replace('PROPERTY-', '')
      const { data } = await api.get(`/properties/${numericId}`)
      setEditModal({ mode: 'edit', record: data })
    } catch (e: any) {
      setMessageModal({ title: 'Error', message: 'Could not load property details.', type: 'error' })
    }
  }

  const saveProperty = async (values: Record<string, string>) => {
    try {
      await ensureSession()
      if (editModal?.record) {
        await api.put(`/properties/${editModal.record.property_id}`, values)
        await loadPropertyRecords()
        setEditModal(null)
        setMessageModal({ title: 'Success', message: 'Property updated successfully.', type: 'success' })
      }
    } catch (e: any) {
      setMessageModal({ title: 'Error', message: 'Could not update property.', type: 'error' })
    }
  }

  const sharedDashboardProps = { active: activePage, query, onQueryChange: setQuery, rows: filteredProperties, onNavigate: setActivePage, onRegister: () => setShowRegisterModal(true), onEdit: editProperty, onDelete: deleteProperty }
  const page = (() => {
    switch (activePage) {
      case 'Properties': return <PropertyLotManagement query={query} />
      case 'Buildings': return <BuildingDirectory query={query} />
      case 'Owners': return <PropertyOwnershipTransfer />
      case 'Assessments': return <AiPropertyValuation />
      case 'GIS Map': return selectedProperty && <PropertyMapView query={query} onQueryChange={setQuery} rows={filteredProperties} selected={selectedProperty} onSelect={setSelectedProperty}/>
      case 'Reports': return <OperationalIntelligenceReports />
      case 'Documents': return <Certifications query={query} onQueryChange={setQuery} rows={filteredProperties} onDelete={deleteProperty} />
      case 'Settings': return <SystemSettings />
      default: return <DashboardView {...sharedDashboardProps}/>
    }
  })()

  const registerProperty = async (form: { owner: string; street: string; barangay: string; type: string; lot: string; market: string; coordinates: string; document: string; lotNumber: string; titleNumber: string }) => {
    await ensureSession()
    const { data } = await api.post('/properties/register', { owner: form.owner, street: form.street, barangay: form.barangay, type: form.type, lot_area: form.lot, market_value: form.market, coordinates: form.coordinates, document: form.document, lot_number: form.lotNumber, title_number: form.titleNumber })
    await loadPropertyRecords()
    setMessageModal({ title: 'Registration Successful', message: `Property #${data.id} was successfully added to the database.`, type: 'success' })
  }

  const navigate = (page: string) => { setActivePage(page); setSidebarOpen(false) }
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors overflow-hidden">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity" 
          aria-label="Close navigation" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      
      <AppSidebar 
        active={activePage} 
        onNavigate={navigate} 
        isOpen={sidebarOpen} 
        collapsed={sidebarCollapsed} 
        onCollapse={() => setSidebarCollapsed(value => !value)} 
      />
      
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 h-screen overflow-y-auto ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <AppHeader 
          active={activePage} 
          searchValue={query} 
          onSearchChange={setQuery} 
          onNavigate={navigate} 
          theme={theme} 
          onThemeToggle={() => setTheme(value => value === 'light' ? 'dark' : 'light')} 
          onMenu={() => setSidebarOpen(true)} 
        />
        <section className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {page}
        </section>
      </main>

      {showRegisterModal && <RegisterPropertyModal close={() => setShowRegisterModal(false)} onSave={registerProperty} />}
      {editModal && <CrudModal title="Edit Property" fields={[
        { key: 'owner_id', label: 'Owner ID', type: 'number' },
        { key: 'address_id', label: 'Address ID', type: 'number' },
        { key: 'property_type_id', label: 'Property Type ID', type: 'number' },
        { key: 'classification_id', label: 'Classification ID', type: 'number' },
        { key: 'property_status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] }
      ]} record={editModal.record} onClose={() => setEditModal(null)} onSave={saveProperty} />}
      {messageModal && <MessageModal {...messageModal} onClose={() => setMessageModal(null)} />}
    </div>
  )
}
export default App
