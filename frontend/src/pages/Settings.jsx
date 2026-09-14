import React from 'react'

export default function Settings() {
  return (
    <div className="panel">
      <div className="panel-head"><h3>System Settings</h3></div>
      <div className="panel-body" style={{ color: 'var(--text-mid)', fontSize: 12.5, lineHeight: 1.8 }}>
        <p>Detection thresholds, zone dwell times, and alert cooldowns are configured in <span className="mono">ai_engine/config.py</span>.</p>
        <p>User accounts and permissions are managed via the Django admin at <span className="mono">/admin/</span>.</p>
        <p>CORS-allowed origins and environment secrets are configured in <span className="mono">backend/.env</span>.</p>
      </div>
    </div>
  )
}
