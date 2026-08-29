const HANDOVER_CONDITIONS = Object.freeze([
  'NORMAL',
  'MINOR_ISSUE_MONITOR',
  'NOT_OPERABLE',
])

function handoverSubmit(request) {
  const actor = requireActor_()
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('HANDOVER_REQUEST_REQUIRED')
  if (request.contractVersion !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')
  return executeHandoverSubmit_(request, actor)
}

function handoverAccept(request) {
  const actor = requireActor_()
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('HANDOVER_ACCEPT_REQUEST_REQUIRED')
  if (request.contractVersion !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')
  return executeHandoverAccept_(request, actor)
}

function executeHandoverSubmit_(request, actor) {
  assertWriteRole_('Equipment_Handover', actor.role)

  const operationId = String(request.operationId || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('HANDOVER_INPUT_REQUIRED')

  const workOrderId = String(input.workOrderId || '').trim()
  const fromDepartment = String(input.fromDepartment || '').trim()
  const toPerson = normalizeIdentity_(input.toPerson)
  const toDepartment = String(input.toDepartment || '').trim()
  const reason = String(input.reason || '').trim()
  const condition = String(input.condition || '').trim().toUpperCase()
  const attachmentNote = String(input.attachmentNote || '').trim()
  const senderComment = String(input.senderComment || '').trim()

  if (!workOrderId) throw new Error('WORK_ORDER_ID_REQUIRED')
  if (!toPerson || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toPerson)) throw new Error('HANDOVER_RECIPIENT_EMAIL_REQUIRED')
  if (!reason) throw new Error('HANDOVER_REASON_REQUIRED')
  if (HANDOVER_CONDITIONS.indexOf(condition) === -1) throw new Error('HANDOVER_CONDITION_INVALID')

  const workOrderMatch = findRecordByField_('Maintenance_Work_Order', 'workOrderId', workOrderId)
  if (!workOrderMatch) throw new Error('WORK_ORDER_NOT_FOUND')
  const workOrder = workOrderMatch.record
  if (String(workOrder.status || '') !== 'VERIFIED') throw new Error('WORK_ORDER_NOT_VERIFIED')

  const equipmentId = String(workOrder.equipmentId || '').trim()
  if (!equipmentId) throw new Error('WORK_ORDER_EQUIPMENT_REQUIRED')

  const handoverId = 'HO-' + workOrderId
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('CREATE_HANDOVER', operationId)
    if (previous) {
      return { ok: true, duplicate: true, operationId: operationId, result: previous }
    }

    if (findRecordByField_('Equipment_Handover', 'handoverId', handoverId)) {
      throw new Error('HANDOVER_ALREADY_EXISTS')
    }

    const record = {
      handoverId: handoverId,
      equipmentId: equipmentId,
      handoverAt: new Date().toISOString(),
      fromPerson: actor.email,
      fromDepartment: fromDepartment,
      toPerson: toPerson,
      toDepartment: toDepartment,
      reason: reason,
      condition: condition,
      attachmentNote: attachmentNote,
      senderComment: senderComment,
      receiverComment: '',
      accepted: false,
    }

    let appended = null
    try {
      appended = appendRecord_('Equipment_Handover', record)
      const auditId = Utilities.getUuid()
      const result = {
        handoverId: handoverId,
        workOrderId: workOrderId,
        equipmentId: equipmentId,
        condition: condition,
        accepted: false,
        rowNumber: appended.rowNumber,
        auditId: auditId,
      }

      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('CREATE_HANDOVER', operationId),
        entityType: 'HANDOVER',
        entityId: handoverId,
        newValueJson: JSON.stringify({
          operationId: operationId,
          result: result,
          handover: record,
        }),
      })

      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      if (appended) {
        compensateOrThrow_(error, function () {
          deleteRecordRow_('Equipment_Handover', appended.rowNumber)
        })
      }
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function executeHandoverAccept_(request, actor) {
  const operationId = String(request.operationId || '').trim()
  const workOrderId = String(request.workOrderId || '').trim()
  const receiverComment = String(request.receiverComment || '').trim()

  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!workOrderId) throw new Error('WORK_ORDER_ID_REQUIRED')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('ACCEPT_HANDOVER', operationId)
    if (previous) {
      return { ok: true, duplicate: true, operationId: operationId, result: previous }
    }

    const workOrderMatch = findRecordByField_('Maintenance_Work_Order', 'workOrderId', workOrderId)
    if (!workOrderMatch) throw new Error('WORK_ORDER_NOT_FOUND')
    const workOrder = workOrderMatch.record
    if (String(workOrder.status || '') !== 'VERIFIED') throw new Error('WORK_ORDER_NOT_VERIFIED')

    const handoverId = 'HO-' + workOrderId
    const handoverMatch = findRecordByField_('Equipment_Handover', 'handoverId', handoverId)
    if (!handoverMatch) throw new Error('HANDOVER_NOT_FOUND')

    const handover = Object.assign({}, handoverMatch.record)
    if (String(handover.equipmentId || '') !== String(workOrder.equipmentId || '')) throw new Error('HANDOVER_EQUIPMENT_MISMATCH')
    if (isTruthyCell_(handover.accepted)) throw new Error('HANDOVER_ALREADY_ACCEPTED')
    if (normalizeIdentity_(handover.toPerson) !== normalizeIdentity_(actor.email)) throw new Error('HANDOVER_RECIPIENT_ONLY')

    const oldHandover = Object.assign({}, handover)
    handover.receiverComment = receiverComment
    handover.accepted = true

    let updated = false
    try {
      updateRecordRow_('Equipment_Handover', handoverMatch.rowNumber, handover)
      updated = true

      const auditId = Utilities.getUuid()
      const result = {
        handoverId: handoverId,
        workOrderId: workOrderId,
        equipmentId: handover.equipmentId,
        condition: handover.condition,
        accepted: true,
        auditId: auditId,
      }

      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('ACCEPT_HANDOVER', operationId),
        entityType: 'HANDOVER',
        entityId: handoverId,
        oldValueJson: JSON.stringify(oldHandover),
        newValueJson: JSON.stringify({
          operationId: operationId,
          result: result,
          handover: handover,
        }),
      })

      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      if (updated) {
        compensateOrThrow_(error, function () {
          updateRecordRow_('Equipment_Handover', handoverMatch.rowNumber, oldHandover)
        })
      }
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}
