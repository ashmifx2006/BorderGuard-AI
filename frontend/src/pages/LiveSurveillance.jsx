import React, { useEffect, useState } from 'react'
import api from '../services/api'
import CameraPanel from '../components/CameraPanel.jsx'
import AlertDrawer from '../components/AlertDrawer.jsx'

export default function LiveSurveillance() {
  const [cameras, setCameras] = useState([]); const [alerts, setAlerts] = useState([]); const [selected, setSelected] = useState(null)
  const load = async () => { const [c,a] = await Promise.all([api.get('/cameras/'), api.get('/alerts/')]); setCameras(c.data); setAlerts(a.data.filter(x => x.status !== 'Resolved')) }
  useEffect(() => { load(); const t=setInterval(load,7000); return()=>clearInterval(t)},[])
  const setStatus = async (id,status) => { await api.post(`/alerts/${id}/set-status/`,{status}); await load(); setSelected(null) }
  return <>
    <div className="command-head"><div><div className="eyebrow">SURVEILLANCE / CAMERAS</div><h1>Live Surveillance</h1><p>Browser command-center telemetry with the existing OpenCV/YOLO processing pipeline.</p></div><div className="demo-flag"><span/> DEMO MODE</div></div>
    <div className="panel"><div className="panel-head"><h3>Multi-Camera Command View</h3><span className="panel-note">Video decoding remains in the AI engine; this view exposes verified telemetry.</span></div><div className="cam-grid surveillance-grid">{cameras.map(c=><div key={c.id} onClick={()=>{const a=alerts.find(x=>x.camera_display===c.camera_id);if(a)setSelected(a)}}><CameraPanel camera={c} latestAlert={alerts.find(x=>x.camera_display===c.camera_id)}/></div>)}</div></div>
    <div className="panel"><div className="panel-head"><h3>Demo Readiness</h3><span className="panel-note">NO SYNTHETIC EVENTS</span></div><div className="panel-body note-box"><b>Runbook:</b> backend → React → <span className="mono">run_demo.bat</span> → real YOLO detections → zone/event/risk → alert/evidence → officer review.</div></div>
    <div className="panel"><div className="panel-head"><h3>Operator Note</h3></div><div className="panel-body note-box"><b>Recommended demo path:</b> run <span className="mono">test.mp4</span> through <span className="mono">video_processor.py</span>. The OpenCV window remains the authoritative annotated video surface; this browser panel is the command-and-control layer.</div></div>
    <AlertDrawer alert={selected} onClose={()=>setSelected(null)} onStatus={setStatus}/>
  </>
}
