import { useEffect, useMemo, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import './QrScanner.css'
import { loadQrEquipmentIndex, parseEquipmentIdFromQr, type QrEquipmentIndexItem } from './data/qrIndex'

type Props = {
  onOpenEquipment: (equipmentId: string) => void
}

export function LiveQrScannerPanel({ onOpenEquipment }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const lastRejectedRef = useRef({ value: '', at: 0 })
  const [index, setIndex] = useState<QrEquipmentIndexItem[]>([])
  const [indexLoading, setIndexLoading] = useState(true)
  const [cameraState, setCameraState] = useState<'IDLE' | 'STARTING' | 'SCANNING' | 'ERROR'>('IDLE')
  const [message, setMessage] = useState('Đưa QR thiết bị vào khung để quét.')
  const [manualCode, setManualCode] = useState('')
  const [lastValue, setLastValue] = useState('')
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)

  const equipmentById = useMemo(() => new Map(index.map((item) => [item.equipmentId, item])), [index])

  useEffect(() => {
    let active = true
    void loadQrEquipmentIndex()
      .then((rows) => { if (active) setIndex(rows) })
      .catch((cause) => { if (active) setMessage(cause instanceof Error ? cause.message : 'Không tải được QR index') })
      .finally(() => { if (active) setIndexLoading(false) })
    return () => { active = false }
  }, [])

  function stopCamera() {
    scannerRef.current?.stop()
    scannerRef.current?.destroy()
    scannerRef.current = null
    setHasFlash(false)
    setFlashOn(false)
  }

  useEffect(() => () => stopCamera(), [])

  function rejectValue(value: string, messageText: string) {
    const now = Date.now()
    if (lastRejectedRef.current.value === value && now - lastRejectedRef.current.at < 1200) return
    lastRejectedRef.current = { value, at: now }
    setLastValue(value)
    setMessage(messageText)
  }

  function acceptValue(rawValue: string) {
    const equipmentId = parseEquipmentIdFromQr(rawValue)
    if (!equipmentId) {
      rejectValue(rawValue, 'QR không chứa mã thiết bị CEV hợp lệ.')
      return false
    }

    const equipment = equipmentById.get(equipmentId)
    if (!equipment) {
      rejectValue(equipmentId, `${equipmentId} không có trong Equipment Master.`)
      return false
    }

    stopCamera()
    setCameraState('IDLE')
    setLastValue(equipmentId)
    setMessage(`Đã nhận ${equipmentId} · ${equipment.equipmentName}`)
    navigator.vibrate?.(35)
    window.setTimeout(() => onOpenEquipment(equipmentId), 70)
    return true
  }

  async function startCamera() {
    if (indexLoading) {
      setMessage('Đang tải Equipment QR index…')
      return
    }

    stopCamera()
    setCameraState('STARTING')
    setMessage('Đang mở camera sau…')

    try {
      if (!await QrScanner.hasCamera()) throw new Error('Thiết bị không có camera khả dụng')
      const video = videoRef.current
      if (!video) throw new Error('QR_VIDEO_UNAVAILABLE')

      const scanner = new QrScanner(
        video,
        (result) => { if (result.data) acceptValue(result.data) },
        {
          preferredCamera: 'environment',
          maxScansPerSecond: 25,
          returnDetailedScanResult: true,
          highlightScanRegion: false,
          highlightCodeOutline: false,
          onDecodeError: () => undefined,
        },
      )
      scannerRef.current = scanner
      await scanner.start()
      setCameraState('SCANNING')
      setMessage('Đang quét siêu tốc · không cần bấm chụp.')
      const flashAvailable = await scanner.hasFlash().catch(() => false)
      setHasFlash(flashAvailable)
    } catch (cause) {
      stopCamera()
      setCameraState('ERROR')
      setMessage(cause instanceof Error ? `Không mở được camera: ${cause.message}` : 'Không mở được camera.')
    }
  }

  async function toggleFlash() {
    const scanner = scannerRef.current
    if (!scanner || !hasFlash) return
    try {
      if (flashOn) await scanner.turnFlashOff()
      else await scanner.turnFlashOn()
      setFlashOn((value) => !value)
    } catch {
      setMessage('Camera này không bật được đèn flash.')
    }
  }

  function submitManualCode() {
    const value = manualCode.trim()
    if (!value) return
    if (acceptValue(value)) setManualCode('')
  }

  return <div className="qr-page">
    <section className="qr-hero">
      <div>
        <p className="eyebrow">QR QUICK ENTRY</p>
        <h2>Quét thiết bị</h2>
        <p>1 chạm · camera sau · 25 scan/giây · mở thẳng hồ sơ thiết bị.</p>
      </div>
      <span className="qr-index-badge">{indexLoading ? 'Đang tải index…' : `${index.length} thiết bị`}</span>
    </section>

    <section className="qr-scanner-card">
      <div className={`qr-camera ${cameraState.toLowerCase()}`}>
        <video ref={videoRef} playsInline muted aria-label="Camera quét QR" />
        <div className="qr-scan-frame" aria-hidden="true"><span /><span /><span /><span /></div>
        {cameraState !== 'SCANNING' ? <div className="qr-camera-overlay">
          <strong>{cameraState === 'STARTING' ? 'Đang mở camera…' : 'QR'}</strong>
          <span>Đặt mã vào giữa khung</span>
        </div> : null}
      </div>

      <div className="qr-controls">
        {cameraState === 'SCANNING'
          ? <div className="qr-live-actions">
              <button className="qr-stop" type="button" onClick={() => { stopCamera(); setCameraState('IDLE'); setMessage('Đã dừng camera.') }}>Dừng</button>
              {hasFlash ? <button className="qr-flash" type="button" onClick={() => void toggleFlash()}>{flashOn ? 'Tắt đèn' : 'Bật đèn'}</button> : null}
            </div>
          : <button className="qr-primary" type="button" onClick={() => void startCamera()} disabled={indexLoading}>Mở camera & quét ngay</button>}
        <div className="qr-message" role="status">{message}</div>
        {lastValue ? <small>Lần đọc gần nhất: {lastValue}</small> : null}
      </div>
    </section>

    <section className="qr-manual-card">
      <div><strong>Nhập mã nhanh</strong><span>Dự phòng khi quyền camera bị chặn.</span></div>
      <div className="qr-manual-row">
        <input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter') submitManualCode() }} placeholder="CEV-PR-001" autoCapitalize="characters" autoComplete="off" />
        <button type="button" onClick={submitManualCode} disabled={!manualCode.trim() || indexLoading}>Mở</button>
      </div>
    </section>
  </div>
}
