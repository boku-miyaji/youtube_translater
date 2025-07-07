import React from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './components/pages/DashboardPage'
import AnalyzePage from './components/pages/AnalyzePage'
import HistoryPage from './components/pages/HistoryPage'
import AnalysisPage from './components/pages/AnalysisPage'
import SettingsPage from './components/pages/SettingsPage'

// Layout wrapper component for nested routing
const LayoutWrapper: React.FC = () => {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LayoutWrapper />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App