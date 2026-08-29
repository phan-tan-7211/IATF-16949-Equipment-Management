import { useEffect, useState } from 'react'
import './Calibration.css'
import { canRecordCalibration, useAppRole } from './auth/AppRoleContext'
import { supabase } from './data/supabaseClient'

type EvaluationRow = { calibrationLogId:string; equipmentId:string; calibrationDate:string; calibrationResult:string; provider:string; evaluationResult:string; evaluationNote:string; evaluatedBy:string; evaluatedAt:string }
function text(v:unknown){return v==null?'':String(v).trim()}

async function loadRows():Promise<EvaluationRow[]>{
  const {data,error}=await supabase.from('calibration_log').select('*').order('calibration_date',{ascending:false}).limit(150)
  if(error)throw error
  return ((data||[]) as Array<Record<string,unknown>>).map((row)=>{const s=(row.source_data as Record<string,unknown>|null)||{};return{calibrationLogId:text(row.calibration_log_id),equipmentId:text(row.equipment_id),calibrationDate:text(row.calibration_date),calibrationResult:text(row.result),provider:text(s.provider),evaluationResult:text(s.evaluationResult),evaluationNote:text(s.evaluationNote),evaluatedBy:text(s.evaluatedBy),evaluatedAt:text(s.evaluatedAt)}})
}

export function LiveCalibrationEvaluationPanel(){
  const role=useAppRole(); const canEvaluate=canRecordCalibration(role)
  const [rows,setRows]=useState<EvaluationRow[]>([]); const [selected,setSelected]=useState<EvaluationRow|null>(null)
  const [result,setResult]=useState<'PASS'|'FAIL'|'LIMITED_USE'>('PASS'); const [note,setNote]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('')
  const refresh=async()=>{setRows(await loadRows());setError('')}
  useEffect(()=>{void refresh().catch((e)=>setError(e instanceof Error?e.message:'Không tải được evaluation'))},[])
  const pending=rows.filter((r)=>!r.evaluationResult), done=rows.filter((r)=>r.evaluationResult)
  const submit=async()=>{if(!selected||!canEvaluate)return;if(result!=='PASS'&&!note.trim()){setError('FAIL / LIMITED_USE bắt buộc ghi lý do đánh giá.');return}setBusy(true);setError('');setMessage('');try{const {error:e}=await supabase.rpc('rpc_evaluate_calibration',{p_calibration_log_id:selected.calibrationLogId,p_evaluation_result:result,p_evaluation_note:note.trim()});if(e)throw e;setMessage(`Đã đánh giá ${selected.calibrationLogId}: ${result}`);setSelected(null);setNote('');setResult('PASS');await refresh()}catch(e){setError(e instanceof Error?e.message:'Không thể đánh giá')}finally{setBusy(false)}}
  return <section className="calibration-surface"><header className="calibration-header"><div><p className="eyebrow">Calibration Post-Evaluation</p><h2>Đánh giá sau hiệu chuẩn</h2><p>Khôi phục workflow parity Apps Script · mỗi Calibration Log chỉ đánh giá một lần.</p></div><span className="calibration-link-state link-linked">{pending.length} chờ đánh giá</span></header>
    {message?<div className="calibration-state success">{message}</div>:null}{error?<div className="calibration-state error">{error}</div>:null}
    {pending.length?<div className="calibration-table-scroll"><table className="calibration-table"><thead><tr><th>Log</th><th>Thiết bị</th><th>Ngày</th><th>Kết quả hiệu chuẩn</th><th>Đơn vị</th><th /></tr></thead><tbody>{pending.map((row)=><tr key={row.calibrationLogId}><td><b>{row.calibrationLogId}</b></td><td>{row.equipmentId}</td><td>{row.calibrationDate}</td><td>{row.calibrationResult}</td><td>{row.provider||'—'}</td><td>{canEvaluate?<button className="calibration-row-action" onClick={()=>{setSelected(row);setResult('PASS');setNote('')}}>Đánh giá</button>:<span className="calibration-readonly">{role}</span>}</td></tr>)}</tbody></table></div>:<div className="calibration-state success">Không có Calibration Log chờ đánh giá.</div>}
    {done.length?<details className="calibration-detail-section"><summary>Lịch sử đã đánh giá ({done.length})</summary><div className="calibration-log-list">{done.slice(0,30).map((row)=><article key={row.calibrationLogId}><div><b>{row.equipmentId} · {row.calibrationDate}</b><span>{row.evaluationResult}</span></div><small>{row.evaluatedBy||'—'} · {row.evaluatedAt?new Date(row.evaluatedAt).toLocaleString('vi-VN'):'—'}</small>{row.evaluationNote?<p>{row.evaluationNote}</p>:null}</article>)}</div></details>:null}
    {selected&&canEvaluate?<div className="calibration-layer" onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelected(null)}}><aside className="calibration-drawer" role="dialog" aria-modal="true"><header><div><p className="eyebrow">Post Evaluation</p><h2>{selected.equipmentId}</h2><p>{selected.calibrationLogId} · {selected.calibrationDate}</p></div><button onClick={()=>setSelected(null)}>×</button></header><div className="calibration-detail-grid"><div><span>Kết quả hiệu chuẩn</span><strong>{selected.calibrationResult}</strong></div><div><span>Đơn vị</span><strong>{selected.provider||'—'}</strong></div></div><div className="calibration-record-form"><label><span>Đánh giá</span><select value={result} onChange={(e)=>setResult(e.target.value as typeof result)}><option>PASS</option><option>LIMITED_USE</option><option>FAIL</option></select></label><label><span>Ghi chú đánh giá</span><textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder={result==='PASS'?'Có thể để trống':'Bắt buộc nêu lý do / giới hạn sử dụng'}/></label><button className="calibration-record-button primary" disabled={busy} onClick={()=>void submit()}>{busy?'Đang lưu…':'Xác nhận đánh giá'}</button></div></aside></div>:null}
  </section>
}
