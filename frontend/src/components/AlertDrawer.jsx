import React, { useState } from 'react'
import api from '../services/api'
import RiskBadge from './RiskBadge.jsx'

export default function AlertDrawer({ alert, onClose, onStatus }) {
  const [notes, setNotes] = useState(alert?.analyst_notes || '')
  const [integrity, setIntegrity] = useState(null)

  if (!alert) return null

  const factors = Array.isArray(alert.risk_factors)
    ? alert.risk_factors
    : []

  const saveStatus = (status) => {
    onStatus(alert.id, status, notes)
  }

  const verify = async () => {
    try {
      const r = await api.get(
        `/alerts/${alert.id}/verify-integrity/`
      )
      setIntegrity(r.data)
    } catch {
      setIntegrity({ verified: false })
    }
  }

  const report = async () => {
    try {
      const r = await api.get(
        `/alerts/${alert.id}/incident-report/`
      )

      const blob = new Blob(
        [JSON.stringify(r.data, null, 2)],
        { type: 'application/json' }
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')

      a.href = url
      a.download = `BorderGuard-AL-${alert.id}-report.json`
      a.click()

      URL.revokeObjectURL(url)
    } catch {}
  }

  const eventName = String(alert.event_type || 'UNKNOWN')
    .replaceAll('_', ' ')

  const riskScore = Number(alert.risk_score || 0)

  const riskWidth = `${Math.min(100, Math.max(0, riskScore))}%`

  const severityClass =
    alert.severity?.toLowerCase() || 'medium'

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
    >
      <aside
        className="alert-drawer"
        onClick={(e) => e.stopPropagation()}
      >

        {/* HEADER */}
        <div className="drawer-head">
          <div>
            <span className="eyebrow">
              INCIDENT DETAIL
            </span>

            <h2>
              AL-{alert.id}
            </h2>
          </div>

          <button
            className="icon-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>


        {/* RISK HERO */}
        <div className="drawer-section hero-risk">

          <RiskBadge
            score={alert.risk_score}
            level={alert.risk_level}
          />

          <div className="drawer-event">
            {eventName}
          </div>

          <p>
            {alert.reasoning ||
              'Rule-based event detected from measurable video activity.'}
          </p>

          {/* RISK METER */}
          <div className="risk-meter-wrap">
            <div className="risk-meter-label">
              <span>RISK SCORE</span>
              <strong>
                {riskScore}/100
              </strong>
            </div>

            <div className="risk-meter">
              <div
                className={`risk-meter-fill ${severityClass}`}
                style={{ width: riskWidth }}
              />
            </div>
          </div>

        </div>


        {/* AI INTELLIGENCE */}
        <div className="drawer-section">

          <span className="eyebrow">
            AI EVENT INTELLIGENCE
          </span>

          <div className="intelligence-grid">

            <div className="intel-card">
              <span>EVENT</span>
              <b>{eventName}</b>
            </div>

            <div className="intel-card">
              <span>RISK LEVEL</span>
              <b>
                {alert.risk_level || 'NORMAL'}
              </b>
            </div>

            <div className="intel-card">
              <span>MOVEMENT</span>
              <b>
                {alert.movement_speed
                  ? `${Number(alert.movement_speed).toFixed(1)} px/s`
                  : '—'}
              </b>
            </div>

            <div className="intel-card">
              <span>DWELL TIME</span>
              <b>
                {Number(alert.dwell_seconds || 0).toFixed(1)}s
              </b>
            </div>

            <div className="intel-card">
              <span>TRACK ID</span>
              <b>
                {alert.track_id || '—'}
              </b>
            </div>

            <div className="intel-card">
              <span>CONFIDENCE</span>
              <b>
                {Math.round(
                  (alert.confidence || 0) * 100
                )}%
              </b>
            </div>

          </div>

        </div>


        {/* INCIDENT DETAILS */}
        <div className="detail-grid">

          <div>
            <span>CAMERA</span>
            <b>
              {alert.camera_display}
            </b>
          </div>

          <div>
            <span>LOCATION</span>
            <b>
              {alert.location}
            </b>
          </div>

          <div>
            <span>OBJECT</span>
            <b>
              {alert.object_type}
            </b>
          </div>

          <div>
            <span>CONFIDENCE</span>
            <b>
              {Math.round(
                (alert.confidence || 0) * 100
              )}%
            </b>
          </div>

          <div>
            <span>DWELL</span>
            <b>
              {Number(
                alert.dwell_seconds || 0
              ).toFixed(1)}s
            </b>
          </div>

          <div>
            <span>TRACK</span>
            <b>
              {alert.track_id || '—'}
            </b>
          </div>

        </div>


        {/* WHY ALERT */}
        <div className="drawer-section">

          <span className="eyebrow">
            WHY THIS ALERT?
          </span>

          {factors.length ? (
            <ul className="factor-list">
              {factors.map((factor, index) => (
                <li key={index}>
                  <span className="factor-marker">
                    +
                  </span>

                  <span>
                    {factor}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No additional risk factors recorded.
            </p>
          )}

        </div>


        {/* EVIDENCE */}
        {alert.evidence_image && (
          <div className="drawer-section">

            <span className="eyebrow">
              EVIDENCE
            </span>

            <img
              className="evidence-img"
              src={alert.evidence_image}
              alt="Alert evidence"
            />

            <button
              className="btn-sm primary"
              style={{ marginTop: 8 }}
              onClick={verify}
            >
              Verify Integrity
            </button>

            {integrity && (
              <div className="integrity-box">

                {integrity.verified
                  ? '✓ Evidence chain verified'
                  : '⚠ Integrity verification failed'}

                <br />

                <span className="mono">
                  SHA-256:{' '}
                  {(integrity.evidence_sha256 || '')
                    .slice(0, 16)}
                  …
                </span>

              </div>
            )}

          </div>
        )}


        {/* OFFICER NOTES */}
        <div className="drawer-section">

          <span className="eyebrow">
            OFFICER NOTES
          </span>

          <textarea
            className="notes-input"
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
            placeholder="Record verification, observations, or resolution notes…"
          />

        </div>


        {/* ACTIONS */}
        <div className="drawer-actions">

          <button
            className="btn-sm"
            onClick={report}
          >
            Generate Incident Report
          </button>

          {alert.status === 'New' && (
            <button
              className="btn"
              onClick={() =>
                saveStatus('Acknowledged')
              }
            >
              Acknowledge
            </button>
          )}

          {alert.status === 'Acknowledged' && (
            <button
              className="btn"
              onClick={() =>
                saveStatus('Investigating')
              }
            >
              Start Investigation
            </button>
          )}

          {alert.status === 'Investigating' && (
            <button
              className="btn accent"
              onClick={() =>
                saveStatus('Resolved')
              }
            >
              Resolve Incident
            </button>
          )}

        </div>

      </aside>
    </div>
  )
}