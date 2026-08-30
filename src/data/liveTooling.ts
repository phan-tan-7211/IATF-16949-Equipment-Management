import { supabase } from './supabaseClient'

export type LiveTooling = {
  toolingId: string; toolingName: string; toolingType: string; ownership: string; managingDepartment: string; storageLocation: string; status: string; inspectionCycleDays: string
}
export type LiveToolingPlan = {
  toolingPlanId: string; toolingId: string; inspectionItem: string; acceptanceCriteria: string; frequencyType: string; frequencyValue: string; responsiblePerson: string; lastResultDate: string
}
export type LiveToolingModification = {
  modificationId: string; toolingId: string; modificationDate: string; modificationType: string; reason: string; proposedBy: string; approvedBy: string; qaConfirmedBy: string; updatedDocuments: string; status: string
}

function text(value: unknown) { return value == null ? '' : String(value).trim() }

export async function loadLiveTooling() {
  const [masterResult, planResult, modResult] = await Promise.all([
    supabase.from('tooling_master').select('*').order('tooling_id'),
    supabase.from('tooling_maintenance_plan').select('*').order('created_at', { ascending: false }),
    supabase.from('tooling_modification').select('*').order('created_at', { ascending: false }),
  ])
  for (const result of [masterResult, planResult, modResult]) if (result.error) throw result.error

  const tooling: LiveTooling[] = ((masterResult.data || []) as Array<Record<string, unknown>>).map((row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    return { toolingId: text(row.tooling_id), toolingName: text(source.toolingName), toolingType: text(row.tooling_type), ownership: text(row.ownership), managingDepartment: text(source.managingDepartment), storageLocation: text(source.storageLocation), status: text(row.status), inspectionCycleDays: text(source.inspectionCycleDays) }
  }).filter((row) => row.toolingId)

  const plans: LiveToolingPlan[] = ((planResult.data || []) as Array<Record<string, unknown>>).map((row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    return { toolingPlanId: text(row.tooling_plan_id), toolingId: text(row.tooling_id), inspectionItem: text(source.inspectionItem), acceptanceCriteria: text(source.acceptanceCriteria), frequencyType: text(row.frequency_type), frequencyValue: text(source.frequencyValue), responsiblePerson: text(source.responsiblePerson), lastResultDate: text(source.lastResultDate) }
  }).filter((row) => row.toolingPlanId)

  const modifications: LiveToolingModification[] = ((modResult.data || []) as Array<Record<string, unknown>>).map((row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    return { modificationId: text(row.modification_id), toolingId: text(row.tooling_id), modificationDate: text(source.modificationDate), modificationType: text(row.modification_type), reason: text(source.reason), proposedBy: text(source.proposedBy), approvedBy: text(source.approvedBy), qaConfirmedBy: text(source.qaConfirmedBy), updatedDocuments: text(source.updatedDocuments), status: text(row.status) }
  }).filter((row) => row.modificationId)

  return { tooling, plans, modifications }
}

export async function createTooling(input: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('rpc_create_tooling', { p_input: input })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  return { result: { toolingId: text(result.toolingId) } }
}

export async function createToolingPlan(input: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('rpc_create_tooling_plan', { p_input: input })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  return { result: { toolingPlanId: text(result.toolingPlanId) } }
}

export async function createToolingModification(input: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('rpc_create_tooling_modification', { p_input: input })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  return { result: { modificationId: text(result.modificationId), status: text(result.status) } }
}

export async function transitionToolingModification(modificationId: string, action: 'APPROVE' | 'QA_CONFIRM' | 'COMPLETE', updatedDocuments = '') {
  const { data, error } = await supabase.rpc('rpc_transition_tooling_modification', {
    p_modification_id: modificationId,
    p_action: action,
    p_updated_documents: updatedDocuments,
  })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  return { result: { modificationId: text(result.modificationId), status: text(result.status) } }
}
