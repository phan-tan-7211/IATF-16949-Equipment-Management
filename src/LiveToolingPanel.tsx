import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './Tooling.css'
import { canCreateToolingMaster, canCreateToolingModification, canCreateToolingPlan, canTransitionTooling, useAppRole } from './auth/AppRoleContext'
import { createTooling, createToolingModification, createToolingPlan, loadLiveTooling, transitionToolingModification, type LiveTooling, type LiveToolingModification, type LiveToolingPlan } from './data/liveTooling'

type Tab = 'MASTER' | 'PLAN' | 'MOD'
type Drawer = '' | 'TOOLING' | 'PLAN' | 'MOD'

export function LiveToolingPanel() {
  const role = useAppRole()
  const canCreateMaster = canCreateToolingMaster(role)
  const canCreatePlan = canCreateToolingPlan(role)
  const canCreateMod = canCreateToolingModification(role)
  const [tooling, setTooling] = useState<LiveTooling[]>([])
  const [plans, setPlans] = useState<LiveToolingPlan[]>([])
  const [mods, setMods] = useState<LiveToolingModification[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<Tab>('MASTER')
  const [drawer, setDrawer] = useState<Drawer>('')
  const [query, setQuery] = useState('')
  const [selectedModId, setSelectedModId] = useState('')
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

  const applyResult = (result: Awaited<ReturnType<typeof loadLiveTooling>>) => {
    setTooling(result.tooling); setPlans(result.plans); setMods(result.modifications)
    setPlanToolingId((current) => current || result.tooling[0]?.toolingId || '')
    setModToolingId((current) => current || result.tooling[0]?.toolingId || '')
    setError('')
  }
  const refresh = async () => applyResult(await loadLiveTooling())

  useEffect(() => {
    let active = true
    loadLiveTooling().then((result) => { if (active) applyResult(result) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Tooling') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!drawer && !selectedModId) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDrawer(''); setSelectedModId('') } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawer, selectedModId])

  const normalized = query.trim().toLocaleLowerCase()
  const filteredTooling = useMemo(() => tooling.filter((item) => !normalized || [item.toolingId,item.toolingName,item.toolingType,item.ownership,item.status,item.managingDepartment,item.storageLocation].join(' ').toLocaleLowerCase().includes(normalized)), [tooling, normalized])
  const filteredPlans = useMemo(() => plans.filter((item) => !normalized || [item.toolingPlanId,item.toolingId,item.inspectionItem,item.acceptanceCriteria,item.frequencyType,item.responsiblePerson].join(' ').toLocaleLowerCase().includes(normalized)), [plans, normalized])
  const filteredMods = useMemo(() => mods.filter((item) => !normalized || [item.modificationId,item.toolingId,item.modificationType,item.reason,item.status,item.proposedBy,item.approvedBy,item.qaConfirmedBy].join(' ').toLocaleLowerCase().includes(normalized)), [mods, normalized])
  const selectedMod = selectedModId ? mods.find((item) => item.modificationId === selectedModId) || null : null

  const submitTooling = async (event: FormEvent) => {
    event.preventDefault(); if (!canCreateMaster) return setError(`Role ${role} không có quyền tạo Tooling Master.`)
    setBusy('create-tooling'); setError(''); setMessage('')
    try {
      await createTooling({ toolingId, toolingName, toolingType, ownership, customerName, status: 'IN_PRODUCTION', serialOrAssetNumber: '', usedFor: '', managingDepartment: '', storageLocation: '', commissionDate: '', inspectionCycleDays: '', note: '' })
      setMessage(`Đã tạo ${toolingId}`); setToolingId(''); setToolingName(''); setDrawer(''); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo Tooling') } finally { setBusy('') }
  }
  const submitPlan = async (event: FormEvent) => {
    event.preventDefault(); if (!canCreatePlan) return setError(`Role ${role} không có quyền tạo kế hoạch Tooling.`)
    setBusy('create-plan'); setError(''); setMessage('')
    try {
      await createToolingPlan({ toolingId: planToolingId, inspectionItem, acceptanceCriteria, frequencyType, frequencyValue, responsiblePerson: '', lastResultDate: '', note: '' })
      setMessage('Đã tạo kế hoạch kiểm tra Tooling'); setInspectionItem(''); setAcceptanceCriteria(''); setDrawer(''); setTab('PLAN'); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo kế hoạch Tooling') } finally { setBusy('') }
  }
  const submitModification = async (event: FormEvent) => {
    event.preventDefault(); if (!canCreateMod) return setError(`Role ${role} không có quyền tạo Tooling Modification.`)
    setBusy('create-mod'); setError(''); setMessage('')
    try {
      await createToolingModification({ toolingId: modToolingId, modificationDate: new Date().toISOString().slice(0, 10), modificationType: 'PHYSICAL_MODIFICATION', reason: modReason, ecnNumber: '', beforeAfterDescription: beforeAfter })
      setMessage('Đã tạo BM-11 modification'); setModReason(''); setBeforeAfter(''); setDrawer(''); setTab('MOD'); await refresh()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể tạo modification') } finally { setBusy('') }
  }
  const transition = async (modificationId: string, action: 'APPROVE' | 'QA_CONFIRM' | 'COMPLETE') => {
    if (!canTransitionTooling(role, action)) return setError(`Role ${role} không có quyền ${action}.`)
    setBusy(modificationId); setError(''); setMessage('')
    try { await transitionToolingModification(modificationId, action, updatedDocs[modificationId] || ''); setMessage(`${modificationId}: ${action}`); await refresh() }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể chuyển trạng thái modification') } finally { setBusy('') }
  }

  const drawerAllowed = drawer === 'TOOLING' ? canCreateMaster : drawer === 'PLAN' ? canCreatePlan : drawer === 'MOD' ? canCreateMod : false

  return <div className="tooling-page">
    <section className="tooling-summary"><article><span>Tooling Master</span><strong>{tooling.length}</strong><small>BM-09</small></article><article><span>Kế hoạch kiểm tra</span><strong>{plans.length}</strong><small>BM-10A</small></article><article><span>Modification mở</span><strong>{mods.filter((item) => item.status !== 'COMPLETED').length}</strong><small>BM-11</small></article><article><span>Hoàn tất</span><strong>{mods.filter((item) => item.status === 'COMPLETED').length}</strong><small>Modification</small></article></section>
    <section className="tooling-surface">
      <header className="tooling-header"><div><p className="eyebrow">Jig & Tooling Control</p><h2>Tooling Workspace</h2><p>Dữ liệu và workflow trực tiếp từ Supabase RPC</p></div><div className="tooling-actions"><button type="button" onClick={() => void refresh()}>Làm mới</button>{canCreateMaster?<button type="button" onClick={() => setDrawer('TOOLING')}>+ Tooling</button>:null}{canCreatePlan?<button type="button" onClick={() => setDrawer('PLAN')}>+ Kế hoạch</button>:null}{canCreateMod?<button className="tooling-primary" type="button" onClick={() => setDrawer('MOD')}>+ Modification</button>:null}</div></header>
      <div className="tooling-tabs"><button className={tab==='MASTER'?'active':''} onClick={() => setTab('MASTER')}>Master ({tooling.length})</button><button className={tab==='PLAN'?'active':''} onClick={() => setTab('PLAN')}>Kế hoạch ({plans.length})</button><button className={tab==='MOD'?'active':''} onClick={() => setTab('MOD')}>Modification ({mods.length})</button></div>
      <div className="tooling-toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã, tên, loại, trạng thái, người phụ trách…" /></div>
      {loading ? <div className="tooling-state">Đang tải Tooling…</div> : null}{error ? <div className="tooling-state error">{error}</div> : null}{message ? <div className="tooling-feedback">{message}</div> : null}
      {!loading && !error && tab==='MASTER' ? <div className="tooling-table-scroll"><table><thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th>Sở hữu</th><th>Bộ phận</th><th>Vị trí</th><th>Trạng thái</th></tr></thead><tbody>{filteredTooling.map((item)=><tr key={item.toolingId}><td><b>{item.toolingId}</b></td><td>{item.toolingName||'—'}</td><td>{item.toolingType||'—'}</td><td>{item.ownership||'—'}</td><td>{item.managingDepartment||'—'}</td><td>{item.storageLocation||'—'}</td><td><span className="tooling-badge">{item.status||'—'}</span></td></tr>)}</tbody></table></div> : null}
      {!loading && !error && tab==='PLAN' ? <div className="tooling-table-scroll"><table><thead><tr><th>Plan ID</th><th>Tooling</th><th>Hạng mục</th><th>Tiêu chuẩn</th><th>Tần suất</th><th>Phụ trách</th><th>Kết quả gần nhất</th></tr></thead><tbody>{filteredPlans.map((item)=><tr key={item.toolingPlanId}><td><b>{item.toolingPlanId}</b></td><td>{item.toolingId}</td><td>{item.inspectionItem||'—'}</td><td>{item.acceptanceCriteria||'—'}</td><td>{item.frequencyValue} {item.frequencyType}</td><td>{item.responsiblePerson||'—'}</td><td>{item.lastResultDate||'—'}</td></tr>)}</tbody></table></div> : null}
      {!loading && !error && tab==='MOD' ? <div className="tooling-table-scroll"><table><thead><tr><th>ID</th><th>Tooling</th><th>Loại</th><th>Lý do</th><th>Proposed</th><th>Approved</th><th>QA</th><th>Trạng thái</th><th /></tr></thead><tbody>{filteredMods.map((item)=><tr key={item.modificationId}><td><button className="tooling-link" onClick={() => setSelectedModId(item.modificationId)}>{item.modificationId}</button></td><td>{item.toolingId}</td><td>{item.modificationType}</td><td>{item.reason||'—'}</td><td>{item.proposedBy||'—'}</td><td>{item.approvedBy||'—'}</td><td>{item.qaConfirmedBy||'—'}</td><td><span className={`tooling-badge ${item.status==='COMPLETED'?'done':''}`}>{item.status}</span></td><td><button onClick={() => setSelectedModId(item.modificationId)}>Xem</button></td></tr>)}</tbody></table></div> : null}
    </section>

    {drawer && drawerAllowed ? <div className="tooling-layer" onMouseDown={(e)=>{if(e.target===e.currentTarget)setDrawer('')}}><aside className="tooling-drawer" role="dialog" aria-modal="true"><header><div><p className="eyebrow">{drawer==='TOOLING'?'BM-TBSX-09':drawer==='PLAN'?'BM-TBSX-10A':'BM-TBSX-11'}</p><h2>{drawer==='TOOLING'?'Thêm Tooling':drawer==='PLAN'?'Tạo kế hoạch kiểm tra':'Tạo Modification'}</h2></div><button onClick={()=>setDrawer('')}>×</button></header>
      {drawer==='TOOLING'?<form onSubmit={submitTooling}><label><span>Mã Tooling</span><input value={toolingId} onChange={(e)=>setToolingId(e.target.value)} required/></label><label><span>Tên Tooling</span><input value={toolingName} onChange={(e)=>setToolingName(e.target.value)} required/></label><label><span>Loại</span><select value={toolingType} onChange={(e)=>setToolingType(e.target.value)}><option>JIG</option><option>FIXTURE</option><option>MOLD</option><option>DIE</option><option>CUTTING_TOOL</option><option>PERISHABLE_TOOL</option><option>OTHER</option></select></label><label><span>Sở hữu</span><select value={ownership} onChange={(e)=>setOwnership(e.target.value)}><option>COMPANY</option><option>CUSTOMER</option></select></label>{ownership==='CUSTOMER'?<label><span>Khách hàng</span><input value={customerName} onChange={(e)=>setCustomerName(e.target.value)} required/></label>:null}<footer><button type="button" onClick={()=>setDrawer('')}>Hủy</button><button className="tooling-primary" disabled={busy==='create-tooling'}>{busy==='create-tooling'?'Đang tạo…':'Tạo Tooling'}</button></footer></form>:null}
      {drawer==='PLAN'?<form onSubmit={submitPlan}><label><span>Tooling</span><select value={planToolingId} onChange={(e)=>setPlanToolingId(e.target.value)}>{tooling.map((i)=><option key={i.toolingId}>{i.toolingId}</option>)}</select></label><label><span>Hạng mục kiểm tra</span><input value={inspectionItem} onChange={(e)=>setInspectionItem(e.target.value)} required/></label><label><span>Tiêu chuẩn chấp nhận</span><input value={acceptanceCriteria} onChange={(e)=>setAcceptanceCriteria(e.target.value)} required/></label><label><span>Tần suất</span><select value={frequencyType} onChange={(e)=>setFrequencyType(e.target.value)}><option>DAY</option><option>WEEK</option><option>MONTH</option><option>USE_COUNT</option><option>OUTPUT_COUNT</option></select></label><label><span>Giá trị</span><input type="number" min="1" value={frequencyValue} onChange={(e)=>setFrequencyValue(e.target.value)} required/></label><footer><button type="button" onClick={()=>setDrawer('')}>Hủy</button><button className="tooling-primary" disabled={busy==='create-plan'||!tooling.length}>Tạo kế hoạch</button></footer></form>:null}
      {drawer==='MOD'?<form onSubmit={submitModification}><label><span>Tooling</span><select value={modToolingId} onChange={(e)=>setModToolingId(e.target.value)}>{tooling.map((i)=><option key={i.toolingId}>{i.toolingId}</option>)}</select></label><label><span>Lý do</span><textarea value={modReason} onChange={(e)=>setModReason(e.target.value)} required/></label><label><span>Before / After</span><textarea value={beforeAfter} onChange={(e)=>setBeforeAfter(e.target.value)} required/></label><footer><button type="button" onClick={()=>setDrawer('')}>Hủy</button><button className="tooling-primary" disabled={busy==='create-mod'||!tooling.length}>Tạo Modification</button></footer></form>:null}
    </aside></div>:null}

    {selectedMod?<div className="tooling-layer" onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelectedModId('')}}><aside className="tooling-drawer" role="dialog" aria-modal="true"><header><div><p className="eyebrow">BM-TBSX-11</p><h2>{selectedMod.modificationId}</h2><p>{selectedMod.toolingId}</p></div><button onClick={()=>setSelectedModId('')}>×</button></header><div className="tooling-detail"><span>Trạng thái</span><strong>{selectedMod.status}</strong><span>Lý do</span><p>{selectedMod.reason||'—'}</p><span>Proposed</span><p>{selectedMod.proposedBy||'—'}</p><span>Approved</span><p>{selectedMod.approvedBy||'—'}</p><span>QA Confirm</span><p>{selectedMod.qaConfirmedBy||'—'}</p></div>{selectedMod.status!=='COMPLETED'?<div className="tooling-workflow">{!selectedMod.approvedBy&&canTransitionTooling(role,'APPROVE')?<button disabled={busy===selectedMod.modificationId} onClick={()=>void transition(selectedMod.modificationId,'APPROVE')}>Approve</button>:null}{!selectedMod.qaConfirmedBy&&canTransitionTooling(role,'QA_CONFIRM')?<button disabled={busy===selectedMod.modificationId} onClick={()=>void transition(selectedMod.modificationId,'QA_CONFIRM')}>QA Confirm</button>:null}{selectedMod.approvedBy&&canTransitionTooling(role,'COMPLETE')?<><label><span>Tài liệu đã cập nhật</span><input value={updatedDocs[selectedMod.modificationId]||''} onChange={(e)=>setUpdatedDocs((c)=>({...c,[selectedMod.modificationId]:e.target.value}))}/></label><button className="tooling-primary" disabled={busy===selectedMod.modificationId} onClick={()=>void transition(selectedMod.modificationId,'COMPLETE')}>Complete</button></>:null}{!canTransitionTooling(role,'APPROVE')&&!canTransitionTooling(role,'QA_CONFIRM')&&!canTransitionTooling(role,'COMPLETE')?<span className="tooling-readonly">Chỉ xem · {role}</span>:null}</div>:null}</aside></div>:null}
  </div>
}
