import { Download, ShieldCheck, Zap } from 'lucide-react'
import type { EstimateInput } from '../../types/property'

const comparables = [
  { address: '750 Evergreen Terrace', price: '₱855,000', area: '2,400', similarity: '98%', status: 'SOLD (2024)' },
  { address: '730 Evergreen Terrace', price: '₱812,000', area: '2,150', similarity: '92%', status: 'SOLD (2023)' },
  { address: '12 Oak Street', price: '₱890,000', area: '2,800', similarity: '86%', status: 'SOLD (2024)' },
]

const trendBars = [
  { label: 'JAN', value: 24 },
  { label: 'MAR', value: 42 },
  { label: 'MAY', value: 58 },
  { label: 'JUL', value: 84, highlight: true },
  { label: 'SEP', value: 64 },
  { label: 'NOV', value: 52 },
]

const peso = (value: number) => `₱${new Intl.NumberFormat('en-PH').format(value)}`

export function AiValuationView({ value, onChange }: { value: EstimateInput; onChange: (value: EstimateInput) => void }) {
  const estimate = Math.round((Number(value.lot) * 1250 + Number(value.building) * 18500) * Math.max(0.65, 1 - Number(value.age) * 0.008))
  const confidence = Math.min(94, 78 + (Number(value.building) > 0 ? 8 : 0))

  return (
    <div className="valuation-page">
      <div className="title-row">
        <div>
          <p className="eyebrow">AI Valuation › Dossier #8829-PX</p>
          <h1>AI Property Valuation Dossier</h1>
          <p className="subhead">Parcel ID: 128-44-002-C | 742 Evergreen Terrace, Springfield</p>
        </div>
        <div className="hero-actions">
          <button className="outline"><Download size={16} /> Export PDF</button>
          <button className="primary">Approve Valuation</button>
        </div>
      </div>

      <div className="valuation-grid">
        <section className="card valuation-summary">
          <div className="value-head">
            <div>
              <p className="eyebrow">ESTIMATED MARKET VALUE</p>
              <h2>{peso(estimate)}</h2>
              <span className="growth">+4.2% (YOY)</span>
            </div>
            <div className="confidence-pill">
              <ShieldCheck size={16} />
              <div>
                <span>Confidence Score</span>
                <strong>{confidence}%</strong>
              </div>
            </div>
          </div>

          <div className="price-chart">
            {trendBars.map((bar) => (
              <div key={bar.label} className={bar.highlight ? 'price-bar highlight' : 'price-bar'}>
                <strong>{bar.value}</strong>
                <span>{bar.label}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="aside-panel">
          <section className="card map-preview">
            <div className="map-header">
              <h3>GIS Parcel View</h3>
              <button className="icon-btn outline" aria-label="Expand map">⛶</button>
            </div>
            <div className="map-box">Map preview</div>
            <div className="map-meta">
              <div><span>Land Area</span><strong>0.45 Acres</strong></div>
              <div><span>Last Assessed</span><strong>24 Jan 2023</strong></div>
            </div>
          </section>

          <section className="card pulse-card">
            <div className="card-head"><h2>AI Market Pulse</h2></div>
            <p>Market liquidity in this sector is High. Average days-on-market for similar R-2 parcels has decreased by 12% in the last 60 days.</p>
            <div className="pulse-foot"><span>Demand Index</span><strong>8.4/10</strong></div>
          </section>
        </aside>
      </div>

      <div className="valuation-insights">
        <section className="card insight-card light">
          <h3>Market Trends</h3>
          <p>Significant uptick in local residential demand following the recent expansion of the tech corridor. Comps within a 2-mile radius show a consistent 15% premium over previous valuation cycles.</p>
        </section>
        <section className="card insight-card light">
          <h3>Infrastructure</h3>
          <p>Valuation includes a positive adjustment (+3.5%) due to the proximity (0.4mi) to the upcoming Springfield Metro extension and renewed municipal park improvements.</p>
        </section>
        <section className="card insight-card light">
          <h3>Asset Quality</h3>
          <p>Recent permit history indicates a high-grade HVAC overhaul and solar installation in 2023, contributing an estimated ₱42k additional structural equity.</p>
        </section>
      </div>

      <section className="card comparables-card">
        <div className="card-head">
          <div>
            <h2>Similar Property Comparables (AI Selected)</h2>
          </div>
          <button className="text-button">View Map View</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ADDRESS</th>
                <th>SALE PRICE</th>
                <th>SQ FT</th>
                <th>SIMILARITY</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {comparables.map((item) => (
                <tr key={item.address}>
                  <td>{item.address}</td>
                  <td>{item.price}</td>
                  <td>{item.area}</td>
                  <td>{item.similarity}</td>
                  <td><span className="status sold">{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="valuation-actions">
        <section className="card recommendation-card">
          <div>
            <h2>Final Appraisal Recommendation</h2>
            <p>All models converge on ₱842.5k. Ready for official assessment.</p>
          </div>
          <button className="outline">Flag for Review</button>
        </section>
        <button className="primary large"><Zap size={18} /> Approve & Finalize Valuation</button>
      </div>
    </div>
  )
}
