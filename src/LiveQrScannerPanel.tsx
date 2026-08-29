import { useEffect, useMemo, useRef, useState } from 'react'
import './QrScanner.css'
import { loadQrEquipmentIndex, parseEquipmentIdFromQr, type QrEquipmentIndexItem } from './data/qrIndex'

type BarcodeResult = { rawValue?: string }
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

type Props = {
  onOpenEquipment: (equipmentId: string) => void
}

function getBarcodeDetectorConstructor() {
  return (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
}

export function LiveQrScannerPanel({ onOpenEquipment }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const [index, setIndex] = useState<QrEquipmentIndexItem[]>([])
  const [indexLoading, setIndexLoading] = useState(true)
  const [cameraState, setCameraState] = useState<'IDLE' | 'STARTING' | 'SCANNING' | 'UNSUPPORTED' | 'ERROR'>('IDLE')
  const [message, setMessage] = useState('Đưa QR thiết bị vào khung để quét.')
  const [manualCode, setManualCode] = useState('')
  const [lastValue, setLastValue] = useState('')

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
    scanningRef.current = false
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => () => stopCamera(), [])

  function acceptValue(rawValue: string) {
    const equipmentId = parseEquipmentIdFromQr(rawValue)
    if (!equipmentId) {
      setLastValue(rawValue)
      setMessage('QR không chứa mã thiết bị CEV hợp lệ.')
      return false
    }

    const equipment = equipmentById.get(equipmentId)
    if (!equipment) {
      setLastValue(equipmentId)
      setMessage(`${equipmentId} không có trong Equipment Master.`)
      return false
    }

    stopCamera()
    setCameraState('IDLE')
    setLastValue(equipmentId)
    setMessage(`Đã nhận ${equipmentId} · ${equipment.equipmentName}`)
    if ('vibrate' in navigator) navigator.vibrate?.(35)
    window.setTimeout(() => onOpenEquipment(equipmentId), 80)
    return true
  }

  async function startCamera() {
    if (indexLoading) {
      setMessage('Đang tải Equipment QR index…')
      return
    }

    const BarcodeDetector = getBarcodeDetectorConstructor()
    if (!BarcodeDetector) {
      setCameraState('UNSUPPORTED')
      setMessage('Trình duyệt này chưa hỗ trợ quét QR native. Có thể nhập mã thiết bị bên dưới.')
      return
    }

    stopCamera()
    setCameraState('STARTING')
    setMessage('Đang mở camera sau…')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('QR_VIDEO_UNAVAILABLE')
      video.srcObject = stream
      await video.play()

      const detector = new BarcodeDetector({ formats: ['qr_code'] })
      scanningRef.current = true
      setCameraState('SCANNING')
      setMessage('Đang quét liên tục · không cần bấm chụp.')

      const scanFrame = async () => {
        if (!scanningRef.current || !videoRef.current) return
        try {
          const results = await detector.detect(videoRef.current)
          const rawValue = results.find((item) => item.rawValue)?.rawValue || ''
          if (rawValue && acceptValue(rawValue)) return
        } catch {
          // A transient decode miss should not stop continuous scanning.
        }
        if (scanningRef.current) timerRef.current = window.setTimeout(() => void scanFrame(), 80)
      }
      void scanFrame()
    } catch (cause) {
      stopCamera()
      setCameraState('ERROR')
      setMessage(cause instanceof Error ? `Không mở được camera: ${cause.message}` : 'Không mở được camera.')
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
        <p>1 chạm · camera sau · quét liên tục · mở thẳng hồ sơ thiết bị.</p>
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
          ? <button className="qr-stop" type="button" onClick={() => { stopCamera(); setCameraState('IDLE'); setMessage('Đã dừng camera.') }}>Dừng camera</button>
          : <button className="qr-primary" type="button" onClick={() => void startCamera()} disabled={indexLoading}>Mở camera & quét ngay</button>}
        <div className="qr-message" role="status">{message}</div>
        {lastValue ? <small>Lần đọc gần nhất: {lastValue}</small> : null}
      </div>
    </section>

    <section className="qr-manual-card">
      <div><strong>Nhập mã nhanh</strong><span>Dùng khi camera bị chặn hoặc trình duyệt chưa hỗ trợ BarcodeDetector.</span></div>
      <div className="qr-manual-row">
        <input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter') submitManualCode() }} placeholder="CEV-PR-001" autoCapitalize="characters" autoComplete="off" />
        <button type="button" onClick={submitManualCode} disabled={!manualCode.trim() || indexLoading}>Mở</button>
      </div>
    </section>
  </div>
}
