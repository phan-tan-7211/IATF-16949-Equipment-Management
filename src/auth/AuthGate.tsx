import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../data/supabaseClient'
import { loadLiveSession, type LiveSession } from '../data/liveAudit'
import './AuthGate.css'

type State = { status: 'loading' | 'signedOut' | 'denied' | 'ready'; session?: LiveSession }
const roles = ['ADMIN', 'MAINTENANCE', 'SUPERVISOR', 'QUALITY', 'MANAGER']

export function AuthGate({ children }: { children: (session: LiveSession, signOut: () => Promise<void>) => ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    let revision = 0
    const timers = new Set<ReturnType<typeof setTimeout>>()
    async function resolve(version: number) {
      const current = () => active && version === revision
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!current()) return
        if (!data.session) { setState({ status: 'signedOut' }); return }
        try {
          const session = await loadLiveSession()
          if (!current()) return
          if (!roles.includes(session.role)) throw new Error('ROLE_REQUIRED')
          setError('')
          setState({ status: 'ready', session })
        } catch {
          if (current()) {
            setState({ status: 'denied' })
            setError('Không xác nhận được quyền tài khoản. Hãy thử lại hoặc liên hệ quản trị viên để kiểm tra quyền truy cập.')
          }
        }
      } catch {
        if (current()) {
          setState({ status: 'signedOut' })
          setError('Không đọc được phiên đăng nhập. Vui lòng đăng nhập lại.')
        }
      }
    }
    function refresh() {
      const version = ++revision
      setState({ status: 'loading' })
      // Supabase requests must run outside the auth callback's lock.
      const timer = setTimeout(() => { timers.delete(timer); void resolve(version) }, 0)
      timers.add(timer)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(refresh)
    refresh()
    return () => { active = false; ++revision; timers.forEach(clearTimeout); subscription.unsubscribe() }
  }, [retry])

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
      setState({ status: 'signedOut' })
      setPassword('')
    } catch { setError('Đăng xuất chưa thành công. Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) {
        setError(signInError.code === 'invalid_credentials' ? 'Email hoặc mật khẩu không đúng.' : 'Không đăng nhập được. Kiểm tra kết nối, thông tin tài khoản và trạng thái xác nhận email.')
        return
      }
      setPassword('')
      setRetry(value => value + 1)
    } catch { setError('Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  if (state.status === 'ready' && state.session) return <>{error && <p className="auth-notice" role="alert">{error}</p>}{children(state.session, signOut)}</>
  return <main className="auth-page"><section className="auth-card" aria-label="Đăng nhập CEV Equipment"><p className="eyebrow">CEV Equipment · IATF 16949</p><h1>Đăng nhập</h1>
    {state.status === 'loading' ? <p role="status">Đang xác nhận phiên đăng nhập…</p> : <>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {state.status === 'denied' ? <div className="auth-actions"><button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button><button type="button" disabled={busy} onClick={() => void signOut()}>Đăng xuất</button></div> : <form onSubmit={signIn}>
        <p>Dùng tài khoản đã được quản trị viên cấp quyền.</p>
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy}/></label>
        <label>Mật khẩu<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></label>
        <button type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        <p className="auth-help">Quên mật khẩu hoặc chưa có tài khoản? Liên hệ quản trị viên.</p>
      </form>}
    </>}
  </section></main>
}
