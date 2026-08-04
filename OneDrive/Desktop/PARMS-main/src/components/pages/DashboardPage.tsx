import { DashboardView } from '../dashboard/DashboardView'
import type { Property } from '../../types/property'
import type { EstimateInput } from '../../types/property'

export default function DashboardPage({
  active,
  query,
  onQueryChange,
  rows,
  onNavigate,
  onRegister,
}: {
  active: string
  query: string
  onQueryChange: (value: string) => void
  rows: Property[]
  onNavigate: (page: string) => void
  onRegister: () => void
}) {
  return (
    <DashboardView
      active={active}
      query={query}
      onQueryChange={onQueryChange}
      rows={rows}
      onNavigate={onNavigate}
      onRegister={onRegister}
    />
  )
}
