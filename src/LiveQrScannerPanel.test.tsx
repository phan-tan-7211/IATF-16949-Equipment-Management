/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  index: vi.fn(), hasCamera: vi.fn(), construct: vi.fn(), start: vi.fn(),
  stop: vi.fn(), destroy: vi.fn(), hasFlash: vi.fn(), turnFlashOn: vi.fn(), turnFlashOff: vi.fn(),
}))
vi.mock('./data/qrIndex', () => ({
  loadQrEquipmentIndex: mocks.index,
  parseEquipmentIdFromQr: (value: string) => value,
}))
vi.mock('qr-scanner', () => ({ default: class {
  static hasCamera = mocks.hasCamera
  constructor(...args: unknown[]) { mocks.construct(...args) }
  start = mocks.start
  stop = mocks.stop
  destroy = mocks.destroy
  hasFlash = mocks.hasFlash
  turnFlashOn = mocks.turnFlashOn
  turnFlashOff = mocks.turnFlashOff
} }))
import { LiveQrScannerPanel } from './LiveQrScannerPanel'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.index.mockResolvedValue([])
  mocks.hasCamera.mockResolvedValue(true)
  mocks.start.mockResolvedValue(undefined)
  mocks.hasFlash.mockResolvedValue(false)
  mocks.turnFlashOn.mockResolvedValue(undefined)
})
afterEach(cleanup)
async function mountReady() {
  const view = render(<LiveQrScannerPanel onOpenEquipment={vi.fn()} />)
  const toggle = screen.getByRole('button', { name: 'Chạm để bật camera' })
  await waitFor(() => expect(toggle).toBeEnabled())
  return { ...view, toggle }
}

describe('tap the QR frame to control the camera', () => {
  it('uses one native button over the frame to start, stop and restart', async () => {
    const { toggle } = await mountReady()
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.closest('.qr-camera')).not.toBeNull()
    expect(screen.queryByText('Mở camera & quét ngay')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    const stop = await screen.findByRole('button', { name: 'Chạm để tắt camera' })
    expect(stop).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(stop)
    expect(mocks.stop).toHaveBeenCalledOnce()
    expect(mocks.destroy).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Chạm để bật camera' }))
    await screen.findByRole('button', { name: 'Chạm để tắt camera' })
    expect(mocks.start).toHaveBeenCalledTimes(2)
  })

  it('disables the frame until the equipment index is ready', async () => {
    let resolve!: (rows: never[]) => void
    mocks.index.mockReturnValue(new Promise(r => { resolve = r }))
    render(<LiveQrScannerPanel onOpenEquipment={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: 'Chạm để bật camera' })
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    expect(mocks.hasCamera).not.toHaveBeenCalled()
    await act(async () => resolve([]))
    expect(toggle).toBeEnabled()
  })

  it('does not create multiple cameras during repeated taps while starting', async () => {
    let resolve!: () => void
    mocks.start.mockReturnValue(new Promise<void>(r => { resolve = r }))
    const { toggle } = await mountReady()
    fireEvent.click(toggle)
    await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce())
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(mocks.construct).toHaveBeenCalledOnce()
    await act(async () => resolve())
    expect(await screen.findByRole('button', { name: 'Chạm để tắt camera' })).toBeEnabled()
  })

  it('allows retry from the frame after a camera permission error', async () => {
    mocks.start.mockRejectedValueOnce(new Error('Permission denied'))
    const { toggle } = await mountReady()
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Permission denied'))
    expect(toggle).toBeEnabled()
    fireEvent.click(toggle)
    await screen.findByRole('button', { name: 'Chạm để tắt camera' })
  })

  it('keeps flash controls outside the frame without stopping the camera', async () => {
    mocks.hasFlash.mockResolvedValue(true)
    const { toggle } = await mountReady()
    fireEvent.click(toggle)
    const flash = await screen.findByRole('button', { name: 'Bật đèn' })
    expect(flash.closest('.qr-camera')).toBeNull()
    fireEvent.click(flash)
    await screen.findByRole('button', { name: 'Tắt đèn' })
    expect(mocks.stop).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Chạm để tắt camera' })).toBeEnabled()
  })

  it('does not construct a camera after leaving during the camera check', async () => {
    let resolve!: (available: boolean) => void
    mocks.hasCamera.mockReturnValue(new Promise<boolean>(r => { resolve = r }))
    const { toggle, unmount } = await mountReady()
    fireEvent.click(toggle)
    unmount()
    await act(async () => resolve(true))
    expect(mocks.construct).not.toHaveBeenCalled()
  })
})
