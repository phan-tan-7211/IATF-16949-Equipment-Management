function calibrationLinkMaster(request) {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('ROLE_NOT_ALLOWED')
  assertCalibrationRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const calibrationEquipmentId = String(request.calibrationEquipmentId || '').trim()
  const equipmentId = String(request.equipmentId || '').trim()
  const expectedCurrentEquipmentId = String(request.expectedCurrentEquipmentId || '').trim()

  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!calibrationEquipmentId) throw new Error('CALIBRATION_EQUIPMENT_ID_REQUIRED')
  if (!equipmentId) throw new Error('EQUIPMENT_ID_REQUIRED')

  const equipment = findEquipmentRow_(equipmentId)
  if (!equipment) throw new Error('EQUIPMENT_NOT_FOUND')
  if (String(equipment.record.equipmentType || '') !== 'MEASUREMENT') throw new Error('CALIBRATION_MEASUREMENT_EQUIPMENT_REQUIRED')
  if (String(equipment.record.status || '') === 'DISPOSED') throw new Error('CALIBRATION_DISPOSED_EQUIPMENT')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('LINK_CALIBRATION_MASTER', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }

    const located = findCalibrationMasterRow_(calibrationEquipmentId)
    if (!located) throw new Error('CALIBRATION_MASTER_NOT_FOUND')

    const currentEquipmentId = String(located.record.equipmentId || '').trim()
    if (currentEquipmentId !== expectedCurrentEquipmentId) throw new Error('CALIBRATION_LINK_VERSION_CONFLICT')
    if (currentEquipmentId && currentEquipmentId !== equipmentId) throw new Error('CALIBRATION_MASTER_ALREADY_LINKED')
    if (currentEquipmentId === equipmentId) {
      const resultAlready = {
        calibrationEquipmentId: calibrationEquipmentId,
        equipmentId: equipmentId,
        linked: true,
        unchanged: true,
      }
      return { ok: true, duplicate: false, operationId: operationId, result: resultAlready }
    }

    const oldRecord = located.record
    const nextRecord = Object.assign({}, oldRecord, { equipmentId: equipmentId })
    writeCalibrationMasterRow_(located.rowNumber, nextRecord)

    try {
      const auditId = Utilities.getUuid()
      const result = {
        calibrationEquipmentId: calibrationEquipmentId,
        equipmentId: equipmentId,
        linked: true,
        auditId: auditId,
      }
      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('LINK_CALIBRATION_MASTER', operationId),
        entityType: 'CALIBRATION_MASTER',
        entityId: calibrationEquipmentId,
        oldValueJson: JSON.stringify(oldRecord),
        newValueJson: JSON.stringify({ operationId: operationId, result: result, calibrationMaster: nextRecord }),
      })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      compensateOrThrow_(error, function () {
        writeCalibrationMasterRow_(located.rowNumber, oldRecord)
      })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function calibrationUnlinkMaster(request) {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('ROLE_NOT_ALLOWED')
  assertCalibrationRequest_(request)

  const operationId = String(request.operationId || '').trim()
  const calibrationEquipmentId = String(request.calibrationEquipmentId || '').trim()
  const expectedEquipmentId = String(request.expectedEquipmentId || '').trim()

  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!calibrationEquipmentId) throw new Error('CALIBRATION_EQUIPMENT_ID_REQUIRED')
  if (!expectedEquipmentId) throw new Error('EXPECTED_EQUIPMENT_ID_REQUIRED')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('UNLINK_CALIBRATION_MASTER', operationId)
    if (previous) return { ok: true, duplicate: true, operationId: operationId, result: previous }

    const located = findCalibrationMasterRow_(calibrationEquipmentId)
    if (!located) throw new Error('CALIBRATION_MASTER_NOT_FOUND')
    const currentEquipmentId = String(located.record.equipmentId || '').trim()
    if (currentEquipmentId !== expectedEquipmentId) throw new Error('CALIBRATION_LINK_VERSION_CONFLICT')
    if (!currentEquipmentId) throw new Error('CALIBRATION_MASTER_NOT_LINKED')

    if (calibrationHistoryExists_(currentEquipmentId)) throw new Error('CALIBRATION_LINK_HAS_HISTORY')

    const oldRecord = located.record
    const nextRecord = Object.assign({}, oldRecord, { equipmentId: '' })
    writeCalibrationMasterRow_(located.rowNumber, nextRecord)

    try {
      const auditId = Utilities.getUuid()
      const result = {
        calibrationEquipmentId: calibrationEquipmentId,
        equipmentId: currentEquipmentId,
        linked: false,
        auditId: auditId,
      }
      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('UNLINK_CALIBRATION_MASTER', operationId),
        entityType: 'CALIBRATION_MASTER',
        entityId: calibrationEquipmentId,
        oldValueJson: JSON.stringify(oldRecord),
        newValueJson: JSON.stringify({ operationId: operationId, result: result, calibrationMaster: nextRecord }),
      })
      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      compensateOrThrow_(error, function () {
        writeCalibrationMasterRow_(located.rowNumber, oldRecord)
      })
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function findCalibrationMasterRow_(calibrationEquipmentId) {
  const sheet = getSheet_('Calibration_Master')
  const headers = getHeaders_(sheet)
  const idIndex = headers.indexOf('calibrationEquipmentId')
  if (idIndex === -1) throw new Error('CALIBRATION_EQUIPMENT_ID_HEADER_REQUIRED')
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null

  const match = sheet
    .getRange(2, idIndex + 1, lastRow - 1, 1)
    .createTextFinder(String(calibrationEquipmentId))
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

function writeCalibrationMasterRow_(rowNumber, record) {
  const sheet = getSheet_('Calibration_Master')
  const headers = getHeaders_(sheet)
  const row = headers.map(function (header) {
    const value = record[header]
    return value === undefined || value === null ? '' : value
  })
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row])
}

function calibrationHistoryExists_(equipmentId) {
  const sheet = getSheet_('Calibration_Log')
  const headers = getHeaders_(sheet)
  const equipmentIndex = headers.indexOf('equipmentId')
  if (equipmentIndex === -1 || sheet.getLastRow() < 2) return false
  return Boolean(
    sheet
      .getRange(2, equipmentIndex + 1, sheet.getLastRow() - 1, 1)
      .createTextFinder(String(equipmentId))
      .matchEntireCell(true)
      .findNext(),
  )
}
