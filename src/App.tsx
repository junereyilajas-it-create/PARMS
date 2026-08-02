import { useMemo, useState } from 'react'
import './App.css'
import { properties } from './data/properties'
import { DashboardView } from './components/dashboard/DashboardView'
import { AiValuationView } from './components/valuation/AiValuationView'
import { PropertyMapView } from './components/maps/PropertyMapView'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { RegisterPropertyModal } from './components/common/RegisterPropertyModal'
import { OperationsView } from './components/operations/OperationsView'
import type { EstimateInput } from './types/property'

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [query, setQuery] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState(properties[0])
  const [estimateInput, setEstimateInput] = useState<EstimateInput>({ type: 'Residential', lot: '450', building: '180', age: '8' })
  const filteredProperties = useMemo(() => properties.filter(property => `${property.id} ${property.owner} ${property.location}`.toLowerCase().includes(query.toLowerCase())), [query])
  const commonViewProps = { active: activePage, query, onQueryChange: setQuery, rows: filteredProperties, onNavigate: setActivePage, onRegister: () => setShowRegisterModal(true) }
  const dashboardPages = ['Dashboard', 'Owners', 'Lots', 'Buildings', 'Assessments']
  return (
    <div className="app-shell">
      <AppSidebar active={activePage} onNavigate={setActivePage}/>
      <main>
        <AppHeader active={activePage} searchValue={query} onSearchChange={setQuery}/>
        <section className="content">
          {activePage === 'AI Valuation' ? (
            <AiValuationView value={estimateInput} onChange={setEstimateInput}/>
          ) : activePage === 'GIS Map' ? (
            <PropertyMapView query={query} onQueryChange={setQuery} rows={filteredProperties} selected={selectedProperty} onSelect={setSelectedProperty}/>
          ) : dashboardPages.includes(activePage) ? (
            <DashboardView {...commonViewProps}/>
          ) : (
            <OperationsView page={activePage} />
          )}
        </section>
      </main>
      {showRegisterModal && <RegisterPropertyModal close={() => setShowRegisterModal(false)}/>}    
    </div>
  )
}
export default App
