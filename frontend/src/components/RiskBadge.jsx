import React from 'react'

export default function RiskBadge({ score = 0, level = 'NORMAL' }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0))
  return (
    <div className="risk-badge">
      <span className={`risk-dot risk-${level.toLowerCase().replace(' ', '-')}`} />
      <span>{level}</span>
      <b className="mono">{safe}/100</b>
    </div>
  )
}
