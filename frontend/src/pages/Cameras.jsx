import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function Cameras() {
  const [cameras, setCameras] = useState([])

  const load = () => api.get('/cameras/').then((r) => setCameras(r.data))
  useEffect(() => { load() }, [])

  return (
    <div className="panel">
      <div className="panel-head"><h3>Camera Management</h3></div>
      <table>
        <thead><tr><th>Camera</th><th>Location</th><th>Sector</th><th>Status</th><th>Source</th><th>AI Active</th><th>FPS</th></tr></thead>
        <tbody>
          {cameras.map((c) => (
            <tr key={c.id}>
              <td className="id-cell">{c.camera_id}</td>
              <td>{c.location}</td>
              <td>{c.sector}</td>
              <td><span className={`status-chip ${c.status}`}>{c.status}</span></td>
              <td>{c.source_type}</td>
              <td>{c.ai_active ? 'Yes' : 'No'}</td>
              <td className="mono">{c.fps}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cameras.length === 0 && <p style={{ padding: 16, color: 'var(--text-low)' }}>No cameras configured yet. Add them via Django admin (/admin/) or run seed_demo_data.</p>}
    </div>
  )
}
