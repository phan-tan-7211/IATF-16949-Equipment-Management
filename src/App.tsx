import { useMemo, useState } from 'react'
import './App.css'
import { PwaStatus } from './PwaStatus'
import { CALIBRATION_SOURCE_SNAPSHOT, calibrationQuoteSummary, calibrationVendorQuotes, mockCalibrationMaster } from './data/calibrationData'
import { mockDowntimeEvents, mockEquipment, mockInspections, mockPlans, mockTooling, mockWorkOrders } from './data/mockData'
import { getCalibrationDueStatus } from './domain/calibration'
import { calculateDowntimeKpi, DOWNTIME_TARGET_RATE } from './domain/kpi'
import type { AuditLog, EquipmentHandover, MaintenanceWorkOrder } from './domain/models'
import { GOOGLE_PERSISTENCE_CONFIG } from './domain/persistenceConfig'
import { type MaintenanceWorkflowAction, type MaintenanceWorkflowStatus } from './domain/workflow'
import { executeMaintenanceTransition } from './domain/workflowExecution'

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

const statusLabel: Record<string, string> = {
  RUNNING: 'Hoạt động',
  DOWN: 'DOWN',
  MAINTENANCE: 'Bảo trì',
  STOPPED: 'Dừng',
  DISPOSED: 'Thanh lý',
  OPEN: 'Mở',
  WAITING_APPROVAL: 'Chờ phê duyệt',
  APPROVED: 'Đã phê duyệt',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Đã hoàn tất',
  VERIFIED: 'Đã xác nhận',
  RELEASED: 'Đã bàn giao',
  DUE_SOON: 'Sắp đến hạn',
  OVERDUE: 'Quá hạn',
  VALID: 'Còn hiệu lực',
  NO_PLAN: 'Chưa có kế hoạch',
  V: 'V · Tốt',
  STOP_REPAIR: 'X · Dừng sửa chữa',
}

const CALIBRATION_AS_OF_DATE = '2026-08-28'
const CURRENT_USER_ID = 'supervisor-demo'
const CURRENT_USER_ROLE = 'SUPERVISOR' as const
const formatVnd = (value: number) => new Intl.NumberFormat('vi-VN').format(value)
const formatMinutes = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)

const workflowActionByStatus: Partial<Record<MaintenanceWorkflowStatus, { action: MaintenanceWorkflowAction; label: string }>> = {
  OPEN: { action: 'REQUEST_APPROVAL', label: 'Gửi phê duyệt' },
  WAITING_APPROVAL: { action: 'APPROVE', label: 'Phê duyệt' },
  APPROVED: { action: 'START', label: 'Bắt đầu sửa chữa' },
  IN_PROGRESS: { action: 'COMPLETE', label: 'Hoàn tất sửa chữa' },
  COMPLETED: { action: 'VERIFY', label: 'Xác nhận chạy thử' },
  VERIFIED: { action: 'RELEASE', label: 'BM-05: xác nhận & bàn giao' },
}

function Dashboard({ workOrders }: { workOrders: MaintenanceWorkOrder[] }) {
  const running = mockEquipment.filter((x) => x.status === 'RUNNING').length
  const down = mockEquipment.filter((x) => x.status === 'DOWN').length
  const overdue = mockPlans.filter((x) => x.status === 'OVERDUE').length
  const criticalWo = workOrders.filter((x) => x.priority === 'CRITICAL' && x.status !== 'RELEASED').length
  const kpi = calculateDowntimeKpi(mockDowntimeEvents, 28)
  const downtimeTargetMet = kpi.downtimeRate <= DOWNTIME_TARGET_RATE

  return <div className="stack">
    <section className="hero-card" aria-labelledby="dashboard-title">
      <div>
        <p className="eyebrow">IATF 16949 · Source-driven</p>
        <h2 id="dashboard-title">Thiết bị trong tầm kiểm soát</h2>
        <p>Workflow UI vẫn chạy local. Google persistence G1 đã được cấu hình và seed dữ liệu nguồn; ghi live chỉ được phép qua backend bảo mật.</p>
      </div>
      <button className="primary-action" type="button" aria-label="Quét mã QR thiết bị">Quét QR</button>
    </section>

    <section className="metric-grid" aria-label="KPI kỹ thuật">
      <article><span>Thiết bị hoạt động</span><strong>{running}</strong><small>Equipment Master</small></article>
      <article><span>Máy đang DOWN</span><strong>{down}</strong><small>BM-06 / downtime</small></article>
      <article><span>PM quá hạn</span><strong>{overdue}</strong><small>BM-TBSX-03</small></article>
      <article><span>WO khẩn cấp</span><strong>{criticalWo}</strong><small>BM-KTTBHN → WO</small></article>
    </section>

    <section className="metric-grid" aria-label="Chỉ số BM-TBSX-06">
      <article><span>Downtime rate</span><strong>{(kpi.downtimeRate * 100).toFixed(2)}%</strong><small>Mục tiêu ≤ {(DOWNTIME_TARGET_RATE * 100).toFixed(0)}% · {downtimeTargetMet ? 'Đạt' : 'Không đạt'}</small></article>
      <article><span>MTBF</span><strong>{formatMinutes(kpi.mtbfMinutes)}</strong><small>phút / lần hỏng</small></article>
      <article><span>MTTR</span><strong>{formatMinutes(kpi.mttrMinutes)}</strong><small>phút / lần hỏng</small></article>
      <article><span>Số lần hỏng</span><strong>{kpi.failureCount}</strong><small>{kpi.downtimeMinutes} phút dừng</small></article>
    </section>

    <section className="content-card" aria-labelledby="workflow-title">
      <div className="section-heading">
        <div><p className="eyebrow">Workflow</p><h3 id="workflow-title">Luồng hồ sơ số hóa</h3></div>
        <span className="status-pill">LOCAL UI · G1 STORAGE READY</span>
      </div>
      <div className="flow">Kiểm tra ngày <b>→</b> Work Order <b>→</b> Phê duyệt <b>→</b> Thực hiện <b>→</b> Xác nhận <b>→</b> BM-05 bàn giao <b>→</b> KPI</div>
    </section>
  </div>
}

function EquipmentView() {
  return <section className="content-card" aria-labelledby="equipment-title">
    <div className="section-heading">
      <div><p className="eyebrow">BM-TBSX-01 · 02</p><h2 id="equipment-title">Equipment Master</h2></div>
      <button className="secondary-action" type="button">+ Thiết bị</button>
    </div>
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Danh sách thiết bị sản xuất và trạng thái hiện tại</caption>
        <thead><tr><th scope="col">Mã</th><th scope="col">Thiết bị</th><th scope="col">Khu vực</th><th scope="col">Criticality</th><th scope="col">Trạng thái</th></tr></thead>
        <tbody>{mockEquipment.map((equipment) => <tr key={equipment.equipmentId}>
          <td><b>{equipment.equipmentId}</b></td>
          <td>{equipment.equipmentName}<small>{equipment.model ?? '—'}</small></td>
          <td>{equipment.currentArea}</td>
          <td>{equipment.criticality}</td>
          <td><span className={`badge ${equipment.status.toLowerCase()}`}>{statusLabel[equipment.status]}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>
}

function InspectionView() {
  return <div className="stack">
    <section className="content-card" aria-labelledby="inspection-title">
      <div className="section-heading">
        <div><p className="eyebrow">BM-KTTBHN</p><h2 id="inspection-title">Kiểm tra thiết bị hàng ngày</h2></div>
        <button className="secondary-action" type="button">Quét QR & kiểm tra</button>
      </div>
      <p className="muted">V = tốt · ○ = sửa gấp · △ = cần bảo trì · X = hư hỏng, dừng máy. Kết quả X sẽ tạo Work Order và Downtime Event.</p>
    </section>
    {mockInspections.map((inspection) => <article className="record-card" key={inspection.inspectionId}>
      <div><b>{inspection.equipmentId}</b><span>{inspection.inspectionDate} · {inspection.shift}</span></div>
      <span className={`badge ${inspection.overallMark === 'STOP_REPAIR' ? 'down' : 'running'}`}>{statusLabel[inspection.overallMark]}</span>
      <p>{inspection.note ?? 'Không có bất thường'}</p>
    </article>)}
  </div>
}

function MaintenanceView({ workOrders, handovers, onAdvance, message }: {
  workOrders: MaintenanceWorkOrder[]
  handovers: EquipmentHandover[]
  onAdvance: (id: string, action: MaintenanceWorkflowAction) => void
  message: string
}) {
  return <div className="stack">
    <section className="content-card" aria-labelledby="maintenance-title">
      <div className="section-heading">
        <div><p className="eyebrow">BM-03 · 07 · 08 · 04 · 05</p><h2 id="maintenance-title">Bảo trì & sửa chữa</h2></div>
        <button className="secondary-action" type="button">+ Work Order</button>
      </div>
      <p className="muted">Trình tự bắt buộc: Gửi phê duyệt → Phê duyệt → Bắt đầu → Hoàn tất sửa chữa → Xác nhận chạy thử → BM-05 bàn giao. Release chỉ xảy ra khi bên nhận chấp nhận thiết bị còn vận hành được.</p>
      <div className="stack" aria-label="Danh sách Work Order">
        {workOrders.map((workOrder) => {
          const status = workOrder.status as MaintenanceWorkflowStatus
          const next = workflowActionByStatus[status]
          const handover = handovers.find((item) => item.equipmentId === workOrder.equipmentId)
          return <article className="record-card" key={workOrder.workOrderId}>
            <div><b>{workOrder.workOrderId}</b><span>{workOrder.equipmentId} · {workOrder.priority} · {workOrder.sourceType}</span></div>
            <span className={`badge ${status === 'RELEASED' ? 'running' : status === 'OPEN' ? 'down' : 'maintenance'}`}>{statusLabel[status] ?? status}</span>
            <p>{workOrder.reason}</p>
            {handover ? <small>BM-05 {handover.handoverId} · {handover.accepted ? 'Bên nhận đã chấp nhận' : 'Chờ bên nhận'}</small> : null}
            {next ? <button className="secondary-action" type="button" onClick={() => onAdvance(workOrder.workOrderId, next.action)}>{next.label}</button> : <span className="muted">Workflow hoàn tất</span>}
          </article>
        })}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{message}</div>
    </section>

    <section className="content-card" aria-labelledby="pm-title">
      <p className="eyebrow">BM-TBSX-03</p>
      <h3 id="pm-title">Kế hoạch PM</h3>
      <div className="list">{mockPlans.map((plan) => <div key={plan.planId}>
        <span><b>{plan.equipmentId}</b> · {plan.maintenanceType}</span>
        <span>{plan.plannedDate} <em className={`badge ${plan.status === 'OVERDUE' ? 'down' : ''}`}>{statusLabel[plan.status]}</em></span>
      </div>)}</div>
    </section>
  </div>
}

function ToolingView() {
  return <section className="content-card" aria-labelledby="tooling-title">
    <div className="section-heading">
      <div><p className="eyebrow">BM-TBSX-09 · 10 · 11</p><h2 id="tooling-title">Jig, Gá & Dụng cụ</h2></div>
      <button className="secondary-action" type="button">+ Tooling</button>
    </div>
    <div className="card-grid">{mockTooling.map((tooling) => <article className="mini-card" key={tooling.toolingId}>
      <span className="eyebrow">{tooling.toolingType}</span>
      <h3>{tooling.toolingName}</h3>
      <b>{tooling.toolingId}</b>
      <p>{tooling.usedFor}</p>
      <small>{tooling.ownership === 'CUSTOMER' ? `Customer-owned · ${tooling.customerName}` : 'Company-owned'} · Chu kỳ {tooling.inspectionCycleDays ?? '—'} ngày</small>
    </article>)}</div>
  </section>
}

function CalibrationView() {
  const rows = mockCalibrationMaster.map((item) => ({ ...item, dueStatus: getCalibrationDueStatus(item.nextDueDate, CALIBRATION_AS_OF_DATE) }))
  const overdue = rows.filter((item) => item.dueStatus === 'OVERDUE').length
  const noPlan = rows.filter((item) => item.dueStatus === 'NO_PLAN').length
  const missingControl = rows.filter((item) => !item.controlNumber).length
  const providers = calibrationQuoteSummary.map((item) => item.provider)

  return <div className="stack">
    <section className="content-card" aria-labelledby="calibration-title">
      <div className="section-heading">
        <div><p className="eyebrow">CEV-BM-STCL-03 · Source snapshot</p><h2 id="calibration-title">Calibration Master</h2></div>
        <span className="status-pill">SOURCE {CALIBRATION_SOURCE_SNAPSHOT}</span>
      </div>
      <p className="muted">Dữ liệu hiệu chuẩn và chi phí dưới đây được giữ theo tài liệu source 2024. Đây là dữ liệu lịch sử để đối chiếu và lập kế hoạch, không được hiểu là trạng thái live hoặc báo giá hiện hành của nhà cung cấp.</p>
    </section>

    <section className="metric-grid" aria-label="Tóm tắt dữ liệu hiệu chuẩn mẫu">
      <article><span>Mẫu đang hiển thị</span><strong>{rows.length}</strong><small>Trong 48 dòng nguồn 2024</small></article>
      <article><span>Quá hạn theo 28/08/2026</span><strong>{overdue}</strong><small>Chỉ tính từ snapshot lịch sử</small></article>
      <article><span>Chưa có kế hoạch</span><strong>{noPlan}</strong><small>Không có next due trong nguồn</small></article>
      <article><span>Thiếu số kiểm soát</span><strong>{missingControl}</strong><small>Dùng ID nội bộ ổn định</small></article>
    </section>

    <section className="content-card" aria-labelledby="calibration-list-title">
      <div className="section-heading">
        <div><p className="eyebrow">Master + due status</p><h3 id="calibration-list-title">Thiết bị đo & kế hoạch hiệu chuẩn</h3></div>
        <button className="secondary-action" type="button">+ Thiết bị đo</button>
      </div>
      <div className="table-wrap"><table>
        <caption className="sr-only">Danh sách thiết bị đo lấy mẫu từ nguồn hiệu chuẩn 2024</caption>
        <thead><tr><th scope="col">Số kiểm soát</th><th scope="col">Thiết bị</th><th scope="col">Bộ phận</th><th scope="col">Thông số / chính xác</th><th scope="col">Hiệu chuẩn gần nhất</th><th scope="col">Kế hoạch tiếp theo</th><th scope="col">Trạng thái</th></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.calibrationEquipmentId}>
          <td><b>{item.controlNumber ?? 'Chưa cấp'}</b><small>{item.calibrationEquipmentId}</small></td>
          <td>{item.instrumentName}<small>{[item.model, item.manufacturer, item.serialNumber].filter(Boolean).join(' · ') || '—'}</small></td>
          <td>{item.department ?? '—'}</td>
          <td>{item.specification ?? '—'}<small>{item.accuracy ? `Độ chính xác: ${item.accuracy}` : item.purpose ?? '—'}</small></td>
          <td>{item.lastCalibrationDate ?? '—'}</td>
          <td>{item.nextDueDate ?? '—'}</td>
          <td><span className={`badge ${item.dueStatus === 'OVERDUE' ? 'down' : item.dueStatus === 'VALID' ? 'running' : 'maintenance'}`}>{statusLabel[item.dueStatus]}</span></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="content-card" aria-labelledby="quote-summary-title">
      <div className="section-heading">
        <div><p className="eyebrow">Báo giá nguồn · 48 thiết bị</p><h3 id="quote-summary-title">So sánh chi phí hiệu chuẩn 2024</h3></div>
        <span className="status-pill">HISTORICAL COST</span>
      </div>
      <div className="table-wrap"><table>
        <caption className="sr-only">Tổng báo giá hiệu chuẩn theo nhà cung cấp trong tài liệu source 2024</caption>
        <thead><tr><th scope="col">Nhà cung cấp</th><th scope="col">Số lượng</th><th scope="col">Trước VAT</th><th scope="col">VAT</th><th scope="col">Sau VAT</th></tr></thead>
        <tbody>{calibrationQuoteSummary.map((item) => <tr key={item.provider}>
          <td><b>{item.provider}</b></td><td>{item.itemCount}</td><td>{formatVnd(item.subtotalVnd)} VND</td><td>{Math.round(item.vatRate * 100)}%</td><td><b>{formatVnd(item.totalVnd)} VND</b></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="content-card" aria-labelledby="quote-detail-title">
      <div className="section-heading"><div><p className="eyebrow">Mẫu chi tiết theo thiết bị</p><h3 id="quote-detail-title">Chi phí nhà cung cấp từ source</h3></div></div>
      <div className="table-wrap"><table>
        <caption className="sr-only">Báo giá mẫu của từng thiết bị hiệu chuẩn theo tài liệu source</caption>
        <thead><tr><th scope="col">Thiết bị</th>{providers.map((provider) => <th scope="col" key={provider}>{provider}</th>)}</tr></thead>
        <tbody>{rows.filter((item) => calibrationVendorQuotes.some((quote) => quote.calibrationEquipmentId === item.calibrationEquipmentId)).map((item) => <tr key={item.calibrationEquipmentId}>
          <td><b>{item.controlNumber ?? item.instrumentName}</b><small>{item.instrumentName}</small></td>
          {providers.map((provider) => {
            const found = calibrationVendorQuotes.find((quote) => quote.calibrationEquipmentId === item.calibrationEquipmentId && quote.provider === provider)
            return <td key={provider}>{found ? `${formatVnd(found.amountVnd)} VND` : '—'}</td>
          })}
        </tr>)}</tbody>
      </table></div>
    </section>
  </div>
}

function AuditView({ auditLogs, handovers }: { auditLogs: AuditLog[]; handovers: EquipmentHandover[] }) {
  return <div className="stack">
    <section className="content-card" aria-labelledby="audit-title">
      <div className="section-heading">
        <div><p className="eyebrow">Audit-ready · Phase 3 storage</p><h2 id="audit-title">Audit Trail & BM-05</h2></div>
        <span className="status-pill">APPEND ONLY</span>
      </div>
      <p className="muted">Mỗi thay đổi workflow ghi actor, action, entity và before/after. Google Sheet/Drive canonical đã được chuẩn bị, nhưng browser không được ghi trực tiếp; adapter backend vẫn là gate bắt buộc.</p>
    </section>

    <section className="metric-grid" aria-label="Tóm tắt audit local">
      <article><span>Audit events</span><strong>{auditLogs.length}</strong><small>Phiên local hiện tại</small></article>
      <article><span>BM-05 handover</span><strong>{handovers.length}</strong><small>Biên bản đã tạo</small></article>
      <article><span>Đã chấp nhận</span><strong>{handovers.filter((handover) => handover.accepted).length}</strong><small>Bên nhận xác nhận</small></article>
      <article><span>Google persistence</span><strong>G1</strong><small>{GOOGLE_PERSISTENCE_CONFIG.tables.length} tables · backend pending</small></article>
    </section>

    <section className="content-card" aria-labelledby="audit-log-title">
      <h3 id="audit-log-title">Sự kiện gần nhất</h3>
      <div className="table-wrap"><table>
        <caption className="sr-only">Audit events của phiên local hiện tại</caption>
        <thead><tr><th scope="col">Thời gian</th><th scope="col">Người thao tác</th><th scope="col">Hành động</th><th scope="col">Đối tượng</th></tr></thead>
        <tbody>{auditLogs.length ? [...auditLogs].reverse().map((log) => <tr key={log.auditId}>
          <td>{log.timestamp}</td><td>{log.userId}</td><td><b>{log.action}</b></td><td>{log.entityType} · {log.entityId}</td>
        </tr>) : <tr><td colSpan={4}>Chưa có thao tác workflow trong phiên này.</td></tr>}</tbody>
      </table></div>
    </section>
  </div>
}

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>(mockWorkOrders)
  const [handovers, setHandovers] = useState<EquipmentHandover[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [workflowMessage, setWorkflowMessage] = useState('')
  const active = useMemo(() => NAV.find((item) => item.id === view) ?? NAV[0], [view])

  const advanceWorkOrder = (id: string, action: MaintenanceWorkflowAction) => {
    const workOrder = workOrders.find((item) => item.workOrderId === id)
    if (!workOrder) return

    const result = executeMaintenanceTransition({
      workOrder,
      action,
      actorUserId: CURRENT_USER_ID,
      actorRole: CURRENT_USER_ROLE,
      now: new Date().toISOString(),
    })

    if (!result.allowed) {
      setWorkflowMessage(result.message)
      return
    }

    setWorkOrders((current) => current.map((item) => item.workOrderId === id ? result.workOrder : item))

    if (result.handover) {
      setHandovers((current) => [...current.filter((item) => item.handoverId !== result.handover?.handoverId), result.handover as EquipmentHandover])
    }

    if (result.auditEvents.length) {
      setAuditLogs((current) => [...current, ...result.auditEvents])
    }

    setWorkflowMessage(`${id}: ${statusLabel[result.workOrder.status] ?? result.workOrder.status}`)
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <PwaStatus />

    <aside className="sidebar" aria-label="Điều hướng desktop">
      <div className="brand"><span className="brand-mark" aria-hidden="true">CEV</span><div><strong>Equipment</strong><small>IATF 16949</small></div></div>
      <nav>{NAV.map((item) => <button key={item.id} type="button" className={item.id === view ? 'active' : ''} aria-current={item.id === view ? 'page' : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>
      <div className="sidebar-note">Source-first · Phase 3<br/>Google G1: configured<br/>Live write: backend required</div>
    </aside>

    <div className="app-body">
      <header className="topbar">
        <div><p className="eyebrow">CEV Equipment</p><h1>{active.label}</h1></div>
        <span className="connection-pill" aria-label="Trạng thái dữ liệu: Phase 3 storage configured, local workflow">G1 STORAGE READY</span>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        {view === 'dashboard' ? <Dashboard workOrders={workOrders} /> : null}
        {view === 'equipment' ? <EquipmentView /> : null}
        {view === 'inspection' ? <InspectionView /> : null}
        {view === 'maintenance' ? <MaintenanceView workOrders={workOrders} handovers={handovers} onAdvance={advanceWorkOrder} message={workflowMessage} /> : null}
        {view === 'tooling' ? <ToolingView /> : null}
        {view === 'calibration' ? <CalibrationView /> : null}
        {view === 'settings' ? <AuditView auditLogs={auditLogs} handovers={handovers} /> : null}
      </main>
    </div>

    <nav className="bottom-nav" aria-label="Điều hướng mobile">
      {NAV.map((item) => <button key={item.id} type="button" className={item.id === view ? 'active' : ''} aria-current={item.id === view ? 'page' : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}
    </nav>
  </div>
}
