import LoginPage from '../auth/LoginPage'

export default function LoginPagePage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  return <LoginPage onNavigate={onNavigate} />
}
