import axios from 'axios'

const baseURL = import.meta.env.MODE === 'production'
  ? '/api'  // Em produção, usar proxy via _redirects
  : '/api'  // Em dev também usar /api (Vite proxy)

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
