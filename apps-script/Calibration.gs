const CALIBRATION_RESULTS = Object.freeze(['PASS', 'FAIL', 'LIMITED_USE'])
const CALIBRATION_WRITE_ROLES = Object.freeze(['QUALITY', 'MANAGER', 'ADMIN'])

function calibrationSubmit(request) {
  const actor = requireActor_()
  assertCalibrationRole_(actor)
  assertCalibrationRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('CALIBRATION_INPUT_REQUIRED')

  const equipmentId = String(input.equipmentId || '').trim()
  const calibrationDate = normalizeCalibrationDate_(input.calibrationDate, 'CALIBRATION_DATE_REQUIRED')
  const nextDueDate = normalizeCalibrationDate_(input.nextDueDate, 'NEXT_DUE_DATE_REQUIRED')
  const result = String(input.result || '').trim().toUpperCase()

  if (!equipmentId) throw new Error('EQUIPMENT_ID_REQUIRED')
  if (CALIBRATION_RESULTS.indexOf(result) === -1) throw new Error('CALIBRATION_RESULT_INVALID')
  if (nextDueDate < calibrationDate) throw new Error('NEXT_DUE_DATE_BEFORE_CALIBRATION_DATE')

  const equipment = findEquipmentRow_(equipmentId)
  if (!equipment) throw new Error('EQUIPMENT_NOT_FOUND')
  if (String(equipment.record.equipmentType || '') !== 'MEASUREMENT') throw new Error('CALIBRATION_MEASUREMENT_EQUIPMENT_REQUIRED')
  if (String(equipment.record.status || '') === 'DISPOSED') throw new Error('CALIBRATION_DISPOSED_EQUIPMENT')
  if (!equipmentActive_(equipment.record.active)) throw new Error('CALIBRATION_INACTIVE_EQUIPMENT')

  const master = findCalibrationMasterByEquipment_(equipmentId)
  if (!master) throw new Error('CALIBRATION_MASTER_LINK_REQUIRED')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('CREATE_CALIBRATION_LOG', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }

    const calibrationId = 'CALLOG-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase()
    const now = new Date().toISOString()
    const record = {
      calibrationId: calibrationId,
      equipmentId: equipmentId,
      calibrationDate: calibrationDate,
      nextDueDate: nextDueDate,
      certificateNumber: String(input.certificateNumber || '').trim(),
      calibrationProvider: String(input.calibrationProvider || '').trim(),
      result: result,
      certificateUrl: normalizeCalibrationUrl_(input.certificateUrl, 'CERTIFICATE_URL_INVALID'),
      labelPhotoUrl: normalizeCalibrationUrl_(input.labelPhotoUrl, 'LABEL_PHOTO_URL_INVALID'),
      createdBy: actor.email,
      createdAt: now,
    }

    let appended = null
    try {
      appended = appendRecord_('Calibration_Log', record)
      const auditId = Utilities.getUuid()
      const resultPayload = {
        calibrationId: calibrationId,
        equipmentId: equipmentId,
        result: result,
        calibrationDate: calibrationDate,
        nextDueDate: nextDueDate,
        rowNumber: appended.rowNumber,
        auditId: auditId,
      }

      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('CREATE_CALIBRATION_LOG', operationId),
        entityType: 'CALIBRATION',
        entityId: calibrationId,
        newValueJson: JSON.stringify({
          operationId: operationId,
          result: resultPayload,
          calibration: record,
          equipment: {
            equipmentId: equipmentId,
            equipmentName: equipment.record.equipmentName,
            equipmentType: equipment.record.equipmentType,
          },
          calibrationMasterRow: master.rowNumber,
        }),
      })

      return { ok: true, duplicate: false, operationId: operationId, result: resultPayload }
    } catch (error) {
      if (appended) {
        compensateOrThrow_(error, function () {
          deleteRecordRow_('Calibration_Log', appended.rowNumber)
        })
      }
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function assertCalibrationRole_(actor) {
  if (!actor || CALIBRATION_WRITE_ROLES.indexOf(actor.role) === -1) throw new Error('ROLE_NOT_ALLOWED')
}

function assertCalibrationRequest_(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('CALIBRATION_REQUEST_REQUIRED')
  if (String(request.contractVersion || '') !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')
}

function normalizeCalibrationDate_(value, errorCode) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(errorCode)
  return text
}

function normalizeCalibrationUrl_(value, errorCode) {
  const text = String(value || '').trim()
  if (text && !/^https:\/\//i.test(text)) throw new Error(errorCode)
  return text
}

function equipmentActive_(value) {
  if (value === true) return true
  const text = String(value === undefined || value === null ? '' : value).trim().toUpperCase()
  return text === 'TRUE' || text === '1' || text === 'YES' || text === 'Y'
}

function findCalibrationMasterByEquipment_(equipmentId) {
  const sheet = getSheet_('Calibration_Master')
  const headers = getHeaders_(sheet)
  const equipmentIndex = headers.indexOf('equipmentId')
  if (equipmentIndex === -1) throw new Error('CALIBRATION_MASTER_EQUIPMENT_ID_HEADER_REQUIRED')
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null

  const match = sheet
    .getRange(2, equipmentIndex + 1, lastRow - 1, 1)
    .createTextFinder(String(equipmentId))
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
