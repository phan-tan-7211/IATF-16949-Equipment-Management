import { useState } from 'react'
import './App.css'
import { PwaStatus } from './PwaStatus'
import { CORE_SHEET_NAMES } from './domain/models'

type View = 'dashboard' | 'equipment' | 'maintenance' | 'calibration' | 'settings'

const NAV: Array<{ id: View; label: string }> = [
  { id: 'dashboard', label: 'Tổng quan' },
  { id: 'equipment', label: 'Thiết bị' },
  { id: 'maintenance', label: 'Bảo trì' },
  { id: 'calibration', label: 'Hiệu chuẩn' },
  { id: 'settings', label: 'Cài đặt' },
]

function Dashboard() {
  return (
    <div className="stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">IATF 16949 · Equipment Control</p>
          <h2>Thiết bị trong tầm kiểm soát</h2>
          <p>Khung ứng dụng đã sẵn sàng cho Equipment Master, bảo trì, hiệu chuẩn, PM, di dời và audit trail.</p>
        </div>
        <button className="primary-action" type="button">Quét QR</button>
      </section>

      <section className="metric-grid" aria-label="KPI kỹ thuật">
        <article><span>Thiết bị hoạt động</span><strong>—</strong><small>Chờ kết nối dữ liệu</small></article>
        <article><span>Máy đang DOWN</span><strong>—</strong><small>Maintenance status</small></article>
        <article><span>PM quá hạn</span><strong>—</strong><small>Preventive maintenance</small></article>
        <article><span>Calibration sắp hạn</span><strong>—</strong><small>QC equipment</small></article>
      </section>

      <section className="content-card">
        <div className="section-heading"><div><p className="eyebrow">Phase 1</p><h3>Database cốt lõi</h3></div><span className="status-pill">SCHEMA READY</span></div>
        <div className="chip-list">{CORE_SHEET_NAMES.map((name) => <span key={name}>{name}</span>)}</div>
        <p className="muted">Frontend chưa chứa Google credential. Kết nối Google Sheets sẽ đi qua backend API ở phase tiếp theo.</p>
      </section>
    </div>
  )
}

function Placeholder({ title, description, action }: { title: string; description: string; action: string }) {
  return (
    <section className="content-card empty-state">
      <p className="eyebrow">Workspace</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <button type="button" className="secondary-action">{action}</button>
    </section>
  )
}

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const active = NAV.find((item) => item.id === view) ?? NAV[0]

  return (
    <div className="app-shell">
      <PwaStatus />
      <aside className="sidebar" aria-label="Điều hướng desktop">
        <div className="brand"><span className="brand-mark">CEV</span><div><strong>Equipment</strong><small>IATF 16949</small></div></div>
        <nav>{NAV.map((item) => <button key={item.id} type="button" className={item.id === view ? 'active' : ''} aria-current={item.id === view ? 'page' : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>
        <div className="sidebar-note">PC + Mobile PWA<br />Không quản lý giá tiền</div>
      </aside>

      <div className="app-body">
        <header className="topbar"><div><p className="eyebrow">CEV Equipment</p><h1>{active.label}</h1></div><span className="connection-pill">LOCAL UI</span></header>
        <main id="main-content" className="main-content">
          {view === 'dashboard' ? <Dashboard /> : null}
          {view === 'equipment' ? <Placeholder title="Danh mục thiết bị" description="Tra cứu theo mã nội bộ, model, serial, khu vực và QR. Equipment Master sẽ là nguồn chuẩn duy nhất cho vị trí hiện tại." action="Thêm thiết bị" /> : null}
          {view === 'maintenance' ? <Placeholder title="Bảo trì & sửa chữa" description="Báo hỏng, chụp ảnh, theo dõi thời điểm bắt đầu/hoàn thành và nguyên nhân để tính downtime, MTTR và lỗi lặp lại." action="Báo sự cố" /> : null}
          {view === 'calibration' ? <Placeholder title="Hiệu chuẩn thiết bị đo" description="Quản lý từng lần hiệu chuẩn, hạn tiếp theo, kết quả và link certificate/ảnh tem kiểm định." action="Ghi hiệu chuẩn" /> : null}
          {view === 'settings' ? <Placeholder title="Cấu hình hệ thống" description="Phase tiếp theo sẽ cấu hình backend Google Sheets/Drive, phân quyền Technician · Maintenance · QC · Manager · Admin." action="Cấu hình dữ liệu" /> : null}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Điều hướng mobile">
        {NAV.slice(0, 4).map((item) => <button key={item.id} type="button" className={item.id === view ? 'active' : ''} aria-current={item.id === view ? 'page' : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}
      </nav>
    </div>
  )
}
