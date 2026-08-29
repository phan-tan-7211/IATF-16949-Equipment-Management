import { useEffect, useState } from 'react'
import { loadLiveDashboard, type LiveDashboardSummary } from './data/liveDashboard'

const EMPTY: LiveDashboardSummary = {
  equipmentTotal: 0, productionCount: 0, measurementCount: 0, runningCount: 0, downCount: 0, calibrationTotal: 0, calibrationOverdue: 0, workOrderOpen: 0, criticalOpen: 0, pmOverdue: 0, downtimeOpen: 0, downtimeMinutes: 0,
}

export function LiveDashboardPanel() {
  const [summary, setSummary] = useState<LiveDashboardSummary>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadLiveDashboard().then((result) => { if (active) { setSummary(result); setError('') } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Dashboard') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <div className="stack">
    <section className="hero-card" aria-labelledby="live-dashboard-title">
      <div><p className="eyebrow">IATF 16949 · Supabase live</p><h2 id="live-dashboard-title">Thiết bị trong tầm kiểm soát</h2><p>Dữ liệu trực tiếp từ Supabase PostgreSQL. Không sử dụng Apps Script/Google Sheets trong runtime.</p></div>
      <span className="status-pill">SUPABASE LIVE</span>
    </section>
    {loading ? <section className="content-card"><p className="muted" role="status">Đang tải dữ liệu…</p></section> : null}
    {error ? <section className="content-card" role="alert"><b>Không kết nối được Supabase</b><p>{error}</p></section> : null}
    {!loading && !error ? <>
      <section className="metric-grid" aria-label="Tổng quan thiết bị live">
        <article><span>Tổng thiết bị</span><strong>{summary.equipmentTotal}</strong><small>{summary.productionCount} sản xuất · {summary.measurementCount} đo kiểm</small></article>
        <article><span>Đang hoạt động</span><strong>{summary.runningCount}</strong><small>Equipment Master</small></article>
        <article><span>Máy DOWN</span><strong>{summary.downCount}</strong><small>Cần xử lý</small></article>
        <article><span>PM quá hạn</span><strong>{summary.pmOverdue}</strong><small>Maintenance Plan</small></article>
      </section>
      <section className="metric-grid" aria-label="Tổng quan nghiệp vụ live">
        <article><span>Hồ sơ hiệu chuẩn</span><strong>{summary.calibrationTotal}</strong><small>{summary.calibrationOverdue} quá hạn</small></article>
        <article><span>Work Order đang mở</span><strong>{summary.workOrderOpen}</strong><small>{summary.criticalOpen} CRITICAL</small></article>
        <article><span>Downtime đang mở</span><strong>{summary.downtimeOpen}</strong><small>Chưa ended_at</small></article>
        <article><span>Downtime ghi nhận</span><strong>{summary.downtimeMinutes}</strong><small>phút</small></article>
      </section>
      <section className="content-card" aria-labelledby="live-flow-title"><div className="section-heading"><div><p className="eyebrow">Workflow live</p><h3 id="live-flow-title">Luồng hồ sơ số hóa</h3></div></div><div className="flow">Kiểm tra ngày <b>→</b> Work Order <b>→</b> Phê duyệt <b>→</b> Thực hiện <b>→</b> Xác nhận <b>→</b> BM-05 bàn giao <b>→</b> KPI</div></section>
    </> : null}
  </div>
}
