import { CheckCircle2, AlertCircle, X } from 'lucide-react'

export type MessageModalProps = {
  title: string
  message: string
  type: 'success' | 'error' | 'confirm'
  onClose: () => void
  onConfirm?: () => void
}

export function MessageModal({ title, message, type, onClose, onConfirm }: MessageModalProps) {
  return (
    <div className="workflow-backdrop" onMouseDown={onClose} style={{ zIndex: 9999 }}>
      <section 
        className="workflow-modal" 
        role="dialog" 
        aria-modal="true" 
        style={{ maxWidth: '400px', margin: 'auto' }}
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="workflow-header" style={{ paddingBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: type === 'error' ? '#b91c1c' : '#15803d' }}>
            {type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            {title}
          </h2>
          <button aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="workflow-body" style={{ padding: '24px 20px', fontSize: '15px', color: '#374151', lineHeight: '1.5' }}>
          {message}
        </div>
        <footer className="workflow-footer" style={{ justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          {type === 'confirm' ? (
            <>
              <button className="workflow-cancel" onClick={onClose}>Cancel</button>
              <button className="workflow-next" onClick={onConfirm}>Confirm</button>
            </>
          ) : (
            <button className="workflow-next" onClick={onClose}>OK</button>
          )}
        </footer>
      </section>
    </div>
  )
}
