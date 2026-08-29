const TOOLING_TYPES = Object.freeze(['JIG', 'FIXTURE', 'MOLD', 'DIE', 'CUTTING_TOOL', 'PERISHABLE_TOOL', 'OTHER'])
const TOOLING_STATUSES = Object.freeze(['IN_PRODUCTION', 'REPAIR', 'STORED', 'DISPOSED'])
const TOOLING_OWNERSHIPS = Object.freeze(['COMPANY', 'CUSTOMER'])
const TOOLING_FREQUENCY_TYPES = Object.freeze(['DAY', 'WEEK', 'MONTH', 'USE_COUNT', 'OUTPUT_COUNT'])
const TOOLING_MODIFICATION_TYPES = Object.freeze(['DESIGN_CHANGE', 'PHYSICAL_MODIFICATION'])
const TOOLING_TECHNICAL_ROLES = Object.freeze(['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'])
const TOOLING_APPROVAL_ROLES = Object.freeze(['MANAGER', 'ADMIN'])
const TOOLING_QA_ROLES = Object.freeze(['QUALITY', 'MANAGER', 'ADMIN'])

function toolingCreate(request) {
  const actor = requireActor_()
  assertToolingRole_(actor, TOOLING_TECHNICAL_ROLES)
  assertToolingRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('TOOLING_INPUT_REQUIRED')

  const toolingId = String(input.toolingId || '').trim()
  const toolingName = String(input.toolingName || '').trim()
  const toolingType = String(input.toolingType || '').trim().toUpperCase()
  const ownership = String(input.ownership || '').trim().toUpperCase()
  const status = String(input.status || 'IN_PRODUCTION').trim().toUpperCase()
  const customerName = String(input.customerName || '').trim()
  const commissionDate = normalizeToolingDate_(input.commissionDate, false, 'TOOLING_COMMISSION_DATE_INVALID')
  const inspectionCycleDays = normalizePositiveInteger_(input.inspectionCycleDays, false, 'TOOLING_INSPECTION_CYCLE_INVALID')

  if (!toolingId) throw new Error('TOOLING_ID_REQUIRED')
  if (!toolingName) throw new Error('TOOLING_NAME_REQUIRED')
  if (TOOLING_TYPES.indexOf(toolingType) === -1) throw new Error('TOOLING_TYPE_INVALID')
  if (TOOLING_OWNERSHIPS.indexOf(ownership) === -1) throw new Error('TOOLING_OWNERSHIP_INVALID')
  if (TOOLING_STATUSES.indexOf(status) === -1) throw new Error('TOOLING_STATUS_INVALID')
  if (ownership === 'CUSTOMER' && !customerName) throw new Error('TOOLING_CUSTOMER_NAME_REQUIRED')
  if (status === 'DISPOSED') throw new Error('NEW_TOOLING_CANNOT_BE_DISPOSED')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const previous = findOperationResult_('CREATE_TOOLING', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }
    if (findRecordByField_('Tooling_Master', 'toolingId', toolingId)) throw new Error('TOOLING_ID_ALREADY_EXISTS')

    const record = {
      toolingId: toolingId,
      toolingName: toolingName,
      serialOrAssetNumber: String(input.serialOrAssetNumber || '').trim(),
      toolingType: toolingType,
      usedFor: String(input.usedFor || '').trim(),
      ownership: ownership,
      customerName: customerName,
      managingDepartment: String(input.managingDepartment || '').trim(),
      storageLocation: String(input.storageLocation || '').trim(),
      status: status,
      commissionDate: commissionDate,
      inspectionCycleDays: inspectionCycleDays,
      note: String(input.note || '').trim(),
    }

    let appended = null
    try {
      appended = appendRecord_('Tooling_Master', record)
      const auditId = Utilities.getUuid()
      const result = { toolingId: toolingId, rowNumber: appended.rowNumber, auditId: auditId }
      appendAudit_({ auditId: auditId, userId: actor.email, action: operationAuditAction_('CREATE_TOOLING', operationId), entityType: 'TOOLING', entityId: toolingId, newValueJson: JSON.stringify({ operationId: operationId, result: result, tooling: record }) })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      if (appended) compensateOrThrow_(error, function () { deleteRecordRow_('Tooling_Master', appended.rowNumber) })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function toolingPlanCreate(request) {
  const actor = requireActor_()
  assertToolingRole_(actor, TOOLING_TECHNICAL_ROLES)
  assertToolingRequest_(request)
  const operationId = String(request.operationId || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('TOOLING_PLAN_INPUT_REQUIRED')

  const toolingId = String(input.toolingId || '').trim()
  const inspectionItem = String(input.inspectionItem || '').trim()
  const acceptanceCriteria = String(input.acceptanceCriteria || '').trim()
  const frequencyType = String(input.frequencyType || '').trim().toUpperCase()
  const frequencyValue = normalizePositiveInteger_(input.frequencyValue, true, 'TOOLING_FREQUENCY_VALUE_INVALID')
  const lastResultDate = normalizeToolingDate_(input.lastResultDate, false, 'TOOLING_LAST_RESULT_DATE_INVALID')

  if (!toolingId) throw new Error('TOOLING_ID_REQUIRED')
  if (!inspectionItem) throw new Error('TOOLING_INSPECTION_ITEM_REQUIRED')
  if (!acceptanceCriteria) throw new Error('TOOLING_ACCEPTANCE_CRITERIA_REQUIRED')
  if (TOOLING_FREQUENCY_TYPES.indexOf(frequencyType) === -1) throw new Error('TOOLING_FREQUENCY_TYPE_INVALID')
  if (!findRecordByField_('Tooling_Master', 'toolingId', toolingId)) throw new Error('TOOLING_NOT_FOUND')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const previous = findOperationResult_('CREATE_TOOLING_PLAN', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }
    const toolingPlanId = 'TPLAN-' + Utilities.getUuid()
    const record = {
      toolingPlanId: toolingPlanId,
      toolingId: toolingId,
      inspectionItem: inspectionItem,
      acceptanceCriteria: acceptanceCriteria,
      frequencyType: frequencyType,
      frequencyValue: frequencyValue,
      responsiblePerson: String(input.responsiblePerson || '').trim(),
      lastResultDate: lastResultDate,
      note: String(input.note || '').trim(),
    }
    let appended = null
    try {
      appended = appendRecord_('Tooling_Maintenance_Plan', record)
      const auditId = Utilities.getUuid()
      const result = { toolingPlanId: toolingPlanId, toolingId: toolingId, rowNumber: appended.rowNumber, auditId: auditId }
      appendAudit_({ auditId: auditId, userId: actor.email, action: operationAuditAction_('CREATE_TOOLING_PLAN', operationId), entityType: 'TOOLING', entityId: toolingPlanId, newValueJson: JSON.stringify({ operationId: operationId, result: result, plan: record }) })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      if (appended) compensateOrThrow_(error, function () { deleteRecordRow_('Tooling_Maintenance_Plan', appended.rowNumber) })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function toolingModificationCreate(request) {
  const actor = requireActor_()
  assertToolingRole_(actor, TOOLING_TECHNICAL_ROLES)
  assertToolingRequest_(request)
  const operationId = String(request.operationId || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('TOOLING_MODIFICATION_INPUT_REQUIRED')

  const toolingId = String(input.toolingId || '').trim()
  const modificationDate = normalizeToolingDate_(input.modificationDate, true, 'TOOLING_MODIFICATION_DATE_REQUIRED')
  const modificationType = String(input.modificationType || '').trim().toUpperCase()
  const reason = String(input.reason || '').trim()
  const beforeAfterDescription = String(input.beforeAfterDescription || '').trim()
  if (!toolingId) throw new Error('TOOLING_ID_REQUIRED')
  if (TOOLING_MODIFICATION_TYPES.indexOf(modificationType) === -1) throw new Error('TOOLING_MODIFICATION_TYPE_INVALID')
  if (!reason) throw new Error('TOOLING_MODIFICATION_REASON_REQUIRED')
  if (!beforeAfterDescription) throw new Error('TOOLING_BEFORE_AFTER_REQUIRED')
  if (!findRecordByField_('Tooling_Master', 'toolingId', toolingId)) throw new Error('TOOLING_NOT_FOUND')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const previous = findOperationResult_('CREATE_TOOLING_MODIFICATION', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }
    const modificationId = 'TMOD-' + Utilities.getUuid()
    const record = {
      modificationId: modificationId,
      toolingId: toolingId,
      modificationDate: modificationDate,
      modificationType: modificationType,
      reason: reason,
      ecnNumber: String(input.ecnNumber || '').trim(),
      beforeAfterDescription: beforeAfterDescription,
      proposedBy: actor.email,
      approvedBy: '',
      qaConfirmedBy: '',
      updatedDocuments: '',
      status: 'IN_PROGRESS',
    }
    let appended = null
    try {
      appended = appendRecord_('Tooling_Modification', record)
      const auditId = Utilities.getUuid()
      const result = { modificationId: modificationId, toolingId: toolingId, status: 'IN_PROGRESS', rowNumber: appended.rowNumber, auditId: auditId }
      appendAudit_({ auditId: auditId, userId: actor.email, action: operationAuditAction_('CREATE_TOOLING_MODIFICATION', operationId), entityType: 'TOOLING', entityId: modificationId, newValueJson: JSON.stringify({ operationId: operationId, result: result, modification: record }) })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      if (appended) compensateOrThrow_(error, function () { deleteRecordRow_('Tooling_Modification', appended.rowNumber) })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function toolingModificationApprove(request) {
  return transitionToolingModification_(request, 'APPROVE')
}

function toolingModificationConfirmQuality(request) {
  return transitionToolingModification_(request, 'QA_CONFIRM')
}

function toolingModificationComplete(request) {
  return transitionToolingModification_(request, 'COMPLETE')
}

function transitionToolingModification_(request, action) {
  const actor = requireActor_()
  assertToolingRequest_(request)
  if (action === 'APPROVE' || action === 'COMPLETE') assertToolingRole_(actor, TOOLING_APPROVAL_ROLES)
  if (action === 'QA_CONFIRM') assertToolingRole_(actor, TOOLING_QA_ROLES)

  const operationId = String(request.operationId || '').trim()
  const modificationId = String(request.modificationId || '').trim()
  const updatedDocuments = String(request.updatedDocuments || '').trim()
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!modificationId) throw new Error('TOOLING_MODIFICATION_ID_REQUIRED')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const operationKind = 'TOOLING_MODIFICATION_' + action
    const previous = findOperationResult_(operationKind, operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }

    const located = findToolingRow_('Tooling_Modification', 'modificationId', modificationId)
    if (!located) throw new Error('TOOLING_MODIFICATION_NOT_FOUND')
    if (String(located.record.status || '') !== 'IN_PROGRESS') throw new Error('TOOLING_MODIFICATION_NOT_IN_PROGRESS')
    const oldRecord = located.record
    const nextRecord = Object.assign({}, oldRecord)

    if (action === 'APPROVE') {
      if (nextRecord.approvedBy) throw new Error('TOOLING_MODIFICATION_ALREADY_APPROVED')
      if (String(nextRecord.proposedBy || '').toLowerCase() === actor.email) throw new Error('SELF_APPROVAL_FORBIDDEN')
      nextRecord.approvedBy = actor.email
    } else if (action === 'QA_CONFIRM') {
      if (nextRecord.qaConfirmedBy) throw new Error('TOOLING_MODIFICATION_ALREADY_QA_CONFIRMED')
      nextRecord.qaConfirmedBy = actor.email
    } else if (action === 'COMPLETE') {
      if (!nextRecord.approvedBy) throw new Error('TOOLING_MODIFICATION_APPROVAL_REQUIRED')
      if (!updatedDocuments) throw new Error('TOOLING_UPDATED_DOCUMENTS_REQUIRED')
      nextRecord.updatedDocuments = updatedDocuments
      nextRecord.status = 'COMPLETED'
    }

    writeToolingRow_('Tooling_Modification', located.rowNumber, nextRecord)
    try {
      const auditId = Utilities.getUuid()
      const result = { modificationId: modificationId, action: action, status: nextRecord.status, approvedBy: nextRecord.approvedBy, qaConfirmedBy: nextRecord.qaConfirmedBy, updatedDocuments: nextRecord.updatedDocuments, auditId: auditId }
      appendAudit_({ auditId: auditId, userId: actor.email, action: operationAuditAction_(operationKind, operationId), entityType: 'TOOLING', entityId: modificationId, oldValueJson: JSON.stringify(oldRecord), newValueJson: JSON.stringify({ operationId: operationId, result: result, modification: nextRecord }) })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      compensateOrThrow_(error, function () { writeToolingRow_('Tooling_Modification', located.rowNumber, oldRecord) })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function assertToolingRole_(actor, allowedRoles) {
  if (!actor || allowedRoles.indexOf(actor.role) === -1) throw new Error('ROLE_NOT_ALLOWED')
}

function assertToolingRequest_(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('TOOLING_REQUEST_REQUIRED')
  if (String(request.contractVersion || '') !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')
}

function normalizeToolingDate_(value, required, errorCode) {
  const text = String(value || '').trim()
  if (!text && !required) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(errorCode)
  return text
}

function normalizePositiveInteger_(value, required, errorCode) {
  if (value === '' || value === null || value === undefined) {
    if (required) throw new Error(errorCode)
    return ''
  }
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new Error(errorCode)
  return number
}

function findToolingRow_(table, idField, idValue) {
  const sheet = getSheet_(table)
  const headers = getHeaders_(sheet)
  const idIndex = headers.indexOf(idField)
  if (idIndex === -1) throw new Error('TOOLING_ID_HEADER_REQUIRED:' + idField)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null
  const match = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).createTextFinder(String(idValue)).matchEntireCell(true).findNext()
  if (!match) return null
  const values = sheet.getRange(match.getRow(), 1, 1, headers.length).getDisplayValues()[0]
  const record = headers.reduce(function (result, header, index) { result[header] = values[index] === '' ? null : values[index]; return result }, {})
  return { rowNumber: match.getRow(), record: record }
}

function writeToolingRow_(table, rowNumber, record) {
  const sheet = getSheet_(table)
  const headers = getHeaders_(sheet)
  const row = headers.map(function (header) { const value = record[header]; return value === undefined || value === null ? '' : value })
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row])
}
