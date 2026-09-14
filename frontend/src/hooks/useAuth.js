import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('bg_token'))
  const [username, setUsername] = useState(localStorage.getItem('bg_username'))

  useEffect(() => {
    if (token) localStorage.setItem('bg_token', token)
    else localStorage.removeItem('bg_token')
  }, [token])

  const login = useCallback(async (u, p) => {
    const res = await api.post('/auth/login/', { username: u, password: p })
    setToken(res.data.token)
    setUsername(res.data.username)
    localStorage.setItem('bg_username', res.data.username)
    return res.data
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUsername(null)
    localStorage.removeItem('bg_username')
  }, [])

  return { token, username, login, logout, isAuthenticated: !!token }
}
