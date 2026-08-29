import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createTooling, createToolingModification, createToolingPlan, loadLiveTooling, transitionToolingModification, type LiveTooling, type LiveToolingModification, type LiveToolingPlan } from './data/liveTooling'

export function LiveToolingPanel() {
  const [tooling, setTooling] = useState<LiveTooling[]>([])
  const [plans, setPlans] = useState<LiveToolingPlan[]>([])
  const [mods, setMods] = useState<LiveToolingModification[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [toolingId, setToolingId] = useState('')
  const [toolingName, setToolingName] = useState('')
  const [toolingType, setToolingType] = useState('JIG')
  const [ownership, setOwnership] = useState('COMPANY')
  const [customerName, setCustomerName] = useState('')
  const [planToolingId, setPlanToolingId] = useState('')
  const [inspectionItem, setInspectionItem] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [frequencyType, setFrequencyType] = useState('MONTH')
  const [frequencyValue, setFrequencyValue] = useState('1')
  const [modToolingId, setModToolingId] = useState('')
  const [modReason, setModReason] = useState('')
  const [beforeAfter, setBeforeAfter] = useState('')
  const [updatedDocs, setUpdatedDocs] = useState<Record<string, string>>({})

  const refresh = async () => {
    const result = await loadLiveTooling()
    setTooling(result.tooling); setPlans(result.plans); setMods(result.modifications)
    setPlanToolingId((current) => current || result.tooling[0]?.toolingId || '')
    setModToolingId((current) => current || result.tooling[0]?.toolingId || '')
    setError('')
  }

  useEffect(() => {
    let active = true
    loadLiveTooling().then((result) => {
      if (!active) return
      setTooling(result.tooling); setPlans(result.plans); setMods(result.modifications)
      setPlanToolingId(result.tooling[0]?.toolingId || ''); setModToolingId(result.tooling[0]?.toolingId || '')
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Tooling') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const submitTooling = async (event: FormEvent) => {
    event.preventDefault(); setBusy('create-tooling'); setError(''); setMessage('')
    try {
      await createTooling({ toolingId, toolingName, toolingType, ownership, customerName, status: 'IN_PRODUCTION', serialOrAssetNumber: '', usedFor: '', managingDepartment: '', storageLocation: '', commissionDate: '', inspectionCycleDays: '', note: '' })
      setMessage(`Đã tạo ${toolingId}`); setToolingId(''); setToolingName(''); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo Tooling') }
    finally { setBusy('') }
  }

  const submitPlan = async (event: FormEvent) => {
    event.preventDefault(); setBusy('create-plan'); setError(''); setMessage('')
    try {
      await createToolingPlan({ toolingId: planToolingId, inspectionItem, acceptanceCriteria, frequencyType, frequencyValue, responsiblePerson: '', lastResultDate: '', note: '' })
      setMessage('Đã tạo kế hoạch kiểm tra Tooling'); setInspectionItem(''); setAcceptanceCriteria(''); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo kế hoạch Tooling') }
    finally { setBusy('') }
  }

  const submitModification = async (event: FormEvent) => {
    event.preventDefault(); setBusy('create-mod'); setError(''); setMessage('')
    try {
      await createToolingModification({ toolingId: modToolingId, modificationDate: new Date().toISOString().slice(0, 10), modificationType: 'PHYSICAL_MODIFICATION', reason: modReason, ecnNumber: '', beforeAfterDescription: beforeAfter })
      setMessage('Đã tạo BM-11 modification'); setModReason(''); setBeforeAfter(''); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo modification') }
    finally { setBusy('') }
  }

  const transition = async (modificationId: string, action: 'APPROVE' | 'QA_CONFIRM' | 'COMPLETE') => {
    setBusy(modificationId); setError(''); setMessage('')
    try { await transitionToolingModification(modificationId, action, updatedDocs[modificationId] || ''); setMessage(`${modificationId}: ${action}`); await refresh() }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể chuyển trạng thái modification') }
    finally { setBusy('') }
  }

  return <div className="stack">
    <section className="metric-grid" aria-label="Tooling live summary">
      <article><span>Tooling Master</span><strong>{tooling.length}</strong><small>BM-09</small></article>
      <article><span>Kế hoạch kiểm tra</span><strong>{plans.length}</strong><small>BM-10A</small></article>
      <article><span>Modification mở</span><strong>{mods.filter((item) => item.status !== 'COMPLETED').length}</strong><small>BM-11</small></article>
      <article><span>Nguồn dữ liệu</span><strong>LIVE</strong><small>Supabase PostgreSQL</small></article>
    </section>
    {loading ? <p className="muted" role="status">Đang tải Tooling…</p> : null}
    {error ? <div className="record-card" role="alert"><b>Có lỗi</b><p>{error}</p></div> : null}
    {message ? <div className="record-card" role="status"><b>{message}</b></div> : null}

    <section className="content-card"><div className="section-heading"><div><p className="eyebrow">BM-TBSX-09</p><h2>Tooling Master</h2></div></div>
      <form className="stack" onSubmit={submitTooling}>
        <label>Mã Tooling<input value={toolingId} onChange={(e) => setToolingId(e.target.value)} required /></label>
        <label>Tên Tooling<input value={toolingName} onChange={(e) => setToolingName(e.target.value)} required /></label>
        <label>Loại<select value={toolingType} onChange={(e) => setToolingType(e.target.value)}><option>JIG</option><option>FIXTURE</option><option>MOLD</option><option>DIE</option><option>CUTTING_TOOL</option><option>PERISHABLE_TOOL</option><option>OTHER</option></select></label>
        <label>Sở hữu<select value={ownership} onChange={(e) => setOwnership(e.target.value)}><option>COMPANY</option><option>CUSTOMER</option></select></label>
        {ownership === 'CUSTOMER' ? <label>Khách hàng<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required /></label> : null}
        <button className="primary-action" disabled={busy === 'create-tooling'}>{busy === 'create-tooling' ? 'Đang tạo…' : '+ Thêm Tooling'}</button>
      </form>
      {tooling.length ? <div className="table-wrap"><table><thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th>Sở hữu</th><th>Trạng thái</th></tr></thead><tbody>{tooling.map((item) => <tr key={item.toolingId}><td><b>{item.toolingId}</b></td><td>{item.toolingName}</td><td>{item.toolingType}</td><td>{item.ownership}</td><td>{item.status}</td></tr>)}</tbody></table></div> : <p className="muted">Chưa có Tooling.</p>}
    </section>

    <section className="content-card"><div className="section-heading"><div><p className="eyebrow">BM-TBSX-10A</p><h3>Kế hoạch kiểm tra Tooling</h3></div></div>
      <form className="stack" onSubmit={submitPlan}>
        <label>Tooling<select value={planToolingId} onChange={(e) => setPlanToolingId(e.target.value)}>{tooling.map((item) => <option key={item.toolingId}>{item.toolingId}</option>)}</select></label>
        <label>Hạng mục kiểm tra<input value={inspectionItem} onChange={(e) => setInspectionItem(e.target.value)} required /></label>
        <label>Tiêu chuẩn chấp nhận<input value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} required /></label>
        <label>Tần suất<select value={frequencyType} onChange={(e) => setFrequencyType(e.target.value)}><option>DAY</option><option>WEEK</option><option>MONTH</option><option>USE_COUNT</option><option>OUTPUT_COUNT</option></select></label>
        <label>Giá trị<input type="number" min="1" value={frequencyValue} onChange={(e) => setFrequencyValue(e.target.value)} required /></label>
        <button className="primary-action" disabled={busy === 'create-plan' || !tooling.length}>+ Tạo kế hoạch</button>
      </form>
    </section>

    <section className="content-card"><div className="section-heading"><div><p className="eyebrow">BM-TBSX-11</p><h3>Tooling Modification</h3></div></div>
      <form className="stack" onSubmit={submitModification}>
        <label>Tooling<select value={modToolingId} onChange={(e) => setModToolingId(e.target.value)}>{tooling.map((item) => <option key={item.toolingId}>{item.toolingId}</option>)}</select></label>
        <label>Lý do<textarea value={modReason} onChange={(e) => setModReason(e.target.value)} required /></label>
        <label>Before / After<textarea value={beforeAfter} onChange={(e) => setBeforeAfter(e.target.value)} required /></label>
        <button className="primary-action" disabled={busy === 'create-mod' || !tooling.length}>+ Tạo Modification</button>
      </form>
      <div className="stack">{mods.map((item) => <article className="record-card" key={item.modificationId}>
        <div><b>{item.modificationId}</b><span>{item.toolingId} · {item.modificationType}</span></div><span className={`badge ${item.status === 'COMPLETED' ? 'running' : 'maintenance'}`}>{item.status}</span><p>{item.reason}</p>
        <small>Proposed: {item.proposedBy || '—'} · Approved: {item.approvedBy || '—'} · QA: {item.qaConfirmedBy || '—'}</small>
        {item.status !== 'COMPLETED' ? <div className="stack">
          {!item.approvedBy ? <button className="secondary-action" type="button" disabled={busy === item.modificationId} onClick={() => transition(item.modificationId, 'APPROVE')}>Approve</button> : null}
          {!item.qaConfirmedBy ? <button className="secondary-action" type="button" disabled={busy === item.modificationId} onClick={() => transition(item.modificationId, 'QA_CONFIRM')}>QA Confirm</button> : null}
          {item.approvedBy ? <><label>Tài liệu đã cập nhật<input value={updatedDocs[item.modificationId] || ''} onChange={(e) => setUpdatedDocs((current) => ({ ...current, [item.modificationId]: e.target.value }))} /></label><button className="secondary-action" type="button" disabled={busy === item.modificationId} onClick={() => transition(item.modificationId, 'COMPLETE')}>Complete</button></> : null}
        </div> : null}
      </article>)}</div>
    </section>
  </div>
}
