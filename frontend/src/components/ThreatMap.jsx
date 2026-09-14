import React from 'react'

export default function ThreatMap({ cameras = [], alerts = [] }) {
  const points = cameras.map((c, i) => {
    const alert = alerts.find((a) => a.camera_display === c.camera_id)
    const score = alert?.risk_score || 0
    return { ...c, x: 16 + ((i * 27) % 70), y: 24 + ((i * 43) % 55), score }
  })
  return <div className="sector-map">
    <div className="map-label">SIMULATED BORDER SECTOR — DEMO MAP</div>
    <div className="map-fence" />
    <div className="map-zone safe">SAFE</div>
    <div className="map-zone restricted">RESTRICTED</div>
    {points.map((p) => <div key={p.id} className={`map-camera ${p.score >= 80 ? 'hot' : p.score >= 40 ? 'watch' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} title={`${p.camera_id} ${p.location}`}><span />{p.camera_id}</div>)}
    <div className="map-legend"><span><i className="legend-safe"/>Normal</span><span><i className="legend-watch"/>Watch</span><span><i className="legend-hot"/>High Risk</span></div>
  </div>
}
