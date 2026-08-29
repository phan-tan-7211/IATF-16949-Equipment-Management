import { useEffect, useState } from 'react'
import { getSupabaseConfigStatus, supabase } from './data/supabaseClient'

type EquipmentRow = {
  equipment_id: string
  equipment_type: string
  equipment_name: string | null
  status: string | null
}

export function SupabaseTestPanel() {
  const config = getSupabaseConfigStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sessionEmail, setSessionEmail] = useState('')
  const [rows, setRows] = useState<EquipmentRow[]>([])
  const [message, setMessage] = useState(config.configured ? 'Supabase configured.' : 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email || '')
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email || '')
    })
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
    setRows([])
    setMessage('Signed out')
  }

  async function loadEquipment() {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase
      .from('equipment_master')
      .select('equipment_id,equipment_type,equipment_name,status')
      .order('equipment_id')
      .limit(100)
    setLoading(false)
    if (error) {
      setMessage(`READ_ERROR: ${error.message}`)
      return
    }
    setRows((data || []) as EquipmentRow[])
    setMessage(`READ_OK: ${data?.length || 0} equipment rows`)
  }

  async function testStorage() {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase.storage.from('equipment-photos').list('', { limit: 20 })
    setLoading(false)
    if (error) {
      setMessage(`STORAGE_ERROR: ${error.message}`)
      return
    }
    setMessage(`STORAGE_OK: ${data.length} object(s) visible`)
  }

  return (
    <section className="panel stack-lg" aria-label="Supabase TEST diagnostic">
      <div>
        <p className="eyebrow">Supabase TEST</p>
        <h1>Local backend diagnostic</h1>
        <p>Branch: feat/supabase-r2-migration. This screen does not use Apps Script.</p>
      </div>

      <div className="card stack-sm">
        <strong>Configuration</strong>
        <div>Configured: {config.configured ? 'YES' : 'NO'}</div>
        <div>URL: {config.url || '—'}</div>
        <div>Session: {sessionEmail || 'not signed in'}</div>
        <div>{message}</div>
      </div>

      {!sessionEmail && (
        <div className="card stack-sm">
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
          <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
          <button type="button" disabled={!config.configured || loading || !email || !password} onClick={() => void signIn()}>Sign in TEST</button>
        </div>
      )}

      <div className="actions-row">
        <button type="button" disabled={!sessionEmail || loading} onClick={() => void loadEquipment()}>Read Equipment</button>
        <button type="button" disabled={!sessionEmail || loading} onClick={() => void testStorage()}>Test Storage</button>
        <button type="button" disabled={!sessionEmail || loading} onClick={() => void signOut()}>Sign out</button>
      </div>

      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Type</th><th>Name</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.equipment_id}>
                  <td>{row.equipment_id}</td><td>{row.equipment_type}</td><td>{row.equipment_name || '—'}</td><td>{row.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
