import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login({ auth }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.login(username, password)
      navigate('/dashboard')
    } catch (err) {
      setError('Invalid credentials. Check the username/password or create one with createsuperuser.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div className="mark" style={{ width: 34, height: 34, borderRadius: 7, background: 'linear-gradient(135deg,var(--accent),var(--accent-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#04211F' }}>BG</div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Border<span style={{ color: 'var(--accent)' }}>Guard</span> AI</div>
        </div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Secure Operator Login</h2>
        <p style={{ color: 'var(--text-mid)', fontSize: 13, marginBottom: 22 }}>Intelligent Video Analytics & Surveillance Platform</p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn accent" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Secure Login'}
          </button>
        </form>
        <p style={{ fontSize: 10.5, color: 'var(--text-low)', marginTop: 16 }}>
          Uses your Django account. Create one on the backend with: <span className="mono">python manage.py createsuperuser</span>
        </p>
      </div>
    </div>
  )
}
