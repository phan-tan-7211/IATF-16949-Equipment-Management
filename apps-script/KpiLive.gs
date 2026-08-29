function dashboardKpi(request) {
  const actor = requireActor_()
  const input = request && request.input ? request.input : {}
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('KPI_REQUEST_REQUIRED')
  if (String(request.contractVersion || '') !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')

  const now = new Date()
  const year = input.year ? Number(input.year) : now.getFullYear()
  const month = input.month ? Number(input.month) : now.getMonth() + 1
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error('KPI_YEAR_INVALID')
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('KPI_MONTH_INVALID')

  const calculated = calculateDashboardKpi_({
    equipment: readTable_('Equipment_Master'),
    inspections: readTable_('Daily_Inspection'),
    downtimeEvents: readTable_('Downtime_Event'),
    plans: readTable_('Maintenance_Plan'),
    workOrders: readTable_('Maintenance_Work_Order'),
    executions: readTable_('Maintenance_Execution'),
  }, year, month)

  return {
    ok: true,
    actor: actor.email,
    period: { year: year, month: month },
    data: calculated,
  }
}

function calculateDashboardKpi_(tables, year, month) {
  const source = tables || {}
  const equipment = (source.equipment || []).filter(function (row) {
    return String(row.equipmentType || '') === 'PRODUCTION' && String(row.status || '') !== 'DISPOSED'
  })
  const productionIds = {}
  equipment.forEach(function (row) { productionIds[String(row.equipmentId || '')] = true })

  const inspections = (source.inspections || []).filter(function (row) {
    return productionIds[String(row.equipmentId || '')] && dateInMonth_(row.inspectionDate, year, month)
  })
  const downtimeEvents = (source.downtimeEvents || []).filter(function (row) {
    return productionIds[String(row.equipmentId || '')] && dateTimeInMonth_(row.downAt, year, month)
  })
  const plans = (source.plans || []).filter(function (row) {
    return productionIds[String(row.equipmentId || '')] && dateInMonth_(row.plannedDate, year, month)
  })
  const workOrders = source.workOrders || []
  const executions = source.executions || []

  const equipmentDays = {}
  inspections.forEach(function (row) {
    const equipmentId = String(row.equipmentId || '')
    const inspectionDate = String(row.inspectionDate || '')
    if (!equipmentDays[equipmentId]) equipmentDays[equipmentId] = {}
    equipmentDays[equipmentId][inspectionDate] = true
  })
  const recordedEquipmentDays = Object.keys(equipmentDays).reduce(function (sum, equipmentId) {
    return sum + Object.keys(equipmentDays[equipmentId]).length
  }, 0)
  const runtimeMinutes = recordedEquipmentDays > 0 ? recordedEquipmentDays * 24 * 60 : null

  let downtimeMinutes = 0
  let restoredFailureCount = 0
  downtimeEvents.forEach(function (row) {
    const minutes = downtimeMinutes_(row)
    downtimeMinutes += minutes
    if (String(row.restoredAt || '').trim() || Number(row.downtimeMinutes || 0) > 0) restoredFailureCount += 1
  })

  const effectiveRunMinutes = runtimeMinutes === null ? null : Math.max(0, runtimeMinutes - downtimeMinutes)
  const mtbfMinutes = runtimeMinutes !== null && restoredFailureCount > 0 ? effectiveRunMinutes / restoredFailureCount : null
  const mttrMinutes = restoredFailureCount > 0 ? downtimeMinutes / restoredFailureCount : null
  const downtimeRate = runtimeMinutes !== null && runtimeMinutes > 0 ? downtimeMinutes / runtimeMinutes : null

  let duePlans = 0
  let onTimePlans = 0
  plans.forEach(function (plan) {
    if (!plan.plannedDate) return
    duePlans += 1
    const planId = String(plan.planId || '')
    const relatedOrders = workOrders.filter(function (wo) {
      return String(wo.sourceType || '') === 'PLAN' && String(wo.sourceId || '') === planId
    })
    const relatedOrderIds = {}
    relatedOrders.forEach(function (wo) { relatedOrderIds[String(wo.workOrderId || '')] = true })
    const completed = executions.some(function (execution) {
      if (!relatedOrderIds[String(execution.workOrderId || '')]) return false
      const completedAt = String(execution.completedAt || '').trim()
      if (!completedAt) return false
      return completedAt.slice(0, 10) <= String(plan.plannedDate)
    })
    if (completed) onTimePlans += 1
  })
  const maintenanceOnTimeRate = duePlans > 0 ? onTimePlans / duePlans : null

  return {
    productionEquipmentCount: equipment.length,
    recordedEquipmentDays: recordedEquipmentDays,
    runtimeMinutes: runtimeMinutes,
    downtimeMinutes: downtimeMinutes,
    failureCount: downtimeEvents.length,
    restoredFailureCount: restoredFailureCount,
    mtbfMinutes: mtbfMinutes,
    mttrMinutes: mttrMinutes,
    downtimeRate: downtimeRate,
    downtimeTargetRate: 0.08,
    dueMaintenancePlans: duePlans,
    onTimeMaintenancePlans: onTimePlans,
    maintenanceOnTimeRate: maintenanceOnTimeRate,
    maintenanceTargetRate: 1,
    completeness: {
      runtimeAvailable: runtimeMinutes !== null,
      runtimeBasis: 'DAILY_INSPECTION_RECORDED_EQUIPMENT_DAYS',
      maintenanceRateAvailable: maintenanceOnTimeRate !== null,
    },
  }
}

function fixtureKpiSmoke() {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')

  const empty = calculateDashboardKpi_({
    equipment: [{ equipmentId: 'FX-KPI-EQ', equipmentType: 'PRODUCTION', status: 'RUNNING' }],
    inspections: [], downtimeEvents: [], plans: [], workOrders: [], executions: [],
  }, 2026, 8)
  if (empty.runtimeMinutes !== null || empty.downtimeRate !== null || empty.mtbfMinutes !== null) {
    throw new Error('FIXTURE_KPI_EMPTY_RUNTIME_ASSERTION_FAILED')
  }

  const populated = calculateDashboardKpi_({
    equipment: [{ equipmentId: 'FX-KPI-EQ', equipmentType: 'PRODUCTION', status: 'RUNNING' }],
    inspections: [
      { equipmentId: 'FX-KPI-EQ', inspectionDate: '2026-08-10' },
      { equipmentId: 'FX-KPI-EQ', inspectionDate: '2026-08-11' },
      { equipmentId: 'FX-KPI-EQ', inspectionDate: '2026-08-11' },
    ],
    downtimeEvents: [
      { equipmentId: 'FX-KPI-EQ', downAt: '2026-08-10T08:00:00+07:00', restoredAt: '2026-08-10T09:00:00+07:00', downtimeMinutes: 60 },
      { equipmentId: 'FX-KPI-EQ', downAt: '2026-08-11T08:00:00+07:00', restoredAt: '2026-08-11T08:30:00+07:00', downtimeMinutes: 30 },
    ],
    plans: [{ planId: 'FX-PLAN-1', equipmentId: 'FX-KPI-EQ', plannedDate: '2026-08-20' }],
    workOrders: [{ workOrderId: 'FX-WO-PLAN-1', sourceType: 'PLAN', sourceId: 'FX-PLAN-1' }],
    executions: [{ workOrderId: 'FX-WO-PLAN-1', completedAt: '2026-08-19T10:00:00+07:00' }],
  }, 2026, 8)

  if (populated.recordedEquipmentDays !== 2) throw new Error('FIXTURE_KPI_EQUIPMENT_DAYS_FAILED')
  if (populated.runtimeMinutes !== 2880) throw new Error('FIXTURE_KPI_RUNTIME_FAILED')
  if (populated.downtimeMinutes !== 90) throw new Error('FIXTURE_KPI_DOWNTIME_FAILED')
  if (populated.restoredFailureCount !== 2) throw new Error('FIXTURE_KPI_FAILURE_COUNT_FAILED')
  if (populated.mttrMinutes !== 45) throw new Error('FIXTURE_KPI_MTTR_FAILED')
  if (Math.abs(populated.mtbfMinutes - 1395) > 0.0001) throw new Error('FIXTURE_KPI_MTBF_FAILED')
  if (Math.abs(populated.downtimeRate - 0.03125) > 0.000001) throw new Error('FIXTURE_KPI_DOWNTIME_RATE_FAILED')
  if (populated.maintenanceOnTimeRate !== 1) throw new Error('FIXTURE_KPI_MAINTENANCE_RATE_FAILED')

  Logger.log(JSON.stringify({ phase: 'fixture-kpi', ok: true, empty: empty, populated: populated }, null, 2))
}

function dateInMonth_(value, year, month) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  return Number(text.slice(0, 4)) === year && Number(text.slice(5, 7)) === month
}

function dateTimeInMonth_(value, year, month) {
  const text = String(value || '').trim()
  if (!text) return false
  return Number(text.slice(0, 4)) === year && Number(text.slice(5, 7)) === month
}

function downtimeMinutes_(row) {
  const stored = Number(row.downtimeMinutes)
  if (Number.isFinite(stored) && stored >= 0 && String(row.downtimeMinutes || '').trim() !== '') return stored
  const downAt = String(row.downAt || '').trim()
  const restoredAt = String(row.restoredAt || '').trim()
  if (!downAt || !restoredAt) return 0
  const start = new Date(downAt).getTime()
  const end = new Date(restoredAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / 60000)
}
