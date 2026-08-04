import LandingPage from '../landing/LandingPage'

export default function LandingPagePage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  return <LandingPage onNavigate={onNavigate} />
}
