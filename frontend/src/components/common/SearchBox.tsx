import { Search } from 'lucide-react'
export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="table-tools"><label><Search size={18}/><input value={value} onChange={e => onChange(e.target.value)} placeholder="Search address or owner..."/></label></div>
}
