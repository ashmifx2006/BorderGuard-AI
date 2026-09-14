import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import api from '../services/api'
import SummaryCards from '../components/SummaryCards.jsx'
import CameraPanel from '../components/CameraPanel.jsx'
import AlertDrawer from '../components/AlertDrawer.jsx'
import ThreatMap from '../components/ThreatMap.jsx'
import RiskBadge from '../components/RiskBadge.jsx'

export default function Dashboard() {
  const { summary } = useOutletContext()
  const [cameras, setCameras] = useState([])
  const [alerts, setAlerts] = useState([])
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)

  const load = async () => {
    try {
      const [cams, als, evs] = await Promise.all([
        api.get('/cameras/'),
        api.get('/alerts/', { params: { page_size: 30 } }),
        api.get('/detections/', { params: { page_size: 30 } }),
      ])
      setCameras(cams.data)
      setAlerts(als.data.filter((a) => a.status !== 'Resolved').slice(0, 30))
      setEvents(evs.data.slice(0, 30))
    } catch (_) {}
  }
  useEffect(() => { load(); const t = setInterval(load, 7000); return () => clearInterval(t) }, [])

  const latestByCamera = useMemo(() => Object.fromEntries(cameras.map((c) => [c.camera_id, alerts.find((a) => a.camera_display === c.camera_id)])), [cameras, alerts])
  const highestRisk = alerts.reduce((a, b) => (Number(b.risk_score || 0) > Number(a?.risk_score || 0) ? b : a), null)

  const setStatus = async (id, status, analyst_notes = '') => { await api.post(`/alerts/${id}/set-status/`, { status, analyst_notes }); await load(); if (selected?.id === id) setSelected(null) }

  return <>
    <div className="command-head">
      <div><div className="eyebrow">BORDERGUARD AI / OPERATIONS</div><h1>Surveillance Command Center</h1><p>Explainable event intelligence over existing CCTV telemetry.</p></div>
      <div className="demo-flag"><span /> DEMO MODE · SIMULATED SECTOR</div>
    </div>
    <SummaryCards summary={summary} />
    <div className="panel demo-runbook"><div className="panel-head"><h3>Judge Demo Runbook</h3><span className="panel-note">REAL PIPELINE · NO SYNTHETIC EVENTS</span></div><div className="runbook-steps"><div><b>01</b><span>LOGIN</span></div><div><b>02</b><span>CAM-01 LIVE</span></div><div><b>03</b><span>YOLO + TRACKING</span></div><div><b>04</b><span>ZONE EVENT</span></div><div><b>05</b><span>RISK 0–100</span></div><div><b>06</b><span>EVIDENCE</span></div><div><b>07</b><span>OFFICER REVIEW</span></div><div><b>08</b><span>RESOLVE</span></div></div><div className="runbook-note">Run <span className="mono">run_demo.bat</span> after placing <span className="mono">test.mp4</span> in <span className="mono">media/videos/</span>. The browser shows backend telemetry; the OpenCV window is the authoritative annotated video.</div></div>
    <div className="command-grid">
      <div className="panel map-panel"><div className="panel-head"><h3>Sector Threat Map</h3><span className="live-state">● CORRELATED VIEW</span></div><ThreatMap cameras={cameras} alerts={alerts} /></div>
      <div className="panel focus-panel"><div className="panel-head"><h3>Current Threat</h3></div>
        {highestRisk ? <div className="focus-body"><RiskBadge score={highestRisk.risk_score} level={highestRisk.risk_level}/><h2>{highestRisk.event_type.replaceAll('_',' ')}</h2><p>{highestRisk.camera_display} · {highestRisk.location}</p><div className="reason-box">{highestRisk.reasoning || 'Measured video event crossed a configured rule threshold.'}</div><button className="btn accent" onClick={() => setSelected(highestRisk)}>Review Evidence</button></div> : <div className="empty-focus"><b>NO ACTIVE HIGH-PRIORITY INCIDENT</b><span>Monitoring all configured cameras.</span></div>}
      </div>
    </div>
    <div className="command-grid lower">
      <div className="panel"><div className="panel-head"><h3>Live Camera Grid</h3><span className="panel-note">Detection telemetry · refresh 7s</span></div><div className="cam-grid">{cameras.map((c) => <CameraPanel key={c.id} camera={c} latestAlert={latestByCamera[c.camera_id]} />)}</div></div>
      <div className="panel"><div className="panel-head"><h3>Incident Queue</h3><span className="panel-note">{alerts.length} active</span></div><div className="incident-list">{alerts.slice(0,7).map((a) => <button className="incident" key={a.id} onClick={() => setSelected(a)}><div><span className={`sev-pill ${a.severity}`}>{a.severity}</span><b>{a.event_type.replaceAll('_',' ')}</b><small>{a.camera_display} · {new Date(a.created_at).toLocaleTimeString()}</small></div><RiskBadge score={a.risk_score} level={a.risk_level}/></button>)}{!alerts.length && <div className="empty-list">No active incidents.</div>}</div></div>
    </div>
    <div className="panel"><div className="panel-head"><h3>Detection Stream</h3><span className="panel-note">Raw AI observations</span></div><div className="stream">{events.slice(0,10).map((e) => <div className="stream-row" key={e.id}><span className="mono">{new Date(e.timestamp).toLocaleTimeString()}</span><b>{e.object_type}</b><span>{e.camera_display}</span><span>{e.zone_display || 'NORMAL AREA'}</span><span className="mono">{Math.round(e.confidence * 100)}%</span></div>)}{!events.length && <div className="empty-list">No detection events recorded yet. Start the AI engine.</div>}</div></div>
    <AlertDrawer alert={selected} onClose={() => setSelected(null)} onStatus={setStatus} />
  </>
}
