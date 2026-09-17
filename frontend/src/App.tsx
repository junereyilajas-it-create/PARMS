import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom'
import './styles/App.css'
import { PropertyAssessments, BuildingDirectory, LandingPage, LoginPage, OperationalIntelligenceReports, PropertyLotManagement, PropertyMapView, PropertyOwnershipTransfer, RegisterPage, Certifications, SystemSettings, ClientDashboard, ClientProperties, ClientGISMap, ClientCertificateRequests, AdminCertificateRequests, UserProfile, CertificateGenerator, CertificateRecords, AdminDashboard, AssessorDashboard, StaffDashboard, UserManagement, ActivityLogsView, PropertyHistoryView, StaffPropertySearch } from './pages'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { RegisterPropertyModal } from './components/common/RegisterPropertyModal'
import { CrudModal } from './components/common/CrudModal'
import { SystemLoadingScreen } from './components/common/SystemLoadingScreen'
import { useModal } from './contexts/ModalContext'
import api, { ensureSession } from './lib/api'
import type { Property } from './types/property'

function toProperty(row: Record<string, unknown>, index: number): Property {
  const status = String(row.property_status ?? 'pending')
  return {
    id: `PROPERTY-${row.property_id}`,
    owner: String(row.owner ?? 'Unassigned owner'),
    location: String(row.location ?? 'Address not yet mapped'),
    type: String(row.property_type ?? 'Unclassified'),
    assessed: Number(row.assessed_value ?? 0) > 0 ? `₱${Number(row.assessed_value).toLocaleString()}` : 'UNASSESSED',
    market: Number(row.market_value ?? 0) > 0 ? `₱${Number(row.market_value).toLocaleString()}` : 'UNASSESSED',
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
  const { showSuccess, showError, showConfirm } = useModal()
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [editModal, setEditModal] = useState<{ mode: 'edit'; record: any } | null>(null)
  const [propertyRecords, setPropertyRecords] = useState<Property[]>([])
  const filteredProperties = useMemo(() => propertyRecords.filter(property => `${property.id} ${property.owner} ${property.location}`.toLowerCase().includes(query.toLowerCase())), [query, propertyRecords])

  const [isInitializing, setIsInitializing] = useState(true)
  const [initError, setInitError] = useState('')

  const loadPropertyRecords = async () => {
    await ensureSession()
    const { data } = await api.get('/property-records')
    const records: Property[] = (data as Record<string, unknown>[]).map(toProperty)
    setPropertyRecords(records)
  }

  const initializeApp = async () => {
    setIsInitializing(true)
    setInitError('')
    const isPublicRoute = ['/', '/login', '/register'].includes(location.pathname)
    if (!isPublicRoute && localStorage.getItem('accessor_token')) {
      try {
        const role = localStorage.getItem('accessor_role')
        if (role !== 'client') {
          await loadPropertyRecords()
        }
      } catch (e) {
        setInitError('Unable to connect to the server. Please make sure the API server and MySQL are running.')
        return // keep initializing true so error shows
      }
    }
    // Small delay to ensure smooth UI transition and not flash
    setTimeout(() => setIsInitializing(false), 200)
  }

  useEffect(() => {
    initializeApp()
  }, [location.pathname])

  const deleteProperty = async (property: Property) => {
    showConfirm(
      `Are you sure you want to delete ${property.id}?`,
      async () => {
        try {
          await ensureSession()
          const numericId = property.id.replace('PROPERTY-', '')
          await api.delete(`/properties/${numericId}`)
          await loadPropertyRecords()
          showSuccess(`${property.id} was successfully deleted.`)
        } catch (e: any) {
          showError(e.response?.data?.message || 'Could not delete property. It may be referenced by other records.')
        }
      },
      'Confirm Deletion'
    )
  }



  const saveProperty = async (values: Record<string, string>) => {
    try {
      await ensureSession()
      if (editModal?.record) {
        await api.put(`/properties/${editModal.record.property_id}`, values)
        await loadPropertyRecords()
        setEditModal(null)
        showSuccess('Property updated successfully.')
      }
    } catch (e: any) {
      showError('Could not update property.')
    }
  }

  const registerProperty = async (form: { owner: string; street: string; barangay: string; type: string; lot: string; market: string; coordinates: string; document: string; lotNumber: string; titleNumber: string }) => {
    await ensureSession()
    const { data } = await api.post('/properties/register', { owner: form.owner, street: form.street, barangay: form.barangay, type: form.type, lot_area: form.lot, market_value: form.market, coordinates: form.coordinates, document: form.document, lot_number: form.lotNumber, title_number: form.titleNumber })
    await loadPropertyRecords()
    showSuccess(`Property #${data.id} was successfully added to the database.`, 'Registration Successful')
  }

  const handleNavigate = (page: string) => {
    setSidebarOpen(false)
    switch(page) {
      case 'Landing': navigate('/'); break;
      case 'Login': navigate('/login'); break;
      case 'Register': navigate('/register'); break;
      case 'Dashboard': navigate('/dashboard'); break;
      case 'Lots':
      case 'Lot Management': navigate('/lots'); break;
      case 'Buildings':
      case 'Buildings': navigate('/buildings'); break;
      case 'Owners':
      case 'Ownership Transfer': navigate('/owners'); break;
      case 'Assessments': navigate('/assessments'); break;
      case 'GIS Map': navigate('/gis'); break;
      case 'Reports': navigate('/reports'); break;
      case 'Documents': navigate('/documents'); break;
      case 'Certification Requests':
      case 'Certificate Requests': navigate(userRole === 'client' ? '/client/certificate-requests' : '/admin/certificate-requests'); break;
      case 'Generate Certificate': navigate('/certificates/generate'); break;
      case 'Certificate Records': navigate('/certificates/records'); break;
      case 'Settings': navigate('/settings'); break;
      case 'My Properties': navigate('/client/my-properties'); break;
      case 'My Property Map': navigate('/client/gis-map'); break;
      case 'My Requests':
      case 'Request Certificate': navigate('/client/certificate-requests'); break;
      case 'My Profile': navigate('/profile'); break;
      case 'User Management': navigate('/users'); break;
      case 'Activity Logs': navigate('/logs'); break;
      case 'Property History': navigate('/property-history'); break;
      case 'Property Search': navigate('/search'); break;
      default: navigate('/dashboard'); break;
    }
  }

  // Determine active page name for header/sidebar based on path
  const getActivePageName = () => {
    const path = location.pathname
    if (path.includes('/dashboard')) return 'Dashboard'
    if (path.includes('/lots')) return 'Lots'
    if (path.includes('/buildings')) return 'Buildings'
    if (path.includes('/admin/certificate-requests')) return 'Certification Requests'
    if (path.includes('/owners')) return 'Owners'
    if (path.includes('/assessments')) return 'Assessments'
    if (path.includes('/gis')) return 'GIS Map'
    if (path.includes('/reports')) return 'Reports'
    if (path.includes('/documents')) return 'Documents'
    if (path.includes('/certificates/generate')) return 'Generate Certificate'
    if (path.includes('/certificates/records')) return 'Certificate Records'
    if (path.includes('/admin/certificate-requests')) return 'Certificate Requests'
    if (path.includes('/client/my-properties')) return 'My Properties'
    if (path.includes('/client/gis-map')) return 'My Property Map'
    if (path.includes('/client/certificate-requests')) return 'My Requests'
    if (path.includes('/profile')) return 'My Profile'
    if (path.includes('/users')) return 'User Management'
    if (path.includes('/logs')) return 'Activity Logs'
    if (path.includes('/property-history')) return 'Property History'
    if (path.includes('/search')) return 'Property Search'
    if (path.includes('/settings')) return 'Settings'
    return 'Dashboard'
  }
  const activePageName = getActivePageName()

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
    </div>
  )

  if (isInitializing) {
    return <SystemLoadingScreen error={initError} onRetry={initializeApp} />
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage onNavigate={handleNavigate} />} />
      <Route path="/login" element={<LoginPage onNavigate={handleNavigate} />} />
      <Route path="/register" element={<RegisterPage onNavigate={handleNavigate} />} />
      
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={
          userRole === 'client' ? <ClientDashboard onNavigate={handleNavigate} /> :
          userRole === 'admin' ? <AdminDashboard /> :
          userRole === 'assessor' ? <AssessorDashboard /> :
          <StaffDashboard />
        } />
        <Route path="/lots" element={<PropertyLotManagement query={query} />} />
        <Route path="/buildings" element={<BuildingDirectory query={query} />} />
        <Route path="/building-properties" element={<BuildingDirectory query={query} />} />
        <Route path="/owners" element={<PropertyOwnershipTransfer />} />
        <Route path="/assessments" element={<PropertyAssessments />} />
        <Route path="/gis" element={<PropertyMapView />} />
        <Route path="/reports" element={<OperationalIntelligenceReports />} />
        <Route path="/documents" element={<Certifications query={query} onQueryChange={setQuery} rows={filteredProperties} onDelete={deleteProperty} />} />
        <Route path="/certificates/generate" element={<CertificateGenerator />} />
        <Route path="/certificates/records" element={<CertificateRecords />} />
        <Route path="/admin/certificate-requests" element={<AdminCertificateRequests />} />
        <Route path="/client/my-properties" element={<ClientProperties />} />
        <Route path="/client/gis-map" element={<ClientGISMap />} />
        <Route path="/client/certificate-requests" element={<ClientCertificateRequests />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/logs" element={<ActivityLogsView />} />
        <Route path="/property-history" element={<PropertyHistoryView />} />
        <Route path="/search" element={<StaffPropertySearch />} />
        <Route path="/settings" element={<SystemSettings />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
