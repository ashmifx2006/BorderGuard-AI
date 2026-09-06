import React, { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import api from '../services/api'

const NAV = [
  { to: 'dashboard', label: 'Dashboard' },
  { to: 'surveillance', label: 'Live Surveillance' },
  { to: 'cameras', label: 'Cameras' },
  { to: 'ai-analytics', label: 'AI Analytics' },
  { to: 'zones', label: 'Zones' },
  { to: 'active-alerts', label: 'Active Alerts' },
  { to: 'alert-history', label: 'Alert History' },
  { to: 'reports', label: 'Analytics & Reports' },
  { to: 'settings', label: 'Settings' },
]

export default function Shell({ auth }) {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let mounted = true
    const load = () => api.get('/dashboard/summary/').then((r) => mounted && setSummary(r.data)).catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  return (
    <div id="shell">
      <div id="sidebar">
        <div className="sb-brand">
          <div className="mark">BG</div>
          <div className="name">Border<span>Guard</span></div>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            {n.label}
          </NavLink>
        ))}
      </div>
      <div id="topbar">
        <div style={{ fontWeight: 700, fontSize: 15 }}>BorderGuard AI</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="tb-stat">AI ENGINE <b>{summary?.ai_engine_status || '—'}</b></span>
          <span className="tb-stat">CAMERAS <b>{summary ? `${summary.online_cameras}/${summary.total_cameras}` : '—'}</b></span>
          <span className="tb-stat">{auth.username}</span>
          <button className="btn-sm" style={{ marginLeft: 10 }} onClick={auth.logout}>Logout</button>
        </div>
      </div>
      <div id="main">
        <Outlet context={{ summary }} />
      </div>
    </div>
  )
}
