import React from 'react'

export default function AlertItem({ alert, onOpen, onAck }) {
  return (
    <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border-soft)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span className={`sev-pill ${alert.severity}`}>{alert.severity}</span>
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{alert.event_type.replaceAll('_', ' ')}</span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-low)' }}>
        {new Date(alert.created_at).toLocaleTimeString()} · {alert.camera_display} · {alert.location} · {Math.round(alert.confidence * 100)}% conf.
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="btn-sm primary" onClick={() => onOpen(alert)}>View Evidence</button>
        {alert.status === 'New' ? (
          <button className="btn-sm" onClick={() => onAck(alert)}>Acknowledge</button>
        ) : (
          <span className={`status-pill ${alert.status}`} style={{ alignSelf: 'center' }}>{alert.status}</span>
        )}
      </div>
    </div>
  )
}
