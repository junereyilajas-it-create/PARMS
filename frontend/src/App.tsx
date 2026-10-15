import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom'
import './styles/App.css'
import { PropertyAssessments, BuildingDirectory, LandingPage, LoginPage, OperationalIntelligenceReports, PropertyLotManagement, PropertyMapView, PropertyOwnershipTransfer, RegisterPage, ForgotPasswordPage, ResetPasswordPage, Certifications, SystemSettings, ClientDashboard, ClientProperties, ClientGISMap, ClientCertificateRequests, AdminCertificateRequests, AccountSettings, HelpSupport, CertificateGenerator, CertificateRecords, AdminDashboard, AssessorDashboard, StaffDashboard, UserManagement, ActivityLogsView, PropertyHistoryView, StaffPropertySearch, SuperAdminDashboard, RoleManagement, AssessmentAssignments, AssessmentPermissionRequests, BlueprintScanner, AssessorPropertiesView } from './pages'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { RegisterPropertyModal } from './components/common/RegisterPropertyModal'
import { IsolatedThemeWrapper } from './components/common/IsolatedThemeWrapper'
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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('accessor_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

const RoleProtectedRoute = ({ allowedRoles, children, userRole }: { allowedRoles: string[], children: React.ReactNode, userRole: string }) => {
  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-green-600">403 Forbidden</h2>
          <p className="text-gray-600 dark:text-gray-400">You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
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
    const isIsolated = location.pathname === '/' || location.pathname === '/login'
    if (isIsolated) {
      document.documentElement.dataset.theme = 'light'
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
    localStorage.setItem('accessor_theme', theme)
  }, [theme, location.pathname])
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
      } catch (e: any) {
        if (e.response?.status === 401 || e.response?.status === 403) {
          localStorage.removeItem('accessor_token');
          localStorage.removeItem('accessor_role');
          navigate('/login');
          setIsInitializing(false);
          return;
        }
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
    const currentRole = localStorage.getItem('accessor_role') || userRole;
    setUserRole(currentRole);
    switch (page) {
      case 'Landing': navigate('/'); break;
      case 'Login': navigate('/login'); break;
      case 'Register': navigate('/register'); break;
      case 'ForgotPassword': navigate('/forgot-password'); break;
      case 'ResetPassword': navigate('/reset-password'); break;
      case 'Dashboard':
        if (currentRole === 'super_admin') {
          navigate('/super-admin/dashboard');
        } else {
          navigate('/dashboard');
        }
        break;
      case 'My Properties': navigate('/client/my-properties'); break;
      case 'My GIS Property': navigate('/client/gis-map'); break;
      case 'My Assessments': navigate('/client/my-assessments'); break;
      case 'Reports': navigate('/reports'); break;
      case 'User Management': navigate('/users'); break;
      case 'Roles & Permissions': navigate('/roles'); break;
      case 'Lots': navigate('/lots'); break;
      case 'Buildings': navigate('/buildings'); break;
      case 'Owners': navigate('/owners'); break;
      case 'Blueprint Scanner': navigate('/scanner'); break;
      case 'Properties':
      case 'Assigned Properties': navigate('/properties'); break;
      case 'GIS Map': navigate('/gis'); break;
      case 'Assessments': navigate('/assessments'); break;
      case 'Assessment Assignments': navigate('/assessment-assignments'); break;
      case 'My Requests': navigate('/my-requests'); break;
      case 'Assessment Requests':
      case 'Permission Requests':
        navigate(currentRole === 'assessor' ? '/my-requests' : '/permission-requests');
        break;
      case 'Certificates': navigate('/documents'); break;
      case 'Certificate Requests':
        navigate(currentRole === 'client' || currentRole === 'owner' ? '/client/certificate-requests' : '/admin/certificate-requests');
        break;
      case 'Assigned Tasks': navigate('/assigned-tasks'); break;
      case 'Activity Logs': navigate('/logs'); break;
      case 'System Settings': navigate('/settings'); break;

      // Preserve other internal mappings
      case 'Account Settings': navigate('/account-settings'); break;
      case 'Help & Support': navigate('/help-support'); break;
      case 'Property History': navigate('/property-history'); break;
      case 'Property Search': navigate('/search'); break;
      default: navigate('/dashboard'); break;
    }
  }

  // Determine active page name for header/sidebar based on path
  const getActivePageName = () => {
    const path = location.pathname

    // Ordered from most specific to least specific
    if (path.startsWith('/assessment-assignments')) return 'Assessment Assignments'
    if (path.startsWith('/my-requests')) return 'My Requests'
    if (path.startsWith('/permission-requests') || path.startsWith('/assessment-requests')) {
      return userRole === 'assessor' ? 'My Requests' : 'Permission Requests'
    }
    if (path.startsWith('/assessments')) return 'Assessments'

    if (path.startsWith('/client/my-properties')) return 'My Properties'
    if (path.startsWith('/client/gis-map')) return 'My GIS Property'
    if (path.startsWith('/client/my-assessments')) return 'My Assessments'
    if (path.startsWith('/reports')) return 'Reports'
    if (path.startsWith('/users')) return 'User Management'
    if (path.startsWith('/roles')) return 'Roles & Permissions'
    if (path.startsWith('/lots')) return 'Lots'
    if (path.startsWith('/buildings')) return 'Buildings'
    if (path.startsWith('/owners')) return 'Owners'
    if (path.startsWith('/scanner')) return 'Blueprint Scanner'
    if (path.startsWith('/properties') || path.startsWith('/assigned-properties')) return 'Properties'
    if (path.startsWith('/gis')) return 'GIS Map'

    if (path.startsWith('/documents') || path.startsWith('/certificates/generate') || path.startsWith('/certificates/records')) return 'Certificates'
    if (path.startsWith('/admin/certificate-requests') || path.startsWith('/client/certificate-requests')) return 'Certificate Requests'

    if (path.startsWith('/assigned-tasks')) return 'Assigned Tasks'
    if (path.startsWith('/logs')) return 'Activity Logs'
    if (path.startsWith('/settings')) return 'System Settings'

    if (path.startsWith('/account-settings')) return 'Account Settings'
    if (path.startsWith('/help-support')) return 'Help & Support'
    if (path.startsWith('/property-history')) return 'Property History'
    if (path.startsWith('/search')) return 'Property Search'

    if (path.startsWith('/dashboard') || path.startsWith('/super-admin/dashboard')) return 'Dashboard'

    return 'Dashboard'
  }
  const activePageName = getActivePageName()

  if (isInitializing) {
    return <SystemLoadingScreen error={initError} onRetry={initializeApp} />
  }

  return (
    <Routes>
      <Route path="/" element={<IsolatedThemeWrapper><LandingPage onNavigate={handleNavigate} /></IsolatedThemeWrapper>} />
      <Route path="/login" element={<IsolatedThemeWrapper><LoginPage onNavigate={handleNavigate} /></IsolatedThemeWrapper>} />
      <Route path="/register" element={<RegisterPage onNavigate={handleNavigate} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage onNavigate={handleNavigate} />} />
      <Route path="/reset-password" element={<ResetPasswordPage onNavigate={handleNavigate} />} />

      <Route element={
        <ProtectedRoute>
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

            <main className="flex-1 w-full overflow-x-hidden flex flex-col min-w-0 transition-all duration-300 h-screen">
              <AppHeader
                active={activePageName}
                onNavigate={handleNavigate}
                theme={theme}
                onThemeToggle={() => setTheme(value => value === 'light' ? 'dark' : 'light')}
                onMenu={() => setSidebarOpen(true)}
              />
              <section className="flex-1 p-4 sm:p-6 lg:p-8 w-full overflow-y-auto custom-scrollbar">
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
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={
          userRole === 'client' ? <ClientDashboard onNavigate={handleNavigate} /> :
            userRole === 'super_admin' ? <Navigate to="/super-admin/dashboard" replace /> :
              userRole === 'admin' ? <AdminDashboard /> :
                userRole === 'assessor' ? <AssessorDashboard /> :
                  <StaffDashboard />
        } />
        <Route path="/super-admin/dashboard" element={<RoleProtectedRoute allowedRoles={['super_admin']} userRole={userRole}><SuperAdminDashboard /></RoleProtectedRoute>} />
        <Route path="/lots" element={<RoleProtectedRoute allowedRoles={['admin', 'staff', 'super_admin']} userRole={userRole}><PropertyLotManagement /></RoleProtectedRoute>} />
        <Route path="/buildings" element={<RoleProtectedRoute allowedRoles={['admin', 'staff', 'super_admin']} userRole={userRole}><BuildingDirectory /></RoleProtectedRoute>} />
        <Route path="/building-properties" element={<RoleProtectedRoute allowedRoles={['admin', 'staff', 'super_admin']} userRole={userRole}><BuildingDirectory /></RoleProtectedRoute>} />
        <Route path="/owners" element={<RoleProtectedRoute allowedRoles={['admin', 'staff', 'super_admin']} userRole={userRole}><PropertyOwnershipTransfer /></RoleProtectedRoute>} />
        <Route path="/assessments" element={<RoleProtectedRoute allowedRoles={['admin', 'assessor', 'super_admin']} userRole={userRole}><PropertyAssessments /></RoleProtectedRoute>} />
        <Route path="/assessment-assignments" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin']} userRole={userRole}><AssessmentAssignments /></RoleProtectedRoute>} />
        <Route path="/permission-requests" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin', 'assessor', 'staff']} userRole={userRole}><AssessmentPermissionRequests /></RoleProtectedRoute>} />
        <Route path="/assessment-requests" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin', 'assessor', 'staff']} userRole={userRole}><AssessmentPermissionRequests /></RoleProtectedRoute>} />
        <Route path="/scanner" element={<RoleProtectedRoute allowedRoles={['admin', 'staff', 'super_admin']} userRole={userRole}><BlueprintScanner /></RoleProtectedRoute>} />
        <Route path="/gis" element={<RoleProtectedRoute allowedRoles={['admin', 'assessor', 'staff', 'super_admin']} userRole={userRole}><PropertyMapView /></RoleProtectedRoute>} />
        <Route path="/reports" element={
          userRole === 'super_admin' ? <Navigate to="/super-admin/dashboard" replace /> :
            <RoleProtectedRoute allowedRoles={['admin']} userRole={userRole}><OperationalIntelligenceReports /></RoleProtectedRoute>
        } />
        <Route path="/documents" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'staff']} userRole={userRole}><Certifications query={query} onQueryChange={setQuery} rows={filteredProperties} onDelete={deleteProperty} /></RoleProtectedRoute>} />
        <Route path="/certificates/generate" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'staff']} userRole={userRole}><CertificateGenerator /></RoleProtectedRoute>} />
        <Route path="/certificates/records" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'staff']} userRole={userRole}><CertificateRecords /></RoleProtectedRoute>} />
        <Route path="/admin/certificate-requests" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'staff']} userRole={userRole}><AdminCertificateRequests /></RoleProtectedRoute>} />
        <Route path="/client/my-properties" element={<RoleProtectedRoute allowedRoles={['owner', 'client']} userRole={userRole}><ClientProperties /></RoleProtectedRoute>} />
        <Route path="/client/my-assessments" element={<RoleProtectedRoute allowedRoles={['owner', 'client']} userRole={userRole}><ClientProperties /></RoleProtectedRoute>} />
        <Route path="/client/gis-map" element={<RoleProtectedRoute allowedRoles={['owner', 'client']} userRole={userRole}><ClientGISMap /></RoleProtectedRoute>} />
        <Route path="/client/certificate-requests" element={<RoleProtectedRoute allowedRoles={['owner', 'client']} userRole={userRole}><ClientCertificateRequests /></RoleProtectedRoute>} />

        <Route path="/properties" element={<RoleProtectedRoute allowedRoles={['assessor', 'admin', 'super_admin']} userRole={userRole}><AssessorPropertiesView /></RoleProtectedRoute>} />
        <Route path="/assigned-properties" element={<RoleProtectedRoute allowedRoles={['assessor', 'admin', 'super_admin']} userRole={userRole}><AssessorPropertiesView /></RoleProtectedRoute>} />
        <Route path="/my-requests" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin', 'assessor', 'staff']} userRole={userRole}><AssessmentPermissionRequests /></RoleProtectedRoute>} />
        <Route path="/assigned-tasks" element={<RoleProtectedRoute allowedRoles={['staff']} userRole={userRole}><StaffDashboard /></RoleProtectedRoute>} />
        <Route path="/account-settings" element={<AccountSettings />} />
        <Route path="/help-support" element={<HelpSupport />} />
        <Route path="/users" element={<RoleProtectedRoute allowedRoles={['super_admin']} userRole={userRole}><UserManagement /></RoleProtectedRoute>} />
        <Route path="/roles" element={<RoleProtectedRoute allowedRoles={['super_admin']} userRole={userRole}><RoleManagement /></RoleProtectedRoute>} />
        <Route path="/logs" element={<RoleProtectedRoute allowedRoles={['super_admin']} userRole={userRole}><ActivityLogsView /></RoleProtectedRoute>} />
        <Route path="/property-history" element={<PropertyHistoryView />} />
        <Route path="/search" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'staff', 'assessor']} userRole={userRole}><StaffPropertySearch /></RoleProtectedRoute>} />
        <Route path="/settings" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'assessor', 'staff']} userRole={userRole}><SystemSettings /></RoleProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
