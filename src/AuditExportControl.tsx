import { useState } from 'react'
import { buildAuditPackage, downloadBlob } from './data/auditPackage'

export function AuditExportControl() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')

  async function exportPackage() {
    setRunning(true)
    setMessage('Đang đọc dữ liệu và lập danh mục bằng chứng…')
    try {
      const result = await buildAuditPackage()
      downloadBlob(result.blob, result.filename)
      setMessage(`Đã tạo ${result.filename}`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể tạo gói bằng chứng kiểm tra')
    } finally {
      setRunning(false)
    }
  }

  return <div className="audit-export-control">
    <button type="button" disabled={running} onClick={() => void exportPackage()}>{running ? 'Đang đóng gói…' : 'Xuất gói bằng chứng (.zip)'}</button>
    {message ? <small role="status">{message}</small> : null}
  </div>
}
