const DAILY_INSPECTION_WRITE_ROLES = Object.freeze([
  'MAINTENANCE',
  'SUPERVISOR',
  'QUALITY',
  'MANAGER',
  'ADMIN',
])

const DAILY_INSPECTION_MARKS = Object.freeze([
  'V',
  'URGENT_REPAIR',
  'MAINTENANCE_REQUIRED',
  'STOP_REPAIR',
])

function dailyInspectionSubmit(request) {
  const actor = requireActor_()
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('DAILY_INSPECTION_REQUEST_REQUIRED')
  if (request.contractVersion !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')
  return executeDailyInspectionSubmit_(request, actor)
}

function executeDailyInspectionSubmit_(request, actor) {
  if (DAILY_INSPECTION_WRITE_ROLES.indexOf(actor.role) === -1) throw new Error('ROLE_NOT_ALLOWED')

  const operationId = String(request.operationId || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('DAILY_INSPECTION_INPUT_REQUIRED')

  const equipmentId = String(input.equipmentId || '').trim()
  const shift = String(input.shift || '').trim().toUpperCase()
  const area = String(input.area || '').trim()
  const overallMark = String(input.overallMark || '').trim().toUpperCase()
  const note = String(input.note || '').trim()
  const damagedParts = String(input.damagedParts || '').trim()
  const priority = String(input.priority || '').trim().toUpperCase()

  if (!equipmentId) throw new Error('EQUIPMENT_ID_REQUIRED')
  if (shift && ['MORNING', 'AFTERNOON', 'NIGHT'].indexOf(shift) === -1) throw new Error('INSPECTION_SHIFT_INVALID')
  if (DAILY_INSPECTION_MARKS.indexOf(overallMark) === -1) throw new Error('INSPECTION_MARK_INVALID')
  if (!findRecordByField_('Equipment_Master', 'equipmentId', equipmentId)) throw new Error('EQUIPMENT_NOT_FOUND')

  const stopRepair = overallMark === 'STOP_REPAIR'
  if (stopRepair) {
    if (!note) throw new Error('STOP_REPAIR_REASON_REQUIRED')
    if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(priority) === -1) throw new Error('WORK_ORDER_PRIORITY_REQUIRED')
  }

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('DAILY_INSPECTION_SUBMIT', operationId)
    if (previous) {
      return { ok: true, duplicate: true, operationId: operationId, result: previous }
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const inspectionId = 'DI-' + Utilities.getUuid()
    const workOrderId = stopRepair ? 'WO-' + Utilities.getUuid() : ''
    const downtimeId = stopRepair ? 'DT-' + Utilities.getUuid() : ''

    const inspectionRecord = {
      inspectionId: inspectionId,
      equipmentId: equipmentId,
      inspectionDate: Utilities.formatDate(now, APP_CONFIG.timeZone || 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'),
      shift: shift,
      area: area,
      inspectorId: actor.email,
      overallMark: overallMark,
      note: note,
      damagedParts: damagedParts,
      createdAt: nowIso,
    }

    const workOrderRecord = stopRepair ? {
      workOrderId: workOrderId,
      equipmentId: equipmentId,
      sourceType: 'DAILY_INSPECTION',
      sourceId: inspectionId,
      requestedAt: nowIso,
      requestedBy: actor.email,
      reason: note,
      priority: priority,
      method: '',
      plannedStartAt: '',
      plannedEndAt: '',
      approvedBy: '',
      approvedAt: '',
      status: 'OPEN',
    } : null

    const downtimeRecord = stopRepair ? {
      downtimeId: downtimeId,
      equipmentId: equipmentId,
      downAt: nowIso,
      restoredAt: '',
      category: 'DAILY_INSPECTION_STOP_REPAIR',
      description: note,
      actionToRestore: '',
      recordedBy: actor.email,
      handledBy: '',
      workOrderId: workOrderId,
      downtimeMinutes: '',
    } : null

    let inspectionAppend = null
    let workOrderAppend = null
    let downtimeAppend = null

    try {
      inspectionAppend = appendRecord_('Daily_Inspection', inspectionRecord)

      if (stopRepair) {
        workOrderAppend = appendRecord_('Maintenance_Work_Order', workOrderRecord)
        downtimeAppend = appendRecord_('Downtime_Event', downtimeRecord)
      }

      const auditId = Utilities.getUuid()
      const result = {
        inspectionId: inspectionId,
        overallMark: overallMark,
        workOrderId: workOrderId || null,
        downtimeId: downtimeId || null,
        auditId: auditId,
      }

      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('DAILY_INSPECTION_SUBMIT', operationId),
        entityType: 'INSPECTION',
        entityId: inspectionId,
        newValueJson: JSON.stringify({
          operationId: operationId,
          result: result,
          inspection: inspectionRecord,
          workOrder: workOrderRecord,
          downtime: downtimeRecord,
        }),
      })

      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      compensateDailyInspection_(error, {
        inspectionRow: inspectionAppend ? inspectionAppend.rowNumber : null,
        workOrderRow: workOrderAppend ? workOrderAppend.rowNumber : null,
        downtimeRow: downtimeAppend ? downtimeAppend.rowNumber : null,
      })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function compensateDailyInspection_(originalError, state) {
  const failures = []

  if (state.downtimeRow) {
    try {
      deleteRecordRow_('Downtime_Event', state.downtimeRow)
    } catch (error) {
      failures.push('DOWNTIME:' + error.message)
    }
  }

  if (state.workOrderRow) {
    try {
      deleteRecordRow_('Maintenance_Work_Order', state.workOrderRow)
    } catch (error) {
      failures.push('WORK_ORDER:' + error.message)
    }
  }

  if (state.inspectionRow) {
    try {
      deleteRecordRow_('Daily_Inspection', state.inspectionRow)
    } catch (error) {
      failures.push('INSPECTION:' + error.message)
    }
  }

  if (failures.length) {
    const originalMessage = originalError && originalError.message ? originalError.message : String(originalError)
    throw new Error('DAILY_INSPECTION_FAILED:' + originalMessage + ':ROLLBACK_FAILED:' + failures.join('|'))
  }
}
