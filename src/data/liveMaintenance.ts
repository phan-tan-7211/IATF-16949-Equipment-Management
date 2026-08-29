import { supabase } from './supabaseClient'
import { transitionMaintenanceStatus, type MaintenanceWorkflowAction, type MaintenanceWorkflowStatus } from '../domain/workflow'

export type MaintenanceEquipmentOption = { equipmentId: string; equipmentName: string }
export type LiveMaintenanceWorkOrder = {
  workOrderId: string; equipmentId: string; sourceType: string; requestedAt: string; requestedBy: string; reason: string; priority: string; status: MaintenanceWorkflowStatus; approvedBy: string; approvedAt: string
}
export type LiveMaintenancePlan = { planId: string; equipmentId: string; maintenanceType: string; plannedDate: string; responsiblePerson: string; status: string }
export type LiveHandover = { handoverId: string; equipmentId: string; accepted: boolean; condition: string; handoverAt: string }

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function bool(value: unknown) { return value === true || ['TRUE', '1', 'YES'].includes(text(value).toUpperCase()) }

export async function loadLiveMaintenance() {
  const [equipmentResult, planResult, woResult, handoverResult] = await Promise.all([
    supabase.from('equipment_master').select('equipment_id,equipment_name,equipment_type,status,active').eq('active', true),
    supabase.from('maintenance_plan').select('*'),
    supabase.from('maintenance_work_order').select('*').order('created_at', { ascending: false }),
    supabase.from('equipment_handover').select('*').order('created_at', { ascending: false }),
  ])
  for (const result of [equipmentResult, planResult, woResult, handoverResult]) if (result.error) throw result.error

  const equipment: MaintenanceEquipmentOption[] = ((equipmentResult.data || []) as Array<Record<string, unknown>>)
    .filter((row) => text(row.equipment_id) && text(row.equipment_type) === 'PRODUCTION' && text(row.status) !== 'DISPOSED')
    .map((row) => ({ equipmentId: text(row.equipment_id), equipmentName: text(row.equipment_name) }))
    .sort((a, b) => a.equipmentId.localeCompare(b.equipmentId))

  const plans: LiveMaintenancePlan[] = ((planResult.data || []) as Array<Record<string, unknown>>).map((row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    return {
      planId: text(row.plan_id), equipmentId: text(row.equipment_id), maintenanceType: text(source.maintenanceType), plannedDate: text(source.plannedDate), responsiblePerson: text(source.responsiblePerson), status: text(source.status) || (row.active === false ? 'INACTIVE' : 'ACTIVE'),
    }
  })

  const workOrders: LiveMaintenanceWorkOrder[] = ((woResult.data || []) as Array<Record<string, unknown>>).map((row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    return {
      workOrderId: text(row.work_order_id), equipmentId: text(row.equipment_id), sourceType: text(row.source_type), requestedAt: text(row.created_at), requestedBy: text(row.created_by), reason: text(row.reason), priority: text(row.priority), status: text(row.status) as MaintenanceWorkflowStatus, approvedBy: text(source.approvedBy), approvedAt: text(source.approvedAt),
    }
  })

  const handovers: LiveHandover[] = ((handoverResult.data || []) as Array<Record<string, unknown>>).map((row) => ({
    handoverId: text(row.handover_id), equipmentId: text(row.equipment_id), accepted: bool(row.accepted), condition: text(row.equipment_condition), handoverAt: text(row.created_at),
  }))

  return { equipment, plans, workOrders, handovers }
}

export async function createManualWorkOrder(request: { operationId: string; input: { equipmentId: string; sourceType: string; sourceId: string; reason: string; priority: string; method?: string; plannedStartAt?: string; plannedEndAt?: string } }) {
  const session = await supabase.auth.getSession()
  const actor = session.data.session?.user.email || ''
  const stamp = Date.now()
  const workOrderId = `WO-${stamp}`
  const { error } = await supabase.from('maintenance_work_order').insert({
    work_order_id: workOrderId,
    equipment_id: request.input.equipmentId,
    source_type: request.input.sourceType,
    source_id: request.input.sourceId || null,
    reason: request.input.reason,
    priority: request.input.priority,
    status: 'OPEN',
    created_by: actor || null,
    source_data: { operationId: request.operationId, method: request.input.method || '', plannedStartAt: request.input.plannedStartAt || '', plannedEndAt: request.input.plannedEndAt || '' },
  })
  if (error) throw error
  return { result: { workOrderId } }
}

export async function transitionLiveMaintenance(request: { workOrderId: string; workflowAction: MaintenanceWorkflowAction; operationId: string }) {
  const { data: wo, error: readError } = await supabase.from('maintenance_work_order').select('*').eq('work_order_id', request.workOrderId).single()
  if (readError) throw readError
  const current = text(wo.status) as MaintenanceWorkflowStatus
  const next = transitionMaintenanceStatus(current, request.workflowAction)

  if (request.workflowAction === 'RELEASE') {
    const { data: accepted, error: handoverError } = await supabase.from('equipment_handover').select('handover_id').eq('work_order_id', request.workOrderId).eq('accepted', true).limit(1)
    if (handoverError) throw handoverError
    if (!accepted?.length) throw new Error('Không thể RELEASE: chưa có BM-05 accepted cho Work Order này')
  }

  const session = await supabase.auth.getSession()
  const actor = session.data.session?.user.email || ''
  const source = ((wo.source_data as Record<string, unknown> | null) || {})
  if (request.workflowAction === 'APPROVE') {
    source.approvedBy = actor
    source.approvedAt = new Date().toISOString()
  }
  source.lastOperationId = request.operationId

  const { error: updateError } = await supabase.from('maintenance_work_order').update({ status: next, source_data: source, updated_at: new Date().toISOString() }).eq('work_order_id', request.workOrderId)
  if (updateError) throw updateError

  const auditId = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await supabase.from('audit_log').insert({
    audit_id: auditId,
    equipment_id: text(wo.equipment_id),
    entity_type: 'Maintenance_Work_Order',
    entity_id: request.workOrderId,
    action: request.workflowAction,
    actor_email: actor || 'unknown',
    detail: { before: current, after: next, operationId: request.operationId },
  })

  return { result: { status: next } }
}
