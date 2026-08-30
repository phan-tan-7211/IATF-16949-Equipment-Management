import { useEffect, useMemo, useState } from 'react'
import './A4PrintCenter.css'
import { supabase } from './data/supabaseClient'

type Row = Record<string, unknown>
type DocType = 'equipment' | 'bm03' | 'bm05' | 'bm08' | 'bm06' | 'calibration'

const DOCS: Array<{ id: DocType; label: string; code: string; table: string; idKey: string; order: string }> = [
  { id: 'equipment', label: 'Lý lịch thiết bị', code: 'BM-TBSX-01', table: 'equipment_master', idKey: 'equipment_id', order: 'equipment_id' },
  { id: 'bm03', label: 'Kế hoạch bảo dưỡng máy', code: 'BM-TBSX-03', table: 'maintenance_plan', idKey: 'plan_id', order: 'created_at' },
  { id: 'bm05', label: 'Biên bản bàn giao trang thiết bị', code: 'BM-TBSX-05', table: 'equipment_handover', idKey: 'handover_id', order: 'created_at' },
  { id: 'bm08', label: 'Kết quả bảo dưỡng sửa chữa thiết bị', code: 'BM-TBSX-08', table: 'maintenance_execution', idKey: 'execution_id', order: 'created_at' },
  { id: 'bm06', label: 'Bảng theo dõi chỉ số dừng máy', code: 'BM-TBSX-06', table: 'downtime_event', idKey: 'downtime_id', order: 'start_time' },
  { id: 'calibration', label: 'Hồ sơ hiệu chuẩn', code: 'CALIBRATION', table: 'calibration_log', idKey: 'calibration_log_id', order: 'created_at' },
]

const LABELS: Record<string, string> = {
  equipment_id: 'Mã thiết bị', equipment_type: 'Loại thiết bị', control_number: 'Số quản lý', qr_code: 'QR', equipment_name: 'Tên thiết bị',
  model: 'Model', manufacturer: 'Nhà sản xuất', serial_number: 'Số Serial', department: 'Bộ phận', status: 'Trạng thái', active: 'Đang quản lý',
  plan_id: 'Mã kế hoạch', handover_id: 'Mã bàn giao', work_order_id: 'Work Order', accepted: 'Đã tiếp nhận', equipment_condition: 'Tình trạng thiết bị',
  execution_id: 'Mã thực hiện', downtime_id: 'Mã dừng máy', start_time: 'Bắt đầu dừng', end_time: 'Khôi phục', calibration_log_id: 'Mã hiệu chuẩn',
  calibration_date: 'Ngày hiệu chuẩn', next_due_date: 'Ngày đến hạn tiếp theo', result: 'Kết quả', actor_email: 'Người ghi nhận', created_at: 'Ngày tạo', updated_at: 'Cập nhật',
  maintenanceType: 'Loại bảo dưỡng', frequency: 'Tần suất', plannedDate: 'Ngày dự kiến', plannedWindow: 'Khung thời gian', responsiblePerson: 'Người thực hiện', note: 'Ghi chú',
  item: 'Hạng mục', item_text: 'Hạng mục', standard: 'Tiêu chuẩn', standard_text: 'Tiêu chuẩn', method: 'Phương pháp', method_text: 'Phương pháp', executionDate: 'Ngày thực hiện', inspectionDepartment: 'Bộ phận kiểm tra', mark: 'Kết quả', result_text: 'Kết quả',
  repairContent: 'Nội dung sửa chữa', maintenanceContent: 'Nội dung bảo dưỡng', inspector: 'Người kiểm tra', handoverAt: 'Thời gian bàn giao', location: 'Địa điểm',
  handoverPerson: 'Người giao', receiverPerson: 'Người nhận', reason: 'Lý do bàn giao', documentsAccessories: 'Tài liệu / phụ kiện', otherAgreement: 'Thỏa thuận khác',
  cause: 'Nguyên nhân', detail: 'Mô tả', recoveryAction: 'Hành động khôi phục', recorder: 'Người ghi', handler: 'Người xử lý', reporter: 'Người báo cáo',
  evaluationResult: 'Đánh giá sau hiệu chuẩn', evaluationNote: 'Nhận xét đánh giá', evaluatedBy: 'Người đánh giá', evaluatedAt: 'Thời điểm đánh giá',
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function sourceData(row: Row | null) {
  const value = row?.source_data
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function printableFields(row: Row | null) {
  if (!row) return []
  return Object.entries(row)
    .filter(([key]) => key !== 'source_data')
    .concat(Object.entries(sourceData(row)))
    .filter(([, value]) => value !== null && value !== undefined && value !== '' && typeof value !== 'object')
}

function DetailTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="a4-empty">Chưa có hạng mục chi tiết.</p>
  const normalized = rows.map((row) => ({ ...row, ...sourceData(row) }))
  const preferred = ['item_text', 'item', 'standard_text', 'standard', 'method_text', 'method', 'result_text', 'mark', 'repairContent', 'maintenanceContent', 'inspector']
  const columns = preferred.filter((key) => normalized.some((row) => row[key] !== undefined && row[key] !== null && row[key] !== ''))
  return <table className="a4-table"><thead><tr><th>STT</th>{columns.map((key) => <th key={key}>{LABELS[key] || key}</th>)}</tr></thead><tbody>{normalized.map((row, index) => <tr key={String(row.maintenance_plan_item_id || row.maintenance_result_item_id || index)}><td>{index + 1}</td>{columns.map((key) => <td key={key}>{display(row[key])}</td>)}</tr>)}</tbody></table>
}

export function A4PrintCenter() {
  const [docType, setDocType] = useState<DocType>('equipment')
  const [records, setRecords] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [details, setDetails] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const config = DOCS.find((item) => item.id === docType) || DOCS[0]

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setSelectedId(''); setDetails([])
    const load = async () => {
      try {
        const { data, error: cause } = await supabase.from(config.table).select('*').order(config.order, { ascending: config.id === 'equipment' }).limit(config.id === 'bm06' ? 500 : 250)
        if (!active) return
        if (cause) setError(cause.message)
        const next = (data || []) as Row[]
        setRecords(next)
        setSelectedId(next.length ? String(next[0][config.idKey] || '') : '')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [config])

  const selected = useMemo(() => records.find((row) => String(row[config.idKey] || '') === selectedId) || null, [records, selectedId, config.idKey])

  useEffect(() => {
    let active = true
    setDetails([])
    if (!selected) return () => { active = false }
    const run = async () => {
      if (docType === 'bm03') {
        const { data, error: cause } = await supabase.from('maintenance_plan_item').select('*').eq('plan_id', selected.plan_id).order('sort_order')
        if (cause) throw cause
        if (active) setDetails((data || []) as Row[])
      } else if (docType === 'bm08') {
        const { data, error: cause } = await supabase.from('maintenance_result_item').select('*').eq('execution_id', selected.execution_id).order('created_at')
        if (cause) throw cause
        if (active) setDetails((data || []) as Row[])
      }
    }
    void run().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết') })
    return () => { active = false }
  }, [docType, selected])

  const bm06Rows = docType === 'bm06' ? records.map((row) => ({ ...row, ...sourceData(row) })) : []

  return <div className="print-center">
    <section className="print-toolbar no-print">
      <div><p className="eyebrow">Audit-ready / Source-first</p><h2>Hồ sơ A4 / PDF</h2><p>Dùng chính dữ liệu Supabase đã nhập. In: Ctrl+P → Save as PDF.</p></div>
      <div className="print-controls">
        <label>Biểu mẫu<select value={docType} onChange={(event) => setDocType(event.target.value as DocType)}>{DOCS.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.label}</option>)}</select></label>
        {docType !== 'bm06' ? <label>Hồ sơ<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!records.length}>{records.map((row) => <option key={String(row[config.idKey])} value={String(row[config.idKey])}>{String(row[config.idKey])} · {String(row.equipment_id || row.equipment_name || '')}</option>)}</select></label> : null}
        <button type="button" disabled={loading || (docType !== 'bm06' && !selected)} onClick={() => window.print()}>In / Xuất PDF A4</button>
      </div>
      {loading ? <p>Đang tải hồ sơ…</p> : null}{error ? <p className="print-error">{error}</p> : null}
    </section>

    <article className={`a4-document${docType === 'bm06' ? ' landscape' : ''}`}>
      <header className="a4-header"><div><b>CORE ELECTRONICS VIETNAM</b><span>HỆ THỐNG QUẢN LÝ THIẾT BỊ · IATF 16949</span></div><div><strong>{config.code}</strong><span>Bản in từ Supabase</span></div></header>
      <h1>{config.label.toUpperCase()}</h1>
      {docType === 'bm06' ? <>
        <div className="a4-meta"><span>Thời điểm in: {new Date().toLocaleString('vi-VN')}</span><span>Số sự kiện: {bm06Rows.length}</span></div>
        <table className="a4-table"><thead><tr><th>STT</th><th>Thiết bị</th><th>Bắt đầu</th><th>Khôi phục</th><th>Nguyên nhân</th><th>Mô tả / hành động</th></tr></thead><tbody>{bm06Rows.map((row, index) => <tr key={String(row.downtime_id)}><td>{index + 1}</td><td>{display(row.equipment_id)}</td><td>{display(row.start_time)}</td><td>{display(row.end_time)}</td><td>{display(row.cause)}</td><td>{display(row.detail)} / {display(row.recoveryAction)}</td></tr>)}</tbody></table>
      </> : selected ? <>
        <div className="a4-meta"><span>Mã hồ sơ: {display(selected[config.idKey])}</span><span>Thời điểm in: {new Date().toLocaleString('vi-VN')}</span></div>
        <section className="a4-fields">{printableFields(selected).map(([key, value], index) => <div key={`${key}-${index}`}><span>{LABELS[key] || key}</span><strong>{display(value)}</strong></div>)}</section>
        {(docType === 'bm03' || docType === 'bm08') ? <section className="a4-detail"><h2>Chi tiết hạng mục</h2><DetailTable rows={details} /></section> : null}
        <footer className="a4-signatures"><div><span>Người lập / thực hiện</span><b>Ký, ghi rõ họ tên</b></div><div><span>Người kiểm tra / xác nhận</span><b>Ký, ghi rõ họ tên</b></div><div><span>Phê duyệt</span><b>Ký, ghi rõ họ tên</b></div></footer>
      </> : <p className="a4-empty">Chưa có hồ sơ nguồn cho biểu mẫu này.</p>}
      <p className="a4-footnote">Dữ liệu được render trực tiếp từ hệ thống Supabase. Không nhập lại dữ liệu riêng cho bản in.</p>
    </article>
  </div>
}
