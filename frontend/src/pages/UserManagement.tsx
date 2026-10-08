import { useState, useEffect } from 'react'
import api from '../lib/api'
import { CrudModal } from '../components/common/CrudModal'
import { Search, Plus, Edit2, Trash2 } from 'lucide-react'
import { useModal } from '../contexts/ModalContext'

export function UserManagement() {
  const { showSuccess, showError, showConfirm } = useModal()
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; record?: any } | null>(null)
  
  const filteredUsers = users.filter(u => {
    const matchesSearch = `${u.first_name} ${u.last_name} ${u.username} ${u.email} ${u.role} ${u.status}`.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter ? u.role === roleFilter : true
    const matchesStatus = statusFilter ? u.status === statusFilter : true
    return matchesSearch && matchesRole && matchesStatus
  })
  
  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users')
      setUsers(data)
    } catch(e) { console.error('Could not load users', e) }
  }

  useEffect(() => { loadUsers() }, [])

  const handleSave = async (form: any) => {
    try {
      if (modalState?.mode === 'create') {
        await api.post('/users', form)
        showSuccess('User successfully created.')
      } else if (modalState?.record) {
        await api.put(`/users/${modalState.record.user_id}`, form)
        showSuccess('User successfully updated.')
      }
      setModalState(null)
      loadUsers()
    } catch(e: any) { 
      const msg = e.response?.data?.message || 'Failed to save user. Please check your inputs.'
      showError(msg)
    }
  }

  const handleDelete = async (id: number) => {
    showConfirm('Are you sure you want to delete this user?', async () => {
      try {
        await api.delete(`/users/${id}`)
        showSuccess('User successfully deleted.')
        loadUsers()
      } catch(e: any) { 
        const msg = e.response?.data?.message || 'Failed to delete user.'
        showError(msg)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold dark:text-white">User Management</h1>
        <button onClick={() => setModalState({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap">
          <Plus size={18}/> Add User
        </button>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="py-2 px-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-sm">
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="assessor">Assessor</option>
          <option value="staff">Staff</option>
          <option value="client">Client</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="py-2 px-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-sm">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredUsers.length > 0 ? filteredUsers.map(u => (
              <tr key={u.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                <td className="p-4 text-sm text-gray-500">{u.user_id}</td>
                <td className="p-4 text-sm font-medium dark:text-white">{u.first_name} {u.last_name}</td>
                <td className="p-4 text-sm text-gray-500">{u.username}</td>
                <td className="p-4 text-sm"><span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs uppercase">{u.role}</span></td>
                <td className="p-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs uppercase \${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                    {u.status || 'ACTIVE'}
                  </span>
                </td>
                <td className="p-4 text-sm flex gap-2">
                  <button onClick={() => setModalState({ mode: 'edit', record: u })} className="text-blue-600 hover:text-blue-800"><Edit2 size={16}/></button>
                  <button onClick={() => handleDelete(u.user_id)} className="text-red-600 hover:text-red-800"><Trash2 size={16}/></button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalState && (
        <CrudModal 
          title={modalState.mode === 'create' ? 'Add User' : 'Edit User'}
          fields={[
            { key: 'first_name', label: 'First Name' },
            { key: 'last_name', label: 'Last Name' },
            { key: 'username', label: 'Username' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role', type: 'select', options: ['super_admin', 'admin', 'assessor', 'staff', 'client'] },
            { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
            { key: 'password', label: 'Password (leave blank to keep current for edit)' }
          ]}
          record={modalState.record}
          onClose={() => setModalState(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
