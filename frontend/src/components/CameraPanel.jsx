import React from 'react'

export default function CameraPanel({ camera, latestAlert }) {
  const online = camera.status === 'ONLINE'
  const score = latestAlert?.risk_score || 0

  const cameraNumber = Number(String(camera.camera_id).replace('CAM-', '')) || 1
const streamPort = 8999 + cameraNumber
const streamUrl = `http://127.0.0.1:${streamPort}/stream`
  return (
    <div className="cam-panel">
      <div className="cam-feed">

        {online ? (
          <img
            src={streamUrl}
            alt={`${camera.camera_id} live surveillance feed`}
            className="camera-stream"
          />
        ) : (
          <div className="no-signal">
            NO SIGNAL
          </div>
        )}

        <div className="feed-overlay">
          <div className="feed-grid" />
          <div className="feed-scan" />
        </div>

        {latestAlert && (
          <div className={`feed-alert ${latestAlert.severity}`}>
            {latestAlert.event_type.replaceAll('_', ' ')}
          </div>
        )}

        {online && (
          <div className="live-tag">
            <span className="live-dot"></span>
            AI LIVE
          </div>
        )}

        <div className="feed-telemetry mono">
          {camera.fps
            ? `${Number(camera.fps).toFixed(1)} FPS`
            : '— FPS'}{' '}
          · YOLO · TRACKING
        </div>

      </div>

      <div className="cam-info">

        <div className="cam-row">
          <span className="cam-id">
            {camera.camera_id}
          </span>

          <span className={`status-chip ${camera.status}`}>
            {camera.status}
          </span>
        </div>

        <div className="cam-loc">
          {camera.location} · Sector {camera.sector}
        </div>

        <div className="cam-meta">

          <span>
            AI {camera.ai_active ? 'ACTIVE' : 'IDLE'}
          </span>

          <span>
            RISK {score}/100
          </span>

          <span>
            {camera.last_activity
              ? new Date(camera.last_activity).toLocaleTimeString()
              : 'NO ACTIVITY'}
          </span>

        </div>

      </div>
    </div>
  )
}