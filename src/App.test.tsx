/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./PwaStatus', () => ({ PwaStatus: () => null }))

import App from './App'

describe('equipment app shell', () => {
  it('renders the dashboard and navigates to maintenance', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Thiết bị trong tầm kiểm soát' })).toBeInTheDocument()
    const desktopNav = screen.getByLabelText('Điều hướng desktop')
    fireEvent.click(within(desktopNav).getByRole('button', { name: 'Bảo trì' }))
    expect(screen.getByRole('heading', { name: 'Bảo trì & sửa chữa' })).toBeInTheDocument()
  })
})
