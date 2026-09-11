import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Building2, Eye, EyeOff, Landmark, LockKeyhole, Mail } from 'lucide-react'
import { useModal } from '../contexts/ModalContext'
import { useFormValidation, validateRequired, validateEmail, validatePassword } from '../lib/validation'
import api from '../lib/api'
import '../styles/AuthPages.css'

function Shell({ children, register = false }: { children: React.ReactNode; register?: boolean }) {
  return (
    <main className={`auth-page ${register ? 'auth-register' : ''}`}>
      <section className="auth-card">
        <div className="auth-panel">
          <div className="auth-brand">
            <Landmark size={19}/><strong>Accessor Office</strong>
          </div>
          {children}
        </div>
        <aside className="auth-image">
          <div className="auth-image-copy">
            {register ? (
              <>
                <div className="stars">★★★★★</div>
                <strong>“Accessor Office has completely transformed our municipal property valuation process. It brings stability, transparency, and increased accuracy to Lagonglong.”</strong>
                <span>Lagonglong Municipal Assessor<br/>Lagonglong, Misamis Oriental</span>
              </>
            ) : (
              <>
                <Building2 size={21}/>
                <h2>Accessor Office</h2>
                <p>Supporting fair and accurate property valuation in Lagonglong, Misamis Oriental.</p>
              </>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}

export function LoginPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { showError, showSuccess } = useModal()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('password')
  const [uState, setUState] = useState<'normal'|'valid'|'invalid'>('normal')
  const [pState, setPState] = useState<'normal'|'valid'|'invalid'>('normal')
  const [touchedU, setTouchedU] = useState(false)
  const [touchedP, setTouchedP] = useState(false)

  useEffect(() => {
    // If empty, reset visually
    if (!username) {
      setUState('normal')
      setPState('normal')
      return
    }

    const handler = setTimeout(async () => {
      try {
        const { data } = await api.post('/validate-login', { username, password })
        setUState(data.usernameExists ? 'valid' : 'invalid')
        
        if (!data.usernameExists) {
           setPState('normal') // Password neutral because account doesn't exist
        } else {
           if (!password) setPState('normal')
           else setPState(data.passwordCorrect ? 'valid' : 'invalid')
        }
      } catch (e) {
        // Silently fail the visual check if the backend is down, keep states as they are
      }
    }, 400) // Debounce

    return () => clearTimeout(handler)
  }, [username, password])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    
    // Explicitly validate before firing full login if states already caught errors
    if (!username || !password) {
      showError('Invalid username/email or password.')
      return
    }

    setBusy(true)
    try {
      const { data } = await api.post('/login', { username, password })
      localStorage.setItem('accessor_token', data.token)
      localStorage.setItem('accessor_role', data.user.role)
      setUState('valid')
      setPState('valid')
      showSuccess('Login successful.')
      setTimeout(() => onNavigate('Dashboard'), 1000)
    } catch (err: any) {
      setUState(err.response?.status === 401 ? 'valid' : 'invalid') // Keep the color logic or just explicitly fail
      // To strictly match requirements: Keep the incorrect field RED.
      if (err.response?.status === 401) {
        // Generic failure handling
        if (uState === 'valid') setPState('invalid')
        else setUState('invalid')
      }
      showError('Invalid username/email or password.')
    } finally {
      setBusy(false)
    }
  }

  const getUClass = () => {
    if (!touchedU) return ''
    if (uState === 'valid') return 'input-valid'
    if (uState === 'invalid') return 'input-invalid'
    return ''
  }

  const getPClass = () => {
    if (!touchedP) return ''
    if (pState === 'valid') return 'input-valid'
    if (pState === 'invalid') return 'input-invalid'
    return ''
  }

  return (
    <Shell>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-heading">
          <h1>Welcome Back</h1>
          <p>Please enter your credentials to access the assessor portal.</p>
        </div>
        
        <label>
          Email address or username
          <div className={`auth-input ${getUClass()}`}>
            <Mail size={15}/>
            <input 
              value={username} 
              onChange={e => {
                setUsername(e.target.value)
                setTouchedU(true)
              }}
              onBlur={() => setTouchedU(true)}
              autoComplete="username" 
              required
            />
          </div>
        </label>
        
        <label>
          Password
          <div className={`auth-input ${getPClass()}`}>
            <LockKeyhole size={15}/>
            <input 
              type={show ? 'text' : 'password'} 
              value={password} 
              onChange={e => {
                setPassword(e.target.value)
                setTouchedP(true)
              }}
              onBlur={() => setTouchedP(true)}
              autoComplete="current-password" 
              required
            />
            <button type="button" onClick={() => setShow(!show)}>
              {show ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
        </label>
        
        <label className="auth-check">
          <input type="checkbox"/> Remember this device for 30 days
        </label>
        
        <button className="auth-submit" disabled={busy}>
          {busy ? 'Signing in…' : <>Sign In <ArrowRight size={16}/></>}
        </button>
        
        <p className="auth-switch">
          No account yet? <button type="button" onClick={() => onNavigate('Register')}>Register</button>
        </p>
        
        <footer>
          Secure Access System for City Hall Staff.<br/>
          © 2024 Municipal Solutions Group.
        </footer>
      </form>
    </Shell>
  )
}

export function RegisterPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { showError, showSuccess } = useModal()
  const [busy, setBusy] = useState(false)

  const { values, setValue, setFieldTouched, markAllTouched, isValid, getFieldClass, getFieldError } = useFormValidation({
    first_name: { initialValue: '', rules: [validateRequired] },
    last_name: { initialValue: '', rules: [validateRequired] },
    email: { initialValue: '', rules: [validateRequired, validateEmail] },
    username: { initialValue: '', rules: [validateRequired] },
    password: { initialValue: '', rules: [validateRequired, validatePassword] },
    confirm_password: { 
      initialValue: '', 
      rules: [
        validateRequired, 
        (val, form) => val !== form.password ? 'Passwords do not match.' : null
      ] 
    }
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    markAllTouched()
    if (!isValid()) {
      showError('Please check the highlighted fields and fix the errors.')
      return
    }

    setBusy(true)
    try {
      const { data } = await api.post('/register', {
        first_name: values.first_name,
        last_name: values.last_name,
        username: values.username,
        email: values.email,
        password: values.password
      })
      showSuccess(data.message)
      setTimeout(() => onNavigate('Login'), 1500)
    } catch (err: any) {
      showError(err.response?.data?.message || 'Unable to create your account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell register>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-heading">
          <h1>Create an account</h1>
          <p>Register for official municipal access. All fields are required.</p>
        </div>
        
        <label>
          Full name
          <div className="auth-two">
            <input 
              className={getFieldClass('first_name')}
              placeholder="First name" 
              value={values.first_name} 
              onChange={e => setValue('first_name', e.target.value)}
              onBlur={() => setFieldTouched('first_name')}
              required
            />
            <input 
              className={getFieldClass('last_name')}
              placeholder="Last name" 
              value={values.last_name} 
              onChange={e => setValue('last_name', e.target.value)}
              onBlur={() => setFieldTouched('last_name')}
              required
            />
          </div>
        </label>
        
        <label>
          Municipal email
          <div className={`auth-input ${getFieldClass('email')}`}>
            <Mail size={15}/>
            <input 
              type="email" 
              placeholder="name@municipality.gov" 
              value={values.email} 
              onChange={e => setValue('email', e.target.value)}
              onBlur={() => setFieldTouched('email')}
              required
            />
          </div>
        </label>
        
        <label>
          Username
          <input 
            className={`auth-plain ${getFieldClass('username')}`}
            placeholder="e.g. jdoe" 
            value={values.username} 
            onChange={e => setValue('username', e.target.value)}
            onBlur={() => setFieldTouched('username')}
            required
          />
        </label>
        
        <label>
          Password
          <input 
            className={`auth-plain ${getFieldClass('password')}`}
            type="password" 
            minLength={6} 
            value={values.password} 
            onChange={e => {
              setValue('password', e.target.value)
              if (values.confirm_password) setFieldTouched('confirm_password') // Re-validate match
            }}
            onBlur={() => setFieldTouched('password')}
            required
          />
        </label>

        <label>
          Confirm Password
          <input 
            className={`auth-plain ${getFieldClass('confirm_password')}`}
            type="password" 
            value={values.confirm_password} 
            onChange={e => setValue('confirm_password', e.target.value)}
            onBlur={() => setFieldTouched('confirm_password')}
            required
          />
          {getFieldError('confirm_password') && (
             <span style={{color: '#a32323', fontSize: '10px'}}>{getFieldError('confirm_password')}</span>
          )}
        </label>
        
        <button className="auth-submit" disabled={busy} style={{marginTop: '10px'}}>
          {busy ? 'Creating…' : <>Create Account <ArrowRight size={16}/></>}
        </button>
        
        <p className="auth-switch">
          Already have an account? <button type="button" onClick={() => onNavigate('Login')}>Sign In</button>
        </p>
        
        <footer>
          © 2024 Municipal Assessor’s Office · Privacy Policy · Terms of Service
        </footer>
      </form>
    </Shell>
  )
}
