import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import './App.css'
import { AppErrorBoundary } from './AppErrorBoundary'
import { AppRoleProvider, canViewAudit, type AppRole } from './auth/AppRoleContext'
import { loadLiveSession } from './data/liveAudit'
import { PwaStatus } from './PwaStatus'

const LiveAuditPanel = lazy(() => import('./LiveAuditPanel').then((module) => ({ default: module.LiveAuditPanel })))
const LiveCalibrationPanel = lazy(() => import('./LiveCalibrationPanel').then((module) => ({ default: module.LiveCalibrationPanel })))
const LiveDashboardPanel = lazy(() => import('./LiveDashboardPanel').then((module) => ({ default: module.LiveDashboardPanel })))
const LiveEquipmentPanel = lazy(() => import('./LiveEquipmentPanel').then((module) => ({ default: module.LiveEquipmentPanel })))
const LiveInspectionPanel = lazy(() => import('./LiveInspectionPanel').then((module) => ({ default: module.LiveInspectionPanel })))
const LiveMaintenancePanel = lazy(() => import('./LiveMaintenancePanel').then((module) => ({ default: module.LiveMaintenancePanel })))
const LiveQrScannerPanel = lazy(() => import('./LiveQrScannerPanel').then((module) => ({ default: module.LiveQrScannerPanel })))
const QrEquipmentResult = lazy(() => import('./QrEquipmentResult').then((module) => ({ default: module.QrEquipmentResult })))
const LiveToolingPanel = lazy(() => import('./LiveToolingPanel').then((module) => ({ default: module.LiveToolingPanel })))

type View = 'dashboard' | 'qr' | 'equipment' | 'inspection' | 'maintenance' | 'tooling' | 'calibration' | 'settings'

const NAV: Array<{ id: View; label: string; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'Tổng quan' },
  { id: 'qr', label: 'Quét QR' },
  { id: 'equipment', label: 'Thiết bị' },
  { id: 'inspection', label: 'Kiểm tra ngày' },
  { id: 'maintenance', label: 'Bảo trì' },
  { id: 'tooling', label: 'Jig & Tooling' },
  { id: 'calibration', label: 'Hiệu chuẩn' },
  { id: 'settings', label: 'Audit & Cấu hình', adminOnly: true },
]

function initialView(): View {
  const requested = new URLSearchParams(window.location.search).get('phase3')
  if (requested === 'qr' || requested === 'equipment' || requested === 'dashboard' || requested === 'inspection' || requested === 'maintenance' || requested === 'tooling' || requested === 'calibration') return requested
  if (requested === 'audit') return 'settings'
  return 'dashboard'
}

function initialEquipmentTarget() {
  const params = new URLSearchParams(window.location.search)
  return params.get('equipment')?.trim().toUpperCase() || ''
}

function normalizeRole(value: string): AppRole {
  return ['MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN'].includes(value) ? value as AppRole : 'UNKNOWN'
}

function LiveView({
  view,
  equipmentTarget,
  onOpenEquipment,
  onCloseQrResult,
  onEditQrResult,
}: {
  view: View
  equipmentTarget: string
  onOpenEquipment: (equipmentId: string) => void
  onCloseQrResult: () => void
  onEditQrResult: () => void
}) {
  if (view === 'dashboard') return <LiveDashboardPanel />
  if (view === 'qr') return <LiveQrScannerPanel onOpenEquipment={onOpenEquipment} />
  if (view === 'equipment' && equipmentTarget) return <QrEquipmentResult equipmentId={equipmentTarget} onClose={onCloseQrResult} onEdit={onEditQrResult} />
  if (view === 'equipment') return <LiveEquipmentPanel />
  if (view === 'inspection') return <LiveInspectionPanel />
  if (view === 'maintenance') return <LiveMaintenancePanel />
  if (view === 'tooling') return <LiveToolingPanel />
  if (view === 'calibration') return <LiveCalibrationPanel />
  return <LiveAuditPanel />
}

export default function App() {
  const [view, setView] = useState<View>(initialView)
  const [equipmentTarget, setEquipmentTarget] = useState(initialEquipmentTarget)
  const [role, setRole] = useState<AppRole>('UNKNOWN')
  const [sessionEmail, setSessionEmail] = useState('')
  const [roleLoaded, setRoleLoaded] = useState(false)

  useEffect(() => {
    let active = true
    void loadLiveSession()
      .then((session) => {
        if (!active) return
        setRole(normalizeRole(session.role))
        setSessionEmail(session.email)
      })
      .catch(() => {
        if (!active) return
        setRole('UNKNOWN')
        setSessionEmail('')
      })
      .finally(() => { if (active) setRoleLoaded(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!roleLoaded) return
    if (view === 'settings' && !canViewAudit(role)) setView('dashboard')
  }, [role, roleLoaded, view])

  const visibleNav = useMemo(() => NAV.filter((item) => !item.adminOnly || canViewAudit(role)), [role])
  const active = useMemo(() => NAV.find((item) => item.id === view) ?? NAV[0], [view])

  function syncUrl(nextView: View, equipmentId = '') {
    const url = new URL(window.location.href)
    url.searchParams.set('phase3', nextView === 'settings' ? 'audit' : nextView)
    if (equipmentId) url.searchParams.set('equipment', equipmentId)
    else url.searchParams.delete('equipment')
    window.history.replaceState({}, '', url)
  }

  function openEquipmentFromQr(equipmentId: string) {
    setEquipmentTarget(equipmentId)
    setView('equipment')
    syncUrl('equipment', equipmentId)
  }

  function openView(nextView: View) {
    setView(nextView)
    setEquipmentTarget('')
    syncUrl(nextView)
  }

  function closeQrResult() {
    setEquipmentTarget('')
    setView('qr')
    syncUrl('qr')
  }

  function editQrResult() {
    setEquipmentTarget('')
    setView('equipment')
    syncUrl('equipment')
  }

  return <AppRoleProvider role={role}>
    <div className="app-shell" data-role={role}>
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <PwaStatus />

      <aside className="sidebar" aria-label="Điều hướng desktop">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">CEV</span>
          <div><strong>Equipment</strong><small>IATF 16949</small></div>
        </div>
        <nav>
          {visibleNav.map((item) => <button
            key={item.id}
            type="button"
            className={item.id === view ? 'active' : ''}
            aria-current={item.id === view ? 'page' : undefined}
            onClick={() => openView(item.id)}
          >{item.label}</button>)}
        </nav>
        <div className="sidebar-user">
          <strong>{roleLoaded ? role : '...'}</strong>
          <span>{sessionEmail || 'Supabase Auth'}</span>
        </div>
        <div className="sidebar-note">Vercel Frontend<br/>React + Vite + TypeScript<br/>Supabase Backend</div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div><p className="eyebrow">CEV Equipment</p><h1>{equipmentTarget || active.label}</h1></div>
          <div className="topbar-status"><span className="role-pill">{roleLoaded ? role : 'AUTH...'}</span><span className="connection-pill" aria-label="Trạng thái kiến trúc: Vercel frontend kết nối Supabase backend">SUPABASE LIVE</span></div>
        </header>

        <main id="main-content" className={`main-content${view === 'equipment' ? ' equipment-main' : ''}`} tabIndex={-1}>
          <AppErrorBoundary key={`${view}:${equipmentTarget}`}>
            <Suspense fallback={<div className="workspace-loading" role="status">Đang mở workspace…</div>}>
              <LiveView view={view} equipmentTarget={equipmentTarget} onOpenEquipment={openEquipmentFromQr} onCloseQrResult={closeQrResult} onEditQrResult={editQrResult} />
            </Suspense>
          </AppErrorBoundary>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Điều hướng mobile">
        {visibleNav.map((item) => <button
          key={item.id}
          type="button"
          className={item.id === view && !equipmentTarget ? 'active' : ''}
          aria-current={item.id === view && !equipmentTarget ? 'page' : undefined}
          onClick={() => openView(item.id)}
        >{item.label}</button>)}
      </nav>
    </div>
  </AppRoleProvider>
}
