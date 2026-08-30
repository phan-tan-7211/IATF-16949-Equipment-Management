import { supabase } from './supabaseClient'

export type LiveSession = { email: string; role: string; contractVersion: string }
export type LiveAudit = { auditId: string; timestamp: string; userId: string; action: string; entityType: string; entityId: string; oldValueJson: string; newValueJson: string }

function text(value: unknown) { return value == null ? '' : String(value).trim() }

export async function loadLiveSession(): Promise<LiveSession> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const user = sessionData.session?.user
  if (!user) throw new Error('Chưa đăng nhập Supabase')
  const { data: roleData, error: roleError } = await supabase.from('app_user_role').select('role,email').eq('user_id', user.id).single()
  if (roleError) throw roleError
  return { email: text(roleData.email) || user.email || '', role: text(roleData.role), contractVersion: 'G1-frozen-2026-08-28' }
}

export async function loadLiveAudit(): Promise<LiveAudit[]> {
  const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return ((data || []) as Array<Record<string, unknown>>).map((row) => {
    const detail = (row.detail as Record<string, unknown> | null) || {}
    return {
      auditId: text(row.audit_id), timestamp: text(row.created_at), userId: text(row.actor_email), action: text(row.action), entityType: text(row.entity_type), entityId: text(row.entity_id), oldValueJson: JSON.stringify(detail.before ?? ''), newValueJson: JSON.stringify(detail.after ?? detail),
    }
  }).filter((row) => row.auditId)
}
