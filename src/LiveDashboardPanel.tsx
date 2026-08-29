import { useEffect, useState } from 'react'
import './Dashboard.css'
import { loadLiveDashboard, type LiveDashboardAction, type LiveDashboardSummary } from './data/liveDashboard'

const EMPTY: LiveDashboardSummary = {
  equipmentTotal: 0,
  productionCount: 0,
  measurementCount: 0,
  runningCount: 0,
  downCount: 0,
  calibrationTotal: 0,
  calibrationOverdue: 0,
  workOrderOpen: 0,
  criticalOpen: 0,
  pmOverdue: 0,
  downtimeOpen: 0,
  downtimeMinutes: 0,
}

const kindLabel: Record<LiveDashboardAction['kind'], string> = {
  DOWN: 'DOWN',
  CRITICAL_WO: 'WO CRITICAL',
  CALIBRATION_OVERDUE: 'HIỆU CHUẨN',
  PM_OVERDUE: 'PM',
  DOWNTIME_OPEN: 'DOWNTIME',
}

function dateText(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export function LiveDashboardPanel() {
  const [summary, setSummary] = useState<LiveDashboardSummary>(EMPTY)
  const [actions, setActions] = useState<LiveDashboardAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadLiveDashboard()
      .then((result) => {
        if (!active) return
        setSummary(result.summary)
        setActions(result.actions)
        setError('')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Dashboard')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const urgentCount = summary.downCount + summary.criticalOpen + summary.downtimeOpen

  return <div className="dashboard-page">
    <section className="dashboard-command" aria-labelledby="live-dashboard-title">
      <div>
        <p className="eyebrow">IATF 16949 · Equipment control center</p>
        <h2 id="live-dashboard-title">Trung tâm điều hành thiết bị</h2>
        <p>Ưu tiên bất thường cần xử lý trước, sau đó mới đến KPI tổng hợp.</p>
      </div>
      <div className="dashboard-live"><span />SUPABASE LIVE</div>
    </section>

    {loading ? <section className="dashboard-state" role="status">Đang tải dữ liệu thiết bị…</section> : null}
    {error ? <section className="dashboard-state error" role="alert"><b>Không tải được Dashboard</b><span>{error}</span></section> : null}

    {!loading && !error ? <>
      <section className="dashboard-priority-grid" aria-label="Các chỉ số cần hành động">
        <article className={summary.downCount ? 'needs-action' : ''}>
          <span>Máy DOWN</span><strong>{summary.downCount}</strong><small>{summary.downCount ? 'Cần xử lý ngay' : 'Không có máy DOWN'}</small>
        </article>
        <article className={summary.criticalOpen ? 'needs-action' : ''}>
          <span>WO CRITICAL</span><strong>{summary.criticalOpen}</strong><small>{summary.workOrderOpen} Work Order đang mở</small>
        </article>
        <article className={summary.calibrationOverdue ? 'warning' : ''}>
          <span>Calibration quá hạn</span><strong>{summary.calibrationOverdue}</strong><small>{summary.calibrationTotal} hồ sơ hiệu chuẩn</small>
        </article>
        <article className={summary.pmOverdue ? 'warning' : ''}>
          <span>PM quá hạn</span><strong>{summary.pmOverdue}</strong><small>Kế hoạch cần cập nhật</small>
        </article>
      </section>

      <section className="dashboard-overview-strip" aria-label="Tình trạng hệ thống">
        <div><span>Tổng thiết bị</span><b>{summary.equipmentTotal}</b><small>{summary.productionCount} sản xuất · {summary.measurementCount} đo kiểm</small></div>
        <div><span>Đang hoạt động</span><b>{summary.runningCount}</b><small>Equipment Master</small></div>
        <div><span>Downtime mở</span><b>{summary.downtimeOpen}</b><small>{summary.downtimeMinutes.toLocaleString('vi-VN')} phút ghi nhận</small></div>
        <div><span>Cần chú ý ngay</span><b>{urgentCount}</b><small>DOWN + Critical WO + open downtime</small></div>
      </section>

      <section className="dashboard-action-panel" aria-labelledby="dashboard-actions-title">
        <header>
          <div><p className="eyebrow">Action queue</p><h3 id="dashboard-actions-title">Việc cần xử lý</h3></div>
          <span className={actions.length ? 'dashboard-action-count active' : 'dashboard-action-count'}>{actions.length} mục</span>
        </header>

        {actions.length ? <div className="dashboard-action-list">
          {actions.slice(0, 30).map((action) => <article key={`${action.kind}-${action.sourceId}`} className={`dashboard-action-row ${action.severity.toLowerCase()}`}>
            <div className="dashboard-action-kind">{kindLabel[action.kind]}</div>
            <div className="dashboard-action-equipment"><b>{action.equipmentId || '—'}</b><span>{action.equipmentName || 'Chưa có tên thiết bị'}</span></div>
            <div className="dashboard-action-detail"><b>{action.title}</b><span>{action.detail}</span></div>
            <div className="dashboard-action-source"><b>{action.sourceId || '—'}</b><span>{dateText(action.date)}</span></div>
          </article>)}
        </div> : <div className="dashboard-clear-state"><strong>Không có cảnh báo ưu tiên.</strong><span>Không có DOWN, Critical WO, overdue calibration/PM hoặc downtime mở.</span></div>}
      </section>

      <section className="dashboard-workflow">
        <p className="eyebrow">Controlled workflow</p>
        <div><span>Kiểm tra ngày</span><b>→</b><span>Work Order</span><b>→</b><span>Phê duyệt</span><b>→</b><span>Thực hiện</span><b>→</b><span>Xác nhận</span><b>→</b><span>BM-05 bàn giao</span><b>→</b><span>KPI</span></div>
      </section>
    </> : null}
  </div>
}
