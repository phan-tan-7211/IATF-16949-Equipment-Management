const CALIBRATION_EVALUATION_RESULTS = Object.freeze(['PASS', 'FAIL', 'LIMITED_USE'])

function calibrationEvaluate(request) {
  const actor = requireActor_()
  assertCalibrationRole_(actor)
  assertCalibrationRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const calibrationId = String(request.calibrationId || '').trim()
  const evaluationResult = String(request.evaluationResult || '').trim().toUpperCase()
  const evaluationNote = String(request.evaluationNote || '').trim()

  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!calibrationId) throw new Error('CALIBRATION_ID_REQUIRED')
  if (CALIBRATION_EVALUATION_RESULTS.indexOf(evaluationResult) === -1) throw new Error('CALIBRATION_EVALUATION_RESULT_INVALID')
  if (evaluationResult !== 'PASS' && !evaluationNote) throw new Error('CALIBRATION_EVALUATION_NOTE_REQUIRED')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('EVALUATE_CALIBRATION', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }

    const calibration = findCalibrationLogById_(calibrationId)
    if (!calibration) throw new Error('CALIBRATION_LOG_NOT_FOUND')
    if (findCalibrationEvaluation_(calibrationId)) throw new Error('CALIBRATION_ALREADY_EVALUATED')

    const evaluatedAt = new Date().toISOString()
    const auditId = Utilities.getUuid()
    const result = {
      calibrationId: calibrationId,
      equipmentId: calibration.record.equipmentId,
      calibrationResult: calibration.record.result,
      evaluationResult: evaluationResult,
      evaluationNote: evaluationNote,
      evaluatedBy: actor.email,
      evaluatedAt: evaluatedAt,
      auditId: auditId,
    }

    appendAudit_({
      auditId: auditId,
      userId: actor.email,
      action: operationAuditAction_('EVALUATE_CALIBRATION', operationId),
      entityType: 'CALIBRATION',
      entityId: calibrationId,
      oldValueJson: JSON.stringify({
        evaluationStatus: 'PENDING',
        calibration: calibration.record,
      }),
      newValueJson: JSON.stringify({
        operationId: operationId,
        result: result,
        evaluationStatus: 'EVALUATED',
      }),
    })

    return { ok: true, duplicate: false, operationId: operationId, result: result }
  } finally {
    lock.releaseLock()
  }
}

function findCalibrationLogById_(calibrationId) {
  const sheet = getSheet_('Calibration_Log')
  const headers = getHeaders_(sheet)
  const idIndex = headers.indexOf('calibrationId')
  if (idIndex === -1) throw new Error('CALIBRATION_ID_HEADER_REQUIRED')
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null

  const match = sheet
    .getRange(2, idIndex + 1, lastRow - 1, 1)
    .createTextFinder(String(calibrationId))
    .matchEntireCell(true)
    .findNext()
  if (!match) return null

  const values = sheet.getRange(match.getRow(), 1, 1, headers.length).getDisplayValues()[0]
  const record = headers.reduce(function (result, header, index) {
    result[header] = values[index] === '' ? null : values[index]
    return result
  }, {})
  return { rowNumber: match.getRow(), record: record }
}

function findCalibrationEvaluation_(calibrationId) {
  const rows = readTable_('Audit_Log')
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (String(row.entityType || '') !== 'CALIBRATION') continue
    if (String(row.entityId || '') !== calibrationId) continue
    if (String(row.action || '').indexOf('EVALUATE_CALIBRATION:') !== 0) continue
    try {
      const payload = JSON.parse(String(row.newValueJson || '{}'))
      return payload.result || payload
    } catch (error) {
      throw new Error('CALIBRATION_EVALUATION_AUDIT_INVALID')
    }
  }
  return null
}
