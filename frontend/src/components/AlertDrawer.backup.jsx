import React, { useState } from 'react'
import api from '../services/api'
import RiskBadge from './RiskBadge.jsx'

export default function AlertDrawer({ alert, onClose, onStatus }) {
  const [notes, setNotes] = useState(alert?.analyst_notes || '')
  const [integrity, setIntegrity] = useState(null)
  if (!alert) return null
  const factors = Array.isArray(alert.risk_factors) ? alert.risk_factors : []
  const saveStatus = (status) => onStatus(alert.id, status, notes)
  const verify = async () => { try { const r = await api.get(`/alerts/${alert.id}/verify-integrity/`); setIntegrity(r.data) } catch { setIntegrity({ verified: false }) } }
  const report = async () => { try { const r = await api.get(`/alerts/${alert.id}/incident-report/`); const blob = new Blob([JSON.stringify(r.data, null, 2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `BorderGuard-AL-${alert.id}-report.json`; a.click(); URL.revokeObjectURL(url) } catch {} }
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="alert-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div><span className="eyebrow">INCIDENT DETAIL</span><h2>AL-{alert.id}</h2></div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="drawer-section hero-risk">
          <RiskBadge score={alert.risk_score} level={alert.risk_level} />
          <div className="drawer-event">{String(alert.event_type).replaceAll('_', ' ')}</div>
          <p>{alert.reasoning || 'Rule-based event detected from measurable video activity.'}</p>
        </div>
        <div className="detail-grid">
          <div><span>CAMERA</span><b>{alert.camera_display}</b></div>
          <div><span>LOCATION</span><b>{alert.location}</b></div>
          <div><span>OBJECT</span><b>{alert.object_type}</b></div>
          <div><span>CONFIDENCE</span><b>{Math.round((alert.confidence || 0) * 100)}%</b></div>
          <div><span>DWELL</span><b>{Number(alert.dwell_seconds || 0).toFixed(1)}s</b></div>
          <div><span>TRACK</span><b>{alert.track_id || '—'}</b></div>
        </div>
        <div className="drawer-section"><span className="eyebrow">WHY THIS ALERT?</span>
          {factors.length ? <ul className="factor-list">{factors.map((f, i) => <li key={i}>{f}</li>)}</ul> : <p>No additional risk factors recorded.</p>}
        </div>
        {alert.evidence_image && <div className="drawer-section"><span className="eyebrow">EVIDENCE</span><img className="evidence-img" src={alert.evidence_image} alt="Alert evidence" /><button className="btn-sm primary" style={{marginTop:8}} onClick={verify}>Verify Integrity</button>{integrity && <div className="integrity-box">{integrity.verified ? '✓ Evidence chain verified' : '⚠ Integrity verification failed'}<br/><span className="mono">SHA-256: {(integrity.evidence_sha256 || '').slice(0,16)}…</span></div>}</div>}
        <div className="drawer-section"><span className="eyebrow">OFFICER NOTES</span><textarea className="notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Record verification, observations, or resolution notes…" /></div>
        <div className="drawer-actions"><button className="btn-sm" onClick={report}>Generate Incident Report</button>
          {alert.status === 'New' && <button className="btn" onClick={() => saveStatus('Acknowledged')}>Acknowledge</button>}
          {alert.status === 'Acknowledged' && <button className="btn" onClick={() => saveStatus('Investigating')}>Start Investigation</button>}
          {alert.status === 'Investigating' && <button className="btn accent" onClick={() => saveStatus('Resolved')}>Resolve Incident</button>}
        </div>
      </aside>
    </div>
  )
}
