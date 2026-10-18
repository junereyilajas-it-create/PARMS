import { Shield, Search, UserCog, Save, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useModal } from '../contexts/ModalContext'

export function RoleManagement() {
  const { showSuccess, showError } = useModal()
  const [users, setUsers] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
  const [search, setSearch] = useState('')

  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userPerms, setUserPerms] = useState<string[]>([])
  const [editingRole, setEditingRole] = useState<string>('')

  const loadData = async () => {
    try {
      const [uRes, pRes, rpRes] = await Promise.all([
        api.get('/users'),
        api.get('/permissions'),
        api.get('/roles/permissions')
      ]);
      setUsers(uRes.data);
      setPermissions(pRes.data);
      setRolePermissions(rpRes.data);
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleManageUser = async (user: any) => {
    setSelectedUser(user);
    setEditingRole(user.role);
    try {
      const { data } = await api.get(`/users/${user.user_id}/permissions`);
      setUserPerms(data);
    } catch (e) {
      console.error(e);
      setUserPerms([]);
    }
  }

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      // Save role change if modified
      if (editingRole !== selectedUser.role) {
        await api.put(`/users/${selectedUser.user_id}`, {
          ...selectedUser,
          role: editingRole
        });
      }

      // Save user permissions
      await api.put(`/users/${selectedUser.user_id}/permissions`, {
        permissions: userPerms
      });

      showSuccess('Permissions and role successfully updated.');
      setSelectedUser(null);
      loadData();
    } catch (e: any) {
      showError(e.response?.data?.message || 'Failed to update user permissions.');
    }
  }

  const toggleUserPermission = (perm: string) => {
    if (userPerms.includes(perm)) {
      setUserPerms(userPerms.filter(p => p !== perm));
    } else {
      setUserPerms([...userPerms, perm]);
    }
  }

  const filteredUsers = users.filter(u =>
    `${u.first_name} ${u.last_name} ${u.username} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  );

  const permissionsByCategory = permissions.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-purple-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Roles & Permissions</h1>
          <p className="text-sm text-gray-500">Manage user roles and granular permissions across the system.</p>
        </div>
      </div>

      {!selectedUser ? (
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b dark:border-neutral-700">
                  <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">User</th>
                  <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Username / Email</th>
                  <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Role</th>
                  <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                  <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredUsers.map(u => (
                  <tr
                    key={u.user_id}
                    onClick={() => handleManageUser(u)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleManageUser(u);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Manage role and permissions for ${u.first_name} ${u.last_name}`}
                    className="cursor-pointer hover:bg-purple-50/70 dark:hover:bg-purple-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:bg-purple-50/70 dark:focus-visible:bg-purple-950/30 transition-colors group select-none"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                        {u.first_name} {u.last_name}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                      <div>{u.username}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-xs font-bold rounded-md uppercase tracking-wider">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageUser(u);
                        }}
                        className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-transform group-hover:scale-110"
                        title="Manage Permissions"
                        aria-label={`Manage Permissions for ${u.first_name}`}
                      >
                        <UserCog size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between glass-panel p-6 rounded-2xl border-l-4 border-l-purple-500">
            <div>
              <h2 className="text-xl font-bold dark:text-white">Managing: {selectedUser.first_name} {selectedUser.last_name}</h2>
              <p className="text-sm text-gray-500">{selectedUser.username} | {selectedUser.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 dark:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-md transition-all"
              >
                <Save size={18} /> Save Changes
              </button>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold mb-4 dark:text-white">User Role</h3>
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Role</label>
              <select
                value={editingRole}
                onChange={e => setEditingRole(e.target.value)}
                className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin / Head Assessor</option>
                <option value="assessor">Assessor</option>
                <option value="staff">Staff</option>
                <option value="client">Owner / Client</option>
              </select>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="mb-6 border-b pb-4 dark:border-neutral-700">
              <h3 className="text-lg font-bold dark:text-white">Individual Permissions</h3>
              <p className="text-sm text-gray-500">
                Grant or revoke specific permissions for this user.
                Permissions inherited from their role ({editingRole.replace('_', ' ').toUpperCase()}) cannot be removed here.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <div key={category} className="space-y-3">
                  <h4 className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs bg-gray-100 dark:bg-neutral-800 p-2 rounded">
                    {category}
                  </h4>
                  <div className="space-y-2">
                    {(perms as any[]).map((p: any) => {
                      const isInherited = rolePermissions[editingRole]?.includes(p.permission_name);
                      const isGranted = userPerms.includes(p.permission_name);
                      const isSuperAdmin = editingRole === 'super_admin';

                      const hasPerm = isSuperAdmin || isInherited || isGranted;

                      return (
                        <div
                          key={p.permission_name}
                          onClick={() => {
                            if (!isInherited && !isSuperAdmin) toggleUserPermission(p.permission_name);
                          }}
                          className={`flex items-center gap-3 p-2 rounded border transition-colors ${!isInherited && !isSuperAdmin ? 'cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20' : 'opacity-70 bg-gray-50 dark:bg-neutral-800/50'
                            } ${hasPerm ? 'border-purple-200 dark:border-purple-900/50' : 'border-gray-200 dark:border-neutral-700'}`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${hasPerm ? 'bg-purple-600 text-white' : 'border-2 border-gray-300 dark:border-gray-600'
                            }`}>
                            {hasPerm && <Check size={14} strokeWidth={3} />}
                          </div>
                          <div>
                            <div className="font-medium text-sm dark:text-gray-200">{p.permission_name}</div>
                            <div className="text-xs text-gray-500">{p.description}</div>
                          </div>
                          {isInherited && !isSuperAdmin && (
                            <span className="ml-auto text-[10px] bg-gray-200 dark:bg-neutral-700 px-1 rounded uppercase font-bold text-gray-600 dark:text-gray-400">
                              Role Inherited
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
