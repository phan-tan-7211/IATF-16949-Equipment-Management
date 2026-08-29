const EQUIPMENT_TYPES = Object.freeze(['PRODUCTION', 'MEASUREMENT'])
const EQUIPMENT_STATUSES = Object.freeze(['RUNNING', 'DOWN', 'MAINTENANCE', 'STOPPED', 'DISPOSED'])
const EQUIPMENT_CRITICALITIES = Object.freeze(['A', 'B', 'C', 'D'])
const EQUIPMENT_MUTABLE_FIELDS = Object.freeze([
  'equipmentName', 'equipmentType', 'equipmentCategory', 'manufacturer', 'supplier', 'model', 'serialNumber',
  'productionYear', 'purchaseDate', 'commissionDate', 'currentArea', 'currentLine', 'managingDepartment',
  'usingDepartment', 'technicalSpecification', 'maintenanceCycleMonths', 'criticality', 'imageUrl', 'manualUrl',
  'setupDocumentUrl',
])

function equipmentCreate(request) {
  const actor = requireActor_()
  assertEquipmentAdmin_(actor)
  assertEquipmentRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('EQUIPMENT_INPUT_REQUIRED')

  const equipmentId = normalizeEquipmentId_(input.equipmentId)
  const equipmentName = requiredEquipmentText_(input.equipmentName, 'EQUIPMENT_NAME_REQUIRED')
  const equipmentType = normalizeEquipmentEnum_(input.equipmentType, EQUIPMENT_TYPES, 'EQUIPMENT_TYPE_INVALID')
  const normalized = normalizeEquipmentFields_(input)
  normalized.equipmentName = equipmentName
  normalized.equipmentType = equipmentType

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('CREATE_EQUIPMENT', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }
    if (findEquipmentRow_(equipmentId)) throw new Error('EQUIPMENT_ID_ALREADY_EXISTS')

    const now = new Date().toISOString()
    const record = Object.assign({}, normalized, {
      equipmentId: equipmentId,
      status: 'RUNNING',
      qrCode: equipmentId,
      active: true,
      updatedAt: now,
    })

    let appended = null
    try {
      appended = appendRecord_('Equipment_Master', record)
      const auditId = Utilities.getUuid()
      const result = {
        equipmentId: equipmentId,
        status: 'RUNNING',
        active: true,
        updatedAt: now,
        rowNumber: appended.rowNumber,
        auditId: auditId,
      }
      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('CREATE_EQUIPMENT', operationId),
        entityType: 'EQUIPMENT',
        entityId: equipmentId,
        newValueJson: JSON.stringify({ operationId: operationId, result: result, equipment: record }),
      })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      if (appended) compensateOrThrow_(error, function () { deleteRecordRow_('Equipment_Master', appended.rowNumber) })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function equipmentUpdate(request) {
  const actor = requireActor_()
  assertEquipmentAdmin_(actor)
  assertEquipmentRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const equipmentId = String(request.equipmentId || '').trim()
  const expectedUpdatedAt = String(request.expectedUpdatedAt || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!equipmentId) throw new Error('EQUIPMENT_ID_REQUIRED')
  if (!expectedUpdatedAt) throw new Error('EXPECTED_UPDATED_AT_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('EQUIPMENT_INPUT_REQUIRED')
  if (Object.prototype.hasOwnProperty.call(input, 'equipmentId')) throw new Error('EQUIPMENT_ID_IMMUTABLE')
  if (Object.prototype.hasOwnProperty.call(input, 'active') || Object.prototype.hasOwnProperty.call(input, 'status')) throw new Error('USE_EQUIPMENT_LIFECYCLE_ACTION')

  const patch = normalizeEquipmentFields_(input, true)
  if (!Object.keys(patch).length) throw new Error('EQUIPMENT_UPDATE_EMPTY')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const previous = findOperationResult_('UPDATE_EQUIPMENT', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }

    const located = findEquipmentRow_(equipmentId)
    if (!located) throw new Error('EQUIPMENT_NOT_FOUND')
    assertEquipmentVersion_(located.record, expectedUpdatedAt)
    const oldRecord = located.record
    const now = new Date().toISOString()
    const nextRecord = Object.assign({}, oldRecord, patch, { updatedAt: now })
    writeEquipmentRow_(located.rowNumber, nextRecord)

    try {
      const auditId = Utilities.getUuid()
      const result = { equipmentId: equipmentId, updatedAt: now, auditId: auditId }
      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('UPDATE_EQUIPMENT', operationId),
        entityType: 'EQUIPMENT',
        entityId: equipmentId,
        oldValueJson: JSON.stringify(oldRecord),
        newValueJson: JSON.stringify({ operationId: operationId, result: result, equipment: nextRecord }),
      })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      compensateOrThrow_(error, function () { writeEquipmentRow_(located.rowNumber, oldRecord) })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function equipmentSetLifecycle(request) {
  const actor = requireActor_()
  assertEquipmentAdmin_(actor)
  assertEquipmentRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const equipmentId = String(request.equipmentId || '').trim()
  const expectedUpdatedAt = String(request.expectedUpdatedAt || '').trim()
  const action = String(request.action || '').trim().toUpperCase()
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!equipmentId) throw new Error('EQUIPMENT_ID_REQUIRED')
  if (!expectedUpdatedAt) throw new Error('EXPECTED_UPDATED_AT_REQUIRED')
  if (['DEACTIVATE', 'RESTORE', 'DISPOSE'].indexOf(action) === -1) throw new Error('EQUIPMENT_LIFECYCLE_ACTION_INVALID')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const previous = findOperationResult_('EQUIPMENT_LIFECYCLE', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }

    const located = findEquipmentRow_(equipmentId)
    if (!located) throw new Error('EQUIPMENT_NOT_FOUND')
    assertEquipmentVersion_(located.record, expectedUpdatedAt)
    const oldRecord = located.record
    const nextRecord = Object.assign({}, oldRecord)

    if (action === 'DEACTIVATE') {
      nextRecord.active = false
      if (nextRecord.status === 'RUNNING') nextRecord.status = 'STOPPED'
    } else if (action === 'RESTORE') {
      if (oldRecord.status === 'DISPOSED') throw new Error('DISPOSED_EQUIPMENT_CANNOT_BE_RESTORED')
      nextRecord.active = true
      if (nextRecord.status === 'STOPPED') nextRecord.status = 'RUNNING'
    } else {
      nextRecord.active = false
      nextRecord.status = 'DISPOSED'
    }

    nextRecord.updatedAt = new Date().toISOString()
    writeEquipmentRow_(located.rowNumber, nextRecord)
    try {
      const auditId = Utilities.getUuid()
      const result = { equipmentId: equipmentId, action: action, status: nextRecord.status, active: nextRecord.active, updatedAt: nextRecord.updatedAt, auditId: auditId }
      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('EQUIPMENT_LIFECYCLE', operationId),
        entityType: 'EQUIPMENT',
        entityId: equipmentId,
        oldValueJson: JSON.stringify(oldRecord),
        newValueJson: JSON.stringify({ operationId: operationId, result: result, equipment: nextRecord }),
      })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      compensateOrThrow_(error, function () { writeEquipmentRow_(located.rowNumber, oldRecord) })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function equipmentDelete(request) {
  const actor = requireActor_()
  assertEquipmentAdmin_(actor)
  assertEquipmentRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const equipmentId = String(request.equipmentId || '').trim()
  const expectedUpdatedAt = String(request.expectedUpdatedAt || '').trim()
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!equipmentId) throw new Error('EQUIPMENT_ID_REQUIRED')
  if (!expectedUpdatedAt) throw new Error('EXPECTED_UPDATED_AT_REQUIRED')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const previous = findOperationResult_('DELETE_EQUIPMENT', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }

    const located = findEquipmentRow_(equipmentId)
    if (!located) throw new Error('EQUIPMENT_NOT_FOUND')
    assertEquipmentVersion_(located.record, expectedUpdatedAt)
    const references = findEquipmentReferences_(equipmentId)
    if (references.length) throw new Error('EQUIPMENT_HAS_HISTORY:' + references.join(','))

    const oldRecord = located.record
    deleteRecordRow_('Equipment_Master', located.rowNumber)
    try {
      const auditId = Utilities.getUuid()
      const result = { equipmentId: equipmentId, deleted: true, auditId: auditId }
      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('DELETE_EQUIPMENT', operationId),
        entityType: 'EQUIPMENT',
        entityId: equipmentId,
        oldValueJson: JSON.stringify(oldRecord),
        newValueJson: JSON.stringify({ operationId: operationId, result: result }),
      })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      compensateOrThrow_(error, function () { appendRecord_('Equipment_Master', oldRecord) })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function assertEquipmentRequest_(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('EQUIPMENT_REQUEST_REQUIRED')
  if (String(request.contractVersion || '') !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')
}

function assertEquipmentAdmin_(actor) {
  if (!actor || actor.role !== 'ADMIN') throw new Error('ROLE_NOT_ALLOWED')
}

function normalizeEquipmentId_(value) {
  const text = String(value || '').trim()
  if (!text) throw new Error('EQUIPMENT_ID_REQUIRED')
  if (text.length > 80 || /[\u0000-\u001F\u007F]/.test(text)) throw new Error('EQUIPMENT_ID_INVALID')
  return text
}

function findEquipmentRow_(equipmentId) {
  const sheet = getSheet_('Equipment_Master')
  const headers = getHeaders_(sheet)
  const idIndex = headers.indexOf('equipmentId')
  if (idIndex === -1) throw new Error('EQUIPMENT_ID_HEADER_REQUIRED')
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null
  const match = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).createTextFinder(String(equipmentId)).matchEntireCell(true).findNext()
  if (!match) return null
  const values = sheet.getRange(match.getRow(), 1, 1, headers.length).getDisplayValues()[0]
  const record = headers.reduce(function (result, header, index) { result[header] = values[index] === '' ? null : values[index]; return result }, {})
  return { rowNumber: match.getRow(), record: record }
}

function writeEquipmentRow_(rowNumber, record) {
  const sheet = getSheet_('Equipment_Master')
  const headers = getHeaders_(sheet)
  const row = headers.map(function (header) { const value = record[header]; return value === undefined || value === null ? '' : value })
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row])
}

function findEquipmentReferences_(equipmentId) {
  return APP_CONFIG.allowedTables.filter(function (table) {
    if (table === 'Equipment_Master' || table === 'Audit_Log') return false
    const sheet = getSheet_(table)
    const headers = getHeaders_(sheet)
    const equipmentIdIndex = headers.indexOf('equipmentId')
    if (equipmentIdIndex === -1 || sheet.getLastRow() < 2) return false
    return Boolean(sheet.getRange(2, equipmentIdIndex + 1, sheet.getLastRow() - 1, 1).createTextFinder(String(equipmentId)).matchEntireCell(true).findNext())
  })
}

function assertEquipmentVersion_(record, expectedUpdatedAt) {
  const actual = String(record.updatedAt || '').trim()
  if (!actual) throw new Error('EQUIPMENT_UPDATED_AT_REQUIRED')
  if (actual !== expectedUpdatedAt) throw new Error('EQUIPMENT_VERSION_CONFLICT')
}

function normalizeEquipmentFields_(input) {
  const result = {}
  const source = input || {}
  Object.keys(source).forEach(function (key) {
    if (key === 'equipmentId') return
    if (EQUIPMENT_MUTABLE_FIELDS.indexOf(key) === -1) {
      if (['status', 'active', 'qrCode', 'updatedAt'].indexOf(key) === -1) throw new Error('EQUIPMENT_FIELD_NOT_ALLOWED:' + key)
      return
    }
    const value = source[key]
    if (key === 'equipmentName') { result[key] = requiredEquipmentText_(value, 'EQUIPMENT_NAME_REQUIRED'); return }
    if (key === 'equipmentType') { result[key] = normalizeEquipmentEnum_(value, EQUIPMENT_TYPES, 'EQUIPMENT_TYPE_INVALID'); return }
    if (key === 'criticality') {
      const text = String(value || '').trim().toUpperCase()
      result[key] = text ? normalizeEquipmentEnum_(text, EQUIPMENT_CRITICALITIES, 'EQUIPMENT_CRITICALITY_INVALID') : ''
      return
    }
    if (key === 'productionYear') {
      if (value === '' || value === null || value === undefined) { result[key] = ''; return }
      const year = Number(value)
      if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error('EQUIPMENT_PRODUCTION_YEAR_INVALID')
      result[key] = year; return
    }
    if (key === 'maintenanceCycleMonths') {
      if (value === '' || value === null || value === undefined) { result[key] = ''; return }
      const months = Number(value)
      if (!Number.isInteger(months) || months <= 0) throw new Error('EQUIPMENT_MAINTENANCE_CYCLE_INVALID')
      result[key] = months; return
    }
    if (key === 'purchaseDate' || key === 'commissionDate') {
      const dateText = String(value || '').trim()
      if (dateText && !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error('EQUIPMENT_DATE_INVALID:' + key)
      result[key] = dateText; return
    }
    if (key === 'imageUrl' || key === 'manualUrl' || key === 'setupDocumentUrl') {
      const url = String(value || '').trim()
      if (url && !/^https:\/\//i.test(url)) throw new Error('EQUIPMENT_URL_INVALID:' + key)
      result[key] = url; return
    }
    result[key] = String(value === null || value === undefined ? '' : value).trim()
  })
  return result
}

function requiredEquipmentText_(value, errorCode) {
  const text = String(value || '').trim()
  if (!text) throw new Error(errorCode)
  return text
}

function normalizeEquipmentEnum_(value, allowed, errorCode) {
  const text = String(value || '').trim().toUpperCase()
  if (allowed.indexOf(text) === -1) throw new Error(errorCode)
  return text
}
