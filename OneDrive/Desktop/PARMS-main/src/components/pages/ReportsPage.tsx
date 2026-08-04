import { Download, FileText } from 'lucide-react'

const queue = [
  { name: 'Residential Market Trends', category: 'Economic', schedule: 'Weekly (Mon)', recipient: 'Planning Commission', status: 'ACTIVE' },
  { name: 'Foreclosure Warning Heatmap', category: 'Risk Mgmt', schedule: 'Monthly (1st)', recipient: "Mayor's Office", status: 'ACTIVE' },
  { name: 'Zoning Compliance Audit', category: 'Compliance', schedule: 'On-Demand', recipient: 'Internal Audit', status: 'ARCHIVED' },
  { name: 'AI Valuation Variance Audit', category: 'System', schedule: 'Daily (23:00)', recipient: 'Data Science Team', status: 'ACTIVE' },
]

const activities = [
  { message: 'Valuation Override Parcel ID: #88291-B0', actor: 'Admin_SR', time: '10:42 AM' },
  { message: 'Bulk Import Success 420 new zoning records', actor: 'Sys_Daemon', time: '09:15 AM' },
  { message: 'API Auth Failure Invalid token from 192.168.1.1', actor: 'Critical', time: '08:58 AM' },
]

export default function ReportsPage() {
  return (
    <div className="reports-page">
      <div className="title-row">
        <div>
          <p className="eyebrow">Operational Intelligence Reports</p>
          <h1>Operational Intelligence Reports</h1>
          <p className="subhead">Aggregate and analyze city-wide parcel data, tax distributions, and AI valuation performance for the 2024 fiscal year.</p>
        </div>
        <div className="hero-actions">
          <button className="outline"><Download size={16} /> Export Excel</button>
          <button className="primary"><FileText size={16} /> Generate PDF</button>
        </div>
      </div>

      <div className="reports-grid">
        <section className="card report-chart">
          <div className="card-head"><h2>AI Prediction Accuracy</h2><span>98.4% Confidence</span></div>
          <div className="report-chart-grid">
            <div className="chart-panel">Chart preview</div>
          </div>
        </section>

        <section className="card inventory-card">
          <div className="card-head"><h2>Property Inventory</h2></div>
          <div className="inventory-graphic">
            <div className="inventory-square"><strong>14,204</strong><span>Total Units</span></div>
          </div>
          <div className="inventory-breakdown">
            <div><span className="dot green"/> Residential 68%</div>
            <div><span className="dot teal"/> Commercial 24%</div>
            <div><span className="dot dark"/> Industrial 8%</div>
          </div>
        </section>
      </div>

      <div className="reports-cards">
        <section className="card report-mini">
          <div className="card-head"><h2>Tax Collection Estimates</h2><span>Projected revenue vs. Historical averages.</span></div>
          <div className="estimate-row"><span>Q3 2024 Projection</span><strong>₱12.4M</strong></div>
          <div className="estimate-row"><span>YTD Actuals</span><strong>₱34.1M</strong></div>
          <div className="mini-stats"><span>Growth Rate +4.2%</span><span>Variance -0.8%</span></div>
        </section>
        <section className="card report-mini activity-log">
          <div className="card-head"><h2>User Activity Logs</h2><a href="#">View All</a></div>
          <div className="activity-list">
            {activities.map((item) => (
              <div key={item.message} className="activity-item">
                <div>
                  <p>{item.message}</p>
                  <span>{item.actor}</span>
                </div>
                <strong>{item.time}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card queue-card">
        <div className="queue-head"><div><h2>Detailed Report Inventory - Current Queue</h2></div><span>Last synced: 4 minutes ago</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Report Name</th><th>Category</th><th>Schedule</th><th>Recipient</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.schedule}</td>
                  <td>{item.recipient}</td>
                  <td><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                  <td><button className="icon-btn outline"><Download size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
