import React, { useState } from 'react'
import './LoginPage.css'

export default function LoginPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    // For now, proceed directly to dashboard on login click
    setLoading(true)
    try {
      // Simulate successful login and navigate to dashboard
      localStorage.setItem('token', 'demo-token')
      if (remember) localStorage.setItem('user', JSON.stringify({ username }))
      onNavigate?.('Dashboard')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-root">
      <div className="login-left" />
      <div className="login-right">
        <h1>Welcome Back</h1>
        <p>Please enter your credentials to access the assessor portal.</p>
        <form onSubmit={submit} className="login-form">
          <label>Email Address</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="assessor@cityhall.gov" />
          <label>Password <a className="forgot" href="#">Forgot Password?</a></label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="●●●●●●●●" />
          <label className="remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember this device for 30 days</label>
          <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In →'}</button>
        </form>
        <div className="login-footer">Secure Access System for City Hall Staff.</div>
      </div>
    </div>
  )
}
