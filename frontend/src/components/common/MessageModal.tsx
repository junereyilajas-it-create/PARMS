import { CheckCircle2, AlertCircle, X, Info, AlertTriangle } from 'lucide-react'

export type MessageModalProps = {
  title: string
  message: string
  type: 'success' | 'error' | 'confirm' | 'info' | 'warning'
  onClose: () => void
  onConfirm?: () => void
}

export function MessageModal({ title, message, type, onClose, onConfirm }: MessageModalProps) {
  return (
    <div className="workflow-backdrop" onMouseDown={onClose} style={{ zIndex: 9999 }}>
      <section 
        className={`workflow-modal ${type === 'success' ? 'modal-success' : type === 'error' ? 'modal-error' : ''}`} 
        role="dialog" 
        aria-modal="true" 
        style={{ maxWidth: '400px', margin: 'auto' }}
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="workflow-header message-modal-header" style={{ paddingBottom: '16px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className={`message-title-${type}`}>
            {type === 'error' && <AlertCircle size={20} />}
            {type === 'success' && <CheckCircle2 size={20} />}
            {type === 'confirm' && <AlertCircle size={20} />}
            {type === 'info' && <Info size={20} />}
            {type === 'warning' && <AlertTriangle size={20} />}
            {title}
          </h2>
          <button aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="workflow-body message-modal-body" style={{ padding: '24px 20px', fontSize: '15px', lineHeight: '1.5' }}>
          {message}
        </div>
        <footer className="workflow-footer message-modal-footer" style={{ justifyContent: 'flex-end', paddingTop: '16px' }}>
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
