import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessor_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function ensureSession() {
  if (!localStorage.getItem('accessor_token')) throw new Error('Please sign in to access database records.')
}

export default api
