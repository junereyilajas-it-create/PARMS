import { useEffect, useState, type FormEvent } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Lock, 
  Clock, 
  Phone, 
  Palette, 
  Bell, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../lib/api';

export function AccountSettings() {
  const { showSuccess, showError } = useModal();
  const { setTheme } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [passBusy, setPassBusy] = useState(false);

  // Profile form state
  const [form, setForm] = useState({ 
    first_name: '', 
    middle_name: '',
    last_name: '', 
    email: '', 
    contact_number: '',
    theme_preference: 'system',
    notification_preferences: {
      assessment_updates: true,
      mapping_alerts: true,
      report_reminders: false
    }
  });

  // Password form state
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/profile');
        setProfile(data);
        
        let notifs = {
          assessment_updates: true,
          mapping_alerts: true,
          report_reminders: false
        };
        if (data.notification_preferences) {
          try {
            notifs = typeof data.notification_preferences === 'string' 
              ? JSON.parse(data.notification_preferences) 
              : data.notification_preferences;
          } catch (e) {
            console.error('Failed to parse notifications preference', e);
          }
        }

        setForm({
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          contact_number: data.contact_number || '',
          theme_preference: data.theme_preference || 'system',
          notification_preferences: notifs
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/profile', form);
      showSuccess('Profile and preferences updated successfully.');
      if (form.theme_preference === 'light' || form.theme_preference === 'dark') {
        setTheme(form.theme_preference);
      }
      const { data } = await api.get('/profile');
      setProfile(data);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passForm.newPassword.length < 8) {
      return showError('New password must be at least 8 characters long.');
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      return showError('New password and confirmation must match exactly.');
    }
    setPassBusy(true);
    try {
      await api.put('/profile/password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      });
      showSuccess('Password changed successfully. Please remember your new password.');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setPassBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading account settings...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your personal identity, contact details, display preferences, and account security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Profile Edit & Password */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profile Management */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <User size={18} className="text-green-600" /> Personal Profile
              </h3>
            </div>
            <form onSubmit={submitProfile} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                    value={form.first_name} 
                    onChange={e => setForm({...form, first_name: e.target.value})} 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Middle Name
                  </label>
                  <input 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                    value={form.middle_name} 
                    placeholder="Optional"
                    onChange={e => setForm({...form, middle_name: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                    value={form.last_name} 
                    onChange={e => setForm({...form, last_name: e.target.value})} 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="email" 
                      className="w-full pl-9 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})} 
                      required 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="e.g. 0917-123-4567"
                      className="w-full pl-9 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                      value={form.contact_number} 
                      onChange={e => setForm({...form, contact_number: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* Personal Display & Notification Preferences */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                      <Palette size={14} className="text-green-600" /> Personal Theme Preference
                    </label>
                    <select
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white"
                      value={form.theme_preference}
                      onChange={e => setForm({...form, theme_preference: e.target.value})}
                    >
                      <option value="system">System Default</option>
                      <option value="light">Light Mode</option>
                      <option value="dark">Dark Mode</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                      <Bell size={14} className="text-blue-600" /> Notifications
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={form.notification_preferences.assessment_updates}
                        onChange={e => setForm({
                          ...form, 
                          notification_preferences: { ...form.notification_preferences, assessment_updates: e.target.checked }
                        })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      Assessment status notifications
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={form.notification_preferences.mapping_alerts}
                        onChange={e => setForm({
                          ...form, 
                          notification_preferences: { ...form.notification_preferences, mapping_alerts: e.target.checked }
                        })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      GIS Tax mapping request updates
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={busy} 
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-70 shadow-sm"
                >
                  {busy ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Password Management */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock size={18} className="text-amber-600" /> Change Password
              </h3>
            </div>
            <form onSubmit={submitPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input 
                    type={showCurrentPass ? 'text' : 'password'} 
                    placeholder="Enter current password" 
                    className="w-full pr-10 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                    value={passForm.currentPassword} 
                    onChange={e => setPassForm({...passForm, currentPassword: e.target.value})} 
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    New Password <span className="text-red-500">* (min 8 chars)</span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showNewPass ? 'text' : 'password'} 
                      placeholder="Minimum 8 characters" 
                      className="w-full pr-10 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                      value={passForm.newPassword} 
                      onChange={e => setPassForm({...passForm, newPassword: e.target.value})} 
                      required 
                      minLength={8} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showConfirmPass ? 'text' : 'password'} 
                      placeholder="Re-enter new password" 
                      className="w-full pr-10 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white" 
                      value={passForm.confirmPassword} 
                      onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})} 
                      required 
                      minLength={8} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {passForm.newPassword && (
                <div className="text-xs space-y-1 pt-1">
                  <div className={`flex items-center gap-1.5 ${passForm.newPassword.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle2 size={13} /> At least 8 characters
                  </div>
                  {passForm.confirmPassword && (
                    <div className={`flex items-center gap-1.5 ${passForm.newPassword === passForm.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                      {passForm.newPassword === passForm.confirmPassword ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {passForm.newPassword === passForm.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={passBusy} 
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-70 shadow-sm"
                >
                  {passBusy ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Security Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield size={18} className="text-green-600" /> Account Identity
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Username</span>
                <span className="text-sm font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded inline-block w-fit">
                  {profile?.username}
                </span>
                <span className="text-[11px] text-gray-400 mt-1">Immutable system identifier.</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Account Role</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 uppercase w-fit">
                  {profile?.role}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Account Status</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 uppercase w-fit">
                  {profile?.status || 'ACTIVE'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1 flex items-center gap-1">
                  <Clock size={12} /> Last Successful Login
                </span>
                <span className="text-sm text-gray-900 dark:text-white font-medium">
                  {profile?.last_login ? new Date(profile.last_login).toLocaleString() : 'Current Session'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase mb-1">Registered Since</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden p-5 flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400 shrink-0">
               <Shield size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Active Secure Session</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Role authorization and tokens are validated per request. Always log out when stepping away from municipal workstations.
              </p>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}

