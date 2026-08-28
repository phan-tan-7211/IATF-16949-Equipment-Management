import { useMemo, useState } from 'react'
import './App.css'
import { PwaStatus } from './PwaStatus'
import { CALIBRATION_SOURCE_SNAPSHOT, calibrationQuoteSummary, calibrationVendorQuotes, mockCalibrationMaster } from './data/calibrationData'
import { mockEquipment, mockInspections, mockPlans, mockTooling, mockWorkOrders } from './data/mockData'
import { getCalibrationDueStatus } from './domain/calibration'
import type { MaintenanceWorkOrder } from './domain/models'
import { transitionMaintenanceStatus, type MaintenanceWorkflowAction, type MaintenanceWorkflowStatus } from './domain/workflow'

type View = 'dashboard' | 'equipment' | 'inspection' | 'maintenance' | 'tooling' | 'calibration' | 'settings'
const NAV: Array<{ id: View; label: string }> = [
  { id: 'dashboard', label: 'Tổng quan' }, { id: 'equipment', label: 'Thiết bị' }, { id: 'inspection', label: 'Kiểm tra ngày' },
  { id: 'maintenance', label: 'Bảo trì' }, { id: 'tooling', label: 'Jig & Tooling' }, { id: 'calibration', label: 'Hiệu chuẩn' }, { id: 'settings', label: 'Cài đặt' },
]
const statusLabel: Record<string, string> = {
  RUNNING: 'Hoạt động', DOWN: 'DOWN', MAINTENANCE: 'Bảo trì', STOPPED: 'Dừng', DISPOSED: 'Thanh lý',
  OPEN: 'Mở', IN_PROGRESS: 'Đang xử lý', COMPLETED: 'Đã hoàn tất', VERIFIED: 'Đã xác nhận', RELEASED: 'Đã bàn giao',
  DUE_SOON: 'Sắp đến hạn', OVERDUE: 'Quá hạn', VALID: 'Còn hiệu lực', NO_PLAN: 'Chưa có kế hoạch',
  V: 'V · Tốt', STOP_REPAIR: 'X · Dừng sửa chữa',
}
const CALIBRATION_AS_OF_DATE = '2026-08-28'
const formatVnd = (value: number) => new Intl.NumberFormat('vi-VN').format(value)
const workflowActionByStatus: Partial<Record<MaintenanceWorkflowStatus, { action: MaintenanceWorkflowAction; label: string }>> = {
  OPEN: { action: 'START', label: 'Bắt đầu sửa chữa' },
  IN_PROGRESS: { action: 'COMPLETE', label: 'Hoàn tất sửa chữa' },
  COMPLETED: { action: 'VERIFY', label: 'Xác nhận chạy thử' },
  VERIFIED: { action: 'RELEASE', label: 'Bàn giao thiết bị' },
}

function Dashboard({ workOrders }: { workOrders: MaintenanceWorkOrder[] }) {
  const running = mockEquipment.filter((x) => x.status === 'RUNNING').length
  const down = mockEquipment.filter((x) => x.status === 'DOWN').length
  const overdue = mockPlans.filter((x) => x.status === 'OVERDUE').length
  const criticalWo = workOrders.filter((x) => x.priority === 'CRITICAL' && x.status !== 'RELEASED').length
  return <div className="stack">
    <section className="hero-card" aria-labelledby="dashboard-title"><div><p className="eyebrow">IATF 16949 · Source-driven</p><h2 id="dashboard-title">Thiết bị trong tầm kiểm soát</h2><p>Dữ liệu demo đang chạy local theo BM-01~11 và BM-KTTBHN. Chưa kết nối Google Sheets/Drive.</p></div><button className="primary-action" type="button" aria-label="Quét mã QR thiết bị">Quét QR</button></section>
    <section className="metric-grid" aria-label="KPI kỹ thuật"><article><span>Thiết bị hoạt động</span><strong>{running}</strong><small>Equipment Master</small></article><article><span>Máy đang DOWN</span><strong>{down}</strong><small>BM-06 / downtime</small></article><article><span>PM quá hạn</span><strong>{overdue}</strong><small>BM-TBSX-03</small></article><article><span>WO khẩn cấp</span><strong>{criticalWo}</strong><small>BM-KTTBHN → WO</small></article></section>
    <section className="content-card" aria-labelledby="workflow-title"><div className="section-heading"><div><p className="eyebrow">Workflow</p><h3 id="workflow-title">Luồng hồ sơ số hóa</h3></div><span className="status-pill">LOCAL DATA</span></div><div className="flow">Kiểm tra ngày <b>→</b> Work Order <b>→</b> Thực hiện <b>→</b> Kết quả <b>→</b> Bàn giao <b>→</b> KPI</div></section>
  </div>
}

function EquipmentView() {
  return <section className="content-card" aria-labelledby="equipment-title"><div className="section-heading"><div><p className="eyebrow">BM-TBSX-01 · 02</p><h2 id="equipment-title">Equipment Master</h2></div><button className="secondary-action" type="button">+ Thiết bị</button></div><div className="table-wrap"><table><caption className="sr-only">Danh sách thiết bị sản xuất và trạng thái hiện tại</caption><thead><tr><th scope="col">Mã</th><th scope="col">Thiết bị</th><th scope="col">Khu vực</th><th scope="col">Criticality</th><th scope="col">Trạng thái</th></tr></thead><tbody>{mockEquipment.map(e=><tr key={e.equipmentId}><td><b>{e.equipmentId}</b></td><td>{e.equipmentName}<small>{e.model ?? '—'}</small></td><td>{e.currentArea}</td><td>{e.criticality}</td><td><span className={`badge ${e.status.toLowerCase()}`}>{statusLabel[e.status]}</span></td></tr>)}</tbody></table></div></section>
}

function InspectionView() {
  return <div className="stack"><section className="content-card" aria-labelledby="inspection-title"><div className="section-heading"><div><p className="eyebrow">BM-KTTBHN</p><h2 id="inspection-title">Kiểm tra thiết bị hàng ngày</h2></div><button className="secondary-action" type="button">Quét QR & kiểm tra</button></div><p className="muted">V = tốt · ○ = sửa gấp · △ = cần bảo trì · X = hư hỏng, dừng máy. Kết quả X sẽ tạo Work Order và Downtime Event.</p></section>{mockInspections.map(i=><article className="record-card" key={i.inspectionId}><div><b>{i.equipmentId}</b><span>{i.inspectionDate} · {i.shift}</span></div><span className={`badge ${i.overallMark === 'STOP_REPAIR' ? 'down' : 'running'}`}>{statusLabel[i.overallMark]}</span><p>{i.note ?? 'Không có bất thường'}</p></article>)}</div>
}

function MaintenanceView({ workOrders, onAdvance, message }: { workOrders: MaintenanceWorkOrder[]; onAdvance: (id: string, action: MaintenanceWorkflowAction) => void; message: string }) {
  return <div className="stack">
    <section className="content-card" aria-labelledby="maintenance-title"><div className="section-heading"><div><p className="eyebrow">BM-03 · 07 · 08 · 04 · 05</p><h2 id="maintenance-title">Bảo trì & sửa chữa</h2></div><button className="secondary-action" type="button">+ Work Order</button></div><p className="muted">Trình tự bắt buộc: Bắt đầu → Hoàn tất sửa chữa → Xác nhận chạy thử → Bàn giao. Không cho phép bỏ qua bước.</p><div className="stack" aria-label="Danh sách Work Order">{workOrders.map(w=>{ const status = w.status as MaintenanceWorkflowStatus; const next = workflowActionByStatus[status]; return <article className="record-card" key={w.workOrderId}><div><b>{w.workOrderId}</b><span>{w.equipmentId} · {w.priority} · {w.sourceType}</span></div><span className={`badge ${status === 'RELEASED' ? 'running' : status === 'OPEN' ? 'down' : 'maintenance'}`}>{statusLabel[status] ?? status}</span><p>{w.reason}</p>{next ? <button className="secondary-action" type="button" onClick={()=>onAdvance(w.workOrderId,next.action)}>{next.label}</button> : <span className="muted">Workflow hoàn tất</span>}</article>})}</div><div className="sr-only" aria-live="polite" aria-atomic="true">{message}</div></section>
    <section className="content-card" aria-labelledby="pm-title"><p className="eyebrow">BM-TBSX-03</p><h3 id="pm-title">Kế hoạch PM</h3><div className="list">{mockPlans.map(p=><div key={p.planId}><span><b>{p.equipmentId}</b> · {p.maintenanceType}</span><span>{p.plannedDate} <em className={`badge ${p.status === 'OVERDUE' ? 'down' : ''}`}>{statusLabel[p.status]}</em></span></div>)}</div></section>
  </div>
}

function ToolingView() {
  return <section className="content-card" aria-labelledby="tooling-title"><div className="section-heading"><div><p className="eyebrow">BM-TBSX-09 · 10 · 11</p><h2 id="tooling-title">Jig, Gá & Dụng cụ</h2></div><button className="secondary-action" type="button">+ Tooling</button></div><div className="card-grid">{mockTooling.map(t=><article className="mini-card" key={t.toolingId}><span className="eyebrow">{t.toolingType}</span><h3>{t.toolingName}</h3><b>{t.toolingId}</b><p>{t.usedFor}</p><small>{t.ownership === 'CUSTOMER' ? `Customer-owned · ${t.customerName}` : 'Company-owned'} · Chu kỳ {t.inspectionCycleDays ?? '—'} ngày</small></article>)}</div></section>
}

function CalibrationView() {
  const rows = mockCalibrationMaster.map((item) => ({ ...item, dueStatus: getCalibrationDueStatus(item.nextDueDate, CALIBRATION_AS_OF_DATE) }))
  const overdue = rows.filter((item) => item.dueStatus === 'OVERDUE').length
  const noPlan = rows.filter((item) => item.dueStatus === 'NO_PLAN').length
  const missingControl = rows.filter((item) => !item.controlNumber).length
  const providers = calibrationQuoteSummary.map((item) => item.provider)

  return <div className="stack">
    <section className="content-card" aria-labelledby="calibration-title"><div className="section-heading"><div><p className="eyebrow">CEV-BM-STCL-03 · Source snapshot</p><h2 id="calibration-title">Calibration Master</h2></div><span className="status-pill">SOURCE {CALIBRATION_SOURCE_SNAPSHOT}</span></div><p className="muted">Dữ liệu hiệu chuẩn và chi phí dưới đây được giữ theo tài liệu source 2024. Đây là dữ liệu lịch sử để đối chiếu và lập kế hoạch, không được hiểu là trạng thái live hoặc báo giá hiện hành của nhà cung cấp.</p></section>
    <section className="metric-grid" aria-label="Tóm tắt dữ liệu hiệu chuẩn mẫu"><article><span>Mẫu đang hiển thị</span><strong>{rows.length}</strong><small>Trong 48 dòng nguồn 2024</small></article><article><span>Quá hạn theo 28/08/2026</span><strong>{overdue}</strong><small>Chỉ tính từ snapshot lịch sử</small></article><article><span>Chưa có kế hoạch</span><strong>{noPlan}</strong><small>Không có next due trong nguồn</small></article><article><span>Thiếu số kiểm soát</span><strong>{missingControl}</strong><small>Dùng ID nội bộ ổn định</small></article></section>
    <section className="content-card" aria-labelledby="calibration-list-title"><div className="section-heading"><div><p className="eyebrow">Master + due status</p><h3 id="calibration-list-title">Thiết bị đo & kế hoạch hiệu chuẩn</h3></div><button className="secondary-action" type="button">+ Thiết bị đo</button></div><div className="table-wrap"><table><caption className="sr-only">Danh sách thiết bị đo lấy mẫu từ nguồn hiệu chuẩn 2024</caption><thead><tr><th scope="col">Số kiểm soát</th><th scope="col">Thiết bị</th><th scope="col">Bộ phận</th><th scope="col">Thông số / chính xác</th><th scope="col">Hiệu chuẩn gần nhất</th><th scope="col">Kế hoạch tiếp theo</th><th scope="col">Trạng thái</th></tr></thead><tbody>{rows.map(item=><tr key={item.calibrationEquipmentId}><td><b>{item.controlNumber ?? 'Chưa cấp'}</b><small>{item.calibrationEquipmentId}</small></td><td>{item.instrumentName}<small>{[item.model,item.manufacturer,item.serialNumber].filter(Boolean).join(' · ') || '—'}</small></td><td>{item.department ?? '—'}</td><td>{item.specification ?? '—'}<small>{item.accuracy ? `Độ chính xác: ${item.accuracy}` : item.purpose ?? '—'}</small></td><td>{item.lastCalibrationDate ?? '—'}</td><td>{item.nextDueDate ?? '—'}</td><td><span className={`badge ${item.dueStatus === 'OVERDUE' ? 'down' : item.dueStatus === 'VALID' ? 'running' : 'maintenance'}`}>{statusLabel[item.dueStatus]}</span></td></tr>)}</tbody></table></div></section>
    <section className="content-card" aria-labelledby="quote-summary-title"><div className="section-heading"><div><p className="eyebrow">Báo giá nguồn · 48 thiết bị</p><h3 id="quote-summary-title">So sánh chi phí hiệu chuẩn 2024</h3></div><span className="status-pill">HISTORICAL COST</span></div><div className="table-wrap"><table><caption className="sr-only">Tổng báo giá hiệu chuẩn theo nhà cung cấp trong tài liệu source 2024</caption><thead><tr><th scope="col">Nhà cung cấp</th><th scope="col">Số lượng</th><th scope="col">Trước VAT</th><th scope="col">VAT</th><th scope="col">Sau VAT</th></tr></thead><tbody>{calibrationQuoteSummary.map(item=><tr key={item.provider}><td><b>{item.provider}</b></td><td>{item.itemCount}</td><td>{formatVnd(item.subtotalVnd)} VND</td><td>{Math.round(item.vatRate * 100)}%</td><td><b>{formatVnd(item.totalVnd)} VND</b></td></tr>)}</tbody></table></div></section>
    <section className="content-card" aria-labelledby="quote-detail-title"><div className="section-heading"><div><p className="eyebrow">Mẫu chi tiết theo thiết bị</p><h3 id="quote-detail-title">Chi phí nhà cung cấp từ source</h3></div></div><div className="table-wrap"><table><caption className="sr-only">Báo giá mẫu của từng thiết bị hiệu chuẩn theo tài liệu source</caption><thead><tr><th scope="col">Thiết bị</th>{providers.map(provider=><th scope="col" key={provider}>{provider}</th>)}</tr></thead><tbody>{rows.filter(item=>calibrationVendorQuotes.some(q=>q.calibrationEquipmentId===item.calibrationEquipmentId)).map(item=><tr key={item.calibrationEquipmentId}><td><b>{item.controlNumber ?? item.instrumentName}</b><small>{item.instrumentName}</small></td>{providers.map(provider=>{const found=calibrationVendorQuotes.find(q=>q.calibrationEquipmentId===item.calibrationEquipmentId&&q.provider===provider);return <td key={provider}>{found ? `${formatVnd(found.amountVnd)} VND` : '—'}</td>})}</tr>)}</tbody></table></div></section>
  </div>
}

function Placeholder({title,description}:{title:string;description:string}) {
  return <section className="content-card empty-state"><p className="eyebrow">Workspace</p><h2>{title}</h2><p>{description}</p></section>
}

export default function App() {
  const [view,setView]=useState<View>('dashboard')
  const [workOrders,setWorkOrders]=useState<MaintenanceWorkOrder[]>(mockWorkOrders)
  const [workflowMessage,setWorkflowMessage]=useState('')
  const active=useMemo(()=>NAV.find(i=>i.id===view)??NAV[0],[view])

  const advanceWorkOrder = (id: string, action: MaintenanceWorkflowAction) => {
    setWorkOrders(current => current.map(workOrder => {
      if (workOrder.workOrderId !== id) return workOrder
      const nextStatus = transitionMaintenanceStatus(workOrder.status as MaintenanceWorkflowStatus, action)
      setWorkflowMessage(`${id}: ${statusLabel[nextStatus]}`)
      return { ...workOrder, status: nextStatus }
    }))
  }

  return <div className="app-shell"><a className="skip-link" href="#main-content">Bỏ qua điều hướng</a><PwaStatus/><aside className="sidebar" aria-label="Điều hướng desktop"><div className="brand"><span className="brand-mark" aria-hidden="true">CEV</span><div><strong>Equipment</strong><small>IATF 16949</small></div></div><nav>{NAV.map(i=><button key={i.id} type="button" className={i.id===view?'active':''} aria-current={i.id===view?'page':undefined} onClick={()=>setView(i.id)}>{i.label}</button>)}</nav><div className="sidebar-note">Source-first · Local phase<br/>Google: chưa kết nối</div></aside><div className="app-body"><header className="topbar"><div><p className="eyebrow">CEV Equipment</p><h1>{active.label}</h1></div><span className="connection-pill" aria-label="Trạng thái dữ liệu: local workflow">LOCAL WORKFLOW</span></header><main id="main-content" className="main-content" tabIndex={-1}>{view==='dashboard'?<Dashboard workOrders={workOrders}/>:null}{view==='equipment'?<EquipmentView/>:null}{view==='inspection'?<InspectionView/>:null}{view==='maintenance'?<MaintenanceView workOrders={workOrders} onAdvance={advanceWorkOrder} message={workflowMessage}/>:null}{view==='tooling'?<ToolingView/>:null}{view==='calibration'?<CalibrationView/>:null}{view==='settings'?<Placeholder title="Cấu hình hệ thống" description="Google Sheets/Drive chỉ được bật sau Schema Freeze (G1)."/>:null}</main></div><nav className="bottom-nav" aria-label="Điều hướng mobile">{NAV.slice(0,4).map(i=><button key={i.id} type="button" className={i.id===view?'active':''} aria-current={i.id===view?'page':undefined} onClick={()=>setView(i.id)}>{i.label}</button>)}</nav></div>
}
