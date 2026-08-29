import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createAppsScriptBridgeClient } from './data/appsScriptBridgeClient'
import { createManualWorkOrder, loadLiveMaintenance, transitionLiveMaintenance, type LiveHandover, type LiveMaintenancePlan, type LiveMaintenanceWorkOrder, type MaintenanceEquipmentOption } from './data/liveMaintenance'
import type { MaintenanceWorkflowAction, MaintenanceWorkflowStatus } from './domain/workflow'

const statusLabel: Record<string, string> = {
  OPEN: 'Mở',
  WAITING_APPROVAL: 'Chờ phê duyệt',
  APPROVED: 'Đã phê duyệt',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Đã hoàn tất',
  VERIFIED: 'Đã xác nhận',
  RELEASED: 'Đã bàn giao',
}

const nextAction: Partial<Record<MaintenanceWorkflowStatus, { action: MaintenanceWorkflowAction; label: string }>> = {
  OPEN: { action: 'REQUEST_APPROVAL', label: 'Gửi phê duyệt' },
  WAITING_APPROVAL: { action: 'APPROVE', label: 'Phê duyệt' },
  APPROVED: { action: 'START', label: 'Bắt đầu sửa chữa' },
  IN_PROGRESS: { action: 'COMPLETE', label: 'Hoàn tất sửa chữa' },
  COMPLETED: { action: 'VERIFY', label: 'Xác nhận chạy thử' },
  VERIFIED: { action: 'RELEASE', label: 'Release / bàn giao' },
}

export function LiveMaintenancePanel() {
  const [equipment, setEquipment] = useState<MaintenanceEquipmentOption[]>([])
  const [plans, setPlans] = useState<LiveMaintenancePlan[]>([])
  const [workOrders, setWorkOrders] = useState<LiveMaintenanceWorkOrder[]>([])
  const [handovers, setHandovers] = useState<LiveHandover[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')

  const refresh = async () => {
    const client = createAppsScriptBridgeClient()
    try {
      const result = await loadLiveMaintenance(client)
      setEquipment(result.equipment)
      setPlans(result.plans)
      setWorkOrders(result.workOrders)
      setHandovers(result.handovers)
      setEquipmentId((current) => current || result.equipment[0]?.equipmentId || '')
      setError('')
    } finally {
      client.destroy()
    }
  }

  useEffect(() => {
    let active = true
    const client = createAppsScriptBridgeClient()
    loadLiveMaintenance(client)
      .then((result) => {
        if (!active) return
        setEquipment(result.equipment)
        setPlans(result.plans)
        setWorkOrders(result.workOrders)
        setHandovers(result.handovers)
        setEquipmentId(result.equipment[0]?.equipmentId || '')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Maintenance')
      })
      .finally(() => {
        if (active) setLoading(false)
        client.destroy()
      })
    return () => { active = false; client.destroy() }
  }, [])

  const openCount = workOrders.filter((item) => item.status !== 'RELEASED').length
  const overduePlans = plans.filter((item) => item.status === 'OVERDUE').length
  const acceptedHandovers = useMemo(() => handovers.filter((item) => item.accepted), [handovers])

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!equipmentId || !reason.trim()) return
    const client = createAppsScriptBridgeClient()
    setBusy('create')
    setError('')
    setMessage('')
    try {
      const result = await createManualWorkOrder(client, {
        operationId: `create-wo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        input: { equipmentId, sourceType: 'MANUAL', sourceId: '', reason: reason.trim(), priority, method: '', plannedStartAt: '', plannedEndAt: '' },
      })
      setMessage(`Đã tạo ${result.result.workOrderId}`)
      setReason('')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể tạo Work Order')
    } finally {
      client.destroy()
      setBusy('')
    }
    try { await refresh() } catch { /* mutation already succeeded; keep message */ }
  }

  const advance = async (workOrderId: string, action: MaintenanceWorkflowAction) => {
    const client = createAppsScriptBridgeClient()
    setBusy(workOrderId)
    setError('')
    setMessage('')
    try {
      const result = await transitionLiveMaintenance(client, {
        workOrderId,
        workflowAction: action,
        operationId: `maintenance-${action.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      })
      setMessage(`${workOrderId}: ${statusLabel[result.result.status] || result.result.status}`)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể chuyển trạng thái Work Order')
    } finally {
      client.destroy()
      setBusy('')
    }
    try { await refresh() } catch { /* mutation result remains authoritative */ }
  }

  return <div className="stack">
    <section className="metric-grid" aria-label="Maintenance live summary">
      <article><span>Work Order đang mở</span><strong>{openCount}</strong><small>Maintenance_Work_Order</small></article>
      <article><span>PM quá hạn</span><strong>{overduePlans}</strong><small>Maintenance_Plan</small></article>
      <article><span>BM-05 accepted</span><strong>{acceptedHandovers.length}</strong><small>Equipment_Handover</small></article>
      <article><span>Nguồn dữ liệu</span><strong>LIVE</strong><small>Backend workflow</small></article>
    </section>

    <section className="content-card" aria-labelledby="create-wo-title">
      <div className="section-heading"><div><p className="eyebrow">Manual Work Order</p><h2 id="create-wo-title">Tạo yêu cầu bảo trì</h2></div><span className="status-pill">SERVER AUTHORITY</span></div>
      {loading ? <p className="muted" role="status">Đang tải dữ liệu bảo trì…</p> : null}
      {error ? <div className="record-card" role="alert"><b>Có lỗi</b><p>{error}</p></div> : null}
      {message ? <div className="record-card" role="status"><b>{message}</b></div> : null}
      {!loading ? <form className="stack" onSubmit={onCreate}>
        <label>Thiết bị<select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}>{equipment.map((item) => <option key={item.equipmentId} value={item.equipmentId}>{item.equipmentId} · {item.equipmentName}</option>)}</select></label>
        <label>Lý do<textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
        <label>Ưu tiên<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
        <button className="primary-action" type="submit" disabled={busy === 'create' || !equipment.length}>{busy === 'create' ? 'Đang tạo…' : '+ Tạo Work Order'}</button>
      </form> : null}
    </section>

    <section className="content-card" aria-labelledby="wo-live-title">
      <div className="section-heading"><div><p className="eyebrow">BM-03 · 07 · 08 · 04 · 05</p><h3 id="wo-live-title">Work Order live</h3></div></div>
      {workOrders.length ? <div className="stack">{workOrders.map((item) => {
        const next = nextAction[item.status]
        const accepted = handovers.find((handover) => handover.equipmentId === item.equipmentId && handover.accepted)
        return <article className="record-card" key={item.workOrderId}>
          <div><b>{item.workOrderId}</b><span>{item.equipmentId} · {item.priority} · {item.sourceType}</span></div>
          <span className={`badge ${item.status === 'RELEASED' ? 'running' : item.status === 'OPEN' ? 'down' : 'maintenance'}`}>{statusLabel[item.status] || item.status}</span>
          <p>{item.reason || '—'}</p>
          <small>Yêu cầu: {item.requestedBy || '—'} · BM-05: {accepted ? `${accepted.handoverId} accepted` : 'chưa accepted'}</small>
          {next ? <button className="secondary-action" type="button" disabled={busy === item.workOrderId} onClick={() => advance(item.workOrderId, next.action)}>{busy === item.workOrderId ? 'Đang xử lý…' : next.label}</button> : <span className="muted">Workflow hoàn tất</span>}
        </article>
      })}</div> : <p className="muted">Chưa có Work Order production.</p>}
    </section>

    <section className="content-card" aria-labelledby="pm-live-title">
      <div className="section-heading"><div><p className="eyebrow">BM-TBSX-03</p><h3 id="pm-live-title">Kế hoạch PM live</h3></div></div>
      {plans.length ? <div className="list">{plans.map((plan) => <div key={plan.planId}><span><b>{plan.equipmentId}</b> · {plan.maintenanceType}</span><span>{plan.plannedDate || '—'} <em className={`badge ${plan.status === 'OVERDUE' ? 'down' : 'maintenance'}`}>{plan.status}</em></span></div>)}</div> : <p className="muted">Chưa có kế hoạch PM production.</p>}
    </section>
  </div>
}
