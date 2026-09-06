import React, { useEffect, useState } from 'react'
import api from '../services/api'
import CameraPanel from '../components/CameraPanel.jsx'

export default function LiveSurveillance() {
  const [cameras, setCameras] = useState([])

  useEffect(() => {
    api.get('/cameras/').then((r) => setCameras(r.data))
  }, [])

  // CAM-01 video source
  const videoSrc = 'http://127.0.0.1:8000/media/videos/test.mp4'

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Multi-Camera Surveillance</h3>

        <span style={{ fontSize: 11, color: 'var(--text-low)' }}>
          CAM-01 — AI Video Feed
        </span>
      </div>

      <div
        className="cam-grid"
        style={{ gridTemplateColumns: 'repeat(3,1fr)' }}
      >
        {cameras.map((c) => (
          <CameraPanel
            camera={c}
            key={c.id}
            videoSrc={c.camera_id === 'CAM-01' ? videoSrc : null}
          />
        ))}
      </div>

      <div
        className="panel-body"
        style={{
          color: 'var(--text-mid)',
          fontSize: 12.5,
          lineHeight: 1.6,
        }}
      >
        CAM-01 is connected to the test surveillance video.
        AI detection and alert generation are handled by the
        BorderGuard AI engine.
      </div>
    </div>
  )
}