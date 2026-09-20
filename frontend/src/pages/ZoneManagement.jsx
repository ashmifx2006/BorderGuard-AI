import React, { useEffect, useRef, useState } from 'react'
import api from '../services/api'

const STREAM_URL_BASE = 'http://127.0.0.1'

const emptyForm = {
  name: '',
  camera: '',
  severity: 'HIGH',
  polygon: '[]',
  active_hours: '24x7',
  alert_threshold: '1 person',
  is_active: true,
}

export default function ZoneManagement() {
  const [zones, setZones] = useState([])
  const [cameras, setCameras] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [drawPoints, setDrawPoints] = useState([])
  const [drawing, setDrawing] = useState(false)

  const frameRef = useRef(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [zonesResponse, camerasResponse] = await Promise.all([
        api.get('/zones/'),
        api.get('/cameras/'),
      ])

      setZones(zonesResponse.data)
      setCameras(camerasResponse.data)
    } catch (err) {
      console.error(err)

      setError(
        err?.response?.data?.detail ||
        'Unable to load security zones.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setDrawPoints([])
    setDrawing(false)
    setError('')
  }

  /*
   * Resolve the selected Django camera ID to the actual
   * camera identifier such as CAM-01 / CAM-02.
   */
  const selectedCamera = cameras.find(
    (camera) => String(camera.id) === String(form.camera)
  )

  /*
   * CAM-01 -> 9000
   * CAM-02 -> 9001
   * CAM-03 -> 9002
   */
  const cameraNumber = selectedCamera
    ? Number(
        String(selectedCamera.camera_id).replace('CAM-', '')
      ) || 1
    : 1

  const streamPort = 8999 + cameraNumber

  const streamUrl = form.camera
    ? `${STREAM_URL_BASE}:${streamPort}/stream`
    : ''

  const normalizePoints = (points) => {
    const frame = frameRef.current

    if (!frame) {
      return []
    }

    const rect = frame.getBoundingClientRect()

    if (!rect.width || !rect.height) {
      return []
    }

    return points.map((point) => [
      Number(
        Math.max(
          0,
          Math.min(1, point.x / rect.width)
        ).toFixed(4)
      ),
      Number(
        Math.max(
          0,
          Math.min(1, point.y / rect.height)
        ).toFixed(4)
      ),
    ])
  }

  const updatePolygonFromPoints = (points) => {
    const normalized = normalizePoints(points)

    updateField(
      'polygon',
      JSON.stringify(normalized, null, 2)
    )
  }

  const handleFrameClick = (event) => {
    if (!form.camera) {
      setError('Select a camera before drawing a zone.')
      return
    }

    const frame = frameRef.current

    if (!frame) {
      return
    }

    const rect = frame.getBoundingClientRect()

    const x = Math.max(
      0,
      Math.min(
        rect.width,
        event.clientX - rect.left
      )
    )

    const y = Math.max(
      0,
      Math.min(
        rect.height,
        event.clientY - rect.top
      )
    )

    const nextPoints = [
      ...drawPoints,
      { x, y },
    ]

    setDrawPoints(nextPoints)
    setDrawing(true)
    setError('')

    updatePolygonFromPoints(nextPoints)
  }

  const undoPoint = () => {
    if (!drawPoints.length) {
      return
    }

    const nextPoints = drawPoints.slice(0, -1)

    setDrawPoints(nextPoints)

    updatePolygonFromPoints(nextPoints)

    if (nextPoints.length === 0) {
      setDrawing(false)
    }
  }

  const clearPolygon = () => {
    setDrawPoints([])
    setDrawing(false)
    updateField('polygon', '[]')
  }

  const startEdit = (zone) => {
    const polygon = zone.polygon || []

    setEditingId(zone.id)

    setForm({
      name: zone.name || '',
      camera: zone.camera || '',
      severity: zone.severity || 'HIGH',
      polygon: JSON.stringify(
        polygon,
        null,
        2
      ),
      active_hours:
        zone.active_hours || '24x7',
      alert_threshold:
        zone.alert_threshold || '1 person',
      is_active:
        Boolean(zone.is_active),
    })

    setDrawPoints([])

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const handleCameraChange = (value) => {
    updateField('camera', value)

    setDrawPoints([])
    setDrawing(false)
    updateField('polygon', '[]')
    setError('')
  }

  const saveZone = async (event) => {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Zone name is required.')
      return
    }

    if (!form.camera) {
      setError('Select a camera.')
      return
    }

    let polygon

    try {
      polygon = JSON.parse(form.polygon)

      if (
        !Array.isArray(polygon) ||
        polygon.length < 3
      ) {
        throw new Error()
      }

      const validPolygon = polygon.every(
        (point) =>
          Array.isArray(point) &&
          point.length === 2 &&
          Number.isFinite(Number(point[0])) &&
          Number.isFinite(Number(point[1])) &&
          Number(point[0]) >= 0 &&
          Number(point[0]) <= 1 &&
          Number(point[1]) >= 0 &&
          Number(point[1]) <= 1
      )

      if (!validPolygon) {
        throw new Error()
      }
    } catch {
      setError(
        'Polygon must contain at least 3 valid normalized points between 0 and 1.'
      )
      return
    }

    const payload = {
      name: form.name.trim(),
      camera: Number(form.camera),
      severity: form.severity,
      polygon,
      active_hours:
        form.active_hours.trim() || '24x7',
      alert_threshold:
        form.alert_threshold.trim() || '1 person',
      is_active: form.is_active,
    }

    try {
      setSaving(true)
      setError('')

      if (editingId) {
        await api.put(
          `/zones/${editingId}/`,
          payload
        )
      } else {
        await api.post(
          '/zones/',
          payload
        )
      }

      resetForm()
      await loadData()
    } catch (err) {
      console.error(err)

      const detail =
        err?.response?.data?.detail

      const fieldErrors =
        err?.response?.data

      setError(
        detail ||
        (fieldErrors
          ? JSON.stringify(fieldErrors)
          : 'Unable to save security zone.')
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleZone = async (zone) => {
    try {
      await api.patch(
        `/zones/${zone.id}/`,
        {
          is_active:
            !zone.is_active,
        }
      )

      await loadData()
    } catch (err) {
      console.error(err)

      setError(
        'Unable to change zone status.'
      )
    }
  }

  const deleteZone = async (zone) => {
    const confirmed =
      window.confirm(
        `Delete zone "${zone.name}"? This cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    try {
      await api.delete(
        `/zones/${zone.id}/`
      )

      if (
        editingId === zone.id
      ) {
        resetForm()
      }

      await loadData()
    } catch (err) {
      console.error(err)

      setError(
        'Unable to delete zone.'
      )
    }
  }

  const normalizedPolygon = (() => {
    try {
      const parsed =
        JSON.parse(form.polygon)

      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed
        .filter(
          (point) =>
            Array.isArray(point) &&
            point.length === 2
        )
        .map((point) => ({
          x: Number(point[0]),
          y: Number(point[1]),
        }))
    } catch {
      return []
    }
  })()

  return (
    <div>

      {/* HEADER */}
      <div className="panel">

        <div className="panel-head">

          <div>
            <span className="eyebrow">
              SECURITY CONFIGURATION
            </span>

            <h3>
              Zone Management
            </h3>
          </div>

          <span className="panel-note">
            {zones.length} zone
            {zones.length === 1 ? '' : 's'}
          </span>

        </div>

        <div
          style={{
            padding: '0 16px 16px',
            color: 'var(--text-low)',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          Configure real surveillance
          zones. Select a camera and click
          points directly on the live AI frame
          to draw a normalized security zone.
        </div>

      </div>


      {/* ZONE FORM */}
      <div className="panel">

        <div className="panel-head">

          <div>
            <span className="eyebrow">
              {editingId
                ? 'EDIT CONFIGURATION'
                : 'NEW CONFIGURATION'}
            </span>

            <h3>
              {editingId
                ? 'Edit Security Zone'
                : 'Create Security Zone'}
            </h3>
          </div>

          {editingId && (
            <button
              className="btn-sm"
              onClick={resetForm}
              type="button"
            >
              Cancel
            </button>
          )}

        </div>

        <form
          onSubmit={saveZone}
          style={{
            padding: 16,
          }}
        >

          {/* BASIC CONFIGURATION */}
          <div className="detail-grid">

            <div>
              <label>
                <span>
                  ZONE NAME
                </span>

                <input
                  value={form.name}
                  onChange={(e) =>
                    updateField(
                      'name',
                      e.target.value
                    )
                  }
                  placeholder="Restricted Perimeter"
                />
              </label>
            </div>

            <div>
              <label>
                <span>
                  CAMERA
                </span>

                <select
                  value={form.camera}
                  onChange={(e) =>
                    handleCameraChange(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select camera
                  </option>

                  {cameras.map(
                    (camera) => (
                      <option
                        key={camera.id}
                        value={camera.id}
                      >
                        {camera.camera_id}
                        {' '}
                        —{' '}
                        {camera.location}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div>
              <label>
                <span>
                  SEVERITY
                </span>

                <select
                  value={form.severity}
                  onChange={(e) =>
                    updateField(
                      'severity',
                      e.target.value
                    )
                  }
                >
                  <option>CRITICAL</option>
                  <option>HIGH</option>
                  <option>MEDIUM</option>
                  <option>LOW</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span>
                  ACTIVE HOURS
                </span>

                <input
                  value={form.active_hours}
                  onChange={(e) =>
                    updateField(
                      'active_hours',
                      e.target.value
                    )
                  }
                  placeholder="24x7"
                />
              </label>
            </div>

            <div>
              <label>
                <span>
                  ALERT THRESHOLD
                </span>

                <input
                  value={form.alert_threshold}
                  onChange={(e) =>
                    updateField(
                      'alert_threshold',
                      e.target.value
                    )
                  }
                  placeholder="1 person"
                />
              </label>
            </div>

            <div>
              <label>
                <span>
                  STATUS
                </span>

                <select
                  value={
                    form.is_active
                      ? 'ACTIVE'
                      : 'INACTIVE'
                  }
                  onChange={(e) =>
                    updateField(
                      'is_active',
                      e.target.value === 'ACTIVE'
                    )
                  }
                >
                  <option value="ACTIVE">
                    ACTIVE
                  </option>

                  <option value="INACTIVE">
                    INACTIVE
                  </option>
                </select>
              </label>
            </div>

          </div>


          {/* VISUAL ZONE DRAWING */}
          <div
            style={{
              marginTop: 18,
              padding: 14,
              border:
                '1px solid var(--border)',
              background:
                'var(--panel)',
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 10,
              }}
            >

              <div>
                <span className="eyebrow">
                  VISUAL ZONE DRAWING
                </span>

                <h4
                  style={{
                    margin: '4px 0 0',
                  }}
                >
                  Draw Restricted Area
                </h4>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 6,
                }}
              >

                <button
                  type="button"
                  className="btn-sm"
                  onClick={undoPoint}
                  disabled={
                    drawPoints.length === 0
                  }
                >
                  Undo
                </button>

                <button
                  type="button"
                  className="btn-sm"
                  onClick={clearPolygon}
                  disabled={
                    drawPoints.length === 0
                  }
                >
                  Clear
                </button>

              </div>

            </div>


            {!form.camera ? (

              <div
                className="empty-list"
                style={{
                  padding: 24,
                  textAlign: 'center',
                }}
              >
                Select a camera above to
                start drawing a zone.
              </div>

            ) : (

              <>

                <div
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    color:
                      'var(--text-low)',
                  }}
                >
                  CAMERA:{' '}
                  <b>
                    {selectedCamera?.camera_id || '—'}
                  </b>
                  {' · '}
                  STREAM PORT:{' '}
                  <b>
                    {streamPort}
                  </b>
                  <br />
                  CLICK 3 OR MORE POINTS ON
                  THE FRAME TO CREATE THE
                  POLYGON.
                </div>


                {/* FRAME */}
                <div
                  ref={frameRef}
                  onClick={handleFrameClick}
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 900,
                    margin: '0 auto',
                    cursor: 'crosshair',
                    overflow: 'hidden',
                    border:
                      '1px solid var(--border)',
                    background: '#050505',
                  }}
                >

                  <img
                    key={streamUrl}
                    src={streamUrl}
                    alt={`${selectedCamera?.camera_id || 'AI'} surveillance stream`}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      minHeight: 260,
                      objectFit: 'contain',
                      pointerEvents: 'none',
                    }}
                    onError={() => {
                      setError(
                        `Unable to load ${selectedCamera?.camera_id || 'camera'} stream at ${streamUrl}. Make sure its AI stream is running.`
                      )
                    }}
                  />


                  {/* SVG POLYGON OVERLAY */}
                  <svg
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    }}
                  >

                    {normalizedPolygon.length >= 3 && (
                      <polygon
                        points={
                          normalizedPolygon
                            .map(
                              (point) =>
                                `${point.x},${point.y}`
                            )
                            .join(' ')
                        }
                        fill="rgba(255, 70, 70, 0.20)"
                        stroke="#ff4646"
                        strokeWidth="0.006"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}

                    {normalizedPolygon.length >= 2 && (
                      <polyline
                        points={
                          normalizedPolygon
                            .map(
                              (point) =>
                                `${point.x},${point.y}`
                            )
                            .join(' ')
                        }
                        fill="none"
                        stroke="#ff4646"
                        strokeWidth="0.006"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}

                    {normalizedPolygon.map(
                      (point, index) => (
                        <circle
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r="0.014"
                          fill="#ffffff"
                          stroke="#ff4646"
                          strokeWidth="0.005"
                          vectorEffect="non-scaling-stroke"
                        />
                      )
                    )}

                  </svg>

                </div>


                {/* DRAW STATUS */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 10,
                    fontSize: 11,
                  }}
                >

                  <span
                    style={{
                      color:
                        'var(--text-low)',
                    }}
                  >
                    POINTS:{' '}
                    <b>
                      {normalizedPolygon.length}
                    </b>
                  </span>

                  <span
                    style={{
                      color:
                        normalizedPolygon.length >= 3
                          ? 'var(--ok)'
                          : 'var(--text-low)',
                    }}
                  >
                    {normalizedPolygon.length >= 3
                      ? 'POLYGON READY'
                      : 'ADD AT LEAST 3 POINTS'}
                  </span>

                </div>

              </>

            )}

          </div>


          {/* NORMALIZED POLYGON */}
          <div
            style={{
              marginTop: 14,
            }}
          >

            <label>
              <span>
                NORMALIZED POLYGON
              </span>

              <textarea
                value={form.polygon}
                onChange={(e) => {
                  updateField(
                    'polygon',
                    e.target.value
                  )

                  try {
                    const parsed =
                      JSON.parse(
                        e.target.value
                      )

                    if (
                      Array.isArray(parsed)
                    ) {
                      setDrawPoints([])
                      setDrawing(false)
                    }
                  } catch {
                    // Keep manual text unchanged.
                  }
                }}
                rows={5}
                spellCheck={false}
                placeholder={`[
  [0.10, 0.10],
  [0.90, 0.10],
  [0.90, 0.90],
  [0.10, 0.90]
]`}
              />

            </label>

            <div
              style={{
                marginTop: 6,
                color:
                  'var(--text-low)',
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              Coordinates are automatically
              normalized between 0 and 1.
              You can also edit the JSON
              manually if needed.
            </div>

          </div>


          {/* ERROR */}
          {error && (
            <div
              className="reason-box"
              style={{
                marginTop: 14,
                borderColor:
                  'var(--crit)',
              }}
            >
              {error}
            </div>
          )}


          {/* ACTIONS */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 14,
            }}
          >

            <button
              className="btn accent"
              type="submit"
              disabled={
                saving ||
                normalizedPolygon.length < 3
              }
            >
              {saving
                ? 'Saving...'
                : editingId
                ? 'Update Zone'
                : 'Create Zone'}
            </button>

            {editingId && (
              <button
                className="btn-sm"
                type="button"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}

          </div>

        </form>

      </div>


      {/* ZONE LIST */}
      <div className="panel">

        <div className="panel-head">

          <div>
            <span className="eyebrow">
              LIVE CONFIGURATION
            </span>

            <h3>
              Configured Zones
            </h3>
          </div>

          <span className="panel-note">
            {
              zones.filter(
                (zone) =>
                  zone.is_active
              ).length
            } active
          </span>

        </div>

        {loading ? (

          <div
            style={{
              padding: 16,
              color:
                'var(--text-low)',
            }}
          >
            Loading zones...
          </div>

        ) : zones.length === 0 ? (

          <div
            className="empty-list"
            style={{
              padding: 20,
            }}
          >
            No security zones
            configured.
          </div>

        ) : (

          <div
            style={{
              padding: 12,
            }}
          >

            {zones.map(
              (zone) => (

                <div
                  key={zone.id}
                  className="intel-card"
                  style={{
                    marginBottom: 8,
                  }}
                >

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >

                    <div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >

                        <b>
                          {zone.name}
                        </b>

                        <span
                          className={`sev-pill ${zone.severity}`}
                        >
                          {zone.severity}
                        </span>

                      </div>

                      <div
                        className="timeline-meta"
                        style={{
                          marginTop: 7,
                        }}
                      >

                        <span>
                          CAMERA{' '}
                          <b>
                            {
                              zone.camera_display ||
                              zone.camera ||
                              '—'
                            }
                          </b>
                        </span>

                        <span>
                          HOURS{' '}
                          <b>
                            {
                              zone.active_hours ||
                              '24x7'
                            }
                          </b>
                        </span>

                        <span>
                          THRESHOLD{' '}
                          <b>
                            {
                              zone.alert_threshold ||
                              '—'
                            }
                          </b>
                        </span>

                        <span>
                          STATUS{' '}
                          <b>
                            {zone.is_active
                              ? 'ACTIVE'
                              : 'INACTIVE'}
                          </b>
                        </span>

                      </div>

                    </div>


                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >

                      <button
                        className="btn-sm"
                        onClick={() =>
                          startEdit(zone)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="btn-sm"
                        onClick={() =>
                          toggleZone(zone)
                        }
                      >
                        {zone.is_active
                          ? 'Disable'
                          : 'Enable'}
                      </button>

                      <button
                        className="btn-sm"
                        onClick={() =>
                          deleteZone(zone)
                        }
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </div>

    </div>
  )
}