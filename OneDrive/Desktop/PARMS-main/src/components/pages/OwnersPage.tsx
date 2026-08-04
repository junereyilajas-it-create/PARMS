import { CheckCircle2, FileText, ShieldCheck, Upload, UserCheck } from 'lucide-react'

const steps = [
  { label: 'Entity Match', icon: UserCheck, active: false },
  { label: 'Details & Data', icon: FileText, active: true },
  { label: 'Documents', icon: Upload, active: false },
  { label: 'Review', icon: ShieldCheck, active: false },
]

const docs = [
  { name: 'Certified_Deed_Transfer_882B.pdf', size: '2.4 MB', age: 'Uploaded 2 mins ago' },
  { name: 'Scan_Tax_Clearance_Cert.jpg', size: '1.1 MB', age: 'Uploaded 1 min ago' },
]

export default function OwnersPage() {
  return (
    <div className="owners-page">
      <div className="title-row">
        <div>
          <p className="eyebrow">Owners &gt; Ownership Transfer</p>
          <h1>Property Ownership Transfer</h1>
          <p className="subhead">Official workflow for legal title deed updates and assessor record reconciliation.</p>
        </div>
      </div>

      <section className="card stepper">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <div key={step.label} className={step.active ? 'step-card active' : 'step-card'}>
              <div className="step-icon"><Icon size={18} /></div>
              <div>
                <span>{step.label}</span>
              </div>
            </div>
          )
        })}
      </section>

      <div className="owners-layout">
        <div className="main-column">
          <section className="card owner-summary">
            <div className="card-head">
              <div>
                <h2>Current Ownership Information</h2>
              </div>
            </div>
            <div className="info-grid">
              <div>
                <span>PRIMARY OWNER</span>
                <strong>Evergreen Development Group LLC</strong>
                <p>Tax ID: 44-902-1138</p>
              </div>
              <div>
                <span>PROPERTY PARCEL ID</span>
                <strong>LOT-882-B-ZONE-G</strong>
                <p>1422 Pine Needle Way, North District</p>
              </div>
            </div>
          </section>

          <section className="card transfer-card">
            <div className="card-head">
              <div>
                <h2>Transfer Details</h2>
                <p>Search the new owner entity and capture the transfer metadata.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Search New Owner Entity
                <input placeholder="Enter Name, TIN, or Entity ID…" />
              </label>
              <div className="verified-pill">
                <CheckCircle2 size={16} />
                <span>Entity Verified</span>
              </div>
              <label>
                Effective Date of Transfer
                <input type="date" />
              </label>
              <label>
                Transaction Type
                <select>
                  <option>Standard Sale / Purchase</option>
                  <option>Inheritance</option>
                  <option>Corporate Transfer</option>
                </select>
              </label>
            </div>
          </section>

          <section className="card upload-card">
            <div className="card-head">
              <div>
                <h2>Supporting Documentation</h2>
                <p>Upload Deed of Sale, Notarized Agreements, and Tax Clearances (PDF, JPG, PNG).</p>
              </div>
            </div>
            <div className="upload-dropzone">
              <div className="upload-icon"><Upload size={22} /></div>
              <p>Drag and drop legal files</p>
              <span>Upload Deed of Sale, Notarized Agreements, and Tax Clearances (PDF, JPG, PNG)</span>
              <button className="secondary">Select Files From Local Disk</button>
            </div>
            <div className="file-list">
              {docs.map((doc) => (
                <div key={doc.name} className="file-row">
                  <div>
                    <FileText size={18} />
                    <div>
                      <strong>{doc.name}</strong>
                      <span>{doc.size} · {doc.age}</span>
                    </div>
                  </div>
                  <button className="icon-btn outline" aria-label="Delete file">×</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="side-column owners-side">
          <section className="card policy-card">
            <p className="eyebrow">AI Policy Check</p>
            <h2>Our AI has pre-verified the current tax status.</h2>
            <p>No outstanding liens detected for Parcel LOT-882-B.</p>
            <div className="policy-badge">
              <ShieldCheck size={16} />
              <span>Compliance Check Passed</span>
            </div>
          </section>

          <section className="card guidelines-card">
            <div className="card-head"><div><h2>Workflow Guidelines</h2></div></div>
            <ul>
              <li>Ensure all legal names exactly match the submitted Deed of Sale.</li>
              <li>The Effective Date cannot be more than 180 days in the past without late fee penalty.</li>
              <li>Dual-signature authentication is required for corporate entities.</li>
            </ul>
            <a href="#">Read Transfer Ordinances</a>
          </section>
        </aside>
      </div>

      <div className="action-row">
        <button className="outline">Cancel Workflow</button>
        <button className="outline">Previous Step</button>
        <button className="primary">Save and Continue</button>
      </div>
    </div>
  )
}
