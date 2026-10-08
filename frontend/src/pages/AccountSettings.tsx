import { useEffect, useState, type FormEvent } from 'react'
import { User, Mail, Shield, Lock, Clock } from 'lucide-react'
import { useModal } from '../contexts/ModalContext'
import api from '../lib/api'

export function AccountSettings() {
  const { showSuccess, showError } = useModal()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [passBusy, setPassBusy] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', contact_number: '' })
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/profile')
        setProfile(data)
        setForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          contact_number: data.contact_number || ''
        })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/profile', form)
      showSuccess('Profile updated successfully.')
      const { data } = await api.get('/profile')
      setProfile(data)
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update profile.')
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (passForm.newPassword !== passForm.confirmPassword) {
      return showError('New password and confirmation must match.')
    }
    setPassBusy(true)
    try {
      await api.put('/profile/password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      })
      showSuccess('Password changed successfully. Please use your new password next time you log in.')
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setPassBusy(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading account settings...</div>

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your personal information, security preferences, and account status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Profile Edit & Password */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><User size={18} className="text-gray-500" /> Edit Profile</h3>
            </div>
            <form onSubmit={submitProfile} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="email" className="w-full pl-9 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-70">{busy ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Lock size={18} className="text-gray-500" /> Change Password</h3>
            </div>
            <form onSubmit={submitPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                <input type="password" placeholder="Enter current password" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={passForm.currentPassword} onChange={e => setPassForm({...passForm, currentPassword: e.target.value})} required minLength={6} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                  <input type="password" placeholder="New password" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={passForm.newPassword} onChange={e => setPassForm({...passForm, newPassword: e.target.value})} required minLength={6} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                  <input type="password" placeholder="Confirm new password" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={passForm.confirmPassword} onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})} required minLength={6} />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={passBusy} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-70">{passBusy ? 'Updating...' : 'Update Password'}</button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Security Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Shield size={18} className="text-gray-500" /> Account Security</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Username</span>
                <span className="text-sm font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded inline-block w-fit">{profile?.username}</span>
                <span className="text-xs text-gray-400 mt-1">Usernames cannot be changed for security reasons.</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Account Role</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 uppercase w-fit">{profile?.role}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit \${profile?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-green-100 text-green-800'} uppercase`}>{profile?.status || 'ACTIVE'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1 flex items-center gap-1"><Clock size={12} /> Last Login</span>
                <span className="text-sm text-gray-900 dark:text-white">{profile?.last_login ? new Date(profile.last_login).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Date Created</span>
                <span className="text-sm text-gray-900 dark:text-white">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden p-5 flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400 shrink-0">
               <Shield size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold dark:text-white">Active Session</h4>
              <p className="text-xs text-gray-500 mt-0.5">You are currently logged in securely. Remember to log out when using public devices.</p>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  )
}
