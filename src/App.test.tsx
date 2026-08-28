/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./PwaStatus', () => ({ PwaStatus: () => null }))

import App from './App'

describe('equipment app shell', () => {
  it('renders the dashboard and source-aligned downtime KPI', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Thiết bị trong tầm kiểm soát' })).toBeInTheDocument()
    expect(screen.getByText('Downtime rate')).toBeInTheDocument()
    expect(screen.getByText('MTBF')).toBeInTheDocument()
    expect(screen.getByText('MTTR')).toBeInTheDocument()
  })

  it('advances a work order through approval before repair', () => {
    render(<App />)
    const desktopNav = screen.getByLabelText('Điều hướng desktop')
    fireEvent.click(within(desktopNav).getByRole('button', { name: 'Bảo trì' }))

    fireEvent.click(screen.getByRole('button', { name: 'Gửi phê duyệt' }))
    expect(screen.getByText('Chờ phê duyệt', { selector: '.badge' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Phê duyệt' }))
    expect(screen.getByText('Đã phê duyệt', { selector: '.badge' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu sửa chữa' }))
    expect(screen.getAllByText('Đang xử lý', { selector: '.badge' }).length).toBeGreaterThan(0)
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
