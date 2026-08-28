import { createAuditEvent } from './audit'
import { canReleaseEquipment } from './handover'
import type { AuditLog, EquipmentHandover, MaintenanceWorkOrder } from './models'
import { transitionMaintenanceStatus, type MaintenanceWorkflowAction, type MaintenanceWorkflowStatus } from './workflow'

export type MaintenanceTransitionResult = {
  workOrder: MaintenanceWorkOrder
  handover?: EquipmentHandover
  auditEvents: AuditLog[]
  message: string
}

type ExecuteMaintenanceTransitionInput = {
  workOrder: MaintenanceWorkOrder
  action: MaintenanceWorkflowAction
  actorUserId: string
  now: string
}

export function executeMaintenanceTransition({
  workOrder,
  action,
  actorUserId,
  now,
}: ExecuteMaintenanceTransitionInput): MaintenanceTransitionResult {
  const previousStatus = workOrder.status as MaintenanceWorkflowStatus
  let handover: EquipmentHandover | undefined
  const auditEvents: AuditLog[] = []

  if (action === 'RELEASE') {
    handover = {
      handoverId: `HO-${workOrder.workOrderId}`,
      equipmentId: workOrder.equipmentId,
      handoverAt: now,
      fromPerson: 'maintenance-demo',
      fromDepartment: 'Bảo trì',
      toPerson: 'production-demo',
      toDepartment: 'Sản xuất',
      reason: 'Hoàn thành sửa chữa và chạy thử',
      condition: 'NORMAL',
      attachmentNote: 'BM-TBSX-08 + kết quả chạy thử',
      receiverComment: 'Đã kiểm tra thực tế và chấp nhận bàn giao',
      accepted: true,
    }

    const decision = canReleaseEquipment(handover)
    if (!decision.allowed) {
      return {
        workOrder,
        auditEvents,
        message: decision.reason ?? 'Không thể bàn giao',
      }
    }

    auditEvents.push(createAuditEvent({
      timestamp: now,
      userId: actorUserId,
      action: 'ACCEPT_HANDOVER',
      entityType: 'HANDOVER',
      entityId: handover.handoverId,
      newValue: handover,
    }))
  }

  const nextStatus = transitionMaintenanceStatus(previousStatus, action)
  const updatedWorkOrder = { ...workOrder, status: nextStatus }

  auditEvents.push(createAuditEvent({
    timestamp: now,
    userId: actorUserId,
    action,
    entityType: action === 'APPROVE' ? 'APPROVAL' : 'MAINTENANCE',
    entityId: workOrder.workOrderId,
    oldValue: { status: previousStatus },
    newValue: { status: nextStatus },
  }))

  return {
    workOrder: updatedWorkOrder,
    handover,
    auditEvents,
    message: `${workOrder.workOrderId}: ${nextStatus}`,
  }
}
