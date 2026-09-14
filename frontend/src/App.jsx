import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login.jsx'
import Shell from './components/Shell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LiveSurveillance from './pages/LiveSurveillance.jsx'
import Cameras from './pages/Cameras.jsx'
import AIAnalytics from './pages/AIAnalytics.jsx'
import Zones from './pages/Zones.jsx'
import ActiveAlerts from './pages/ActiveAlerts.jsx'
import AlertHistory from './pages/AlertHistory.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import ZoneManagement from './pages/ZoneManagement'

function ProtectedRoute({ isAuthenticated, children }) {
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  const auth = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={<Login auth={auth} />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute
            isAuthenticated={auth.isAuthenticated}
          >
            <Shell auth={auth} />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={<Navigate to="dashboard" replace />}
        />

        <Route
          path="dashboard"
          element={<Dashboard />}
        />

        <Route
          path="surveillance"
          element={<LiveSurveillance />}
        />

        <Route
          path="cameras"
          element={<Cameras />}
        />

        <Route
          path="ai-analytics"
          element={<AIAnalytics />}
        />

        <Route
          path="zones"
          element={<Zones />}
        />

        {/* Stage 4 — Security Zone Management */}
        <Route
          path="zone-management"
          element={<ZoneManagement />}
        />

        <Route
          path="active-alerts"
          element={<ActiveAlerts />}
        />

        <Route
          path="alert-history"
          element={<AlertHistory />}
        />

        <Route
          path="reports"
          element={<Reports />}
        />

        <Route
          path="settings"
          element={<Settings />}
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  )
}