import React from 'react'

export default function CameraPanel({ camera, videoSrc }) {
  const isCam01 = camera.camera_id === 'CAM-01'

  return (
    <div className="cam-panel">
      <div className="cam-feed" style={{ position: 'relative', overflow: 'hidden' }}>

        {isCam01 && videoSrc ? (
          <>
            <video
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              controls
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />

            <div
              className="live-tag"
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                zIndex: 2,
              }}
            >
              <span className="live-dot"></span>
              LIVE
            </div>
          </>
        ) : camera.status === 'ONLINE' ? (
          <div className="live-tag">
            <span className="live-dot"></span>
            LIVE
          </div>
        ) : (
          <div
            style={{
              color: 'var(--text-low)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            NO SIGNAL
          </div>
        )}

      </div>

      <div className="cam-info">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="cam-id">{camera.camera_id}</span>
          <span className={`status-chip ${camera.status}`}>
            {isCam01 ? 'ONLINE' : camera.status}
          </span>
        </div>

        <div className="cam-loc">{camera.location}</div>
      </div>
    </div>
  )
}