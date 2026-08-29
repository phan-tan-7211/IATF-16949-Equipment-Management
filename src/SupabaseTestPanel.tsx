import { useEffect, useState } from 'react'
import { getSupabaseConfigStatus, supabase } from './data/supabaseClient'
import { getEquipmentPhotoPreviews, loadSupabaseEquipment } from './data/supabaseEquipment'
import { loadLiveSession } from './data/liveAudit'

type Diagnostics = {
  pass: boolean
  counts: Record<string, number>
  issues: Record<string, number>
  storage: Record<string, number>
}

type Check = {
  label: string
  state: 'PASS' | 'FAIL' | 'WAIT'
  detail: string
}

export function SupabaseTestPanel() {
  const config = getSupabaseConfigStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sessionEmail, setSessionEmail] = useState('')
  const [message, setMessage] = useState(config.configured ? 'Supabase configured.' : 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  const [loading, setLoading] = useState(false)
  const [checks, setChecks] = useState<Check[]>([])
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email || ''))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSessionEmail(session?.user.email || ''))
    return () => data.subscription.unsubscribe()
  }, [])

  async function signIn() {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setMessage(`LOGIN_ERROR: ${error.message}`)
      return
    }
    setSessionEmail(data.user.email || '')
    setMessage('Login OK')
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setChecks([])
    setDiagnostics(null)
    setMessage('Signed out')
  }

  async function runCutoverChecks() {
    if (!supabase) return
    setLoading(true)
    setChecks([{ label: 'Cutover diagnostics', state: 'WAIT', detail: 'Đang chạy…' }])
    setDiagnostics(null)

    const nextChecks: Check[] = []
    try {
      const session = await loadLiveSession()
      nextChecks.push({ label: 'Auth + App role', state: session.email && session.role !== 'UNKNOWN' ? 'PASS' : 'FAIL', detail: `${session.email || 'no session'} · ${session.role}` })

      const { data: diagnosticData, error: diagnosticError } = await supabase.rpc('rpc_cutover_diagnostics')
      if (diagnosticError) throw new Error(`CUTOVER_DIAGNOSTICS_RPC_FAILED: ${diagnosticError.message}`)
      const result = diagnosticData as Diagnostics
      setDiagnostics(result)
      nextChecks.push({ label: 'Database integrity', state: result.pass ? 'PASS' : 'FAIL', detail: result.pass ? '0 orphan / duplicate / wrong-type issue' : 'Có issue cần xử lý' })

      const equipment = await loadSupabaseEquipment()
      nextChecks.push({ label: 'Equipment Master read', state: equipment.length === result.counts.equipment_total ? 'PASS' : 'FAIL', detail: `${equipment.length} / ${result.counts.equipment_total} thiết bị` })

      const previews = await getEquipmentPhotoPreviews(equipment.map((row) => row.equipmentId))
      const photoCount = Object.values(previews).filter((item) => item.exists && item.signedUrl).length
      const expectedPhotoCount = result.storage.canonical_photo_objects || 0
      nextChecks.push({ label: 'Private Storage + signed URLs', state: photoCount === expectedPhotoCount ? 'PASS' : 'FAIL', detail: `${photoCount} / ${expectedPhotoCount} ảnh ký URL thành công` })

      const adminAudit = session.role === 'ADMIN'
        ? await supabase.from('audit_log').select('audit_id', { count: 'exact', head: true })
        : null
      if (adminAudit) nextChecks.push({ label: 'ADMIN Audit RLS read', state: adminAudit.error ? 'FAIL' : 'PASS', detail: adminAudit.error?.message || `${adminAudit.count || 0} audit row(s)` })

      const allPass = nextChecks.every((check) => check.state === 'PASS')
      setChecks(nextChecks)
      setMessage(allPass ? 'CUTOVER_BROWSER_READ_GATE_PASS' : 'CUTOVER_BROWSER_READ_GATE_FAIL')
    } catch (cause) {
      nextChecks.push({ label: 'Diagnostics runtime', state: 'FAIL', detail: cause instanceof Error ? cause.message : 'UNKNOWN_ERROR' })
      setChecks(nextChecks)
      setMessage('CUTOVER_BROWSER_READ_GATE_FAIL')
    } finally {
      setLoading(false)
    }
  }

  const failedCount = checks.filter((check) => check.state === 'FAIL').length

  return (
    <section className="panel stack-lg" aria-label="Supabase cutover diagnostic">
      <div>
        <p className="eyebrow">Supabase Cutover</p>
        <h1>Browser diagnostics</h1>
        <p>Read-only gate cho React + Vite + TypeScript → Supabase. Không dùng Apps Script và không tạo transaction nghiệp vụ.</p>
      </div>

      <div className="card stack-sm">
        <strong>Configuration</strong>
        <div>Configured: {config.configured ? 'YES' : 'NO'}</div>
        <div>URL: {config.url || '—'}</div>
        <div>Session: {sessionEmail || 'not signed in'}</div>
        <div>Status: {message}</div>
      </div>

      {!sessionEmail ? <div className="card stack-sm">
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" /></label>
        <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
        <button type="button" disabled={!config.configured || loading || !email || !password} onClick={() => void signIn()}>Sign in</button>
      </div> : null}

      <div className="actions-row">
        <button type="button" disabled={!sessionEmail || loading} onClick={() => void runCutoverChecks()}>{loading ? 'Đang kiểm…' : 'Run cutover read gate'}</button>
        <button type="button" disabled={!sessionEmail || loading} onClick={() => void signOut()}>Sign out</button>
      </div>

      {checks.length > 0 ? <div className="card stack-sm" aria-live="polite">
        <strong>{failedCount === 0 && checks.every((check) => check.state === 'PASS') ? 'READ GATE PASS' : failedCount > 0 ? 'READ GATE FAIL' : 'CHECKING'}</strong>
        {checks.map((check) => <div key={check.label}><b>{check.state}</b> · {check.label} — {check.detail}</div>)}
      </div> : null}

      {diagnostics ? <div className="card stack-sm">
        <strong>Database snapshot</strong>
        <div>Equipment: {diagnostics.counts.equipment_total} ({diagnostics.counts.production_total} production + {diagnostics.counts.measurement_total} measurement)</div>
        <div>Calibration Master: {diagnostics.counts.calibration_master_total}</div>
        <div>Canonical equipment photos: {diagnostics.storage.canonical_photo_objects}</div>
        <div>Noncanonical photos: {diagnostics.storage.noncanonical_photo_objects}</div>
        <div>Photo IDs without Equipment: {diagnostics.storage.photo_ids_without_equipment}</div>
      </div> : null}
    </section>
  )
}
