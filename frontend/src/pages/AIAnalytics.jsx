import React from 'react'

const PIPELINE = ['Video Source', 'OpenCV Processing', 'YOLO Object Detection', 'Object Tracking', 'Zone & Movement Analysis', 'Event Detection Engine', 'Alert Priority Engine', 'Evidence Capture', 'Security Alert']

const PRIORITY_ROWS = [
  ['Normal object detection', '1', 'LOW', 'Object recognized outside any restricted zone'],
  ['Unusual movement', '4', 'MEDIUM', 'Movement pattern flagged by tracking heuristics'],
  ['Restricted-zone intrusion', '7', 'HIGH', 'Confirmed presence inside zone boundary'],
  ['Prolonged presence', '9', 'CRITICAL', 'Presence exceeded configured dwell-time threshold'],
]

export default function AIAnalytics() {
  return (
    <>
      <div className="panel">
        <div className="panel-head"><h3>AI Processing Pipeline</h3></div>
        <div className="panel-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {PIPELINE.map((step, i) => (
            <React.Fragment key={step}>
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '8px 12px', fontSize: 11.5, fontWeight: 600 }}>{step}</div>
              {i < PIPELINE.length - 1 && <span style={{ color: 'var(--text-low)' }}>→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h3>AI Alert Priority Engine</h3><span style={{ fontSize: 11, color: 'var(--text-low)' }}>Rule-based scoring — does not infer intent</span></div>
        <table>
          <thead><tr><th>Condition</th><th>Event Score</th><th>Severity</th><th>Reasoning</th></tr></thead>
          <tbody>
            {PRIORITY_ROWS.map((r) => (
              <tr key={r[0]}>
                <td>{r[0]}</td><td className="mono">{r[1]}/10</td>
                <td><span className={`sev-pill ${r[2]}`}>{r[2]}</span></td><td>{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
