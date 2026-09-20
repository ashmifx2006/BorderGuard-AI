import React, { useEffect, useState } from 'react'
import api from '../services/api'

const emptyForm = {
  camera_id: '',
  location: '',
  sector: '',
  status: 'ONLINE',
  source_type: 'UPLOAD',
  source_path: '',
  ai_active: true,
  fps: 30,
}

export default function Cameras() {
  const [cameras, setCameras] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    try {
      const response = await api.get('/cameras/')
      setCameras(
        Array.isArray(response.data)
          ? response.data
          : []
      )
      setError('')
    } catch (err) {
      console.error('Camera loading failed:', err)
      setError('Unable to load camera configuration.')
    }
  }

  useEffect(() => {
    load()
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
    setMessage('')
  }

  const editCamera = (camera) => {
    setEditingId(camera.id)

    setForm({
      camera_id: camera.camera_id || '',
      location: camera.location || '',
      sector: camera.sector || '',
      status: camera.status || 'ONLINE',
      source_type: camera.source_type || 'UPLOAD',
      source_path: camera.source_path || '',
      ai_active: Boolean(camera.ai_active),
      fps: camera.fps || 30,
    })

    setError('')
    setMessage('')
  }

  const saveCamera = async (event) => {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!form.camera_id.trim()) {
      setError('Camera ID is required.')
      return
    }

    if (!form.location.trim()) {
      setError('Location is required.')
      return
    }

    if (!form.sector.trim()) {
      setError('Sector is required.')
      return
    }

    if (
      form.source_type === 'UPLOAD' &&
      !form.source_path.trim()
    ) {
      setError(
        'Enter the uploaded video path for this camera.'
      )
      return
    }

    setSaving(true)

    const payload = {
      camera_id: form.camera_id.trim(),
      location: form.location.trim(),
      sector: form.sector.trim(),
      status: form.status,
      source_type: form.source_type,
      source_path: form.source_path.trim(),
      ai_active: form.ai_active,
      fps: Number(form.fps) || 30,
    }

    try {
      if (editingId) {
        await api.patch(
          `/cameras/${editingId}/`,
          payload
        )

        setMessage(
          `${payload.camera_id} updated successfully.`
        )
      } else {
        await api.post('/cameras/', payload)

        setMessage(
          `${payload.camera_id} added successfully.`
        )
      }

      resetForm()
      await load()
    } catch (err) {
      console.error('Camera save failed:', err)

      const detail =
        err?.response?.data

      if (typeof detail === 'object') {
        setError(
          Object.entries(detail)
            .map(
              ([key, value]) =>
                `${key}: ${
                  Array.isArray(value)
                    ? value.join(', ')
                    : value
                }`
            )
            .join(' | ')
        )
      } else {
        setError(
          'Unable to save camera configuration.'
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteCamera = async (camera) => {
    const confirmed = window.confirm(
      `Delete ${camera.camera_id}?`
    )

    if (!confirmed) {
      return
    }

    setError('')
    setMessage('')

    try {
      await api.delete(
        `/cameras/${camera.id}/`
      )

      setMessage(
        `${camera.camera_id} deleted successfully.`
      )

      if (editingId === camera.id) {
        resetForm()
      }

      await load()
    } catch (err) {
      console.error('Camera delete failed:', err)
      setError(
        'Unable to delete this camera.'
      )
    }
  }

  return (
    <div>
      <div
        className="command-head"
        style={{ marginBottom: 18 }}
      >
        <div>
          <div className="eyebrow">
            SURVEILLANCE / CAMERA SOURCES
          </div>

          <h1>
            Multi-Footage Management
          </h1>

          <p>
            Configure multiple video sources for
            BorderGuard AI surveillance.
          </p>
        </div>

        <div className="demo-flag">
          <span />
          {cameras.length} CAMERA
          {cameras.length === 1 ? '' : 'S'}
        </div>
      </div>

      {error && (
        <div
          className="panel"
          style={{
            padding: 14,
            marginBottom: 16,
            borderColor: '#ef4444',
          }}
        >
          <strong>Configuration error</strong>
          <div style={{ marginTop: 5 }}>
            {error}
          </div>
        </div>
      )}

      {message && (
        <div
          className="panel"
          style={{
            padding: 14,
            marginBottom: 16,
          }}
        >
          <strong>{message}</strong>
        </div>
      )}

      <div
        className="panel"
        style={{ marginBottom: 18 }}
      >
        <div className="panel-head">
          <div>
            <h3>
              {editingId
                ? 'Edit Camera Source'
                : 'Add Camera Source'}
            </h3>

            <span className="panel-note">
              Each camera can point to its own
              footage source.
            </span>
          </div>

          {editingId && (
            <button
              type="button"
              className="btn"
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form
          onSubmit={saveCamera}
          style={{ padding: 16 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            <label>
              <span>Camera ID</span>
              <input
                value={form.camera_id}
                onChange={(event) =>
                  updateField(
                    'camera_id',
                    event.target.value
                  )
                }
                placeholder="CAM-02"
              />
            </label>

            <label>
              <span>Location</span>
              <input
                value={form.location}
                onChange={(event) =>
                  updateField(
                    'location',
                    event.target.value
                  )
                }
                placeholder="North Gate"
              />
            </label>

            <label>
              <span>Sector</span>
              <input
                value={form.sector}
                onChange={(event) =>
                  updateField(
                    'sector',
                    event.target.value
                  )
                }
                placeholder="Sector B"
              />
            </label>

            <label>
              <span>Source Type</span>

              <select
                value={form.source_type}
                onChange={(event) =>
                  updateField(
                    'source_type',
                    event.target.value
                  )
                }
              >
                <option value="UPLOAD">
                  Uploaded Video
                </option>

                <option value="WEBCAM">
                  Webcam
                </option>

                <option value="RTSP">
                  RTSP / IP Camera
                </option>
              </select>
            </label>

            <label>
              <span>Status</span>

              <select
                value={form.status}
                onChange={(event) =>
                  updateField(
                    'status',
                    event.target.value
                  )
                }
              >
                <option value="ONLINE">
                  ONLINE
                </option>

                <option value="OFFLINE">
                  OFFLINE
                </option>

                <option value="MAINTENANCE">
                  MAINTENANCE
                </option>
              </select>
            </label>

            <label>
              <span>FPS</span>

              <input
                type="number"
                min="1"
                max="120"
                value={form.fps}
                onChange={(event) =>
                  updateField(
                    'fps',
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <label
            style={{
              display: 'block',
              marginTop: 14,
            }}
          >
            <span>
              Footage Source Path
            </span>

            <input
              value={form.source_path}
              onChange={(event) =>
                updateField(
                  'source_path',
                  event.target.value
                )
              }
              placeholder={
                form.source_type === 'UPLOAD'
                  ? 'media/screenshots/videos/cam02.mp4'
                  : form.source_type === 'RTSP'
                    ? 'rtsp://...'
                    : 'Webcam index, e.g. 0'
              }
            />

            <small
              style={{
                display: 'block',
                marginTop: 6,
                opacity: 0.7,
              }}
            >
              For uploaded footage, use the
              path relative to the project.
            </small>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 16,
            }}
          >
            <input
              type="checkbox"
              checked={form.ai_active}
              onChange={(event) =>
                updateField(
                  'ai_active',
                  event.target.checked
                )
              }
            />

            <span>
              Enable AI processing for this camera
            </span>
          </label>

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 18,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="submit"
              className="btn accent"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Camera'
                  : 'Add Camera'}
            </button>

            <button
              type="button"
              className="btn"
              onClick={resetForm}
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>
              Configured Footage Sources
            </h3>

            <span className="panel-note">
              {cameras.length} configured camera
              source
              {cameras.length === 1
                ? ''
                : 's'}
            </span>
          </div>
        </div>

        <div
          style={{
            overflowX: 'auto',
          }}
        >
          <table>
            <thead>
              <tr>
                <th>Camera</th>
                <th>Location</th>
                <th>Sector</th>
                <th>Status</th>
                <th>Source</th>
                <th>Footage</th>
                <th>AI</th>
                <th>FPS</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {cameras.map((camera) => (
                <tr key={camera.id}>
                  <td className="id-cell">
                    {camera.camera_id}
                  </td>

                  <td>
                    {camera.location || '—'}
                  </td>

                  <td>
                    {camera.sector || '—'}
                  </td>

                  <td>
                    <span
                      className={`status-chip ${
                        camera.status || ''
                      }`}
                    >
                      {camera.status || 'UNKNOWN'}
                    </span>
                  </td>

                  <td>
                    {camera.source_type ||
                      '—'}
                  </td>

                  <td
                    className="mono"
                    style={{
                      maxWidth: 280,
                      wordBreak:
                        'break-word',
                    }}
                  >
                    {camera.source_path ||
                      '—'}
                  </td>

                  <td>
                    {camera.ai_active
                      ? 'YES'
                      : 'NO'}
                  </td>

                  <td className="mono">
                    {camera.fps || '—'}
                  </td>

                  <td>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          editCamera(camera)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          deleteCamera(camera)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cameras.length === 0 && (
          <p
            style={{
              padding: 16,
              color: 'var(--text-low)',
            }}
          >
            No cameras configured yet.
          </p>
        )}
      </div>
    </div>
  )
}