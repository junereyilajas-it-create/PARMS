import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useModal } from '../contexts/ModalContext'
import { useFormValidation, validateRequired, validateEmail, validatePassword } from '../lib/validation'
import api from '../lib/api'
import { SystemLogo } from '../components/common/SystemLogo'
import '../styles/AuthPages.css'

function Shell({ children, register = false }: { children: React.ReactNode; register?: boolean }) {
  return (
    <main className={`auth-page theme-isolated ${register ? 'auth-register' : ''}`} data-theme="light">
      <section className="auth-card">
        <div className="auth-panel">
          <div className="auth-brand">
            <SystemLogo className="w-10 h-10 object-contain shrink-0" navigateTo="/" />
            <div>
              <span className="auth-brand-title">PARMS</span>
              <span className="auth-brand-subtitle">Office of the Municipal Assessor · Lagonglong</span>
            </div>
          </div>
          {children}
        </div>
        <aside className="auth-image">
          <div className="auth-image-overlay" />
          <div className="auth-image-copy">
            {register ? (
              <>
                <div className="auth-image-tag">REGISTRATION PORTAL</div>
                <h2>Join the Municipal Property System</h2>
                <p>Create an account to track your land declarations, submit assessment requests, and inspect registered property records online.</p>
                <div className="auth-image-sub">Municipality of Lagonglong · Misamis Oriental</div>
              </>
            ) : (
              <>
                <div className="auth-image-tag">OFFICIAL MUNICIPAL PLATFORM</div>
                <h2>Property Assessment & Records Management System</h2>
                <p>Empowering fair, transparent, and accurate municipal property valuation, cadastral mapping, and certified tax documentation.</p>
                <div className="auth-image-badges">
                  <span>✓ Verified Cadastral Parcels</span>
                  <span>✓ Interactive GIS Mapping</span>
                  <span>✓ Certified Tax Declarations</span>
                </div>
                <div className="auth-image-sub">Municipality of Lagonglong · Office of the Municipal Assessor</div>
              </>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}

export function LoginPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  type LoginScreenState = 'idle' | 'loggingIn' | 'success'
  const [loginScreenState, setLoginScreenState] = useState<LoginScreenState>('idle')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameStarted, setUsernameStarted] = useState(false)
  const [passwordStarted, setPasswordStarted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isUsernameValid, setIsUsernameValid] = useState(false)
  const [isPasswordValid, setIsPasswordValid] = useState(false)

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loggingInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRequestSeqRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Username and Password Validation against existing database/backend:
  // Red when empty, unverified, partial, or incorrect; green only when verified against the backend database.
  const validateCredentials = (userVal: string, passVal: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    const trimmedUser = userVal.trim()
    if (!trimmedUser) {
      latestRequestSeqRef.current += 1
      setIsUsernameValid(false)
      setIsPasswordValid(false)
      return
    }

    const requestSeq = ++latestRequestSeqRef.current
    const controller = new AbortController()
    abortControllerRef.current = controller

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const payload: { username: string; password?: string } = { username: trimmedUser }
        if (passVal) {
          payload.password = passVal
        }
        const res = await api.post(
          '/validate-login',
          payload,
          { signal: controller.signal }
        )
        if (requestSeq === latestRequestSeqRef.current) {
          setIsUsernameValid(Boolean(res.data?.usernameExists))
          setIsPasswordValid(Boolean(passVal && res.data?.passwordCorrect))
        }
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
          return
        }
        if (requestSeq === latestRequestSeqRef.current) {
          setIsUsernameValid(false)
          setIsPasswordValid(false)
        }
      }
    }, 150)
  }

  // Determine dynamic border classes
  const usernameBorderClass = (usernameStarted || submitted || username)
    ? (isUsernameValid ? 'input-valid' : 'input-invalid')
    : ''

  const passwordBorderClass = (passwordStarted || submitted || password)
    ? (isPasswordValid ? 'input-valid' : 'input-invalid')
    : ''

  // Clean up any pending timer and in-flight request on component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      if (loggingInTimerRef.current) clearTimeout(loggingInTimerRef.current)
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  const triggerError = (msg: string) => {
    // Clear previous pending timer to prevent stacking
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
    setLoginError(msg)
    // Automatically hide the message after exactly 2 seconds (2000ms)
    errorTimerRef.current = setTimeout(() => {
      setLoginError(null)
      errorTimerRef.current = null
    }, 2000)
  }

  const handleUsernameChange = (val: string) => {
    setUsername(val)
    setUsernameStarted(true)
    setIsUsernameValid(false) // Immediately invalid until verified for current value
    setIsPasswordValid(false) // Re-verify password against updated username

    // Clear previous error immediately when user begins editing credentials
    if (loginError) {
      setLoginError(null)
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
        errorTimerRef.current = null
      }
    }

    validateCredentials(val, password)
  }

  const handlePasswordChange = (val: string) => {
    setPassword(val)
    setPasswordStarted(true)
    setIsPasswordValid(false) // Immediately invalid until verified for current value

    // Clear previous error immediately when user begins editing credentials
    if (loginError) {
      setLoginError(null)
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
        errorTimerRef.current = null
      }
    }

    validateCredentials(username, val)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()

    if (busy || loginScreenState !== 'idle') return

    setSubmitted(true)
    setUsernameStarted(true)
    setPasswordStarted(true)

    // Clear previous error when a new attempt begins
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
    setLoginError(null)

    if (!username.trim() || !password) {
      triggerError('Invalid email or password. Please try again.')
      return
    }

    setBusy(true)
    try {
      const { data } = await api.post('/login', {
        username: username.trim(),
        password
      })
      localStorage.setItem('accessor_token', data.token)
      localStorage.setItem('accessor_role', data.user.role)

      // 3. Logging-In Screen — Exactly 2 Seconds (2000ms)
      setLoginScreenState('loggingIn')

      loggingInTimerRef.current = setTimeout(() => {
        // 4. Login Successful Screen — Exactly 1 Second (1000ms)
        setLoginScreenState('success')

        successTimerRef.current = setTimeout(() => {
          // Automatic redirection to role-specific dashboard
          onNavigate('Dashboard')
        }, 1000)
      }, 2000)
    } catch (err: any) {
      setBusy(false)
      setLoginScreenState('idle')
      if (err.response?.status === 401) {
        // Required exact text: Do not reveal whether email alone or password alone was incorrect
        triggerError('Invalid email or password. Please try again.')
      } else if (err.response?.status === 403) {
        triggerError(err.response?.data?.message || 'Your account is inactive. Please contact the administrator.')
      } else if (!err.response) {
        // Network or server unavailable error
        triggerError('Unable to connect to the server. Please check your connection and try again.')
      } else {
        triggerError(err.response?.data?.message || 'Invalid email or password. Please try again.')
      }
    }
  }

  return (
    <>
      {/* 3. Logging-In Screen — Exactly 2 Seconds */}
      {loginScreenState === 'loggingIn' && (
        <div 
          id="logging-in-screen"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 backdrop-blur-md p-4 transition-all duration-300 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 sm:p-10 max-w-sm w-full mx-auto flex flex-col items-center shadow-2xl border border-gray-100 dark:border-gray-800 text-center animate-in zoom-in-95 duration-300">
            <div className="mb-6 relative">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center p-3 shadow-inner">
                <SystemLogo className="w-full h-full object-contain" clickable={false} />
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Logging in...
              </h2>
            </div>

            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
              Please wait while we prepare your dashboard.
            </p>

            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-6 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full animate-pulse w-3/4 mx-auto" />
            </div>
          </div>
        </div>
      )}

      {/* 4. Login Successful Screen — Exactly 1 Second */}
      {loginScreenState === 'success' && (
        <div 
          id="login-success-screen"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 backdrop-blur-md p-4 transition-all duration-300 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 sm:p-10 max-w-sm w-full mx-auto flex flex-col items-center shadow-2xl border border-gray-100 dark:border-gray-800 text-center animate-in zoom-in-95 duration-300">
            <div className="mb-4 relative">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center p-3 shadow-inner">
                <SystemLogo className="w-full h-full object-contain" clickable={false} />
              </div>
            </div>

            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4 animate-in zoom-in-75 duration-300 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={38} className="stroke-[2.5]" />
            </div>

            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">
              Successfully Logged In!
            </h2>

            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      )}

      <Shell>
        <form className="auth-form" onSubmit={submit} autoComplete="off" noValidate>
          <div className="auth-heading">
            <h1>Welcome Back</h1>
            <p>Sign in to access the property assessment system.</p>
          </div>

          {/* Non-blocking 2-second inline error notification */}
          {loginError && (
            <div
              id="login-error-banner"
              role="alert"
              className="p-3 mb-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 shadow-xs"
            >
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <label>
            Email address or username
            <div className={`auth-input ${usernameBorderClass}`}>
              <Mail size={15} />
              <input
                id="login-username"
                value={username}
                onChange={e => handleUsernameChange(e.target.value)}
                onFocus={() => {
                  setUsernameStarted(true)
                  if (username.trim()) validateCredentials(username, password)
                }}
                autoComplete="off"
                placeholder="Enter your email or username"
                required
                disabled={busy || loginScreenState !== 'idle'}
              />
            </div>
          </label>

          <label>
            Password
            <div className={`auth-input ${passwordBorderClass}`}>
              <LockKeyhole size={15} />
              <input
                id="login-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => handlePasswordChange(e.target.value)}
                onFocus={() => {
                  setPasswordStarted(true)
                  if (password) validateCredentials(username, password)
                }}
                autoComplete="new-password"
                placeholder="Enter your password"
                required
                disabled={busy || loginScreenState !== 'idle'}
              />
              <button 
                type="button" 
                onClick={() => setShow(!show)} 
                aria-label="Toggle password visibility"
                disabled={busy || loginScreenState !== 'idle'}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="auth-check">
              <input type="checkbox" /> Remember this device for 30 days
            </label>
            <button type="button" onClick={() => onNavigate('ForgotPassword')} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '12px', cursor: 'pointer', padding: 0 }}>Forgot Password?</button>
          </div>

          <button id="login-submit-btn" className="auth-submit" disabled={busy || loginScreenState !== 'idle'}>
            {busy || loginScreenState !== 'idle' ? 'Signing in…' : <>Sign In <ArrowRight size={16} /></>}
          </button>

          <p className="auth-switch">
            No account yet? <button type="button" onClick={() => onNavigate('Register')}>Register</button>
          </p>

          <footer>
            Official Government Access Portal.<br />
            © {new Date().getFullYear()} Municipal Assessor's Office · Lagonglong.
          </footer>
        </form>
      </Shell>
    </>
  )
}

export function RegisterPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { showSuccess } = useModal()
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { values, setValue, setFieldTouched, markAllTouched, isValid, getFieldClass, getFieldError } = useFormValidation<Record<string, string>>({
    first_name: {
      initialValue: '',
      rules: [
        validateRequired,
        (val) => !val || !val.trim() ? 'First name cannot be empty or only spaces.' : null
      ]
    },
    last_name: {
      initialValue: '',
      rules: [
        validateRequired,
        (val) => !val || !val.trim() ? 'Last name cannot be empty or only spaces.' : null
      ]
    },
    email: {
      initialValue: '',
      rules: [
        validateRequired,
        validateEmail
      ]
    },
    username: {
      initialValue: '',
      rules: [
        validateRequired,
        (val) => !val || !val.trim() ? 'Username cannot be empty or only spaces.' : null
      ]
    },
    password: {
      initialValue: '',
      rules: [
        validateRequired,
        validatePassword
      ]
    },
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
    setFormError(null)
    setSuccessMsg(null)
    markAllTouched()

    if (!isValid()) {
      setFormError('Please check the highlighted fields and fix the errors.')
      return
    }

    const cleanFirst = (values.first_name || '').trim().replace(/\s+/g, ' ')
    const cleanLast = (values.last_name || '').trim().replace(/\s+/g, ' ')
    const cleanEmail = (values.email || '').trim().toLowerCase()
    const cleanUsername = (values.username || '').trim()

    if (!cleanFirst || !cleanLast) {
      setFormError('First and last name cannot consist only of spaces.')
      return
    }

    setBusy(true)
    try {
      const { data } = await api.post('/register', {
        first_name: cleanFirst,
        last_name: cleanLast,
        username: cleanUsername,
        email: cleanEmail,
        password: values.password,
        confirm_password: values.confirm_password
      })
      setSuccessMsg(data.message || 'Account created successfully. You can now sign in.')
      showSuccess(data.message || 'Account created successfully. You can now sign in.')
      setTimeout(() => onNavigate('Login'), 1500)
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to create your account. Please check your information and try again.'
      setFormError(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleFieldChange = (key: string, value: string) => {
    setValue(key, value)
    if (formError) setFormError(null)
  }

  return (
    <Shell register>
      <form className="auth-form" onSubmit={submit} autoComplete="off" noValidate>
        <div className="auth-heading">
          <h1>Create an account</h1>
          <p>Register for official municipal access. All fields are required.</p>
        </div>

        {formError && (
          <div
            id="register-error-banner"
            role="alert"
            className="p-3 mb-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 shadow-xs"
          >
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {successMsg && (
          <div
            id="register-success-banner"
            role="status"
            className="p-3 mb-3 rounded-xl bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 shadow-xs"
          >
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <label>
          Full name
          <div className="auth-two">
            <div>
              <input
                id="register-first-name"
                className={getFieldClass('first_name')}
                placeholder="First name"
                value={values.first_name}
                onChange={e => handleFieldChange('first_name', e.target.value)}
                onBlur={() => setFieldTouched('first_name')}
                required
              />
              {getFieldError('first_name') && (
                <span className="text-[10px] text-red-600 block mt-0.5">{getFieldError('first_name')}</span>
              )}
            </div>
            <div>
              <input
                id="register-last-name"
                className={getFieldClass('last_name')}
                placeholder="Last name"
                value={values.last_name}
                onChange={e => handleFieldChange('last_name', e.target.value)}
                onBlur={() => setFieldTouched('last_name')}
                required
              />
              {getFieldError('last_name') && (
                <span className="text-[10px] text-red-600 block mt-0.5">{getFieldError('last_name')}</span>
              )}
            </div>
          </div>
        </label>

        <label>
          Email address
          <div className={`auth-input ${getFieldClass('email')}`}>
            <Mail size={15} />
            <input
              id="register-email"
              type="email"
              placeholder="e.g. user@example.com"
              value={values.email}
              onChange={e => handleFieldChange('email', e.target.value)}
              onBlur={() => setFieldTouched('email')}
              required
            />
          </div>
          {getFieldError('email') && (
            <span className="text-[10px] text-red-600 block mt-0.5">{getFieldError('email')}</span>
          )}
        </label>

        <label>
          Username
          <input
            id="register-username"
            className={`auth-plain ${getFieldClass('username')}`}
            placeholder="e.g. jdoe"
            value={values.username}
            onChange={e => handleFieldChange('username', e.target.value)}
            onBlur={() => setFieldTouched('username')}
            autoComplete="off"
            required
          />
          {getFieldError('username') && (
            <span className="text-[10px] text-red-600 block mt-0.5">{getFieldError('username')}</span>
          )}
        </label>

        <label>
          Password
          <input
            id="register-password"
            className={`auth-plain ${getFieldClass('password')}`}
            type="password"
            minLength={6}
            value={values.password}
            onChange={e => {
              handleFieldChange('password', e.target.value)
              if (values.confirm_password) setFieldTouched('confirm_password')
            }}
            onBlur={() => setFieldTouched('password')}
            autoComplete="new-password"
            required
          />
          {getFieldError('password') && (
            <span className="text-[10px] text-red-600 block mt-0.5">{getFieldError('password')}</span>
          )}
        </label>

        <label>
          Confirm Password
          <input
            id="register-confirm-password"
            className={`auth-plain ${getFieldClass('confirm_password')}`}
            type="password"
            value={values.confirm_password}
            onChange={e => handleFieldChange('confirm_password', e.target.value)}
            onBlur={() => setFieldTouched('confirm_password')}
            autoComplete="new-password"
            required
          />
          {getFieldError('confirm_password') && (
            <span className="text-[10px] text-red-600 block mt-0.5">{getFieldError('confirm_password')}</span>
          )}
        </label>

        <button id="register-submit-btn" className="auth-submit" disabled={busy} style={{ marginTop: '10px' }}>
          {busy ? 'Creating Account…' : <>Create Account <ArrowRight size={16} /></>}
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

export function ForgotPasswordPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { showError, showSuccess } = useModal()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email) {
      showError('Please enter your email address.')
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post('/forgot-password', { email })
      showSuccess(data.message)
    } catch (err: any) {
      showError(err.response?.data?.message || 'An error occurred.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <form className="auth-form" onSubmit={submit} autoComplete="off" noValidate>
        <div className="auth-heading">
          <h1>Forgot Password</h1>
          <p>Enter your registered email address and we will send instructions to reset your password.</p>
        </div>

        <label>
          Email address
          <div className="auth-input">
            <Mail size={15} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="off"
              placeholder="Enter your email"
              required
            />
          </div>
        </label>

        <button className="auth-submit" disabled={busy} style={{ marginTop: '20px' }}>
          {busy ? 'Sending…' : 'Send Reset Link'}
        </button>

        <p className="auth-switch" style={{ marginTop: '20px' }}>
          <button type="button" onClick={() => onNavigate('Login')}>Back to Login</button>
        </p>
      </form>
    </Shell>
  )
}

export function ResetPasswordPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { showError, showSuccess } = useModal()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Get token from URL
  const queryParams = new URLSearchParams(window.location.search)
  const token = queryParams.get('token')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || !confirmPassword) {
      showError('Both fields are required.')
      return
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      showError('Password is too short.')
      return
    }

    setBusy(true)
    try {
      const { data } = await api.post('/reset-password', { token, newPassword: password })
      showSuccess(data.message)
      setTimeout(() => onNavigate('Login'), 2000)
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to reset password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <form className="auth-form" onSubmit={submit} autoComplete="off" noValidate>
        <div className="auth-heading">
          <h1>Reset Password</h1>
          <p>Enter your new password below.</p>
        </div>

        <label>
          New Password
          <div className="auth-input">
            <LockKeyhole size={15} />
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Enter new password"
              required
            />
            <button type="button" onClick={() => setShow(!show)}>
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </label>

        <label>
          Confirm Password
          <div className="auth-input">
            <LockKeyhole size={15} />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Confirm new password"
              required
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </label>

        <button className="auth-submit" disabled={busy} style={{ marginTop: '20px' }}>
          {busy ? 'Saving…' : 'Change Password'}
        </button>

        <p className="auth-switch" style={{ marginTop: '20px' }}>
          <button type="button" onClick={() => onNavigate('Login')}>Back to Login</button>
        </p>
      </form>
    </Shell>
  )
}
