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

type SourceRowsCacheEntry = { savedAt: number; rows: Record<string, unknown>[] }

const SOURCE_ROWS_FRESH_MS = 30_000
const sourceRowsCache = new Map<string, SourceRowsCacheEntry>()
const sourceRowsInFlight = new Map<string, Promise<Record<string, unknown>[]>>()

function cacheKey(table: string, filter?: { column: string; value: unknown }) {
  return filter ? `${table}|${filter.column}|${String(filter.value ?? '')}` : `${table}|*`
}

export function invalidateSourceRows(table: string, filter?: { column: string; value: unknown }) {
  if (filter) {
    sourceRowsCache.delete(cacheKey(table, filter))
    return
  }
  for (const key of [...sourceRowsCache.keys()]) if (key === `${table}|*` || key.startsWith(`${table}|`)) sourceRowsCache.delete(key)
}

// Keyset pagination respects the server row cap and uses the canonical table PK.
export async function fetchSourceRows(table: string, filter?: { column: string; value: unknown }, options: { force?: boolean } = {}) {
  const id = TABLE_IDS[table]
  if (!id) throw new Error(`Unsupported source table: ${table}`)

  const key = cacheKey(table, filter)
  const cached = sourceRowsCache.get(key)
  if (!options.force && cached && Date.now() - cached.savedAt <= SOURCE_ROWS_FRESH_MS) return cached.rows

  const existing = sourceRowsInFlight.get(key)
  if (existing) return existing

  const task = (async () => {
    const rows: Record<string, unknown>[] = []
    let after: string | undefined
    for (;;) {
      let query = supabase.from(table).select('*').order(id).limit(500)
      if (filter) query = query.eq(filter.column, filter.value)
      if (after !== undefined) query = query.gt(id, after)
      const { data, error } = await query
      if (error) {
        if (cached) return cached.rows
        throw new Error(`${table}: ${error.message}`)
      }
      if (!data?.length) {
        sourceRowsCache.set(key, { savedAt: Date.now(), rows })
        return rows
      }
      const next = String(data[data.length - 1][id])
      if (next === after || data.some(row => row[id] == null)) throw new Error(`${table}: invalid pagination`)
      rows.push(...data)
      after = next
    }
  })().finally(() => { sourceRowsInFlight.delete(key) })

  sourceRowsInFlight.set(key, task)
  return task
}
