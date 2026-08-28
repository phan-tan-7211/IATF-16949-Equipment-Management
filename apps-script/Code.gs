const APP_CONFIG = Object.freeze({
  contractVersion: 'G1-frozen-2026-08-28',
  spreadsheetId: '1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE',
  projectFolderId: '1hxow8p4gir4KRJZUMhEntsrazjAqfVGI',
  allowedTables: [
    'Equipment_Master',
    'Daily_Inspection',
    'Daily_Inspection_Item',
    'Maintenance_Plan',
    'Maintenance_Plan_Item',
    'Maintenance_Work_Order',
    'Maintenance_Execution',
    'Maintenance_Result_Item',
    'Maintenance_Log',
    'Equipment_Handover',
    'Downtime_Event',
    'Tooling_Master',
    'Tooling_Maintenance_Plan',
    'Tooling_Modification',
    'Calibration_Master',
    'Calibration_Log',
    'Calibration_Vendor_Quote',
    'Calibration_Quote_Summary',
    'Equipment_Movement_Log',
    'Audit_Log',
  ],
})

const WRITE_ROLE_POLICY = Object.freeze({
  Maintenance_Work_Order: ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  Maintenance_Execution: ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  Maintenance_Result_Item: ['MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN'],
  Maintenance_Log: ['MAINTENANCE', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  Equipment_Handover: ['SUPERVISOR', 'MANAGER', 'ADMIN'],
  Audit_Log: ['ADMIN'],
})

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health')

    if (action === 'health') {
      return json_({
        ok: true,
        provider: 'GOOGLE_APPS_SCRIPT',
        boundary: 'APPS_SCRIPT_WEB_APP',
        contractVersion: APP_CONFIG.contractVersion,
        authenticated: Boolean(getActiveUserEmail_()),
      })
    }

    if (action === 'readTable') {
      const actor = requireActor_()
      const table = String(e.parameter.table || '')
      assertAllowedTable_(table)
      return json_({ ok: true, table: table, rows: readTable_(table), actor: actor.email })
    }

    return json_({ ok: false, error: 'UNKNOWN_ACTION' })
  } catch (error) {
    return errorJson_(error)
  }
}

function doPost(e) {
  try {
    const actor = requireActor_()
    const body = parseJsonBody_(e)

    if (body.contractVersion !== APP_CONFIG.contractVersion) {
      throw new Error('CONTRACT_VERSION_MISMATCH')
    }

    if (body.action === 'appendRecord') {
      return json_(executeAppendRecord_(body, actor))
    }

    if (body.action === 'maintenanceTransition') {
      return json_(executeMaintenanceTransition_(body, actor))
    }

    throw new Error('UNKNOWN_ACTION')
  } catch (error) {
    return errorJson_(error)
  }
}

function executeAppendRecord_(body, actor) {
  const table = String(body.table || '')
  const operationId = String(body.operationId || '')
  const entityType = String(body.entityType || '')
  const entityId = String(body.entityId || '')
  const record = body.record

  assertAllowedTable_(table)
  assertWriteRole_(table, actor.role)

  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!entityType) throw new Error('ENTITY_TYPE_REQUIRED')
  if (!entityId) throw new Error('ENTITY_ID_REQUIRED')
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('RECORD_REQUIRED')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('APPEND_RECORD', operationId)
    if (previous) {
      return { ok: true, duplicate: true, operationId: operationId, result: previous }
    }

    const appended = appendRecord_(table, record)
    const auditId = Utilities.getUuid()
    const result = {
      table: table,
      rowNumber: appended.rowNumber,
      auditId: auditId,
    }

    appendAudit_({
      auditId: auditId,
      userId: actor.email,
      action: operationAuditAction_('APPEND_RECORD', operationId),
      entityType: entityType,
      entityId: entityId,
      newValueJson: JSON.stringify({
        operationId: operationId,
        result: result,
        record: record,
      }),
    })

    return { ok: true, duplicate: false, operationId: operationId, result: result }
  } finally {
    lock.releaseLock()
  }
}

function readTable_(table) {
  const sheet = getSheet_(table)
  const values = sheet.getDataRange().getDisplayValues()
  if (!values.length) return []

  const headers = values[0]
  return values.slice(1).filter(function (row) {
    return row.some(function (value) { return value !== '' })
  }).map(function (row) {
    return headers.reduce(function (record, header, index) {
      record[header] = row[index] === '' ? null : row[index]
      return record
    }, {})
  })
}

function appendRecord_(table, record) {
  if (table === 'Audit_Log') throw new Error('AUDIT_LOG_DIRECT_WRITE_FORBIDDEN')

  const sheet = getSheet_(table)
  const headers = getHeaders_(sheet)
  const unknownKeys = Object.keys(record).filter(function (key) { return headers.indexOf(key) === -1 })
  if (unknownKeys.length) throw new Error('UNKNOWN_FIELDS:' + unknownKeys.join(','))

  const row = headers.map(function (header) {
    const value = record[header]
    return value === undefined || value === null ? '' : value
  })
  sheet.appendRow(row)
  return { rowNumber: sheet.getLastRow() }
}

function appendAudit_(input) {
  const sheet = getSheet_('Audit_Log')
  const headers = getHeaders_(sheet)
  const auditId = input.auditId || Utilities.getUuid()
  const record = {
    auditId: auditId,
    timestamp: new Date().toISOString(),
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    oldValueJson: input.oldValueJson || '',
    newValueJson: input.newValueJson || '',
  }

  const row = headers.map(function (header) {
    return record[header] === undefined ? '' : record[header]
  })
  sheet.appendRow(row)
  return { auditId: auditId, rowNumber: sheet.getLastRow() }
}

function getSheet_(table) {
  assertAllowedTable_(table)
  const spreadsheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId)
  const sheet = spreadsheet.getSheetByName(table)
  if (!sheet) throw new Error('TABLE_NOT_FOUND:' + table)
  return sheet
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn()
  if (lastColumn < 1) throw new Error('HEADER_ROW_REQUIRED')
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
  if (headers.some(function (header) { return !header })) throw new Error('BLANK_HEADER_NOT_ALLOWED')
  return headers
}

function assertAllowedTable_(table) {
  if (APP_CONFIG.allowedTables.indexOf(table) === -1) throw new Error('TABLE_NOT_ALLOWED')
}

function assertWriteRole_(table, role) {
  const allowed = WRITE_ROLE_POLICY[table] || ['SUPERVISOR', 'QUALITY', 'MANAGER', 'ADMIN']
  if (allowed.indexOf(role) === -1) throw new Error('ROLE_NOT_ALLOWED')
}

function requireActor_() {
  const email = getActiveUserEmail_()
  if (!email) throw new Error('AUTHENTICATION_REQUIRED')

  const roleMapRaw = PropertiesService.getScriptProperties().getProperty('RBAC_JSON') || '{}'
  const roleMap = JSON.parse(roleMapRaw)
  const role = String(roleMap[email] || '')
  if (!role) throw new Error('ROLE_NOT_CONFIGURED')

  return { email: email, role: role }
}

function getActiveUserEmail_() {
  return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase()
}

function operationAuditAction_(kind, operationId) {
  return kind + ':' + operationId
}

function findOperationResult_(kind, operationId) {
  const sheet = getSheet_('Audit_Log')
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null

  const headers = getHeaders_(sheet)
  const actionColumn = headers.indexOf('action') + 1
  const valueColumn = headers.indexOf('newValueJson') + 1
  if (!actionColumn || !valueColumn) throw new Error('AUDIT_HEADERS_REQUIRED')

  const match = sheet
    .getRange(2, actionColumn, lastRow - 1, 1)
    .createTextFinder(operationAuditAction_(kind, operationId))
    .matchEntireCell(true)
    .findNext()

  if (!match) return null

  const raw = sheet.getRange(match.getRow(), valueColumn).getDisplayValue()
  if (!raw) return null

  const payload = JSON.parse(raw)
  if (payload.operationId !== operationId || !payload.result) return null
  return payload.result
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('JSON_BODY_REQUIRED')
  return JSON.parse(e.postData.contents)
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON)
}

function errorJson_(error) {
  const message = error && error.message ? error.message : String(error)
  return json_({ ok: false, error: message })
}
