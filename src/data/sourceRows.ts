import { supabase } from './supabaseClient'

export const TABLE_IDS: Record<string, string> = {
  equipment_master: 'equipment_id', daily_inspection: 'inspection_id', daily_inspection_item: 'item_id',
  maintenance_plan: 'plan_id', maintenance_plan_item: 'item_id', maintenance_work_order: 'work_order_id',
  maintenance_execution: 'execution_id', maintenance_result_item: 'result_item_id', maintenance_log: 'log_id',
  equipment_handover: 'handover_id', downtime_event: 'downtime_id', tooling_master: 'tooling_id',
  tooling_maintenance_plan: 'tooling_plan_id', tooling_modification: 'modification_id', calibration_master: 'calibration_id',
  calibration_log: 'calibration_log_id', calibration_vendor_quote: 'quote_id', calibration_quote_summary: 'summary_id',
  equipment_movement_log: 'movement_id', audit_log: 'audit_id',
}

// Keyset pagination respects the server row cap and uses the canonical table PK.
export async function fetchSourceRows(table: string, filter?: { column: string; value: unknown }) {
  const id = TABLE_IDS[table]
  if (!id) throw new Error(`Unsupported source table: ${table}`)
  const rows: Record<string, unknown>[] = []
  let after: string | undefined
  for (;;) {
    let query = supabase.from(table).select('*').order(id).limit(500)
    if (filter) query = query.eq(filter.column, filter.value)
    if (after !== undefined) query = query.gt(id, after)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) return rows
    const next = String(data[data.length - 1][id])
    if (next === after || data.some(row => row[id] == null)) throw new Error(`${table}: invalid pagination`)
    rows.push(...data)
    after = next
  }
}
