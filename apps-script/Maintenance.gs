const MAINTENANCE_TRANSITIONS = Object.freeze({
  OPEN: { REQUEST_APPROVAL: 'WAITING_APPROVAL' },
  WAITING_APPROVAL: { APPROVE: 'APPROVED' },
  APPROVED: { START: 'IN_PROGRESS' },
  IN_PROGRESS: { COMPLETE: 'COMPLETED' },
  COMPLETED: { VERIFY: 'VERIFIED' },
  VERIFIED: { RELEASE: 'RELEASED' },
  RELEASED: {},
})

const MAINTENANCE_ACTION_ROLES = Object.freeze({
  REQUEST_APPROVAL: ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  APPROVE: ['SUPERVISOR', 'MANAGER', 'ADMIN'],
  START: ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  COMPLETE: ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  VERIFY: ['QUALITY', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  RELEASE: ['SUPERVISOR', 'MANAGER', 'ADMIN'],
})

function executeMaintenanceTransition_(body, actor) {
  const operationId = String(body.operationId || '')
  const workOrderId = String(body.workOrderId || '')
  const action = String(body.workflowAction || '')

  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!workOrderId) throw new Error('WORK_ORDER_ID_REQUIRED')
  assertMaintenanceActionRole_(action, actor.role)

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('MAINTENANCE_TRANSITION', operationId)
    if (previous) {
      return { ok: true, duplicate: true, operationId: operationId, result: previous }
    }

    const workOrderMatch = findRecordByField_('Maintenance_Work_Order', 'workOrderId', workOrderId)
    if (!workOrderMatch) throw new Error('WORK_ORDER_NOT_FOUND')

    const workOrder = workOrderMatch.record
    const currentStatus = String(workOrder.status || '')
    const nextStatus = nextMaintenanceStatus_(currentStatus, action)
    const now = new Date().toISOString()
    let execution = null

    if (action === 'APPROVE') {
      if (normalizeIdentity_(workOrder.requestedBy) === actor.email) throw new Error('SELF_APPROVAL_FORBIDDEN')
      workOrder.approvedBy = actor.email
      workOrder.approvedAt = now
    }

    if (action === 'START') {
      if (findRecordByField_('Maintenance_Execution', 'workOrderId', workOrderId)) {
        throw new Error('MAINTENANCE_EXECUTION_ALREADY_EXISTS')
      }

      const executionRecord = {
        executionId: Utilities.getUuid(),
        workOrderId: workOrderId,
        equipmentId: workOrder.equipmentId,
        startedAt: now,
        performedBy: actor.email,
        status: 'IN_PROGRESS',
      }
      appendRecord_('Maintenance_Execution', executionRecord)
      execution = executionRecord
    }

    if (action === 'COMPLETE') {
      const executionMatch = findRecordByField_('Maintenance_Execution', 'workOrderId', workOrderId)
      if (!executionMatch) throw new Error('MAINTENANCE_EXECUTION_REQUIRED')
      execution = executionMatch.record
      if (String(execution.status || '') !== 'IN_PROGRESS') throw new Error('EXECUTION_STATUS_INVALID')
      execution.completedAt = now
      execution.status = 'COMPLETED'
      updateRecordRow_('Maintenance_Execution', executionMatch.rowNumber, execution)
    }

    if (action === 'VERIFY') {
      const executionMatch = findRecordByField_('Maintenance_Execution', 'workOrderId', workOrderId)
      if (!executionMatch) throw new Error('MAINTENANCE_EXECUTION_REQUIRED')
      execution = executionMatch.record
      if (String(execution.status || '') !== 'COMPLETED') throw new Error('EXECUTION_STATUS_INVALID')
      if (normalizeIdentity_(execution.performedBy) === actor.email) throw new Error('SELF_VERIFICATION_FORBIDDEN')
      execution.verifiedBy = actor.email
      execution.verifiedAt = now
      execution.status = 'VERIFIED'
      updateRecordRow_('Maintenance_Execution', executionMatch.rowNumber, execution)
    }

    if (action === 'RELEASE') {
      const handover = findAcceptedHandover_(String(workOrder.equipmentId || ''))
      if (!handover) throw new Error('ACCEPTED_HANDOVER_REQUIRED')
      if (String(handover.condition || '') === 'NOT_OPERABLE') throw new Error('HANDOVER_NOT_OPERABLE')
    }

    const oldWorkOrder = Object.assign({}, workOrderMatch.record)
    workOrder.status = nextStatus
    updateRecordRow_('Maintenance_Work_Order', workOrderMatch.rowNumber, workOrder)

    const auditId = Utilities.getUuid()
    const result = {
      workOrderId: workOrderId,
      previousStatus: currentStatus,
      status: nextStatus,
      executionId: execution ? execution.executionId : null,
      auditId: auditId,
    }

    appendAudit_({
      auditId: auditId,
      userId: actor.email,
      action: operationAuditAction_('MAINTENANCE_TRANSITION', operationId),
      entityType: 'MAINTENANCE',
      entityId: workOrderId,
      oldValueJson: JSON.stringify(oldWorkOrder),
      newValueJson: JSON.stringify({
        operationId: operationId,
        result: result,
        workOrder: workOrder,
        execution: execution,
      }),
    })

    return { ok: true, duplicate: false, operationId: operationId, result: result }
  } finally {
    lock.releaseLock()
  }
}

function nextMaintenanceStatus_(status, action) {
  const transitions = MAINTENANCE_TRANSITIONS[status]
  const next = transitions && transitions[action]
  if (!next) throw new Error('WORKFLOW_TRANSITION_NOT_ALLOWED:' + status + ':' + action)
  return next
}

function assertMaintenanceActionRole_(action, role) {
  const roles = MAINTENANCE_ACTION_ROLES[action]
  if (!roles) throw new Error('WORKFLOW_ACTION_NOT_ALLOWED')
  if (roles.indexOf(role) === -1) throw new Error('ROLE_NOT_ALLOWED')
}

function findRecordByField_(table, field, expectedValue) {
  const sheet = getSheet_(table)
  const headers = getHeaders_(sheet)
  const fieldIndex = headers.indexOf(field)
  if (fieldIndex === -1) throw new Error('FIELD_NOT_FOUND:' + table + ':' + field)

  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues()
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (String(values[index][fieldIndex]) === String(expectedValue)) {
      return {
        rowNumber: index + 2,
        record: rowToRecord_(headers, values[index]),
      }
    }
  }
  return null
}

function findAcceptedHandover_(equipmentId) {
  const sheet = getSheet_('Equipment_Handover')
  const headers = getHeaders_(sheet)
  const equipmentIndex = headers.indexOf('equipmentId')
  const acceptedIndex = headers.indexOf('accepted')
  if (equipmentIndex === -1 || acceptedIndex === -1) throw new Error('HANDOVER_HEADERS_REQUIRED')

  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues()
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (String(values[index][equipmentIndex]) === equipmentId && isTruthyCell_(values[index][acceptedIndex])) {
      return rowToRecord_(headers, values[index])
    }
  }
  return null
}

function updateRecordRow_(table, rowNumber, record) {
  const sheet = getSheet_(table)
  const headers = getHeaders_(sheet)
  const unknownKeys = Object.keys(record).filter(function (key) { return headers.indexOf(key) === -1 })
  if (unknownKeys.length) throw new Error('UNKNOWN_FIELDS:' + unknownKeys.join(','))

  const row = headers.map(function (header) {
    const value = record[header]
    return value === undefined || value === null ? '' : value
  })
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row])
}

function rowToRecord_(headers, row) {
  return headers.reduce(function (record, header, index) {
    record[header] = row[index] === '' ? null : row[index]
    return record
  }, {})
}

function normalizeIdentity_(value) {
  return String(value || '').trim().toLowerCase()
}

function isTruthyCell_(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'TRUE' || normalized === '1' || normalized === 'YES' || normalized === 'Y'
}
