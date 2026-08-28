/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./PwaStatus', () => ({ PwaStatus: () => null }))

afterEach(() => cleanup())

import App from './App'

describe('equipment app shell', () => {
  it('renders the dashboard and source-aligned downtime KPI', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Thiết bị trong tầm kiểm soát' })).toBeInTheDocument()
    expect(screen.getByText('Downtime rate')).toBeInTheDocument()
    expect(screen.getByText('MTBF')).toBeInTheDocument()
    expect(screen.getByText('MTTR')).toBeInTheDocument()
  })

  it('advances a work order through approval, repair, verification and BM-05 handover', () => {
    render(<App />)
    const desktopNav = screen.getByLabelText('Điều hướng desktop')
    fireEvent.click(within(desktopNav).getByRole('button', { name: 'Bảo trì' }))

    fireEvent.click(screen.getByRole('button', { name: 'Gửi phê duyệt' }))
    expect(screen.getByText('Chờ phê duyệt', { selector: '.badge' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Phê duyệt' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu sửa chữa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất sửa chữa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chạy thử' }))
    fireEvent.click(screen.getByRole('button', { name: 'BM-05: xác nhận & bàn giao' }))

    expect(screen.getByText('Đã bàn giao', { selector: '.badge' })).toBeInTheDocument()
    expect(screen.getByText(/Bên nhận đã chấp nhận/)).toBeInTheDocument()
  })

  it('records workflow actions in the local audit trail', () => {
    render(<App />)
    const desktopNav = screen.getByLabelText('Điều hướng desktop')
    fireEvent.click(within(desktopNav).getByRole('button', { name: 'Bảo trì' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phê duyệt' }))
    fireEvent.click(within(desktopNav).getByRole('button', { name: 'Audit & Cấu hình' }))

    expect(screen.getByRole('heading', { name: 'Audit Trail & BM-05' })).toBeInTheDocument()
    expect(screen.getByText('REQUEST_APPROVAL')).toBeInTheDocument()
  })

  it('shows calibration and historical cost from source without calling it live pricing', () => {
    render(<App />)
    const desktopNav = screen.getByLabelText('Điều hướng desktop')
    fireEvent.click(within(desktopNav).getByRole('button', { name: 'Hiệu chuẩn' }))

    expect(screen.getByRole('heading', { name: 'Calibration Master' })).toBeInTheDocument()
    expect(screen.getByText(/dữ liệu lịch sử để đối chiếu và lập kế hoạch/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'So sánh chi phí hiệu chuẩn 2024' })).toBeInTheDocument()
    expect(screen.getByText('G.TECH')).toBeInTheDocument()
  })
})
