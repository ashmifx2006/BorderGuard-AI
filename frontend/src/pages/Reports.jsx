import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../services/api'

const SEV_COLORS = { CRITICAL: '#EF4A56', HIGH: '#F5893A', MEDIUM: '#F0C233', LOW: '#4C8DFF' }

export default function Reports() {
  const [byCamera, setByCamera] = useState([])
  const [bySeverity, setBySeverity] = useState([])

  useEffect(() => {
    api.get('/dashboard/summary/').then((r) => {
      setByCamera(r.data.events_by_camera.map((e) => ({ name: e.camera__camera_id || 'Unknown', count: e.count })))
      setBySeverity(r.data.severity_breakdown.map((e) => ({ name: e.severity, value: e.count })))
    })
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div className="panel">
        <div className="panel-head"><h3>Events by Camera</h3></div>
        <div className="panel-body" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCamera}>
              <XAxis dataKey="name" stroke="#9AA8C0" fontSize={11} />
              <YAxis stroke="#9AA8C0" fontSize={11} />
              <Tooltip contentStyle={{ background: '#17202F', border: '1px solid #22304A' }} />
              <Bar dataKey="count" fill="#2BD1C6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h3>Severity Distribution</h3></div>
        <div className="panel-body" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={bySeverity} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {bySeverity.map((entry) => <Cell key={entry.name} fill={SEV_COLORS[entry.name] || '#888'} />)}
              </Pie>
              <Legend />
              <Tooltip contentStyle={{ background: '#17202F', border: '1px solid #22304A' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
