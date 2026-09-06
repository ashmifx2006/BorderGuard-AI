import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function AlertHistory() {
  const [alerts, setAlerts] = useState([])
  useEffect(() => { api.get('/alerts/', { params: { status: 'Resolved' } }).then((r) => setAlerts(r.data)) }, [])

  return (
    <div className="panel">
      <div className="panel-head"><h3>Alert History</h3></div>
      <table>
        <thead><tr><th>Alert</th><th>Date</th><th>Camera</th><th>Event</th><th>Severity</th><th>Resolved By</th></tr></thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td className="id-cell">AL-{a.id}</td>
              <td className="mono">{new Date(a.created_at).toLocaleDateString()}</td>
              <td className="mono">{a.camera_display}</td>
              <td>{a.event_type.replaceAll('_', ' ')}</td>
              <td><span className={`sev-pill ${a.severity}`}>{a.severity}</span></td>
              <td>{a.resolved_by || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {alerts.length === 0 && <p style={{ padding: 16, color: 'var(--text-low)' }}>No resolved alerts yet.</p>}
    </div>
  )
}
