/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EquipmentProfile } from './EquipmentProfile'
import { AppRoleProvider, type AppRole } from './auth/AppRoleContext'
import type { LiveEquipment } from './data/liveEquipment'
const mocks = vi.hoisted(() => ({ upload: vi.fn(), preview: vi.fn() }))
vi.mock('./data/supabaseEquipment', () => ({
  uploadEquipmentPhoto: mocks.upload, getEquipmentPhotoPreview: mocks.preview,
  loadEquipmentHistory: async () => ({ calibration: [], maintenance: [], inspections: [], downtime: [], movements: [], audit: [] }),
}))
const equipment = { equipmentId: 'CEV-ME-061', equipmentName: 'Máy LCR', status: 'RUNNING' } as LiveEquipment
function mount(role: AppRole = 'MAINTENANCE') {
  render(<AppRoleProvider role={role}><EquipmentProfile equipment={equipment} photoUrl="" onClose={vi.fn()} onEdit={vi.fn()} /></AppRoleProvider>)
}
beforeEach(() => { vi.resetAllMocks(); mocks.upload.mockResolvedValue('CEV-ME-061/photo.webp'); mocks.preview.mockResolvedValue({ signedUrl: 'https://example.com/photo.webp' }) })
afterEach(cleanup)
it('offers rear camera and file selection and shows the saved photo for the current equipment', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: /Chưa có ảnh thiết bị/ }))
  expect(screen.getByRole('button', { name: 'Chụp ảnh' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Tải ảnh lên' })).toBeVisible()
  expect(screen.getByLabelText('Chụp ảnh thiết bị')).toHaveAttribute('capture', 'environment')
  const file = new File(['image'], 'device.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Tải ảnh thiết bị'), { target: { files: [file] } })
  await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/photo.webp'))
  expect(mocks.upload).toHaveBeenCalledExactlyOnceWith('CEV-ME-061', file)
})
it('keeps retry available when upload fails without claiming a saved photo', async () => {
  mocks.upload.mockRejectedValue(new Error('Không lưu được ảnh'))
  mount()
  fireEvent.click(screen.getByRole('button', { name: /Chưa có ảnh thiết bị/ }))
  fireEvent.change(screen.getByLabelText('Chụp ảnh thiết bị'), { target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Không lưu được ảnh')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Chụp ảnh' })).toBeEnabled()
})
it('does not offer photo writes to an unknown role', async () => {
  mount('UNKNOWN')
  expect(screen.getByText('Chưa có ảnh thiết bị')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Chưa có ảnh thiết bị/ })).not.toBeInTheDocument()
  expect(mocks.upload).not.toHaveBeenCalled()
})
