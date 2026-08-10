import { useMemo, useState } from 'react'
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
import { properties } from './data/properties'
import { AiPropertyValuation, BuildingDirectory, DashboardView, LandingPage, OperationalIntelligenceReports, PropertyLotManagement, PropertyMapView, PropertyOwnershipTransfer } from './pages'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { RegisterPropertyModal } from './components/common/RegisterPropertyModal'

function App() {
  const [activePage, setActivePage] = useState('Landing')
  const [query, setQuery] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [propertyRecords, setPropertyRecords] = useState(properties)
  const [selectedProperty, setSelectedProperty] = useState(properties[0])
  const filteredProperties = useMemo(() => propertyRecords.filter(property => `${property.id} ${property.owner} ${property.location}`.toLowerCase().includes(query.toLowerCase())), [query, propertyRecords])

  if (activePage === 'Landing') return <LandingPage onNavigate={setActivePage} />

  const sharedDashboardProps = { active: activePage, query, onQueryChange: setQuery, rows: filteredProperties, onNavigate: setActivePage, onRegister: () => setShowRegisterModal(true) }
  const page = (() => {
    switch (activePage) {
      case 'Lot Management': return <PropertyLotManagement />
      case 'Ownership Transfer': return <PropertyOwnershipTransfer />
      case 'Property Valuation': return <AiPropertyValuation />
      case 'Building Directory': return <BuildingDirectory />
      case 'GIS Map': return <PropertyMapView query={query} onQueryChange={setQuery} rows={filteredProperties} selected={selectedProperty} onSelect={setSelectedProperty}/>
      case 'Reports': return <OperationalIntelligenceReports />
      default: return <DashboardView {...sharedDashboardProps}/>
    }
  })()

  return <div className="app-shell"><AppSidebar active={activePage} onNavigate={setActivePage}/><main><AppHeader active={activePage} searchValue={query} onSearchChange={setQuery}/><section className="content">{page}</section></main>{showRegisterModal && <RegisterPropertyModal close={() => setShowRegisterModal(false)} onSave={property => setPropertyRecords(records => [property, ...records])}/>}</div>
}
export default App
