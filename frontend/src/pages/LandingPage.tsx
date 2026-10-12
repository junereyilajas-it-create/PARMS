import { 
  ArrowRight, 
  Building2, 
  Map, 
  ShieldCheck, 
  Award, 
  CheckCircle2, 
  Compass, 
  Database
} from 'lucide-react'
import { SystemLogo } from '../components/common/SystemLogo'
import '../styles/LandingPage.css'
import '../styles/LandingOverride.css'

export function LandingPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const featureCards = [
    {
      title: 'Property Records Management',
      badge: 'Core Registry',
      description: 'Comprehensive digital archive of land parcels, cadastral books, title records, and historical ownership chains with real-time updates.',
      image: '/images/feature-records.jpg',
      icon: <Database className="w-5 h-5 text-emerald-600" />,
      page: 'Properties',
      btnText: 'View Records'
    },
    {
      title: 'Land & Building Assessment',
      badge: 'Valuation Engine',
      description: 'Objective field appraisal and automated computation of fair market and assessed values for residential, commercial, and agricultural properties.',
      image: '/images/feature-assessment.jpg',
      icon: <Building2 className="w-5 h-5 text-emerald-600" />,
      page: 'Assessments',
      btnText: 'Appraisal Tools'
    },
    {
      title: 'GIS Property Mapping',
      badge: 'Spatial Intelligence',
      description: 'Interactive cadastral map visualizer integrating satellite imagery, parcel boundaries, zoning overlays, and geolocation surveying.',
      image: '/images/feature-gis.jpg',
      icon: <Map className="w-5 h-5 text-emerald-600" />,
      page: 'GIS Map',
      btnText: 'Open GIS Portal'
    },
    {
      title: 'Assessment Reports & Certificates',
      badge: 'Official Documents',
      description: 'Instantly generate, review, customize, and print verified Tax Declarations, Property Holdings Certifications, and Historical Ownership records.',
      image: '/images/feature-certificates.jpg',
      icon: <Award className="w-5 h-5 text-emerald-600" />,
      page: 'Certifications',
      btnText: 'Generate Certificates'
    }
  ]

  const stats = [
    { value: '12,500+', label: 'Registered Land Parcels', detail: 'Fully mapped and recorded' },
    { value: '100%', label: 'Cadastral Coverage', detail: 'Across all barangays' },
    { value: '99.8%', label: 'Valuation Accuracy', detail: 'Strict municipal standards' },
    { value: '24/7', label: 'Cloud-Enabled Access', detail: 'For citizens and staff' }
  ]

  return (
    <div className="lp-root">
      {/* 1. Header / Navigation Bar */}
      <header className="lp-header">
        <button className="lp-brand" onClick={() => onNavigate('Landing')} aria-label="PARMS Home">
          <SystemLogo clickable={false} className="w-10 h-10 shrink-0 object-contain" />
          <span>
            <span className="lp-brand-name">PARMS</span>
            <span className="lp-brand-sub">Office of the Municipal Assessor · Lagonglong</span>
          </span>
        </button>

        <nav className="lp-nav">
          <button 
            type="button" 
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            System Features
          </button>
          <button 
            type="button" 
            onClick={() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Municipal Overview
          </button>
          <button 
            type="button" 
            onClick={() => onNavigate('Register')}
            className="lp-nav-register"
          >
            Register
          </button>
          <button 
            id="login-nav-btn"
            type="button" 
            className="lp-signin" 
            onClick={() => onNavigate('Login')}
          >
            Sign In
          </button>
        </nav>
      </header>

      <main>
        {/* 2. Hero Section with Photographic Aerial Background */}
        <section className="lp-hero-banner">
          <div className="lp-hero-backdrop" />
          <div className="lp-hero-content">
            <div className="lp-hero-badge-wrap">
              <span className="lp-badge">
                <ShieldCheck className="w-4 h-4 inline mr-1 text-emerald-400" />
                Republic of the Philippines · Province of Misamis Oriental
              </span>
            </div>

            <h1 className="lp-hero-title">
              Property Assessment and Records Management System
            </h1>

            <p className="lp-hero-description">
              Manage property records, land assessments, geographic information, and official property documents in one centralized system.
            </p>

            <div className="lp-cta-group">
              <button 
                id="get-started-btn" 
                type="button" 
                className="lp-primary-btn" 
                onClick={() => onNavigate('Login')}
                aria-label="Get Started"
              >
                Get Started <ArrowRight className="w-5 h-5 ml-1" />
              </button>
              
              <button 
                id="explore-features-btn"
                type="button" 
                className="lp-secondary-btn" 
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Compass className="w-4 h-4 mr-2" /> Explore Features
              </button>
            </div>

            {/* Quick Metrics Bar inside Hero */}
            <div className="lp-hero-highlights">
              <div className="lp-highlight-item">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Centralized Property Registry</span>
              </div>
              <div className="lp-highlight-item">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Interactive GIS Tax Mapping</span>
              </div>
              <div className="lp-highlight-item">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Automated Certified True Copies</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Municipal Statistics Strip */}
        <section id="stats" className="lp-stats-strip">
          <div className="lp-stats-container">
            {stats.map((s, idx) => (
              <div key={idx} className="lp-stat-card">
                <div className="lp-stat-number">{s.value}</div>
                <div className="lp-stat-label">{s.label}</div>
                <div className="lp-stat-detail">{s.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Core System Features / Visual Photographic Cards */}
        <section id="features" className="lp-features-section">
          <div className="lp-section-header">
            <span className="lp-section-eyebrow">COMPREHENSIVE MUNICIPAL PLATFORM</span>
            <h2 className="lp-section-title">Designed for Modern Property Governance</h2>
            <p className="lp-section-subtitle">
              Combining official cadastral archiving, rigorous appraisal algorithms, and spatial GIS mapping into an intuitive interface for assessors and citizens.
            </p>
          </div>

          <div className="lp-features-grid">
            {featureCards.map((card, idx) => (
              <article className="lp-feature-card" key={idx}>
                <div className="lp-card-image-wrap">
                  <img 
                    src={card.image} 
                    alt={card.title} 
                    className="lp-card-image"
                    loading="lazy"
                  />
                  <span className="lp-card-badge">{card.badge}</span>
                </div>

                <div className="lp-card-content">
                  <div className="lp-card-icon-title">
                    <div className="lp-card-icon-container">
                      {card.icon}
                    </div>
                    <h3 className="lp-card-title">{card.title}</h3>
                  </div>

                  <p className="lp-card-description">{card.description}</p>

                  <button 
                    type="button" 
                    className="lp-card-action-btn"
                    onClick={() => onNavigate('Login')}
                  >
                    <span>{card.btnText}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 5. Trust & Accountability Banner */}
        <section className="lp-trust-banner">
          <div className="lp-trust-container">
            <div className="lp-trust-text">
              <h2>Official Municipal Assessor Standards</h2>
              <p>
                Engineered in compliance with local government property assessment codes, ensuring strict auditability, role segregation, and immutable record integrity for the Municipality of Lagonglong.
              </p>
            </div>
            <div className="lp-trust-cta">
              <button 
                type="button" 
                className="lp-primary-btn" 
                onClick={() => onNavigate('Login')}
              >
                Access Assessor Portal <ArrowRight className="w-5 h-5 ml-1" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 6. Professional Government Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <div className="flex items-center gap-3 mb-2">
              <SystemLogo clickable={false} className="w-9 h-9 object-contain" />
              <div>
                <strong className="text-lg text-emerald-950 font-bold block">PARMS</strong>
                <span className="text-xs text-emerald-800">Property Assessment & Records Management System</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 max-w-md mt-2 leading-relaxed">
              Office of the Municipal Assessor · Municipal Government of Lagonglong, Province of Misamis Oriental, Republic of the Philippines.
            </p>
          </div>

          <div className="lp-footer-links-group">
            <div className="lp-footer-col">
              <h4>System Portals</h4>
              <button onClick={() => onNavigate('Login')}>Assessor Sign In</button>
              <button onClick={() => onNavigate('Register')}>Citizen Registration</button>
              <button onClick={() => onNavigate('Login')}>Staff Portal</button>
            </div>
            <div className="lp-footer-col">
              <h4>Quick Access</h4>
              <button onClick={() => onNavigate('Login')}>Property Search</button>
              <button onClick={() => onNavigate('Login')}>GIS Parcel Viewer</button>
              <button onClick={() => onNavigate('Login')}>Tax Declaration Status</button>
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <p>© {new Date().getFullYear()} Municipal Assessor's Office of Lagonglong. All rights reserved.</p>
          <p className="text-xs text-emerald-800">Secure Government Records Administration Platform</p>
        </div>
      </footer>
    </div>
  )
}
export default LandingPage
