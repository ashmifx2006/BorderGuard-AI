import React, { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import RiskBadge from '../components/RiskBadge.jsx'

const PIPELINE = [
  'Video Source',
  'OpenCV Processing',
  'YOLO Detection',
  'Object Tracking',
  'Zone + Movement Analysis',
  'Event Intelligence',
  'Risk 0–100',
  'Explainable Alert',
  'Evidence',
  'Human Review',
]

const EVENT_LABELS = {
  RESTRICTED_ZONE_INTRUSION: 'Restricted Zone Intrusion',
  PROLONGED_PRESENCE: 'Prolonged Presence',
  UNUSUAL_MOVEMENT: 'Unusual Movement',
  COMPOUND_INCIDENT: 'Compound Incident',
  ZONE_ENTRY: 'Zone Entry',
  ZONE_EXIT: 'Zone Exit',
  NORMAL_DETECTION: 'Normal Detection',
}

const formatEvent = (event) =>
  EVENT_LABELS[event] ||
  String(event || 'UNKNOWN').replaceAll('_', ' ')

const formatAlertTime = (timestamp) => {
  if (!timestamp) return '—'

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString()
}

const riskClass = (score) => {
  const value = Number(score || 0)

  if (value >= 80) return 'critical'
  if (value >= 60) return 'high'
  if (value >= 30) return 'medium'

  return 'low'
}

export default function AIAnalytics() {
  const [alerts, setAlerts] = useState([])
  const [cameras, setCameras] = useState([])

  const [loading, setLoading] = useState(true)
  const [cameraLoading, setCameraLoading] = useState(true)

  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadAlerts = async () => {
      try {
        const response = await api.get('/alerts/')

        if (mounted) {
          setAlerts(
            Array.isArray(response.data)
              ? response.data
              : []
          )

          setError('')
        }
      } catch (err) {
        console.error(
          'Analytics loading failed:',
          err
        )

        if (mounted) {
          setError(
            'Unable to load analytics data from the backend.'
          )
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    const loadCameras = async () => {
      try {
        const response = await api.get('/cameras/')

        if (mounted) {
          setCameras(
            Array.isArray(response.data)
              ? response.data
              : []
          )

          setCameraError('')
        }
      } catch (err) {
        console.error(
          'Camera health loading failed:',
          err
        )

        if (mounted) {
          setCameraError(
            'Unable to load camera health data.'
          )
        }
      } finally {
        if (mounted) {
          setCameraLoading(false)
        }
      }
    }

    loadAlerts()
    loadCameras()

    const refreshTimer = setInterval(() => {
      loadAlerts()
      loadCameras()
    }, 5000)

    return () => {
      mounted = false
      clearInterval(refreshTimer)
    }
  }, [])

  /*
   * CAMERA HEALTH
   *
   * The Camera model uses `last_activity`.
   * A camera is considered online when its last activity
   * was received within the last 15 seconds.
   */
  const cameraHealth = useMemo(() => {
    const now = Date.now()

    return cameras.map((camera) => {
      const heartbeat =
        camera.last_activity || null

      let online = false

      if (heartbeat) {
        const heartbeatTime =
          new Date(heartbeat).getTime()

        if (!Number.isNaN(heartbeatTime)) {
          online =
            now - heartbeatTime <= 15000
        }
      }

      return {
        ...camera,
        online,
        heartbeat,
      }
    })
  }, [cameras])

  const onlineCameras = cameraHealth.filter(
    (camera) => camera.online
  ).length

  const offlineCameras =
    cameraHealth.length - onlineCameras

  /*
   * ANALYTICS
   */
  const analytics = useMemo(() => {
    const total = alerts.length

    const scores = alerts.map((alert) =>
      Number(alert.risk_score || 0)
    )

    const averageRisk = total
      ? Math.round(
          scores.reduce(
            (sum, score) => sum + score,
            0
          ) / total
        )
      : 0

    const critical = alerts.filter(
      (alert) =>
        Number(alert.risk_score || 0) >= 80
    ).length

    const high = alerts.filter(
      (alert) => {
        const score = Number(
          alert.risk_score || 0
        )

        return score >= 60 && score < 80
      }
    ).length

    const watch = alerts.filter(
      (alert) => {
        const score = Number(
          alert.risk_score || 0
        )

        return score >= 30 && score < 60
      }
    ).length

    const normal = alerts.filter(
      (alert) =>
        Number(alert.risk_score || 0) < 30
    ).length

    const correlated = alerts.filter(
      (alert) =>
        Boolean(alert.correlation_id)
    ).length

    const resolved = alerts.filter(
      (alert) =>
        String(
          alert.status || ''
        ).toLowerCase() === 'resolved'
    ).length

    const active = alerts.filter(
      (alert) =>
        String(
          alert.status || ''
        ).toLowerCase() !== 'resolved'
    ).length

    const cameraCounts = {}

    alerts.forEach((alert) => {
      const camera =
        alert.camera_display ||
        alert.camera ||
        'Unknown'

      cameraCounts[camera] =
        (cameraCounts[camera] || 0) + 1
    })

    const eventCounts = {}

    alerts.forEach((alert) => {
      const event =
        alert.event_type ||
        'UNKNOWN'

      eventCounts[event] =
        (eventCounts[event] || 0) + 1
    })

    const topCameras = Object.entries(
      cameraCounts
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const topEvents = Object.entries(
      eventCounts
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    return {
      total,
      averageRisk,
      critical,
      high,
      watch,
      normal,
      correlated,
      resolved,
      active,
      topCameras,
      topEvents,
    }
  }, [alerts])

  const highRiskActive = useMemo(() => {
    return alerts.filter((alert) => {
      const score =
        Number(alert.risk_score || 0)

      const status =
        String(
          alert.status || ''
        ).toLowerCase()

      return (
        score >= 60 &&
        status !== 'resolved'
      )
    }).length
  }, [alerts])

  const riskDistribution = [
    {
      label: 'Critical',
      value: analytics.critical,
      className: 'critical',
    },
    {
      label: 'High',
      value: analytics.high,
      className: 'high',
    },
    {
      label: 'Watch',
      value: analytics.watch,
      className: 'medium',
    },
    {
      label: 'Normal',
      value: analytics.normal,
      className: 'low',
    },
  ]

  return (
    <>
      {/* HEADER */}

      <div className="command-head">
        <div>
          <div className="eyebrow">
            AI / INTELLIGENCE
          </div>

          <h1>
            Explainable AI Analytics
          </h1>

          <p>
            Rule-based contextual intelligence
            using measurable video activity.
            No identity inference or
            criminal-intent prediction.
          </p>
        </div>
      </div>

      {/* COMMAND CENTER SUMMARY */}

      <div className="analytics-cards">
        <div className="metric-card">
          <span>
            Current Risk Posture
          </span>

          <b>
            {loading
              ? '—'
              : analytics.critical > 0
                ? 'CRITICAL'
                : analytics.high > 0
                  ? 'HIGH'
                  : analytics.watch > 0
                    ? 'WATCH'
                    : 'NORMAL'}
          </b>

          <small>
            Derived from recorded alert scores
          </small>
        </div>

        <div className="metric-card">
          <span>
            Active Incidents
          </span>

          <b>
            {loading
              ? '—'
              : analytics.active}
          </b>

          <small>
            Not resolved
          </small>
        </div>

        <div className="metric-card">
          <span>
            High-Risk Active
          </span>

          <b>
            {loading
              ? '—'
              : highRiskActive}
          </b>

          <small>
            Risk score 60+
          </small>
        </div>

        <div className="metric-card">
          <span>
            Cameras Online
          </span>

          <b>
            {cameraLoading
              ? '—'
              : `${onlineCameras}/${cameraHealth.length}`}
          </b>

          <small>
            Live surveillance status
          </small>
        </div>
      </div>

      {/* PIPELINE */}

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              DECISION PIPELINE
            </span>

            <h3>
              Processing Pipeline
            </h3>
          </div>

          <span className="mono">
            {PIPELINE.length} stages
          </span>
        </div>

        <div className="pipeline">
          {PIPELINE.map((step, index) => (
            <React.Fragment key={step}>
              <div className="pipeline-step">
                <small>
                  {String(index + 1).padStart(
                    2,
                    '0'
                  )}
                </small>

                {step}
              </div>

              {index <
                PIPELINE.length - 1 && (
                <span>→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* CAMERA HEALTH */}

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              SURVEILLANCE NETWORK
            </span>

            <h3>
              Camera Health
            </h3>
          </div>

          <span className="mono">
            {onlineCameras} / {cameraHealth.length}{' '}
            ONLINE
          </span>
        </div>

        {cameraLoading ? (
          <div className="empty-state">
            Loading camera health...
          </div>
        ) : cameraError ? (
          <div className="empty-state">
            {cameraError}
          </div>
        ) : cameraHealth.length === 0 ? (
          <div className="empty-state">
            No cameras registered.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {cameraHealth.map((camera) => {
              const heartbeatTime =
                camera.heartbeat
                  ? new Date(
                      camera.heartbeat
                    ).getTime()
                  : null

              const heartbeatAge =
                heartbeatTime &&
                !Number.isNaN(
                  heartbeatTime
                )
                  ? Math.max(
                      0,
                      Math.round(
                        (Date.now() -
                          heartbeatTime) /
                          1000
                      )
                    )
                  : null

              return (
                <div
                  key={camera.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '14px 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      display: 'block',
                      background:
                        camera.online
                          ? '#22c55e'
                          : '#ef4444',
                      boxShadow:
                        camera.online
                          ? '0 0 10px rgba(34,197,94,0.7)'
                          : '0 0 10px rgba(239,68,68,0.5)',
                    }}
                  />

                  <div>
                    <strong className="mono">
                      {camera.camera_id}
                    </strong>

                    <div
                      style={{
                        marginTop: 3,
                        opacity: 0.7,
                      }}
                    >
                      {camera.location ||
                        camera.name ||
                        'Location unavailable'}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                    }}
                  >
                    <strong
                      style={{
                        color:
                          camera.online
                            ? '#22c55e'
                            : '#ef4444',
                      }}
                    >
                      {camera.online
                        ? 'ONLINE'
                        : 'OFFLINE'}
                    </strong>

                    <div
                      className="mono"
                      style={{
                        marginTop: 3,
                        fontSize: 11,
                        opacity: 0.65,
                      }}
                    >
                      {heartbeatAge !== null
                        ? `${heartbeatAge}s ago`
                        : 'No heartbeat'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!cameraLoading &&
          !cameraError &&
          cameraHealth.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 18,
                marginTop: 14,
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              <span>
                Online: {onlineCameras}
              </span>

              <span>
                Offline: {offlineCameras}
              </span>

              <span>
                Auto-refresh: 5s
              </span>
            </div>
          )}
      </div>

      {/* LIVE INCIDENT ACTIVITY */}

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              LIVE OPERATIONS
            </span>

            <h3>
              Recent Incident Activity
            </h3>
          </div>

          <span className="mono">
            Auto-refresh: 5s
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            Loading incident activity...
          </div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            No incidents recorded yet.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {alerts
              .slice(0, 8)
              .map((alert) => {
                const score =
                  Number(
                    alert.risk_score || 0
                  )

                return (
                  <div
                    key={alert.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        '1fr auto auto auto auto',
                      gap: 14,
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom:
                        '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div>
                      <strong>
                        {formatEvent(
                          alert.event_type
                        )}
                      </strong>

                      <div
                        className="mono"
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          opacity: 0.65,
                        }}
                      >
                        {alert.camera_display ||
                          alert.camera ||
                          'Unknown camera'}
                      </div>
                    </div>

                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatAlertTime(
                        alert.created_at
                      )}
                    </span>

                    <RiskBadge
                      score={score}
                      level={
                        alert.risk_level
                      }
                    />

                    <span
                      className={`sev-pill ${
                        alert.severity ||
                        riskClass(score)
                      }`}
                    >
                      {alert.severity ||
                        riskClass(
                          score
                        ).toUpperCase()}
                    </span>

                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                      }}
                    >
                      {alert.status ||
                        'New'}
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* ERROR */}

      {error && (
        <div className="panel">
          <div className="integrity-box">
            ⚠ {error}
          </div>
        </div>
      )}

      {/* PRIMARY ANALYTICS */}

      <div className="analytics-cards">
        <div className="metric-card">
          <span>
            Total Alerts
          </span>

          <b>
            {loading
              ? '—'
              : analytics.total}
          </b>

          <small>
            Recorded incidents
          </small>
        </div>

        <div className="metric-card">
          <span>
            Average Risk
          </span>

          <b>
            {loading
              ? '—'
              : `${analytics.averageRisk}/100`}
          </b>

          <small>
            Across recorded alerts
          </small>
        </div>

        <div className="metric-card">
          <span>
            High Risk+
          </span>

          <b>
            {loading
              ? '—'
              : analytics.critical +
                analytics.high}
          </b>

          <small>
            Risk score 60+
          </small>
        </div>

        <div className="metric-card">
          <span>
            Active Incidents
          </span>

          <b>
            {loading
              ? '—'
              : analytics.active}
          </b>

          <small>
            Not resolved
          </small>
        </div>
      </div>

      {/* SECONDARY ANALYTICS */}

      <div className="analytics-cards">
        <div className="metric-card">
          <span>
            Critical Alerts
          </span>

          <b>
            {loading
              ? '—'
              : analytics.critical}
          </b>

          <small>
            Risk score 80+
          </small>
        </div>

        <div className="metric-card">
          <span>
            Correlated Incidents
          </span>

          <b>
            {loading
              ? '—'
              : analytics.correlated}
          </b>

          <small>
            Temporal correlation
          </small>
        </div>

        <div className="metric-card">
          <span>
            Resolved
          </span>

          <b>
            {loading
              ? '—'
              : analytics.resolved}
          </b>

          <small>
            Completed investigations
          </small>
        </div>

        <div className="metric-card">
          <span>
            Cameras Online
          </span>

          <b>
            {cameraLoading
              ? '—'
              : `${onlineCameras}/${cameraHealth.length}`}
          </b>

          <small>
            Live camera status
          </small>
        </div>
      </div>

      {/* RISK DISTRIBUTION */}

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              RISK DISTRIBUTION
            </span>

            <h3>
              Alert Risk Profile
            </h3>
          </div>

          <span className="mono">
            0–100 scoring model
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 14,
            padding: '8px 0',
          }}
        >
          {riskDistribution.map(
            (item) => {
              const percentage =
                analytics.total > 0
                  ? Math.round(
                      (item.value /
                        analytics.total) *
                        100
                    )
                  : 0

              return (
                <div
                  key={item.label}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems:
                        'center',
                      marginBottom: 6,
                    }}
                  >
                    <span>
                      {item.label}
                    </span>

                    <span className="mono">
                      {item.value} ·{' '}
                      {percentage}%
                    </span>
                  </div>

                  <div className="risk-meter">
                    <div
                      className={`risk-meter-fill ${item.className}`}
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              )
            }
          )}
        </div>
      </div>

      {/* CAMERA + EVENT ANALYTICS */}

      <div
        className="analytics-cards"
        style={{
          alignItems: 'stretch',
        }}
      >
        <div className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                CAMERA ACTIVITY
              </span>

              <h3>
                Alerts by Camera
              </h3>
            </div>
          </div>

          {analytics.topCameras.length ? (
            <div
              style={{
                display: 'grid',
                gap: 12,
              }}
            >
              {analytics.topCameras.map(
                ([camera, count]) => (
                  <div
                    key={camera}
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      gap: 16,
                      alignItems:
                        'center',
                    }}
                  >
                    <span className="mono">
                      {camera}
                    </span>

                    <strong>
                      {count}
                    </strong>
                  </div>
                )
              )}
            </div>
          ) : (
            <p>
              No camera activity recorded.
            </p>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                EVENT INTELLIGENCE
              </span>

              <h3>
                Most Frequent Events
              </h3>
            </div>
          </div>

          {analytics.topEvents.length ? (
            <div
              style={{
                display: 'grid',
                gap: 12,
              }}
            >
              {analytics.topEvents.map(
                ([event, count]) => (
                  <div
                    key={event}
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      gap: 16,
                      alignItems:
                        'center',
                    }}
                  >
                    <span>
                      {formatEvent(event)}
                    </span>

                    <strong>
                      {count}
                    </strong>
                  </div>
                )
              )}
            </div>
          ) : (
            <p>
              No event activity recorded.
            </p>
          )}
        </div>
      </div>

      {/* RISK SCORE TREND */}

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              RISK ANALYTICS
            </span>

            <h3>
              Recent Risk Score Trend
            </h3>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-state">
            No risk data available yet.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              height: 180,
              padding: '20px 0',
            }}
          >
            {alerts
              .slice(0, 12)
              .reverse()
              .map((alert) => {
                const score =
                  Math.max(
                    0,
                    Math.min(
                      100,
                      Number(
                        alert.risk_score || 0
                      )
                    )
                  )

                return (
                  <div
                    key={alert.id}
                    title={`${formatEvent(
                      alert.event_type
                    )}: ${score}/100`}
                    style={{
                      flex: 1,
                      height: `${Math.max(
                        score,
                        4
                      )}%`,
                      minWidth: 10,
                      borderRadius:
                        '6px 6px 0 0',
                      background:
                        'var(--accent, #4f8cff)',
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        position:
                          'absolute',
                        top: -20,
                        left: '50%',
                        transform:
                          'translateX(-50%)',
                        fontSize: 11,
                      }}
                    >
                      {score}
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* EVENT DISTRIBUTION */}

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              EVENT INTELLIGENCE
            </span>

            <h3>
              Event Distribution
            </h3>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-state">
            No event data available yet.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
            }}
          >
            {Object.entries(
              alerts.reduce(
                (counts, alert) => {
                  const event =
                    alert.event_type ||
                    'UNKNOWN'

                  counts[event] =
                    (counts[event] || 0) + 1

                  return counts
                },
                {}
              )
            )
              .sort((a, b) => b[1] - a[1])
              .map(([event, count]) => {
                const percentage =
                  Math.round(
                    (count /
                      alerts.length) *
                      100
                  )

                return (
                  <div
                    key={event}
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        '190px 1fr 50px',
                      gap: 12,
                      alignItems:
                        'center',
                    }}
                  >
                    <span>
                      {formatEvent(event)}
                    </span>

                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background:
                          'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          borderRadius: 999,
                          background:
                            'var(--accent, #4f8cff)',
                        }}
                      />
                    </div>

                    <span
                      className="mono"
                      style={{
                        textAlign:
                          'right',
                      }}
                    >
                      {count}
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* SEVERITY DISTRIBUTION */}

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              ALERT SEVERITY
            </span>

            <h3>
              Severity Distribution
            </h3>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-state">
            No severity data available yet.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {[
              'CRITICAL',
              'HIGH',
              'MEDIUM',
              'LOW',
            ].map((severity) => {
              const count =
                alerts.filter(
                  (alert) =>
                    String(
                      alert.severity || ''
                    ).toUpperCase() ===
                    severity
                ).length

              const percentage =
                alerts.length
                  ? Math.round(
                      (count /
                        alerts.length) *
                        100
                    )
                  : 0

              return (
                <div
                  key={severity}
                  className="metric-card"
                >
                  <span>
                    {severity}
                  </span>

                  <b>
                    {count}
                  </b>

                  <small>
                    {percentage}% of alerts
                  </small>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* RECENT DECISIONS */}

      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              DECISION LOG
            </span>

            <h3>
              Recent Risk Decisions
            </h3>
          </div>

          <span className="mono">
            {alerts.length} total
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            Loading analytics...
          </div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            No alert decisions recorded yet.
          </div>
        ) : (
          <div
            style={{
              overflowX: 'auto',
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>
                    Event
                  </th>

                  <th>
                    Camera
                  </th>

                  <th>
                    Risk
                  </th>

                  <th>
                    Severity
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Why
                  </th>
                </tr>
              </thead>

              <tbody>
                {alerts
                  .slice(0, 15)
                  .map((alert) => {
                    const score =
                      Number(
                        alert.risk_score ||
                          0
                      )

                    return (
                      <tr
                        key={alert.id}
                      >
                        <td>
                          {formatEvent(
                            alert.event_type
                          )}
                        </td>

                        <td className="mono">
                          {alert.camera_display ||
                            alert.camera ||
                            '—'}
                        </td>

                        <td>
                          <RiskBadge
                            score={score}
                            level={
                              alert.risk_level
                            }
                          />
                        </td>

                        <td>
                          <span
                            className={`sev-pill ${
                              alert.severity ||
                              riskClass(
                                score
                              )
                            }`}
                          >
                            {alert.severity ||
                              riskClass(
                                score
                              ).toUpperCase()}
                          </span>
                        </td>

                        <td>
                          {alert.status ||
                            'New'}
                        </td>

                        <td>
                          {alert.reasoning ||
                            'Measured rule threshold crossed.'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}