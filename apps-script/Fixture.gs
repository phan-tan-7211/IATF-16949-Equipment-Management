const FIXTURE_CONFIG = Object.freeze({
  spreadsheetProperty: 'TEST_SPREADSHEET_ID',
  dataTable: 'Maintenance_Log',
  auditTable: 'Audit_Log',
})

function fixtureIdempotencySmoke() {
  const actor = requireActor_()
  if (actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')

  const spreadsheetId = String(
    PropertiesService.getScriptProperties().getProperty(FIXTURE_CONFIG.spreadsheetProperty) || ''
  ).trim()
  if (!spreadsheetId) throw new Error('TEST_SPREADSHEET_ID_NOT_CONFIGURED')
  if (spreadsheetId === APP_CONFIG.spreadsheetId) throw new Error('FIXTURE_MUST_NOT_USE_PRODUCTION_SPREADSHEET')

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId)
  const dataSheet = requireFixtureSheet_(spreadsheet, FIXTURE_CONFIG.dataTable)
  const auditSheet = requireFixtureSheet_(spreadsheet, FIXTURE_CONFIG.auditTable)
  assertFixtureHeaders_(dataSheet, [
    'maintenanceId', 'equipmentId', 'workOrderId', 'executionId', 'maintenanceType',
    'reportedAt', 'repairStartedAt', 'completedAt', 'issueDescription', 'failureCategory',
    'rootCause', 'correctiveAction', 'replacedPart', 'performedBy', 'status',
    'downtimeMinutes', 'createdBy',
  ])
  assertFixtureHeaders_(auditSheet, [
    'auditId', 'timestamp', 'userId', 'action', 'entityType', 'entityId',
    'oldValueJson', 'newValueJson',
  ])

  const operationId = 'fixture-' + Utilities.getUuid()
  const fixtureId = 'FX-MNT-' + Utilities.getUuid()
  const now = new Date().toISOString()
  const record = {
    maintenanceId: fixtureId,
    equipmentId: 'FIXTURE-EQUIPMENT',
    workOrderId: '',
    executionId: '',
    maintenanceType: 'CM',
    reportedAt: now,
    repairStartedAt: '',
    completedAt: '',
    issueDescription: 'Isolated idempotency smoke test',
    failureCategory: 'FIXTURE',
    rootCause: '',
    correctiveAction: '',
    replacedPart: '',
    performedBy: actor.email,
    status: 'OPEN',
    downtimeMinutes: 0,
    createdBy: actor.email,
  }

  const before = fixtureCounts_(dataSheet, auditSheet)
  const first = fixtureAppendOnce_(dataSheet, auditSheet, operationId, fixtureId, record, actor)
  const afterFirst = fixtureCounts_(dataSheet, auditSheet)
  const second = fixtureAppendOnce_(dataSheet, auditSheet, operationId, fixtureId, record, actor)
  const afterSecond = fixtureCounts_(dataSheet, auditSheet)

  const passed =
    first.ok === true && first.duplicate === false &&
    second.ok === true && second.duplicate === true &&
    afterFirst.dataRows === before.dataRows + 1 &&
    afterFirst.auditRows === before.auditRows + 1 &&
    afterSecond.dataRows === afterFirst.dataRows &&
    afterSecond.auditRows === afterFirst.auditRows

  if (!passed) throw new Error('FIXTURE_IDEMPOTENCY_ASSERTION_FAILED')

  return {
    phase: 'fixture-idempotency',
    ok: true,
    operationId: operationId,
    first: first,
    second: second,
    counts: {
      before: before,
      afterFirst: afterFirst,
      afterSecond: afterSecond,
    },
  }
}

function fixtureAppendOnce_(dataSheet, auditSheet, operationId, fixtureId, record, actor) {
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = fixtureFindOperationResult_(auditSheet, operationId)
    if (previous) {
      return { ok: true, duplicate: true, operationId: operationId, result: previous }
    }

    let appendedRow = null
    try {
      appendedRow = fixtureAppendRecord_(dataSheet, record)
      const auditId = Utilities.getUuid()
      const result = {
        table: FIXTURE_CONFIG.dataTable,
        rowNumber: appendedRow,
        auditId: auditId,
      }

      fixtureAppendAudit_(auditSheet, {
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('APPEND_RECORD', operationId),
        entityType: 'Maintenance_Log',
        entityId: fixtureId,
        newValueJson: JSON.stringify({
          operationId: operationId,
          result: result,
          record: record,
        }),
      })

      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      if (appendedRow) {
        compensateOrThrow_(error, function () {
          dataSheet.deleteRow(appendedRow)
        })
      }
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function fixtureAppendRecord_(sheet, record) {
  const headers = getHeaders_(sheet)
  const unknownKeys = Object.keys(record).filter(function (key) { return headers.indexOf(key) === -1 })
  if (unknownKeys.length) throw new Error('FIXTURE_UNKNOWN_FIELDS:' + unknownKeys.join(','))

  sheet.appendRow(headers.map(function (header) {
    const value = record[header]
    return value === undefined || value === null ? '' : value
  }))
  return sheet.getLastRow()
}

function fixtureAppendAudit_(sheet, input) {
  const headers = getHeaders_(sheet)
  const record = {
    auditId: input.auditId,
    timestamp: new Date().toISOString(),
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    oldValueJson: input.oldValueJson || '',
    newValueJson: input.newValueJson || '',
  }
  sheet.appendRow(headers.map(function (header) {
    return record[header] === undefined ? '' : record[header]
  }))
}

function fixtureFindOperationResult_(auditSheet, operationId) {
  const lastRow = auditSheet.getLastRow()
  if (lastRow < 2) return null

  const headers = getHeaders_(auditSheet)
  const actionColumn = headers.indexOf('action') + 1
  const valueColumn = headers.indexOf('newValueJson') + 1
  if (!actionColumn || !valueColumn) throw new Error('FIXTURE_AUDIT_HEADERS_REQUIRED')

  const match = auditSheet
    .getRange(2, actionColumn, lastRow - 1, 1)
    .createTextFinder(operationAuditAction_('APPEND_RECORD', operationId))
    .matchEntireCell(true)
    .findNext()
  if (!match) return null

  const raw = auditSheet.getRange(match.getRow(), valueColumn).getDisplayValue()
  if (!raw) return null
  const payload = JSON.parse(raw)
  return payload.operationId === operationId && payload.result ? payload.result : null
}

function fixtureCounts_(dataSheet, auditSheet) {
  return {
    dataRows: Math.max(0, dataSheet.getLastRow() - 1),
    auditRows: Math.max(0, auditSheet.getLastRow() - 1),
  }
}

function requireFixtureSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name)
  if (!sheet) throw new Error('FIXTURE_TABLE_NOT_FOUND:' + name)
  return sheet
}

function assertFixtureHeaders_(sheet, expected) {
  const actual = getHeaders_(sheet)
  if (actual.length !== expected.length) throw new Error('FIXTURE_HEADER_COUNT_MISMATCH:' + sheet.getName())
  expected.forEach(function (header, index) {
    if (actual[index] !== header) throw new Error('FIXTURE_HEADER_MISMATCH:' + sheet.getName() + ':' + header)
  })
}
