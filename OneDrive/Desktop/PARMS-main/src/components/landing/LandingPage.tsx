import React from 'react'
import './LandingPage.css'

type Props = { onNavigate?: (page: string) => void }

export default function LandingPage({ onNavigate }: Props) {
  const API_BASE = 'http://localhost:5000/api/demo/properties'
  const AUTH_API = 'http://localhost:5000/api/login'

  async function addProperty() {
    const location = window.prompt('Enter property location/address')
    if (!location) return
    const lot_area = window.prompt('Enter lot area (e.g. 450)') || ''
    const body = { owner_id: 1, address_id: 1, property_type_id: 1, classification_id: 1, lot_number: `L-${Date.now()}`, title_number: '', location, lot_area, latitude: null, longitude: null, property_status: 'active' }
    try {
      const res = await fetch(API_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      alert('Property created: id=' + data.id)
    } catch (e: any) { alert('Create failed: ' + e.message) }
  }

  async function updateProperty() {
    const id = window.prompt('Enter property id to update')
    if (!id) return
    const location = window.prompt('Enter new location/address')
    if (location === null) return
    const lot_area = window.prompt('Enter new lot area (leave blank to keep)')
    const body = { owner_id: null, address_id: null, property_type_id: null, classification_id: null, lot_number: null, title_number: null, location: location || null, lot_area: lot_area || null, latitude: null, longitude: null, property_status: null }
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await res.text())
      alert('Property updated')
    } catch (e: any) { alert('Update failed: ' + e.message) }
  }

  async function deleteProperty() {
    const id = window.prompt('Enter property id to delete')
    if (!id) return
    if (!confirm('Delete property id=' + id + '? This cannot be undone.')) return
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
      if (res.status !== 204) throw new Error(await res.text())
      alert('Property deleted')
    } catch (e: any) { alert('Delete failed: ' + e.message) }
  }
  return (
    <div className="lp-root">
      <header className="lp-header">
        <div className="lp-brand">
          <div className="lp-logo">🏛️</div>
          <div className="lp-brand-text">
            <div className="lp-brand-name">Assessor Pro AI</div>
            <div className="lp-brand-sub">Municipal Valuation</div>
          </div>
        </div>
        <nav className="lp-nav">
          <button onClick={() => document.querySelector('.lp-cards')?.scrollIntoView({ behavior: 'smooth' })}>Features</button>
          <button onClick={() => onNavigate?.('Reports')}>Solutions</button>
          <button className="lp-signin" onClick={() => onNavigate?.('Login')}>Sign In</button>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-left">
          <span className="lp-badge">AI-Powered Valuation Engine</span>
          <h1>Modernizing Municipal Property Assessment with AI</h1>
          <p className="lp-lead">A comprehensive records management and GIS mapping system designed for the next generation of city assessors. Ensure accuracy, transparency, and efficiency.</p>
          <div className="lp-cta">
            <button className="lp-primary" onClick={() => onNavigate ? onNavigate('Dashboard') : null}>Get Started →</button>
            <button className="lp-outline" onClick={() => { document.querySelector('.lp-cards')?.scrollIntoView({ behavior: 'smooth' }) }}>Explore Features</button>
            <div style={{ marginTop: 12 }}>
              <button onClick={addProperty} style={{ marginRight: 8 }}>Add Property</button>
              <button onClick={updateProperty} style={{ marginRight: 8 }}>Update Property</button>
              <button onClick={deleteProperty}>Delete Property</button>
            </div>
          </div>
        </div>

        <div className="lp-hero-right">
          <div className="lp-image-stack">
              <div className="lp-image" onClick={() => onNavigate?.('GIS Map')} />
              <div className="lp-image" onClick={() => onNavigate?.('GIS Map')} />
              <div className="lp-image" onClick={() => onNavigate?.('GIS Map')} />
          </div>
        </div>
      </section>

      <section className="lp-stats">
        <button className="lp-stat" onClick={() => onNavigate?.('Dashboard')}>12,000+<div className="lp-stat-label">Properties Managed</div></button>
        <button className="lp-stat" onClick={() => onNavigate?.('AI Valuation')}>98%<div className="lp-stat-label">AI Prediction Accuracy</div></button>
        <button className="lp-stat" onClick={() => onNavigate?.('GIS Map')}>15+<div className="lp-stat-label">Municipal Districts Supported</div></button>
      </section>

      <section className="lp-cards">
        <h2>Comprehensive Assessor Tools</h2>
        <p className="lp-sub">Built specifically for municipal needs, combining traditional records management with advanced analytics.</p>
        <div className="lp-card-grid">
          <div className="lp-card">
            <div className="lp-card-title">AI-Driven Valuation</div>
            <div className="lp-card-body">Harness machine learning to predict property market values with unprecedented accuracy, analyzing thousands of historical data points instantly.</div>
            <button className="lp-card-link" onClick={() => onNavigate?.('AI Valuation')}>Learn more →</button>
          </div>
          <div className="lp-card">
            <div className="lp-card-title">GIS Mapping Integration</div>
            <div className="lp-card-body">Visualize municipal land assets with real-time interactive mapping and parcel tracking.</div>
            <button className="lp-card-link" onClick={() => onNavigate?.('GIS Map')}>Explore maps →</button>
          </div>
          <div className="lp-card">
            <div className="lp-card-title">Ownership Lifecycle</div>
            <div className="lp-card-body">Seamlessly manage ownership transfers, tax declarations, and historical property records in a secure ledger.</div>
            <button className="lp-card-link" onClick={() => onNavigate?.('Assessments')}>View workflows →</button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-left">
          <div className="lp-brand">Assessor Pro AI</div>
          <div className="lp-footer-copy">© 2024 Assessor Pro AI. All rights reserved.</div>
        </div>
        <div className="lp-footer-links">
          <button onClick={() => onNavigate?.('Dashboard')}>Product</button>
          <button onClick={() => onNavigate?.('Reports')}>Support</button>
        </div>
      </footer>
    </div>
  )
}
