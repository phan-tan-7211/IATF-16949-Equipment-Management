import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppErrorBoundary } from './AppErrorBoundary'
import { LiveCalibrationPanel } from './LiveCalibrationPanel'
import { LiveDashboardPanel } from './LiveDashboardPanel'
import { LiveEquipmentPanel } from './LiveEquipmentPanel'
import { LiveInspectionPanel } from './LiveInspectionPanel'
import { LiveMaintenancePanel } from './LiveMaintenancePanel'
import { LiveToolingPanel } from './LiveToolingPanel'

const phase3Preview = new URLSearchParams(window.location.search).get('phase3')
const content = phase3Preview === 'dashboard'
  ? <div className="app-body"><main id="main-content" className="main-content"><LiveDashboardPanel /></main></div>
  : phase3Preview === 'equipment'
    ? <div className="app-body"><main id="main-content" className="main-content"><LiveEquipmentPanel /></main></div>
    : phase3Preview === 'calibration'
      ? <div className="app-body"><main id="main-content" className="main-content"><LiveCalibrationPanel /></main></div>
      : phase3Preview === 'inspection'
        ? <div className="app-body"><main id="main-content" className="main-content"><LiveInspectionPanel /></main></div>
        : phase3Preview === 'maintenance'
          ? <div className="app-body"><main id="main-content" className="main-content"><LiveMaintenancePanel /></main></div>
          : phase3Preview === 'tooling'
            ? <div className="app-body"><main id="main-content" className="main-content"><LiveToolingPanel /></main></div>
            : <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {content}
    </AppErrorBoundary>
  </StrictMode>,
)
