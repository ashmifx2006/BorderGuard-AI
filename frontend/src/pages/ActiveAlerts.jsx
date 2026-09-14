import React, { useEffect, useMemo, useState } from 'react'
import api from '../services/api'

export default function ActiveAlerts() {
  const [alerts, setAlerts] = useState([])
  const [severity, setSeverity] = useState('')
  const [selected, setSelected] = useState(null)

  const load = () =>
    api
      .get('/alerts/', {
        params: {
          severity: severity || undefined,
        },
      })
      .then((r) => {
        setAlerts(
          r.data.filter((a) => a.status !== 'Resolved')
        )
      })

  useEffect(() => {
    load()
  }, [severity])

  const setStatus = async (
    id,
    status,
    analyst_notes = ''
  ) => {
    await api.post(
      `/alerts/${id}/set-status/`,
      {
        status,
        analyst_notes,
      }
    )

    await load()
  }

  /*
   * Correlate alerts into incident windows.
   *
   * Events on the same camera occurring within
   * 30 seconds are treated as part of the same incident.
   */
  const incidents = useMemo(() => {
    const sorted = [...alerts].sort(
      (a, b) =>
        new Date(a.created_at) -
        new Date(b.created_at)
    )

    const groups = []

    sorted.forEach((alert) => {
      const camera =
        alert.camera_display ||
        alert.camera ||
        'UNKNOWN CAMERA'

      const alertTime =
        new Date(alert.created_at).getTime()

      let matchedGroup = null

      for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i]

        if (group.camera !== camera) {
          continue
        }

        const lastEvent =
          group.events[group.events.length - 1]

        const lastTime =
          new Date(
            lastEvent.created_at
          ).getTime()

        if (
          Math.abs(alertTime - lastTime) <= 30000
        ) {
          matchedGroup = group
          break
        }

        if (
          alertTime - lastTime > 30000
        ) {
          break
        }
      }

      if (matchedGroup) {
        matchedGroup.events.push(alert)
      } else {
        groups.push({
          id: `${camera}-${alert.id}`,
          camera,
          events: [alert],
        })
      }
    })

    return groups
  }, [alerts])

  return (
    <div>

      {/* ACTIVE ALERTS */}
      <div className="panel">

        <div className="panel-head">

          <div>
            <span className="eyebrow">
              SECURITY OPERATIONS
            </span>

            <h3>
              Active Alerts
            </h3>
          </div>

          <select
            value={severity}
            onChange={(e) =>
              setSeverity(e.target.value)
            }
            style={{
              background: 'var(--bg-inset)',
              color: 'var(--text-hi)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              padding: '5px 8px',
              fontSize: 12,
            }}
          >
            <option value="">
              All Severities
            </option>

            <option>CRITICAL</option>
            <option>HIGH</option>
            <option>MEDIUM</option>
            <option>LOW</option>
          </select>

        </div>

        <table>

          <thead>
            <tr>
              <th>Alert</th>
              <th>Time</th>
              <th>Camera</th>
              <th>Event</th>
              <th>Severity</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>

            {alerts.map((a) => (

              <tr key={a.id}>

                <td className="id-cell">
                  AL-{a.id}
                </td>

                <td className="mono">
                  {new Date(
                    a.created_at
                  ).toLocaleTimeString()}
                </td>

                <td className="mono">
                  {a.camera_display ||
                    a.camera ||
                    '—'}
                </td>

                <td>
                  {String(
                    a.event_type || ''
                  ).replaceAll(
                    '_',
                    ' '
                  )}
                </td>

                <td>
                  <span
                    className={`sev-pill ${a.severity}`}
                  >
                    {a.severity}
                  </span>
                </td>

                <td className="mono">
                  {a.risk_score != null
                    ? `${a.risk_score}/100`
                    : '—'}
                </td>

                <td>
                  <span
                    className={`status-pill ${a.status}`}
                  >
                    {a.status}
                  </span>
                </td>

                <td>
                  <button
                    className="btn-sm"
                    onClick={() =>
                      setSelected(a)
                    }
                  >
                    Timeline
                  </button>
                </td>

              </tr>

            ))}

          </tbody>

        </table>

        {alerts.length === 0 && (
          <p
            style={{
              padding: 16,
              color: 'var(--text-low)',
            }}
          >
            No active alerts. Run the AI engine
            to generate real ones from a video feed.
          </p>
        )}

      </div>


      {/* INCIDENT TIMELINE */}
      <div className="panel">

        <div className="panel-head">

          <div>
            <span className="eyebrow">
              EVENT CORRELATION
            </span>

            <h3>
              Incident Timeline
            </h3>
          </div>

          <span className="panel-note">
            {incidents.length} incident
            {incidents.length === 1
              ? ''
              : 's'}
          </span>

        </div>

        <div className="incident-timeline">

          {incidents.map(
            (incident) => (

              <div
                className="timeline-group"
                key={incident.id}
              >

                <div className="timeline-camera">

                  <span className="live-dot" />

                  <span className="mono">
                    {incident.camera}
                  </span>

                  <span className="timeline-count">
                    {incident.events.length} event
                    {incident.events.length === 1
                      ? ''
                      : 's'}
                  </span>

                </div>


                <div className="timeline">

                  {incident.events.map(
                    (event, index) => {

                      const score =
                        Number(
                          event.risk_score || 0
                        )

                      return (

                        <div
                          className="timeline-event"
                          key={event.id}
                        >

                          <div className="timeline-line">

                            <span
                              className={`timeline-node ${
                                score >= 80
                                  ? 'critical'
                                  : score >= 60
                                  ? 'high'
                                  : score >= 30
                                  ? 'medium'
                                  : 'low'
                              }`}
                            />

                            {index <
                              incident.events.length - 1 && (
                              <span className="timeline-connector" />
                            )}

                          </div>


                          <div
                            className="timeline-card"
                            onClick={() =>
                              setSelected(event)
                            }
                            style={{
                              cursor: 'pointer',
                            }}
                          >

                            <div className="timeline-card-head">

                              <div>

                                <span className="timeline-time mono">
                                  {new Date(
                                    event.created_at
                                  ).toLocaleTimeString()}
                                </span>

                                <b>
                                  {String(
                                    event.event_type || ''
                                  ).replaceAll(
                                    '_',
                                    ' '
                                  )}
                                </b>

                              </div>

                              <span
                                className={`sev-pill ${event.severity}`}
                              >
                                {event.severity}
                              </span>

                            </div>


                            <div className="timeline-meta">

                              <span>
                                TRACK{' '}
                                <b>
                                  {event.track_id ||
                                    '—'}
                                </b>
                              </span>

                              <span>
                                RISK{' '}
                                <b>
                                  {score}/100
                                </b>
                              </span>

                              <span>
                                CONF{' '}
                                <b>
                                  {Math.round(
                                    (event.confidence ||
                                      0) * 100
                                  )}
                                  %
                                </b>
                              </span>

                              <span>
                                DWELL{' '}
                                <b>
                                  {Number(
                                    event.dwell_seconds ||
                                      0
                                  ).toFixed(1)}
                                  s
                                </b>
                              </span>

                            </div>

                          </div>

                        </div>

                      )
                    }
                  )}

                </div>

              </div>

            )
          )}

          {alerts.length === 0 && (
            <div className="empty-list">
              No correlated incidents available.
            </div>
          )}

        </div>

      </div>


      {/* SELECTED EVENT */}
      {selected && (

        <div
          className="drawer-backdrop"
          onClick={() =>
            setSelected(null)
          }
        >

          <aside
            className="alert-drawer"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="drawer-head">

              <div>
                <span className="eyebrow">
                  TIMELINE EVENT
                </span>

                <h2>
                  AL-{selected.id}
                </h2>
              </div>

              <button
                className="icon-btn"
                onClick={() =>
                  setSelected(null)
                }
              >
                ×
              </button>

            </div>


            <div className="drawer-section">

              <span className="eyebrow">
                EVENT
              </span>

              <h3
                style={{
                  marginTop: 8,
                  fontSize: 17,
                }}
              >
                {String(
                  selected.event_type || ''
                ).replaceAll(
                  '_',
                  ' '
                )}
              </h3>

              <p style={{ marginTop: 7 }}>
                {selected.reasoning ||
                  'Rule-based event generated from measurable video activity.'}
              </p>

            </div>


            <div className="detail-grid">

              <div>
                <span>CAMERA</span>
                <b>
                  {selected.camera_display ||
                    selected.camera ||
                    '—'}
                </b>
              </div>

              <div>
                <span>SEVERITY</span>
                <b>
                  {selected.severity}
                </b>
              </div>

              <div>
                <span>RISK</span>
                <b>
                  {selected.risk_score != null
                    ? `${selected.risk_score}/100`
                    : '—'}
                </b>
              </div>

              <div>
                <span>STATUS</span>
                <b>
                  {selected.status}
                </b>
              </div>

              <div>
                <span>TRACK</span>
                <b>
                  {selected.track_id || '—'}
                </b>
              </div>

              <div>
                <span>DWELL</span>
                <b>
                  {Number(
                    selected.dwell_seconds || 0
                  ).toFixed(1)}
                  s
                </b>
              </div>

            </div>


            <div className="drawer-section">

              <span className="eyebrow">
                EVENT REASONING
              </span>

              <div className="reason-box">
                {selected.reasoning ||
                  'No additional reasoning recorded.'}
              </div>

            </div>


            <div className="drawer-actions">

              {selected.status === 'New' && (
                <button
                  className="btn"
                  onClick={async () => {
                    await setStatus(
                      selected.id,
                      'Acknowledged'
                    )

                    setSelected(null)
                  }}
                >
                  Acknowledge
                </button>
              )}

              {selected.status ===
                'Acknowledged' && (
                <button
                  className="btn"
                  onClick={async () => {
                    await setStatus(
                      selected.id,
                      'Investigating'
                    )

                    setSelected(null)
                  }}
                >
                  Investigate
                </button>
              )}

              {selected.status ===
                'Investigating' && (
                <button
                  className="btn accent"
                  onClick={async () => {
                    await setStatus(
                      selected.id,
                      'Resolved'
                    )

                    setSelected(null)
                  }}
                >
                  Resolve
                </button>
              )}

            </div>

          </aside>

        </div>

      )}

    </div>
  )
}