import { useEffect, useState, type FormEvent } from 'react'
import { Search, Plus, LifeBuoy, FileText, MessageSquare, ShieldAlert } from 'lucide-react'
import { useModal } from '../contexts/ModalContext'
import api from '../lib/api'

export function HelpSupport() {
  const { showSuccess, showError } = useModal()
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets' | 'manage'>('faq')
  const userRole = localStorage.getItem('accessor_role') || ''

  // FAQs
  const [searchQuery, setSearchQuery] = useState('')
  const allFaqs = [
    { question: 'How do I log in?', answer: 'Use the credentials provided by your administrator on the login page.', tags: ['login', 'account'] },
    { question: 'How do I change my password?', answer: 'Go to Account Settings > Edit Profile, enter your current password and your new password.', tags: ['password', 'account'] },
    { question: 'How do I manage users?', answer: 'If you are a Super Admin, go to User Management to add, edit, or deactivate users.', tags: ['users', 'admin'] },
    { question: 'How do I manage properties?', answer: 'Go to the Buildings or Lots section. You can view, add, or edit property information there.', tags: ['property', 'management'] },
    { question: 'How does the GIS map work?', answer: 'Navigate to the GIS Map section. It displays property parcels geographically. Click on a parcel to see its details.', tags: ['gis', 'map', 'property'] },
    { question: 'How do I request a certificate?', answer: 'For clients, go to Certificate Requests and submit a new request. For staff, use the Generate Certificate feature.', tags: ['certificate', 'request'] },
  ]

  const filteredFaqs = allFaqs.filter(faq =>
    searchQuery === '' ||
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.tags.some(tag => tag.includes(searchQuery.toLowerCase()))
  )

  // Tickets
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'General Inquiry', priority: 'Low', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)

  // Ticket Messages
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [messageBusy, setMessageBusy] = useState(false)

  const loadTickets = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/support-tickets')
      setTickets(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'tickets' || activeTab === 'manage') {
      loadTickets()
    }
  }, [activeTab])

  const submitTicket = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/support-tickets', form)
      showSuccess('Support request submitted successfully.')
      setForm({ subject: '', category: 'General Inquiry', priority: 'Low', description: '' })
      loadTickets()
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to submit request.')
    } finally {
      setSubmitting(false)
    }
  }

  const loadMessages = async (ticketId: string) => {
    try {
      const { data } = await api.get(`/support-tickets/${ticketId}/messages`)
      setMessages(data)
    } catch (e) {
      console.error(e)
    }
  }

  const openTicket = (ticket: any) => {
    setSelectedTicket(ticket)
    loadMessages(ticket.ticket_id)
  }

  const submitMessage = async (e: FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedTicket) return
    setMessageBusy(true)
    try {
      await api.post(`/support-tickets/${selectedTicket.ticket_id}/messages`, { message: newMessage })
      setNewMessage('')
      loadMessages(selectedTicket.ticket_id)
    } catch (e) {
      showError('Failed to send message.')
    } finally {
      setMessageBusy(false)
    }
  }

  const updateTicketStatus = async (status: string) => {
    if (!selectedTicket) return
    try {
      await api.put(`/support-tickets/${selectedTicket.ticket_id}`, { status })
      setSelectedTicket({ ...selectedTicket, status })
      loadTickets()
      showSuccess(`Ticket marked as ${status}`)
    } catch (e) {
      showError('Failed to update ticket status.')
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Help & Support</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Find answers to common questions or contact support for help.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'faq' ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          onClick={() => setActiveTab('faq')}
        >
          <div className="flex items-center gap-2"><LifeBuoy size={16} /> FAQ & Help Center</div>
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'tickets' ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          onClick={() => setActiveTab('tickets')}
        >
          <div className="flex items-center gap-2"><FileText size={16} /> My Support Requests</div>
        </button>
        {(userRole === 'admin' || userRole === 'super_admin') && (
          <button
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'manage' ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setActiveTab('manage')}
          >
            <div className="flex items-center gap-2"><ShieldAlert size={16} /> Manage Tickets</div>
          </button>
        )}
      </div>

      {activeTab === 'faq' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
            <h3 className="text-lg font-bold dark:text-white mb-2">How can we help you?</h3>
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search for articles, features, e.g., 'GIS', 'password'"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white">Frequently Asked Questions</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredFaqs.length > 0 ? filteredFaqs.map((faq, i) => (
                <div key={i} className="p-5">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{faq.question}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{faq.answer}</p>
                </div>
              )) : (
                <div className="p-8 text-center text-sm text-gray-500">No matching FAQs found for "{searchQuery}".</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Submit a Request</h3>
              <form onSubmit={submitTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option>General Inquiry</option>
                    <option>Technical Issue</option>
                    <option>Feature Request</option>
                    <option>Account Assistance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                  <input type="text" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea rows={4} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm resize-none" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required placeholder="Describe your issue..." />
                </div>
                <button type="submit" disabled={submitting} className="w-full flex justify-center items-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-70">
                  <Plus size={16} /> {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="font-semibold text-gray-900 dark:text-white">My Requests</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-sm text-gray-500">Loading tickets...</div>
                ) : tickets.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {tickets.map(ticket => (
                      <div key={ticket.ticket_id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors" onClick={() => openTicket(ticket)}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400 mr-2">{ticket.ticket_id}</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{ticket.subject}</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase
                            ${ticket.status === 'Open' ? 'bg-green-100 text-green-800' :
                              ticket.status === 'In Progress' ? 'bg-green-100 text-green-800' :
                                ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {ticket.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Category: {ticket.category}</span>
                          <span>Priority: <strong className={ticket.priority === 'Critical' ? 'text-green-500' : ticket.priority === 'High' ? 'text-green-500' : ''}>{ticket.priority}</strong></span>
                          <span>Submitted: {new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-500">You haven't submitted any support requests yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">All Support Tickets</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket ID</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {tickets.map(ticket => (
                  <tr key={ticket.ticket_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => openTicket(ticket)}>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{ticket.ticket_id}</td>
                    <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{ticket.first_name} {ticket.last_name}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{ticket.subject}</td>
                    <td className={`px-5 py-3 font-medium ${ticket.priority === 'Critical' ? 'text-green-600' : ticket.priority === 'High' ? 'text-green-600' : 'text-gray-500'}`}>{ticket.priority}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase
                        ${ticket.status === 'Open' ? 'bg-green-100 text-green-800' :
                          ticket.status === 'In Progress' ? 'bg-green-100 text-green-800' :
                            ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{new Date(ticket.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tickets.length === 0 && <div className="p-8 text-center text-sm text-gray-500">No tickets found.</div>}
          </div>
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setSelectedTicket(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {selectedTicket.ticket_id}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase
                        ${selectedTicket.status === 'Open' ? 'bg-green-100 text-green-800' :
                      selectedTicket.status === 'In Progress' ? 'bg-green-100 text-green-800' :
                        selectedTicket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {selectedTicket.status}
                  </span>
                </h3>
                <p className="text-sm text-gray-500 mt-1">{selectedTicket.subject}</p>
              </div>
              <div className="flex gap-2">
                {(userRole === 'admin' || userRole === 'super_admin') && selectedTicket.status !== 'Closed' && (
                  <button onClick={() => updateTicketStatus('Closed')} className="px-3 py-1.5 text-xs font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">Close Ticket</button>
                )}
                <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-gray-950 custom-scrollbar">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-sm dark:text-white">{selectedTicket.first_name || 'You'} {selectedTicket.last_name || ''}</span>
                  <span className="text-xs text-gray-400">{new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {messages.map(msg => (
                <div key={msg.message_id} className={`flex flex-col ${msg.role === 'admin' || msg.role === 'super_admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${msg.role === 'admin' || msg.role === 'super_admin'
                      ? 'bg-green-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                    <div className="flex justify-between items-center gap-4 mb-1">
                      <span className={`font-semibold text-xs ${msg.role === 'admin' || msg.role === 'super_admin' ? 'text-green-100' : 'text-gray-500'}`}>{msg.first_name} ({msg.role})</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 mx-1">{new Date(msg.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {selectedTicket.status !== 'Closed' && (
              <form onSubmit={submitMessage} className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-3 items-end">
                <div className="flex-1">
                  <textarea
                    rows={2}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm resize-none"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" disabled={messageBusy} className="h-[42px] px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-70 flex items-center justify-center">
                  <MessageSquare size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
