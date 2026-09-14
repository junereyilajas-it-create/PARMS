import { useState, useEffect } from 'react'
import api from '../lib/api'
import { CrudModal } from '../components/common/CrudModal'
import { Search, Plus, Edit2, Trash2 } from 'lucide-react'

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; record?: any } | null>(null)
  
  const filteredUsers = users.filter(u => 
    `${u.first_name} ${u.last_name} ${u.username} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  )
  
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
      } else if (modalState?.record) {
        await api.put(`/users/${modalState.record.user_id}`, form)
      }
      setModalState(null)
      loadUsers()
    } catch(e) { console.error('Failed to save', e) }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await api.delete(`/users/${id}`)
        loadUsers()
      } catch(e) { console.error('Failed to delete', e) }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold dark:text-white">User Management</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <button onClick={() => setModalState({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap">
            <Plus size={18}/> Add User
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
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
                <td className="p-4 text-sm flex gap-2">
                  <button onClick={() => setModalState({ mode: 'edit', record: u })} className="text-blue-600 hover:text-blue-800"><Edit2 size={16}/></button>
                  <button onClick={() => handleDelete(u.user_id)} className="text-red-600 hover:text-red-800"><Trash2 size={16}/></button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No users found.</td></tr>
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
            { key: 'role', label: 'Role', type: 'select', options: ['admin', 'assessor', 'staff', 'client'] },
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
