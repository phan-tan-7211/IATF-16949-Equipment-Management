import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppErrorBoundary } from './AppErrorBoundary'
import { LiveAuditPanel } from './LiveAuditPanel'
import { LiveCalibrationPanel } from './LiveCalibrationPanel'
import { LiveDashboardPanel } from './LiveDashboardPanel'
import { LiveEquipmentPanel } from './LiveEquipmentPanel'
import { LiveInspectionPanel } from './LiveInspectionPanel'
import { LiveMaintenancePanel } from './LiveMaintenancePanel'
import { LiveToolingPanel } from './LiveToolingPanel'
import { SupabaseTestPanel } from './SupabaseTestPanel'

const phase3Preview = new URLSearchParams(window.location.search).get('phase3')
const preview = (panel: React.ReactNode) => (
  <div className="app-body phase3-preview-body">
    <main id="main-content" className="main-content phase3-preview-content">{panel}</main>
  </div>
)

const content = phase3Preview === 'supabase-test'
  ? preview(<SupabaseTestPanel />)
  : phase3Preview === 'dashboard'
    ? preview(<LiveDashboardPanel />)
    : phase3Preview === 'equipment'
      ? preview(<LiveEquipmentPanel />)
      : phase3Preview === 'calibration'
        ? preview(<LiveCalibrationPanel />)
        : phase3Preview === 'inspection'
          ? preview(<LiveInspectionPanel />)
          : phase3Preview === 'maintenance'
            ? preview(<LiveMaintenancePanel />)
            : phase3Preview === 'tooling'
              ? preview(<LiveToolingPanel />)
              : phase3Preview === 'audit'
                ? preview(<LiveAuditPanel />)
                : <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {content}
    </AppErrorBoundary>
  </StrictMode>,
)
