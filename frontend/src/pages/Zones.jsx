import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function Zones() {
  const [zones, setZones] = useState([])
  useEffect(() => { api.get('/zones/').then((r) => setZones(r.data)) }, [])

  return (
    <div className="panel">
      <div className="panel-head"><h3>Restricted Zones</h3></div>
      <table>
        <thead><tr><th>Zone</th><th>Camera</th><th>Severity</th><th>Active Hours</th><th>Threshold</th><th>Status</th></tr></thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id}>
              <td>{z.name}</td><td className="mono">{z.camera_display}</td>
              <td><span className={`sev-pill ${z.severity}`}>{z.severity}</span></td>
              <td>{z.active_hours}</td><td>{z.alert_threshold}</td>
              <td>{z.is_active ? 'Active' : 'Disabled'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {zones.length === 0 && <p style={{ padding: 16, color: 'var(--text-low)' }}>No zones yet. Create one via Django admin (/admin/) — draw a polygon in normalized [x,y] coordinates.</p>}
    </div>
  )
}
