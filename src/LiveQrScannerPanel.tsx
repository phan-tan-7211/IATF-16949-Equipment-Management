import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import './QrScanner.css'
import { loadQrEquipmentIndex, parseEquipmentIdFromQr, type QrEquipmentIndexItem } from './data/qrIndex'

type Props = {
  onOpenEquipment: (equipmentId: string) => void
}

type ScanFeedback = {
  kind: 'success' | 'warning'
  title: string
  detail: string
  equipmentId?: string
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* Visual feedback remains available. */ }
}

export function LiveQrScannerPanel({ onOpenEquipment }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const cameraAttemptRef = useRef(0)
  const startingRef = useRef(false)
  const acceptedRef = useRef(false)
  const feedbackTimerRef = useRef<number | null>(null)
  const navigationTimerRef = useRef<number | null>(null)
  const lastRejectedRef = useRef({ value: '', at: 0 })
  const [index, setIndex] = useState<QrEquipmentIndexItem[]>([])
  const [indexLoading, setIndexLoading] = useState(true)
  const [cameraState, setCameraState] = useState<'IDLE' | 'STARTING' | 'SCANNING' | 'ERROR'>('IDLE')
  const [message, setMessage] = useState('Đưa QR thiết bị vào khung để quét.')
  const [manualCode, setManualCode] = useState('')
  const [lastValue, setLastValue] = useState('')
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null)

  const equipmentById = useMemo(() => new Map(index.map((item) => [item.equipmentId, item])), [index])

  useEffect(() => {
    let active = true
    void loadQrEquipmentIndex()
      .then((rows) => { if (active) setIndex(rows) })
      .catch((cause) => { if (active) setMessage(cause instanceof Error ? cause.message : 'Không tải được QR index') })
      .finally(() => { if (active) setIndexLoading(false) })
    return () => { active = false }
  }, [])

  const stopCamera = useCallback(() => {
    cameraAttemptRef.current += 1
    startingRef.current = false
    scannerRef.current?.stop()
    scannerRef.current?.destroy()
    scannerRef.current = null
    setHasFlash(false)
    setFlashOn(false)
  }, [])

  useEffect(() => () => {
    stopCamera()
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current)
  }, [stopCamera])

  function clearFeedback() {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = null
    setFeedback(null)
  }

  function rejectValue(value: string, messageText: string) {
    const now = Date.now()
    if (lastRejectedRef.current.value === value && now - lastRejectedRef.current.at < 1200) return
    lastRejectedRef.current = { value, at: now }
    setLastValue(value)
    setMessage(messageText)
    clearFeedback()
    setFeedback({ kind: 'warning', title: 'Đã đọc QR · chưa mở được hồ sơ', detail: messageText })
    vibrate(80)
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null)
      feedbackTimerRef.current = null
    }, 2400)
  }

  function acceptValue(rawValue: string) {
    if (acceptedRef.current) return false
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

    acceptedRef.current = true
    stopCamera()
    clearFeedback()
    setCameraState('IDLE')
    setLastValue(equipmentId)
    setMessage(`Đã nhận ${equipmentId} · ${equipment.equipmentName}`)
    setFeedback({ kind: 'success', title: 'Đã nhận mã thiết bị', detail: equipment.equipmentName, equipmentId })
    vibrate([90, 50, 90])
    navigationTimerRef.current = window.setTimeout(() => {
      navigationTimerRef.current = null
      onOpenEquipment(equipmentId)
    }, 1000)
    return true
  }

  async function startCamera() {
    if (startingRef.current || acceptedRef.current) return
    if (indexLoading) {
      setMessage('Đang tải Equipment QR index…')
      return
    }

    stopCamera()
    clearFeedback()
    lastRejectedRef.current = { value: '', at: 0 }
    const attempt = cameraAttemptRef.current
    startingRef.current = true
    setCameraState('STARTING')
    setMessage('Đang mở camera sau…')

    try {
      if (!await QrScanner.hasCamera()) throw new Error('Thiết bị không có camera khả dụng')
      if (attempt !== cameraAttemptRef.current) return
      const video = videoRef.current
      if (!video) throw new Error('QR_VIDEO_UNAVAILABLE')

      const scanner = new QrScanner(
        video,
        (result) => { if (attempt === cameraAttemptRef.current && result.data) acceptValue(result.data) },
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
      if (attempt !== cameraAttemptRef.current) return
      startingRef.current = false
      setCameraState('SCANNING')
      setMessage('Đang quét siêu tốc · không cần bấm chụp.')
      const flashAvailable = await scanner.hasFlash().catch(() => false)
      if (attempt !== cameraAttemptRef.current) return
      setHasFlash(flashAvailable)
    } catch (cause) {
      if (attempt !== cameraAttemptRef.current) return
      stopCamera()
      setCameraState('ERROR')
      setMessage(cause instanceof Error ? `Không mở được camera: ${cause.message}` : 'Không mở được camera.')
    }
  }

  function toggleCamera() {
    if (indexLoading || startingRef.current || acceptedRef.current) return
    if (cameraState === 'SCANNING') {
      stopCamera()
      clearFeedback()
      setCameraState('IDLE')
      setMessage('Đã dừng camera. Chạm vào khung để quét tiếp.')
    } else {
      void startCamera()
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
      <div className={`qr-camera ${cameraState.toLowerCase()}${feedback ? ` qr-feedback-${feedback.kind}` : ''}`}>
        <video ref={videoRef} playsInline muted aria-label="Camera quét QR" />
        <div className="qr-scan-frame" aria-hidden="true"><span /><span /><span /><span /></div>
        <button
          className="qr-camera-toggle"
          type="button"
          onClick={toggleCamera}
          disabled={indexLoading || cameraState === 'STARTING' || feedback?.kind === 'success'}
          aria-label={feedback?.kind === 'success' ? 'Đã nhận mã thiết bị' : cameraState === 'SCANNING' ? 'Chạm để tắt camera' : 'Chạm để bật camera'}
          aria-pressed={cameraState === 'SCANNING'}
          aria-busy={cameraState === 'STARTING'}
        >
          <span className="qr-camera-prompt">
            <svg className="qr-camera-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {cameraState === 'SCANNING'
                ? <rect x="6" y="6" width="12" height="12" rx="2" />
                : <><path d="M8 5l2-2h4l2 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><circle cx="12" cy="12" r="4" /></>}
            </svg>
            <strong>{indexLoading ? 'Đang tải thiết bị…' : cameraState === 'STARTING' ? 'Đang mở camera…' : cameraState === 'SCANNING' ? 'Chạm để tắt camera' : 'Chạm để bật camera'}</strong>
            {cameraState !== 'SCANNING' ? <span>Chạm ở bất kỳ đâu trong khung này</span> : null}
          </span>
        </button>
        {feedback ? <div className={`qr-scan-feedback ${feedback.kind}`} role={feedback.kind === 'success' ? 'status' : 'alert'} aria-atomic="true">
          <span className="qr-feedback-symbol" aria-hidden="true">{feedback.kind === 'success' ? '✓' : '!'}</span>
          <strong>{feedback.title}</strong>
          {feedback.equipmentId ? <b className="qr-feedback-code">{feedback.equipmentId}</b> : null}
          <span className="qr-feedback-detail">{feedback.detail}</span>
          <small>{feedback.kind === 'success' ? 'Đang mở hồ sơ…' : 'Đưa QR thiết bị khác vào khung để quét tiếp.'}</small>
        </div> : null}
      </div>

      <div className="qr-controls">
        {cameraState === 'SCANNING' && hasFlash ? <button className="qr-flash" type="button" onClick={() => void toggleFlash()}>{flashOn ? 'Tắt đèn' : 'Bật đèn'}</button> : null}
        <div className="qr-message" role={feedback ? undefined : 'status'}>{message}</div>
        {lastValue ? <small>Lần đọc gần nhất: {lastValue}</small> : null}
      </div>
    </section>

    <section className="qr-manual-card">
      <div><strong>Nhập mã nhanh</strong><span>Dự phòng khi quyền camera bị chặn.</span></div>
      <div className="qr-manual-row">
        <input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter') submitManualCode() }} placeholder="CEV-PR-001" autoCapitalize="characters" autoComplete="off" />
        <button type="button" onClick={submitManualCode} disabled={!manualCode.trim() || indexLoading || feedback?.kind === 'success'}>Mở</button>
      </div>
    </section>
  </div>
}
