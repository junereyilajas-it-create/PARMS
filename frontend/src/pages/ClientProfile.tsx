import { useEffect, useState, type FormEvent } from 'react'
import { User, Mail, Phone, Shield } from 'lucide-react'
import { useModal } from '../contexts/ModalContext'
import api from '../lib/api'

export function ClientProfile() {
  const { showSuccess, showError } = useModal()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', contact_number: '' })

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/client/profile')
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

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/client/profile', form)
      showSuccess('Profile updated successfully.')
      const { data } = await api.get('/client/profile')
      setProfile(data)
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update profile.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">My Profile</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your personal information and account settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><User size={18} className="text-gray-500" /> Personal Information</h3>
          </div>
          <form onSubmit={submit} className="p-6 space-y-4">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="email" className="w-full pl-9 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="tel" className="w-full pl-9 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.contact_number} onChange={e => setForm({...form, contact_number: e.target.value})} />
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t border-gray-100 dark:border-gray-800 mt-6">
              <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-70">{busy ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Shield size={18} className="text-gray-500" /> Account Details</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="block text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Account Role</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 uppercase">{profile?.role || 'CLIENT'}</span>
              </div>
              <div>
                <span className="block text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Username</span>
                <span className="text-sm text-gray-900 dark:text-white">{profile?.username}</span>
              </div>
              <div>
                <span className="block text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Status</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 uppercase">ACTIVE</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><User size={18} className="text-gray-500" /> Owner Information</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="block text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Owner ID</span>
                <span className="text-sm font-mono text-gray-900 dark:text-white">{profile?.owner_id ? String(profile.owner_id).padStart(5, '0') : 'N/A'}</span>
              </div>
              <p className="text-xs text-gray-500">Note: Property ownership details and official Assessor records can only be updated by municipal staff. Visit the Assessor's Office with relevant documents if changes are required.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
