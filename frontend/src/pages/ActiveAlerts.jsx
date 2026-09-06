import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function ActiveAlerts() {
  const [alerts, setAlerts] = useState([])
  const [severity, setSeverity] = useState('')

  const load = () => api.get('/alerts/', { params: { severity: severity || undefined } })
    .then((r) => setAlerts(r.data.filter((a) => a.status !== 'Resolved')))

  useEffect(() => { load() }, [severity])

  const setStatus = async (id, status) => {
    await api.post(`/alerts/${id}/set-status/`, { status })
    load()
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Active Alerts</h3>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}
          style={{ background: 'var(--bg-inset)', color: 'var(--text-hi)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', fontSize: 12 }}>
          <option value="">All Severities</option>
          <option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
        </select>
      </div>
      <table>
        <thead><tr><th>Alert</th><th>Time</th><th>Camera</th><th>Event</th><th>Severity</th><th>Confidence</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td className="id-cell">AL-{a.id}</td>
              <td className="mono">{new Date(a.created_at).toLocaleTimeString()}</td>
              <td className="mono">{a.camera_display}</td>
              <td>{a.event_type.replaceAll('_', ' ')}</td>
              <td><span className={`sev-pill ${a.severity}`}>{a.severity}</span></td>
              <td className="mono">{Math.round(a.confidence * 100)}%</td>
              <td><span className={`status-pill ${a.status}`}>{a.status}</span></td>
              <td>
                {a.status === 'New' && <button className="btn-sm" onClick={() => setStatus(a.id, 'Acknowledged')}>Acknowledge</button>}
                {a.status === 'Acknowledged' && <button className="btn-sm" onClick={() => setStatus(a.id, 'Investigating')}>Investigate</button>}
                {a.status === 'Investigating' && <button className="btn-sm primary" onClick={() => setStatus(a.id, 'Resolved')}>Resolve</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {alerts.length === 0 && <p style={{ padding: 16, color: 'var(--text-low)' }}>No active alerts. Run the AI engine to generate real ones from a video feed.</p>}
    </div>
  )
}
