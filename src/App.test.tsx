/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./data/supabaseClient', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })), signOut: vi.fn().mockResolvedValue({ error: null }) } } }))

vi.mock('./PwaStatus', () => ({ PwaStatus: () => null }))
vi.mock('./data/liveAudit', () => ({
  loadLiveSession: vi.fn().mockResolvedValue({ email: 'admin@example.com', role: 'ADMIN', contractVersion: 'G1-frozen-2026-08-28' }),
  loadLiveAudit: vi.fn().mockResolvedValue([]),
}))
vi.mock('./LiveDashboardPanel', () => ({ LiveDashboardPanel: () => <h2>Dashboard live</h2> }))
vi.mock('./LiveEquipmentPanel', () => ({ LiveEquipmentPanel: () => <h2>Equipment live</h2> }))
vi.mock('./LiveInspectionPanel', () => ({ LiveInspectionPanel: () => <h2>Inspection live</h2> }))
vi.mock('./LiveMaintenancePanel', () => ({ LiveMaintenancePanel: () => <h2>Maintenance live</h2> }))
vi.mock('./LiveToolingPanel', () => ({ LiveToolingPanel: () => <h2>Tooling live</h2> }))
vi.mock('./LiveCalibrationPanel', () => ({ LiveCalibrationPanel: () => <h2>Calibration live</h2> }))
vi.mock('./LiveAuditPanel', () => ({ LiveAuditPanel: () => <h2>Audit live</h2> }))

vi.mock('./LiveMaintenancePlanPanel', () => ({ LiveMaintenancePlanPanel: () => null }))
vi.mock('./LiveMaintenanceResultPanel', () => ({ LiveMaintenanceResultPanel: () => null }))
vi.mock('./LiveHandoverPanel', () => ({ LiveHandoverPanel: () => null }))
vi.mock('./LiveDowntimePanel', () => ({ LiveDowntimePanel: () => null }))
vi.mock('./LiveCalibrationEvaluationPanel', () => ({ LiveCalibrationEvaluationPanel: () => null }))
vi.mock('./LiveCalibrationQuotePanel', () => ({ LiveCalibrationQuotePanel: () => null }))

afterEach(() => cleanup())

import App from './App'

describe('Vercel + Supabase app shell', () => {
  it('renders the live dashboard by default', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Dashboard live' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tài khoản' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/React \+ Vite \+ TypeScript/)).toBeInTheDocument()
    expect((await screen.findAllByText('ADMIN')).length).toBeGreaterThan(0)
  })

  it('routes every desktop workspace to its live module', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Dashboard live' })
    const desktopNav = screen.getByLabelText('Điều hướng desktop')
    const cases = [
      ['Thiết bị', 'Equipment live'], ['Kiểm tra ngày', 'Inspection live'], ['Bảo trì', 'Maintenance live'], ['Jig & Tooling', 'Tooling live'], ['Hiệu chuẩn', 'Calibration live'], ['Audit & Cấu hình', 'Audit live'], ['Tổng quan', 'Dashboard live'],
    ] as const
    for (const [navLabel, heading] of cases) {
      fireEvent.click(within(desktopNav).getByRole('button', { name: navLabel }))
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('exposes every workspace from mobile navigation for admin', async () => {
    render(<App />)
    expect((await screen.findAllByText('ADMIN')).length).toBeGreaterThan(0)
    const mobileNav = screen.getByLabelText('Điều hướng mobile')
    const expectedItems = ['Tổng quan', 'Thiết bị', 'Kiểm tra ngày', 'Bảo trì', 'Jig & Tooling', 'Hiệu chuẩn', 'Audit & Cấu hình']
    expectedItems.forEach((label) => expect(within(mobileNav).getByRole('button', { name: label })).toBeInTheDocument())
    fireEvent.click(within(mobileNav).getByRole('button', { name: 'Audit & Cấu hình' }))
    expect(await screen.findByRole('heading', { name: 'Audit live' })).toBeInTheDocument()
  })
})

