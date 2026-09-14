import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import api from '../services/api'

export default function Reports() {
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/dashboard/analytics/').then(r => setData(r.data)).catch(() => {}) }, [])
  if (!data) return <div className="panel"><div className="panel-body">Loading operational analytics…</div></div>
  const types = (data.event_types || []).map(x => ({ name: x.event_type.replaceAll('_',' '), count: x.count }))
  return <div>
    <div className="command-head"><div><span className="eyebrow">OPERATIONAL INTELLIGENCE</span><h1>Analytics & Reports</h1><p>Backend-derived activity and incident trends for the last 24 hours.</p></div></div>
    <div className="analytics-cards">
      <div className="metric-card"><span>DETECTIONS / 24H</span><b>{data.detections_24h}</b></div>
      <div className="metric-card"><span>ALERTS / 24H</span><b>{data.alerts_24h}</b></div>
      <div className="metric-card"><span>AVERAGE RISK</span><b>{data.average_risk}/100</b></div>
      <div className="metric-card"><span>PEAK RISK</span><b>{data.peak_risk}/100</b></div>
      <div className="metric-card"><span>ZONE VIOLATIONS</span><b>{data.zone_violations}</b></div>
      <div className="metric-card"><span>RESOLVED</span><b>{data.resolved}</b></div>
    </div>
    <div className="command-grid lower">
      <div className="panel"><div className="panel-head"><h3>Hourly Detection / Alert Trend</h3></div><div className="panel-body" style={{height:260}}><ResponsiveContainer width="100%" height="100%"><LineChart data={data.hourly}><XAxis dataKey="hour" stroke="#9AA8C0" fontSize={10}/><YAxis stroke="#9AA8C0" fontSize={10}/><Tooltip/><Line type="monotone" dataKey="detections" stroke="#2BD1C6" strokeWidth={2}/><Line type="monotone" dataKey="alerts" stroke="#EF4A56" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
      <div className="panel"><div className="panel-head"><h3>Alert Types</h3></div><div className="panel-body" style={{height:260}}><ResponsiveContainer width="100%" height="100%"><BarChart data={types} layout="vertical"><XAxis type="number" stroke="#9AA8C0" fontSize={10}/><YAxis type="category" dataKey="name" width={145} stroke="#9AA8C0" fontSize={9}/><Tooltip/><Bar dataKey="count" fill="#2BD1C6" radius={[0,3,3,0]}/></BarChart></ResponsiveContainer></div></div>
    </div>
    <div className="panel" style={{marginTop:14}}><div className="panel-head"><h3>Evidence & Human Review</h3></div><div className="panel-body note-box">Evidence is sealed with SHA-256 metadata when an alert is created. Officers can verify the stored evidence hash and chain hash from the incident drawer, then record investigation or resolution notes. This is an integrity mechanism for the prototype—not a claim of production-grade forensic chain-of-custody.</div></div>
  </div>
}
