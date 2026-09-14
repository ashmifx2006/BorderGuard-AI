import React, { useEffect, useState } from 'react'
import api from '../services/api'

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

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [zonesResponse, camerasResponse] =
        await Promise.all([
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
    setError('')
  }

  const startEdit = (zone) => {
    setEditingId(zone.id)

    setForm({
      name: zone.name || '',
      camera: zone.camera || '',
      severity: zone.severity || 'HIGH',
      polygon: JSON.stringify(
        zone.polygon || [],
        null,
        2
      ),
      active_hours: zone.active_hours || '24x7',
      alert_threshold:
        zone.alert_threshold || '1 person',
      is_active: Boolean(zone.is_active),
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
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

      if (!Array.isArray(polygon)) {
        throw new Error()
      }
    } catch {
      setError(
        'Polygon must be valid JSON, for example [[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]].'
      )
      return
    }

    const payload = {
      name: form.name.trim(),
      camera: Number(form.camera),
      severity: form.severity,
      polygon,
      active_hours: form.active_hours.trim() || '24x7',
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
        await api.post('/zones/', payload)
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
          is_active: !zone.is_active,
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
    const confirmed = window.confirm(
      `Delete zone "${zone.name}"? This cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    try {
      await api.delete(
        `/zones/${zone.id}/`
      )

      if (editingId === zone.id) {
        resetForm()
      }

      await loadData()
    } catch (err) {
      console.error(err)
      setError(
        'Unable to delete security zone.'
      )
    }
  }

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
          Configure real surveillance zones and
          their alert sensitivity. Polygon coordinates
          use normalized 0–1 frame coordinates.
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

          <div className="detail-grid">

            <div>
              <label>
                <span>ZONE NAME</span>

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
                <span>CAMERA</span>

                <select
                  value={form.camera}
                  onChange={(e) =>
                    updateField(
                      'camera',
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select camera
                  </option>

                  {cameras.map((camera) => (
                    <option
                      key={camera.id}
                      value={camera.id}
                    >
                      {camera.camera_id} —{' '}
                      {camera.location}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                <span>SEVERITY</span>

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
                <span>ACTIVE HOURS</span>

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
                <span>ALERT THRESHOLD</span>

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
                <span>STATUS</span>

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
                onChange={(e) =>
                  updateField(
                    'polygon',
                    e.target.value
                  )
                }
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

          </div>


          {error && (
            <div
              className="reason-box"
              style={{
                marginTop: 14,
                borderColor: 'var(--crit)',
              }}
            >
              {error}
            </div>
          )}


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
              disabled={saving}
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
            {zones.filter(
              (zone) => zone.is_active
            ).length}{' '}
            active
          </span>

        </div>

        {loading ? (
          <div
            style={{
              padding: 16,
              color: 'var(--text-low)',
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
            No security zones configured.
          </div>
        ) : (
          <div
            style={{
              padding: 12,
            }}
          >

            {zones.map((zone) => (

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
                    justifyContent:
                      'space-between',
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
                          {zone.camera_display ||
                            zone.camera ||
                            '—'}
                        </b>
                      </span>

                      <span>
                        HOURS{' '}
                        <b>
                          {zone.active_hours ||
                            '24x7'}
                        </b>
                      </span>

                      <span>
                        THRESHOLD{' '}
                        <b>
                          {zone.alert_threshold ||
                            '—'}
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

            ))}

          </div>
        )}

      </div>

    </div>
  )
}