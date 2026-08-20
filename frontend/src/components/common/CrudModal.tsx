import { useEffect, useState } from 'react'

export type CrudField = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'select'; options?: string[] }

export function CrudModal({ title, fields, record, onClose, onSave, readOnly = false }: {
  title: string; fields: CrudField[]; record?: Record<string, unknown>; onClose: () => void
  onSave: (record: Record<string, string>) => void; readOnly?: boolean
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => setValues(Object.fromEntries(fields.map(field => [field.key, String(record?.[field.key] ?? '')]))), [fields, record])
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
    <form className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl" onMouseDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); onSave(values) }}>
      <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">{title}</h2><button type="button" onClick={onClose} className="text-2xl text-gray-500">×</button></div>
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.key} className="text-sm font-medium text-gray-700">{field.label}
        {field.type === 'select' ? <select disabled={readOnly} value={values[field.key] ?? ''} onChange={event => setValues(prev => ({ ...prev, [field.key]: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 p-2">{field.options?.map(option => <option key={option}>{option}</option>)}</select>
        : <input required={!readOnly} readOnly={readOnly} type={field.type ?? 'text'} value={values[field.key] ?? ''} onChange={event => setValues(prev => ({ ...prev, [field.key]: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 p-2 read-only:bg-gray-50" />}
      </label>)}</div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded border border-gray-300 px-4 py-2">{readOnly ? 'Close' : 'Cancel'}</button>{!readOnly && <button className="rounded bg-green-700 px-4 py-2 text-white">Save</button>}</div>
    </form>
  </div>
}
