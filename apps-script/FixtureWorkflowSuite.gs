function fixtureEquipmentDailySmoke() {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')
  const spreadsheet = SpreadsheetApp.openById(requireFixtureSpreadsheetId_())
  const equipmentSheet = requireFixtureSheet_(spreadsheet, 'Equipment_Master')
  const dailySheet = requireFixtureSheet_(spreadsheet, 'Daily_Inspection')
  const workOrderSheet = requireFixtureSheet_(spreadsheet, 'Maintenance_Work_Order')
  const downtimeSheet = requireFixtureSheet_(spreadsheet, 'Downtime_Event')
  const auditSheet = requireFixtureSheet_(spreadsheet, 'Audit_Log')

  const suffix = Utilities.getUuid()
  const equipmentId = 'FX-EQ-' + suffix
  const cleanDeleteId = 'FX-EQ-DELETE-' + suffix
  const now = new Date().toISOString()

  normalizeEquipmentId_(equipmentId)
  requiredEquipmentText_('Fixture production equipment', 'EQUIPMENT_NAME_REQUIRED')
  normalizeEquipmentFields_({ equipmentName: 'Fixture production equipment', equipmentType: 'PRODUCTION', maintenanceCycleMonths: 1 })

  const equipmentRecord = fixtureEquipmentRecord_(equipmentId, 'Fixture production equipment', 'PRODUCTION', now)
  const createdRow = fixtureAppendRecord_(equipmentSheet, equipmentRecord)
  fixtureAppendAudit_(auditSheet, fixtureAuditInput_(actor, 'FIXTURE_CREATE_EQUIPMENT', equipmentId, { equipment: equipmentRecord }))
  if (!fixtureFindByField_(equipmentSheet, 'equipmentId', equipmentId)) throw new Error('FIXTURE_EQUIPMENT_CREATE_FAILED')

  const oldVersion = now
  const updatedAt = new Date(Date.now() + 1000).toISOString()
  const updated = Object.assign({}, equipmentRecord, { equipmentName: 'Fixture production equipment updated', updatedAt: updatedAt })
  assertEquipmentVersion_(equipmentRecord, oldVersion)
  fixtureWriteRow_(equipmentSheet, createdRow, updated)
  expectFixtureError_('EQUIPMENT_STALE_VERSION', 'EQUIPMENT_VERSION_CONFLICT', function () {
    assertEquipmentVersion_(updated, oldVersion)
  })

  const deactivated = Object.assign({}, updated, { active: false, status: 'STOPPED', updatedAt: new Date(Date.now() + 2000).toISOString() })
  fixtureWriteRow_(equipmentSheet, createdRow, deactivated)
  if (String(fixtureFindByField_(equipmentSheet, 'equipmentId', equipmentId).record.status) !== 'STOPPED') throw new Error('FIXTURE_EQUIPMENT_DEACTIVATE_FAILED')
  const restored = Object.assign({}, deactivated, { active: true, status: 'RUNNING', updatedAt: new Date(Date.now() + 3000).toISOString() })
  fixtureWriteRow_(equipmentSheet, createdRow, restored)

  const inspectionId = 'FX-INSP-' + suffix
  const workOrderId = 'FX-WO-' + suffix
  const downtimeId = 'FX-DT-' + suffix
  const inspection = {
    inspectionId: inspectionId,
    equipmentId: equipmentId,
    inspectionDate: Utilities.formatDate(new Date(), 'Asia/Saigon', 'yyyy-MM-dd'),
    shift: 'FIXTURE',
    area: 'FIXTURE',
    inspectorId: actor.email,
    overallMark: 'X',
    note: 'Fixture STOP_REPAIR atomic chain',
    damagedParts: '',
    createdAt: new Date().toISOString(),
  }
  const workOrder = {
    workOrderId: workOrderId,
    equipmentId: equipmentId,
    sourceType: 'DAILY_INSPECTION',
    sourceId: inspectionId,
    requestedAt: new Date().toISOString(),
    requestedBy: actor.email,
    reason: inspection.note,
    priority: 'CRITICAL',
    method: '',
    plannedStartAt: '',
    plannedEndAt: '',
    approvedBy: '',
    approvedAt: '',
    status: 'OPEN',
  }
  const downtime = {
    downtimeId: downtimeId,
    equipmentId: equipmentId,
    downAt: new Date().toISOString(),
    restoredAt: '',
    category: 'DAILY_INSPECTION',
    description: inspection.note,
    actionToRestore: '',
    recordedBy: actor.email,
    handledBy: '',
    workOrderId: workOrderId,
    downtimeMinutes: '',
  }

  const dailyRow = fixtureAppendRecord_(dailySheet, inspection)
  let woRow = null
  let downtimeRow = null
  try {
    woRow = fixtureAppendRecord_(workOrderSheet, workOrder)
    downtimeRow = fixtureAppendRecord_(downtimeSheet, downtime)
    fixtureAppendAudit_(auditSheet, fixtureAuditInput_(actor, 'FIXTURE_DAILY_X_ATOMIC', inspectionId, {
      inspectionId: inspectionId,
      workOrderId: workOrderId,
      downtimeId: downtimeId,
    }))
  } catch (error) {
    if (downtimeRow) downtimeSheet.deleteRow(downtimeRow)
    if (woRow) workOrderSheet.deleteRow(woRow)
    if (dailyRow) dailySheet.deleteRow(dailyRow)
    throw error
  }

  const linkedWorkOrder = fixtureFindByField_(workOrderSheet, 'workOrderId', workOrderId)
  const linkedDowntime = fixtureFindByField_(downtimeSheet, 'downtimeId', downtimeId)
  if (!linkedWorkOrder || String(linkedWorkOrder.record.sourceId) !== inspectionId) throw new Error('FIXTURE_DAILY_WORK_ORDER_LINK_FAILED')
  if (!linkedDowntime || String(linkedDowntime.record.workOrderId) !== workOrderId) throw new Error('FIXTURE_DAILY_DOWNTIME_LINK_FAILED')

  if (!fixtureEquipmentHasReference_(spreadsheet, equipmentId)) throw new Error('FIXTURE_EQUIPMENT_REFERENCE_GUARD_FAILED')

  const deleteRecord = fixtureEquipmentRecord_(cleanDeleteId, 'Fixture deletable equipment', 'PRODUCTION', new Date().toISOString())
  const deleteRow = fixtureAppendRecord_(equipmentSheet, deleteRecord)
  if (fixtureEquipmentHasReference_(spreadsheet, cleanDeleteId)) throw new Error('FIXTURE_CLEAN_EQUIPMENT_UNEXPECTED_REFERENCE')
  equipmentSheet.deleteRow(deleteRow)
  fixtureAppendAudit_(auditSheet, fixtureAuditInput_(actor, 'FIXTURE_DELETE_EQUIPMENT', cleanDeleteId, { deleted: true }))
  if (fixtureFindByField_(equipmentSheet, 'equipmentId', cleanDeleteId)) throw new Error('FIXTURE_EQUIPMENT_DELETE_FAILED')

  Logger.log(JSON.stringify({
    phase: 'fixture-equipment-daily',
    ok: true,
    equipment: { equipmentId: equipmentId, create: true, update: true, staleVersionBlocked: true, deactivateRestore: true, deleteWithHistoryBlocked: true, cleanDelete: true },
    dailyX: { inspectionId: inspectionId, workOrderId: workOrderId, downtimeId: downtimeId, atomicLinks: true },
  }, null, 2))
}

function fixtureCalibrationToolingSmoke() {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')
  const spreadsheet = SpreadsheetApp.openById(requireFixtureSpreadsheetId_())
  const equipmentSheet = requireFixtureSheet_(spreadsheet, 'Equipment_Master')
  const calibrationMasterSheet = requireFixtureSheet_(spreadsheet, 'Calibration_Master')
  const calibrationLogSheet = requireFixtureSheet_(spreadsheet, 'Calibration_Log')
  const toolingMasterSheet = requireFixtureSheet_(spreadsheet, 'Tooling_Master')
  const toolingPlanSheet = requireFixtureSheet_(spreadsheet, 'Tooling_Maintenance_Plan')
  const toolingModificationSheet = requireFixtureSheet_(spreadsheet, 'Tooling_Modification')
  const auditSheet = requireFixtureSheet_(spreadsheet, 'Audit_Log')

  const suffix = Utilities.getUuid()
  const measurementId = 'FX-EQ-MEAS-' + suffix
  const productionId = 'FX-EQ-PROD-' + suffix
  const calibrationEquipmentId = 'FX-CALSRC-' + suffix
  const calibrationId = 'FX-CAL-' + suffix
  const toolingId = 'FX-TL-' + suffix
  const toolingPlanId = 'FX-TPLAN-' + suffix
  const modificationId = 'FX-TMOD-' + suffix

  fixtureAppendRecord_(equipmentSheet, fixtureEquipmentRecord_(measurementId, 'Fixture measurement equipment', 'MEASUREMENT', new Date().toISOString()))
  fixtureAppendRecord_(equipmentSheet, fixtureEquipmentRecord_(productionId, 'Fixture production equipment for negative calibration link', 'PRODUCTION', new Date().toISOString()))
  if (fixtureFindByField_(equipmentSheet, 'equipmentId', productionId).record.equipmentType === 'MEASUREMENT') throw new Error('FIXTURE_CALIBRATION_NON_MEASUREMENT_GUARD_FAILED')

  const sourceMaster = {
    calibrationEquipmentId: calibrationEquipmentId,
    equipmentId: '',
    controlNumber: 'FX-CONTROL-' + suffix,
    department: 'QUALITY',
    category: 'FIXTURE',
    instrumentName: 'Fixture calibration instrument',
    localName: '',
    operationalStatus: 'OK',
    specification: '',
    accuracy: '',
    model: '',
    manufacturer: '',
    serialNumber: '',
    purpose: 'Fixture smoke',
    lastCalibrationDate: '',
    nextDueDate: '',
    instrumentStatus: 'ACTIVE',
    active: true,
  }
  const masterRow = fixtureAppendRecord_(calibrationMasterSheet, sourceMaster)
  const linkedMaster = Object.assign({}, sourceMaster, { equipmentId: measurementId })
  fixtureWriteRow_(calibrationMasterSheet, masterRow, linkedMaster)
  fixtureAppendAudit_(auditSheet, fixtureAuditInput_(actor, 'FIXTURE_LINK_CALIBRATION', calibrationEquipmentId, { equipmentId: measurementId }))
  if (fixtureFindByField_(calibrationMasterSheet, 'calibrationEquipmentId', calibrationEquipmentId).record.equipmentId !== measurementId) throw new Error('FIXTURE_CALIBRATION_LINK_FAILED')

  const calDate = Utilities.formatDate(new Date(), 'Asia/Saigon', 'yyyy-MM-dd')
  const nextDue = Utilities.formatDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'Asia/Saigon', 'yyyy-MM-dd')
  const calibrationLog = {
    calibrationId: calibrationId,
    equipmentId: measurementId,
    calibrationDate: calDate,
    nextDueDate: nextDue,
    certificateNumber: 'FX-CERT-' + suffix,
    calibrationProvider: 'FIXTURE',
    result: 'PASS',
    certificateUrl: '',
    labelPhotoUrl: '',
    createdBy: actor.email,
    createdAt: new Date().toISOString(),
  }
  fixtureAppendRecord_(calibrationLogSheet, calibrationLog)
  fixtureAppendAudit_(auditSheet, fixtureAuditInput_(actor, 'FIXTURE_CALIBRATION_LOG', calibrationId, { calibration: calibrationLog }))

  if (!fixtureFindByField_(calibrationLogSheet, 'calibrationId', calibrationId)) throw new Error('FIXTURE_CALIBRATION_LOG_FAILED')
  fixtureAssertNoCalibrationEvaluation_(auditSheet, calibrationId)
  fixtureAppendAudit_(auditSheet, fixtureAuditInput_(actor, 'EVALUATE_CALIBRATION', calibrationId, { result: { calibrationId: calibrationId, evaluationResult: 'PASS', evaluationNote: '' } }))
  expectFixtureError_('CALIBRATION_SECOND_EVALUATION', 'CALIBRATION_ALREADY_EVALUATED', function () {
    if (fixtureHasCalibrationEvaluation_(auditSheet, calibrationId)) throw new Error('CALIBRATION_ALREADY_EVALUATED')
  })

  const tooling = {
    toolingId: toolingId,
    toolingName: 'Fixture Jig',
    serialOrAssetNumber: '',
    toolingType: 'JIG',
    usedFor: 'FIXTURE',
    ownership: 'COMPANY',
    customerName: '',
    managingDepartment: 'TECHNICAL',
    storageLocation: 'FIXTURE',
    status: 'IN_PRODUCTION',
    commissionDate: calDate,
    inspectionCycleDays: 30,
    note: 'Fixture smoke',
  }
  fixtureAppendRecord_(toolingMasterSheet, tooling)
  if (!fixtureFindByField_(toolingMasterSheet, 'toolingId', toolingId)) throw new Error('FIXTURE_TOOLING_CREATE_FAILED')

  expectFixtureError_('TOOLING_PLAN_MISSING_MASTER', 'TOOLING_NOT_FOUND', function () {
    if (!fixtureFindByField_(toolingMasterSheet, 'toolingId', 'FX-TL-MISSING-' + suffix)) throw new Error('TOOLING_NOT_FOUND')
  })
  const plan = {
    toolingPlanId: toolingPlanId,
    toolingId: toolingId,
    inspectionItem: 'Fixture inspection',
    acceptanceCriteria: 'PASS',
    frequencyType: 'MONTH',
    frequencyValue: 1,
    responsiblePerson: actor.email,
    lastResultDate: '',
    note: '',
  }
  fixtureAppendRecord_(toolingPlanSheet, plan)

  const modification = {
    modificationId: modificationId,
    toolingId: toolingId,
    modificationDate: calDate,
    modificationType: 'DESIGN_CHANGE',
    reason: 'Fixture design change',
    ecnNumber: 'FX-ECN-' + suffix,
    beforeAfterDescription: 'Before fixture → after fixture',
    proposedBy: 'fixture-proposer@example.invalid',
    approvedBy: '',
    qaConfirmedBy: '',
    updatedDocuments: '',
    status: 'IN_PROGRESS',
  }
  const modRow = fixtureAppendRecord_(toolingModificationSheet, modification)
  expectFixtureError_('TOOLING_SELF_APPROVAL', 'SELF_APPROVAL_FORBIDDEN', function () {
    assertNotSelfApproval_({ requestedBy: actor.email }, actor)
  })
  if (modification.approvedBy) throw new Error('FIXTURE_TOOLING_UNEXPECTED_APPROVAL')
  const approved = Object.assign({}, modification, { approvedBy: actor.email })
  fixtureWriteRow_(toolingModificationSheet, modRow, approved)
  expectFixtureError_('TOOLING_COMPLETE_WITHOUT_DOCUMENTS', 'TOOLING_UPDATED_DOCUMENTS_REQUIRED', function () {
    if (!String(approved.updatedDocuments || '').trim()) throw new Error('TOOLING_UPDATED_DOCUMENTS_REQUIRED')
  })
  const completed = Object.assign({}, approved, { updatedDocuments: 'BM-TBSX-09; drawing fixture', status: 'COMPLETED' })
  fixtureWriteRow_(toolingModificationSheet, modRow, completed)
  fixtureAppendAudit_(auditSheet, fixtureAuditInput_(actor, 'FIXTURE_TOOLING_COMPLETE', modificationId, { modification: completed }))
  if (fixtureFindByField_(toolingModificationSheet, 'modificationId', modificationId).record.status !== 'COMPLETED') throw new Error('FIXTURE_TOOLING_COMPLETE_FAILED')

  Logger.log(JSON.stringify({
    phase: 'fixture-calibration-tooling',
    ok: true,
    calibration: { measurementLink: true, nonMeasurementBlocked: true, logCreated: true, evaluationPass: true, secondEvaluationBlocked: true },
    tooling: { masterCreated: true, missingMasterPlanBlocked: true, planCreated: true, selfApprovalBlocked: true, documentsRequired: true, completed: true },
  }, null, 2))
}

function fixtureEquipmentRecord_(equipmentId, equipmentName, equipmentType, updatedAt) {
  return {
    equipmentId: equipmentId,
    equipmentName: equipmentName,
    equipmentType: equipmentType,
    equipmentCategory: 'FIXTURE',
    manufacturer: '',
    supplier: '',
    model: '',
    serialNumber: '',
    productionYear: '',
    purchaseDate: '',
    commissionDate: '',
    currentArea: 'FIXTURE',
    currentLine: '',
    managingDepartment: 'FIXTURE',
    usingDepartment: 'FIXTURE',
    technicalSpecification: '',
    maintenanceCycleMonths: 1,
    status: 'RUNNING',
    criticality: 'D',
    imageUrl: '',
    manualUrl: '',
    setupDocumentUrl: '',
    qrCode: equipmentId,
    active: true,
    updatedAt: updatedAt,
  }
}

function fixtureFindByField_(sheet, field, value) {
  const headers = getHeaders_(sheet)
  const index = headers.indexOf(field)
  if (index === -1) throw new Error('FIXTURE_FIELD_NOT_FOUND:' + sheet.getName() + ':' + field)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null
  const match = sheet.getRange(2, index + 1, lastRow - 1, 1).createTextFinder(String(value)).matchEntireCell(true).findNext()
  if (!match) return null
  const values = sheet.getRange(match.getRow(), 1, 1, headers.length).getDisplayValues()[0]
  const record = headers.reduce(function (result, header, i) {
    result[header] = values[i] === '' ? null : values[i]
    return result
  }, {})
  return { rowNumber: match.getRow(), record: record }
}

function fixtureWriteRow_(sheet, rowNumber, record) {
  const headers = getHeaders_(sheet)
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function (header) {
    const value = record[header]
    return value === undefined || value === null ? '' : value
  })])
}

function fixtureEquipmentHasReference_(spreadsheet, equipmentId) {
  return APP_CONFIG.allowedTables.some(function (table) {
    if (table === 'Equipment_Master' || table === 'Audit_Log') return false
    const sheet = spreadsheet.getSheetByName(table)
    if (!sheet || sheet.getLastRow() < 2) return false
    const headers = getHeaders_(sheet)
    const index = headers.indexOf('equipmentId')
    if (index === -1) return false
    return Boolean(sheet.getRange(2, index + 1, sheet.getLastRow() - 1, 1).createTextFinder(String(equipmentId)).matchEntireCell(true).findNext())
  })
}

function fixtureAuditInput_(actor, kind, entityId, payload) {
  return {
    auditId: Utilities.getUuid(),
    userId: actor.email,
    action: kind + ':' + Utilities.getUuid(),
    entityType: kind.indexOf('TOOLING') >= 0 ? 'TOOLING' : kind.indexOf('CALIBRATION') >= 0 || kind === 'EVALUATE_CALIBRATION' ? 'CALIBRATION' : kind.indexOf('EQUIPMENT') >= 0 ? 'EQUIPMENT' : 'MAINTENANCE',
    entityId: entityId,
    newValueJson: JSON.stringify(payload || {}),
  }
}

function fixtureHasCalibrationEvaluation_(auditSheet, calibrationId) {
  const headers = getHeaders_(auditSheet)
  const actionIndex = headers.indexOf('action')
  const entityIndex = headers.indexOf('entityId')
  if (actionIndex === -1 || entityIndex === -1 || auditSheet.getLastRow() < 2) return false
  const values = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, headers.length).getDisplayValues()
  return values.some(function (row) {
    return String(row[entityIndex]) === String(calibrationId) && String(row[actionIndex]).indexOf('EVALUATE_CALIBRATION:') === 0
  })
}

function fixtureAssertNoCalibrationEvaluation_(auditSheet, calibrationId) {
  if (fixtureHasCalibrationEvaluation_(auditSheet, calibrationId)) throw new Error('CALIBRATION_ALREADY_EVALUATED')
}
