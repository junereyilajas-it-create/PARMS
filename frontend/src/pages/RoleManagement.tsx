import { Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../lib/api'

export function RoleManagement() {
  const [roleStats, setRoleStats] = useState<any[]>([])

  const roleDescriptions: Record<string, { desc: string; perms: string[] }> = {
    'super_admin': {
      desc: 'Full system access and configuration.',
      perms: ['User Management', 'Role Management', 'System Settings', 'Activity Logs', 'System Monitoring']
    },
    'admin': {
      desc: 'Department head or head assessor managing all operational workflows.',
      perms: ['Properties', 'Lots', 'Buildings', 'Owners', 'Assessments', 'Assessment Approval']
    },
    'assessor': {
      desc: 'Field assessor managing specific assigned properties.',
      perms: ['Assigned Properties', 'Assessments', 'GIS', 'Assessment Submission']
    },
    'staff': {
      desc: 'Clerical staff for basic data entry and document requests.',
      perms: ['Allowed Data Entry', 'Properties', 'Owners', 'Certificates']
    },
    'client': {
      desc: 'Property owner viewing their own records.',
      perms: ['Own Properties', 'Own Assessments', 'Own GIS Property', 'Certificate Requests']
    }
  }

  useEffect(() => {
    api.get('/stats/super_admin')
      .then(res => setRoleStats(res.data.users || []))
      .catch(console.error)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="text-purple-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Roles & Permissions</h1>
          <p className="text-sm text-gray-500">System access control policies and role definitions based on current database records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.keys(roleDescriptions).map(roleKey => {
          const stat = roleStats.find(r => r.role === roleKey)
          const info = roleDescriptions[roleKey]
          return (
            <div key={roleKey} className="glass-panel p-6 rounded-2xl flex flex-col h-full border-t-4 border-t-purple-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-bl-lg text-sm">
                {stat?.count || 0} Users
              </div>
              <h2 className="text-xl font-bold dark:text-white mb-2 uppercase">{roleKey.replace('_', ' ')}</h2>
              <p className="text-sm text-gray-500 mb-6 flex-grow pr-16">{info.desc}</p>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Permissions</h3>
                <ul className="space-y-2">
                  {info.perms.map(perm => (
                    <li key={perm} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-green-500 font-bold">✓</span> {perm}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
