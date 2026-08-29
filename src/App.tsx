import { useMemo, useState } from 'react'
import './App.css'
import { AppErrorBoundary } from './AppErrorBoundary'
import { LiveAuditPanel } from './LiveAuditPanel'
import { LiveCalibrationPanel } from './LiveCalibrationPanel'
import { LiveDashboardPanel } from './LiveDashboardPanel'
import { LiveEquipmentPanel } from './LiveEquipmentPanel'
import { LiveInspectionPanel } from './LiveInspectionPanel'
import { LiveMaintenancePanel } from './LiveMaintenancePanel'
import { LiveToolingPanel } from './LiveToolingPanel'
import { PwaStatus } from './PwaStatus'

type View = 'dashboard' | 'equipment' | 'inspection' | 'maintenance' | 'tooling' | 'calibration' | 'settings'

const NAV: Array<{ id: View; label: string }> = [
  { id: 'dashboard', label: 'Tổng quan' },
  { id: 'equipment', label: 'Thiết bị' },
  { id: 'inspection', label: 'Kiểm tra ngày' },
  { id: 'maintenance', label: 'Bảo trì' },
  { id: 'tooling', label: 'Jig & Tooling' },
  { id: 'calibration', label: 'Hiệu chuẩn' },
  { id: 'settings', label: 'Audit & Cấu hình' },
]

function initialView(): View {
  const requested = new URLSearchParams(window.location.search).get('phase3')
  if (requested === 'equipment' || requested === 'dashboard' || requested === 'inspection' || requested === 'maintenance' || requested === 'tooling' || requested === 'calibration') return requested
  if (requested === 'audit') return 'settings'
  return 'dashboard'
}

function LiveView({ view }: { view: View }) {
  if (view === 'dashboard') return <LiveDashboardPanel />
  if (view === 'equipment') return <LiveEquipmentPanel />
  if (view === 'inspection') return <LiveInspectionPanel />
  if (view === 'maintenance') return <LiveMaintenancePanel />
  if (view === 'tooling') return <LiveToolingPanel />
  if (view === 'calibration') return <LiveCalibrationPanel />
  return <LiveAuditPanel />
}

export default function App() {
  const [view, setView] = useState<View>(initialView)
  const active = useMemo(() => NAV.find((item) => item.id === view) ?? NAV[0], [view])

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <PwaStatus />

    <aside className="sidebar" aria-label="Điều hướng desktop">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">CEV</span>
        <div><strong>Equipment</strong><small>IATF 16949</small></div>
      </div>
      <nav>
        {NAV.map((item) => <button
          key={item.id}
          type="button"
          className={item.id === view ? 'active' : ''}
          aria-current={item.id === view ? 'page' : undefined}
          onClick={() => setView(item.id)}
        >{item.label}</button>)}
      </nav>
      <div className="sidebar-note">Vercel Frontend<br/>Apps Script Backend<br/>Google Sheets / Drive</div>
    </aside>

    <div className="app-body">
      <header className="topbar">
        <div><p className="eyebrow">CEV Equipment</p><h1>{active.label}</h1></div>
        <span className="connection-pill" aria-label="Trạng thái kiến trúc: Vercel frontend kết nối Apps Script backend">PRODUCTION LIVE</span>
      </header>

      <main id="main-content" className={`main-content${view === 'equipment' ? ' equipment-main' : ''}`} tabIndex={-1}>
        <AppErrorBoundary key={view}>
          <LiveView view={view} />
        </AppErrorBoundary>
      </main>
    </div>

    <nav className="bottom-nav" aria-label="Điều hướng mobile">
      {NAV.map((item) => <button
        key={item.id}
        type="button"
        className={item.id === view ? 'active' : ''}
        aria-current={item.id === view ? 'page' : undefined}
        onClick={() => setView(item.id)}
      >{item.label}</button>)}
    </nav>
  </div>
}
