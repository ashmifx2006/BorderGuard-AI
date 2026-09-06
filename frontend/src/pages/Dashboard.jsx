import React, { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import api from '../services/api'
import SummaryCards from '../components/SummaryCards.jsx'
import CameraPanel from '../components/CameraPanel.jsx'
import AlertItem from '../components/AlertItem.jsx'

export default function Dashboard() {
  const { summary } = useOutletContext()
  const [cameras, setCameras] = useState([])
  const [alerts, setAlerts] = useState([])

  const loadAlerts = () => api.get('/alerts/').then((r) => setAlerts(r.data.filter((a) => a.status !== 'Resolved').slice(0, 6)))

  useEffect(() => {
    api.get('/cameras/').then((r) => setCameras(r.data.slice(0, 6)))
    loadAlerts()
    const t = setInterval(loadAlerts, 8000)
    return () => clearInterval(t)
  }, [])

  const ack = async (alert) => {
    await api.post(`/alerts/${alert.id}/set-status/`, { status: 'Acknowledged' })
    loadAlerts()
  }

  return (
    <>
      <SummaryCards summary={summary} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head"><h3>Live Camera Grid</h3></div>
          <div className="cam-grid">
            {cameras.map((c) => <CameraPanel camera={c} key={c.id} />)}
            {cameras.length === 0 && (
              <p style={{ color: 'var(--text-low)', padding: 16 }}>
                No cameras yet — run <span className="mono">python manage.py seed_demo_data</span> in the backend.
              </p>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Active Alerts</h3></div>
          {alerts.map((a) => <AlertItem alert={a} key={a.id} onOpen={() => {}} onAck={ack} />)}
          {alerts.length === 0 && <p style={{ color: 'var(--text-low)', padding: 16 }}>No active alerts.</p>}
        </div>
      </div>
    </>
  )
}
