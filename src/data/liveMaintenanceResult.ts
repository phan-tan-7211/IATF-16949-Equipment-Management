import { supabase } from './supabaseClient'

export type MaintenanceResultItem = {
  resultItemId: string
  itemName: string
  resultMark: string
  repairContent: string
  maintenanceContent: string
  inspector: string
  sequence: number
}

export type MaintenanceExecutionResult = {
  executionId: string
  workOrderId: string
  equipmentId: string
  executionDate: string
  periodicFrequency: string
  inspectionDepartment: string
  recordedBy: string
  createdAt: string
  items: MaintenanceResultItem[]
}

export type MaintenanceResultInput = {
  workOrderId: string
  executionDate: string
  periodicFrequency: string
  inspectionDepartment: string
  items: Array<{
    itemName: string
    resultMark: '○' | '△' | '×'
    repairContent: string
    maintenanceContent: string
    inspector: string
  }>
}

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }

export async function loadMaintenanceExecutionResults() {
  const [executionResult, itemResult] = await Promise.all([
    supabase.from('maintenance_execution').select('*').order('created_at', { ascending: false }),
    supabase.from('maintenance_result_item').select('*'),
  ])
  if (executionResult.error) throw executionResult.error
  if (itemResult.error) throw itemResult.error

  const itemsByExecution = new Map<string, MaintenanceResultItem[]>()
  for (const row of (itemResult.data || []) as Array<Record<string, unknown>>) {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    const executionId = text(row.execution_id)
    const item: MaintenanceResultItem = {
      resultItemId: text(row.result_item_id),
      itemName: text(source.itemName),
      resultMark: text(source.resultMark),
      repairContent: text(source.repairContent),
      maintenanceContent: text(source.maintenanceContent),
      inspector: text(source.inspector),
      sequence: number(source.sequence),
    }
    itemsByExecution.set(executionId, [...(itemsByExecution.get(executionId) || []), item])
  }

  return ((executionResult.data || []) as Array<Record<string, unknown>>).map((row): MaintenanceExecutionResult => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    const executionId = text(row.execution_id)
    return {
      executionId,
      workOrderId: text(row.work_order_id),
      equipmentId: text(row.equipment_id),
      executionDate: text(source.executionDate),
      periodicFrequency: text(source.periodicFrequency),
      inspectionDepartment: text(source.inspectionDepartment),
      recordedBy: text(source.recordedBy),
      createdAt: text(row.created_at),
      items: (itemsByExecution.get(executionId) || []).toSorted((a, b) => a.sequence - b.sequence),
    }
  })
}

export async function recordMaintenanceResult(input: MaintenanceResultInput) {
  const { data, error } = await supabase.rpc('rpc_record_maintenance_result', { p_input: input })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  return {
    executionId: text(result.executionId),
    workOrderId: text(result.workOrderId),
    equipmentId: text(result.equipmentId),
    itemCount: number(result.itemCount),
    abnormalCount: number(result.abnormalCount),
  }
}
