import { useEffect, useState } from 'react'
import { createAppsScriptBridgeClient } from './data/appsScriptBridgeClient'
import { loadLiveAudit, loadLiveSession, type LiveAudit, type LiveSession } from './data/liveAudit'

export function LiveAuditPanel() {
  const [session, setSession] = useState<LiveSession | null>(null)
  const [rows, setRows] = useState<LiveAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const client = createAppsScriptBridgeClient()
    loadLiveSession(client)
      .then(async (current) => {
        if (!active) return
        setSession(current)
        if (current.role === 'ADMIN') {
          const audit = await loadLiveAudit(client)
          if (active) setRows(audit)
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải session/audit')
      })
      .finally(() => {
        if (active) setLoading(false)
        client.destroy()
      })
    return () => { active = false; client.destroy() }
  }, [])

  return <div className="stack">
    <section className="content-card">
      <div className="section-heading"><div><p className="eyebrow">Security / Session</p><h2>Audit & Configuration</h2></div><span className="status-pill">SERVER AUTHORITY</span></div>
      {loading ? <p className="muted" role="status">Đang xác thực phiên làm việc…</p> : null}
      {error ? <div className="record-card" role="alert"><b>Có lỗi</b><p>{error}</p></div> : null}
      {session ? <div className="metric-grid">
        <article><span>User</span><strong>{session.email}</strong><small>Session.getActiveUser()</small></article>
        <article><span>Role</span><strong>{session.role}</strong><small>RBAC server-side</small></article>
        <article><span>Contract</span><strong>{session.contractVersion}</strong><small>Frozen G1 contract</small></article>
        <article><span>Audit access</span><strong>{session.role === 'ADMIN' ? 'ALLOWED' : 'DENIED'}</strong><small>ADMIN-only</small></article>
      </div> : null}
      <p className="muted">RBAC_JSON, Script Properties và credential không được gửi xuống browser.</p>
    </section>

    {session?.role === 'ADMIN' ? <section className="content-card">
      <div className="section-heading"><div><p className="eyebrow">Audit_Log live</p><h3>Lịch sử audit</h3></div><span>{rows.length} records</span></div>
      {rows.length ? <div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th></tr></thead><tbody>{rows.slice().reverse().slice(0, 200).map((item) => <tr key={item.auditId}><td>{item.timestamp}</td><td>{item.userId}</td><td><b>{item.action}</b></td><td>{item.entityType}</td><td>{item.entityId}</td></tr>)}</tbody></table></div> : <p className="muted">Chưa có Audit Log.</p>}
    </section> : session ? <section className="content-card"><p className="muted">Audit Log chỉ hiển thị cho ADMIN.</p></section> : null}
  </div>
}
