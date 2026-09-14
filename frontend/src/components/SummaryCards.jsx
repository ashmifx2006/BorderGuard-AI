import React from 'react'

export default function SummaryCards({ summary }) {
  if (!summary) return null
  const cards = [
    { label: 'Total Cameras', value: summary.total_cameras },
    { label: 'Online Cameras', value: summary.online_cameras, cls: 'ok' },
    { label: 'Active Alerts', value: summary.active_alerts, cls: summary.active_alerts > 0 ? 'crit' : '' },
    { label: 'Events Today', value: summary.events_today },
    { label: 'Critical Alerts', value: summary.critical_alerts, cls: summary.critical_alerts > 0 ? 'crit' : '' },
    { label: 'AI Engine Status', value: summary.ai_engine_status, cls: summary.ai_engine_status === 'ONLINE' ? 'ok' : '' },
  ]
  return (
    <div className="summary-grid">
      {cards.map((c) => (
        <div className="sum-card" key={c.label}>
          <div className="label">{c.label}</div>
          <div className={`value ${c.cls || ''}`}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}
