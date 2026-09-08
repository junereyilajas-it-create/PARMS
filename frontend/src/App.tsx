import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom'
import './styles/App.css'
import { PropertyAssessments, BuildingDirectory, DashboardView, LandingPage, LoginPage, OperationalIntelligenceReports, PropertyLotManagement, PropertyMapView, PropertyOwnershipTransfer, RegisterPage, Certifications, SystemSettings, ClientDashboard, ClientProperties, ClientGISMap, ClientCertificateRequests, AdminCertificateRequests, ClientProfile } from './pages'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { RegisterPropertyModal } from './components/common/RegisterPropertyModal'
import { MessageModal } from './components/common/MessageModal'
import { CrudModal } from './components/common/CrudModal'
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
  const [userRole, setUserRole] = useState(() => localStorage.getItem('accessor_role') || '')
  const navigate = useNavigate()
  const location = useLocation()

  // Re-read role when navigating to handle login
  useEffect(() => {
    setUserRole(localStorage.getItem('accessor_role') || '')
  }, [location.pathname])

  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('accessor_theme') === 'dark' ? 'dark' : 'light')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('accessor_sidebar_collapsed') === 'true')
  
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
    const isPublicRoute = ['/', '/login', '/register'].includes(location.pathname)
    if (!isPublicRoute && localStorage.getItem('accessor_token')) {
      loadPropertyRecords().catch(() => setPropertyRecords([]))
    }
  }, [location.pathname])

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

  const registerProperty = async (form: { owner: string; street: string; barangay: string; type: string; lot: string; market: string; coordinates: string; document: string; lotNumber: string; titleNumber: string }) => {
    await ensureSession()
    const { data } = await api.post('/properties/register', { owner: form.owner, street: form.street, barangay: form.barangay, type: form.type, lot_area: form.lot, market_value: form.market, coordinates: form.coordinates, document: form.document, lot_number: form.lotNumber, title_number: form.titleNumber })
    await loadPropertyRecords()
    setMessageModal({ title: 'Registration Successful', message: `Property #${data.id} was successfully added to the database.`, type: 'success' })
  }

  const handleNavigate = (page: string) => {
    setSidebarOpen(false)
    switch(page) {
      case 'Landing': navigate('/'); break;
      case 'Login': navigate('/login'); break;
      case 'Register': navigate('/register'); break;
      case 'Dashboard': navigate('/dashboard'); break;
      case 'Properties':
      case 'Lot Management': navigate('/properties'); break;
      case 'Buildings': navigate('/buildings'); break;
      case 'Owners':
      case 'Ownership Transfer': navigate('/owners'); break;
      case 'Assessments': navigate('/assessments'); break;
      case 'GIS Map': navigate('/gis'); break;
      case 'Reports': navigate('/reports'); break;
      case 'Documents': navigate('/documents'); break;
      case 'Certificate Requests': navigate(userRole === 'client' ? '/client/certificate-requests' : '/admin/certificate-requests'); break;
      case 'Settings': navigate('/settings'); break;
      case 'My Properties': navigate('/client/my-properties'); break;
      case 'My Property Map': navigate('/client/gis-map'); break;
      case 'My Requests':
      case 'Request Certificate': navigate('/client/certificate-requests'); break;
      case 'My Profile': navigate('/client/profile'); break;
      default: navigate('/dashboard'); break;
    }
  }

  // Determine active page name for header/sidebar based on path
  const getActivePageName = () => {
    const path = location.pathname
    if (path.includes('/dashboard')) return 'Dashboard'
    if (path.includes('/properties')) return 'Properties'
    if (path.includes('/buildings')) return 'Buildings'
    if (path.includes('/owners')) return 'Owners'
    if (path.includes('/assessments')) return 'Assessments'
    if (path.includes('/gis')) return 'GIS Map'
    if (path.includes('/reports')) return 'Reports'
    if (path.includes('/documents')) return 'Documents'
    if (path.includes('/admin/certificate-requests')) return 'Certificate Requests'
    if (path.includes('/client/my-properties')) return 'My Properties'
    if (path.includes('/client/gis-map')) return 'My Property Map'
    if (path.includes('/client/certificate-requests')) return 'My Requests'
    if (path.includes('/client/profile')) return 'My Profile'
    if (path.includes('/settings')) return 'Settings'
    return 'Dashboard'
  }
  const activePageName = getActivePageName()

  const sharedDashboardProps = { active: activePageName, query, onQueryChange: setQuery, rows: filteredProperties, onNavigate: handleNavigate, onRegister: () => setShowRegisterModal(true), onEdit: editProperty, onDelete: deleteProperty }

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const token = localStorage.getItem('accessor_token')
    if (!token) return <Navigate to="/login" replace />
    return <>{children}</>
  }

  const Layout = () => (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors overflow-hidden">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity" 
          aria-label="Close navigation" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      
      <AppSidebar 
        active={activePageName} 
        onNavigate={handleNavigate} 
        isOpen={sidebarOpen} 
        collapsed={sidebarCollapsed} 
        onCollapse={() => setSidebarCollapsed(value => !value)} 
        userRole={userRole}
      />
      
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 h-screen overflow-y-auto ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <AppHeader 
          active={activePageName} 
          searchValue={query} 
          onSearchChange={setQuery} 
          onNavigate={handleNavigate} 
          theme={theme} 
          onThemeToggle={() => setTheme(value => value === 'light' ? 'dark' : 'light')} 
          onMenu={() => setSidebarOpen(true)} 
        />
        <section className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <Outlet />
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

  return (
    <Routes>
      <Route path="/" element={<LandingPage onNavigate={handleNavigate} />} />
      <Route path="/login" element={<LoginPage onNavigate={handleNavigate} />} />
      <Route path="/register" element={<RegisterPage onNavigate={handleNavigate} />} />
      
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={userRole === 'client' ? <ClientDashboard onNavigate={handleNavigate} /> : <DashboardView {...sharedDashboardProps}/>} />
        <Route path="/properties" element={<PropertyLotManagement query={query} />} />
        <Route path="/buildings" element={<BuildingDirectory query={query} />} />
        <Route path="/owners" element={<PropertyOwnershipTransfer />} />
        <Route path="/assessments" element={<PropertyAssessments />} />
        <Route path="/gis" element={selectedProperty ? <PropertyMapView query={query} onQueryChange={setQuery} rows={filteredProperties} selected={selectedProperty} onSelect={setSelectedProperty}/> : <div>Select a property to view on map.</div>} />
        <Route path="/reports" element={<OperationalIntelligenceReports />} />
        <Route path="/documents" element={<Certifications query={query} onQueryChange={setQuery} rows={filteredProperties} onDelete={deleteProperty} />} />
        <Route path="/admin/certificate-requests" element={<AdminCertificateRequests />} />
        <Route path="/client/my-properties" element={<ClientProperties />} />
        <Route path="/client/gis-map" element={<ClientGISMap />} />
        <Route path="/client/certificate-requests" element={<ClientCertificateRequests />} />
        <Route path="/client/profile" element={<ClientProfile />} />
        <Route path="/settings" element={<SystemSettings />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
