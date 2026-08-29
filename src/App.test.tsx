/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./PwaStatus', () => ({ PwaStatus: () => null }))
vi.mock('./LiveDashboardPanel', () => ({ LiveDashboardPanel: () => <h2>Dashboard live</h2> }))
vi.mock('./LiveEquipmentPanel', () => ({ LiveEquipmentPanel: () => <h2>Equipment live</h2> }))
vi.mock('./LiveInspectionPanel', () => ({ LiveInspectionPanel: () => <h2>Inspection live</h2> }))
vi.mock('./LiveMaintenancePanel', () => ({ LiveMaintenancePanel: () => <h2>Maintenance live</h2> }))
vi.mock('./LiveToolingPanel', () => ({ LiveToolingPanel: () => <h2>Tooling live</h2> }))
vi.mock('./LiveCalibrationPanel', () => ({ LiveCalibrationPanel: () => <h2>Calibration live</h2> }))
vi.mock('./LiveAuditPanel', () => ({ LiveAuditPanel: () => <h2>Audit live</h2> }))

afterEach(() => cleanup())

import App from './App'

describe('Vercel production app shell', () => {
  it('renders the live dashboard by default', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Dashboard live' })).toBeInTheDocument()
    expect(screen.getByText('PRODUCTION LIVE')).toBeInTheDocument()
    expect(screen.getByText(/Vercel Frontend/)).toBeInTheDocument()
  })

  it('routes every desktop workspace to its live module', () => {
    render(<App />)
    const desktopNav = screen.getByLabelText('Điều hướng desktop')
    const cases = [
      ['Thiết bị', 'Equipment live'],
      ['Kiểm tra ngày', 'Inspection live'],
      ['Bảo trì', 'Maintenance live'],
      ['Jig & Tooling', 'Tooling live'],
      ['Hiệu chuẩn', 'Calibration live'],
      ['Audit & Cấu hình', 'Audit live'],
      ['Tổng quan', 'Dashboard live'],
    ] as const

    cases.forEach(([navLabel, heading]) => {
      fireEvent.click(within(desktopNav).getByRole('button', { name: navLabel }))
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })
  })

  it('exposes every production workspace from mobile navigation', () => {
    render(<App />)
    const mobileNav = screen.getByLabelText('Điều hướng mobile')
    const expectedItems = ['Tổng quan', 'Thiết bị', 'Kiểm tra ngày', 'Bảo trì', 'Jig & Tooling', 'Hiệu chuẩn', 'Audit & Cấu hình']

    expectedItems.forEach((label) => {
      expect(within(mobileNav).getByRole('button', { name: label })).toBeInTheDocument()
    })

    fireEvent.click(within(mobileNav).getByRole('button', { name: 'Audit & Cấu hình' }))
    expect(screen.getByRole('heading', { name: 'Audit live' })).toBeInTheDocument()
  })
})
