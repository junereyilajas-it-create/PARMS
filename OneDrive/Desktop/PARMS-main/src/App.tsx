import { useMemo, useState } from 'react'
import './App.css'
import { properties } from './data/properties'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { RegisterPropertyModal } from './components/common/RegisterPropertyModal'
import type { EstimateInput } from './types/property'
import { LandingPagePage, LoginPagePage, DashboardPage, OwnersPage, LotsPage, BuildingsPage, AssessmentsPage, AiValuationPage, GisMapPage, ReportsPage, SettingsPage } from './components/pages'

function App() {
  const [activePage, setActivePage] = useState('Landing')
  const [query, setQuery] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState(properties[0])
  const [estimateInput, setEstimateInput] = useState<EstimateInput>({ type: 'Residential', lot: '450', building: '180', age: '8' })
  const filteredProperties = useMemo(() => properties.filter(property => `${property.id} ${property.owner} ${property.location}`.toLowerCase().includes(query.toLowerCase())), [query])
  const commonViewProps = { active: activePage, query, onQueryChange: setQuery, rows: filteredProperties, onNavigate: setActivePage, onRegister: () => setShowRegisterModal(true) }
  const dashboardPages = ['Dashboard']
  return (
    <>
      {activePage === 'Landing' ? (
        <LandingPagePage onNavigate={setActivePage} />
      ) : activePage === 'Login' ? (
        <LoginPagePage onNavigate={setActivePage} />
      ) : (
        <div className="app-shell">
          <AppSidebar active={activePage} onNavigate={setActivePage}/>
          <main>
            <AppHeader active={activePage} searchValue={query} onSearchChange={setQuery}/>
            <section className="content">
              {activePage === 'AI Valuation' ? (
                <AiValuationPage value={estimateInput} onChange={setEstimateInput}/>
              ) : activePage === 'GIS Map' ? (
                <GisMapPage query={query} onQueryChange={setQuery} rows={filteredProperties} selected={selectedProperty} onSelect={setSelectedProperty}/>
              ) : dashboardPages.includes(activePage) ? (
                <DashboardPage {...commonViewProps}/>
              ) : activePage === 'Owners' ? (
                <OwnersPage />
              ) : activePage === 'Lots' ? (
                <LotsPage />
              ) : activePage === 'Buildings' ? (
                <BuildingsPage />
              ) : activePage === 'Assessments' ? (
                <AssessmentsPage />
              ) : activePage === 'Reports' ? (
                <ReportsPage />
              ) : activePage === 'Settings' ? (
                <SettingsPage />
              ) : (
                <DashboardPage {...commonViewProps}/>
              )}
            </section>
          </main>
          {showRegisterModal && <RegisterPropertyModal close={() => setShowRegisterModal(false)}/>}    
        </div>
      )}
    </>
  )
}
export default App
