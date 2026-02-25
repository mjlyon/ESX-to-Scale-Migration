import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useWebSocket } from './hooks/useWebSocket'
import { Connections } from './pages/Connections'
import { Dashboard } from './pages/Dashboard'
import { MigrationDetail } from './pages/MigrationDetail'
import { MigrationList } from './pages/MigrationList'
import { NewMigration } from './pages/NewMigration'
import { Settings } from './pages/Settings'
import { SetupWizard } from './pages/SetupWizard'
import { StorageSettings } from './pages/StorageSettings'

export default function App() {
  useWebSocket()

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="/migrations" element={<MigrationList />} />
          <Route path="/migrations/new" element={<NewMigration />} />
          <Route path="/migrations/:id" element={<MigrationDetail />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/storage" element={<StorageSettings />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
