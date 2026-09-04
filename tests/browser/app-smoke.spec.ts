import { expect, test, type Page } from '@playwright/test'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const jwt = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify({ sub: USER_ID, aud: 'authenticated', exp: 4102444800, email: 'smoke@example.com', role: 'authenticated' })).toString('base64url')}.`

const EQUIPMENT = [{
  equipment_id: 'CEV-PR-001', equipment_type: 'PRODUCTION', control_number: 'SMOKE', qr_code: 'CEV-PR-001',
  equipment_name: 'Smoke Equipment', model: 'M1', manufacturer: 'CEV', serial_number: 'S1', department: 'PRODUCTION',
  status: 'RUNNING', active: true, source_data: {}, created_at: '2026-08-30T00:00:00Z', updated_at: '2026-08-30T00:00:00Z',
}]

const SOURCE_ROWS: Record<string, Record<string, unknown>[]> = {
  maintenance_plan: [{ plan_id: 'PLAN-1', equipment_id: 'CEV-PR-001', source_data: { maintenanceType: 'PM', frequency: '3 tháng' } }],
  maintenance_plan_item: [{ item_id: 'PI-1', plan_id: 'PLAN-1', source_data: { itemName: 'Kiểm tra dây đai', standard: 'Không nứt' } }],
  maintenance_execution: [{ execution_id: 'EX-1', equipment_id: 'CEV-PR-001', source_data: { executionDate: '2026-09-03' } }],
  maintenance_result_item: [{ result_item_id: 'RI-1', execution_id: 'EX-1', source_data: { itemName: 'Dây đai', repairContent: 'Thay dây' } }],
  equipment_handover: [{ handover_id: 'HO-1', equipment_id: 'CEV-PR-001', source_data: { receiverPerson: 'Người nhận mẫu' } }],
  downtime_event: [{ downtime_id: 'DT-1', equipment_id: 'CEV-PR-001', source_data: { actionTaken: 'Thay vòng bi' } }],
  calibration_log: [{ calibration_log_id: 'CL-1', equipment_id: 'CEV-ME-001', result: 'PASS', source_data: { provider: 'Phòng đo mẫu' } }],
}

async function installSupabaseMocks(page: Page, signedIn = true) {
  await page.addInitScript(({ token, userId, signedIn }) => {
    if (signedIn) localStorage.setItem('sb-supabase-not-configured-auth-token', JSON.stringify({
      access_token: token, refresh_token: 'smoke-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
      user: { id: userId, email: 'smoke@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }))
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => { throw new DOMException('Camera unavailable in CI', 'NotAllowedError') },
      enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'denied-camera', label: 'CI camera' }],
    } })
  }, { token: jwt, userId: USER_ID, signedIn })

  await page.route('https://supabase-not-configured.invalid/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
    if (path.includes('/auth/v1/user')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ id: USER_ID, email: 'smoke@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }) })
    if (path.includes('/auth/v1/token')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ access_token: jwt, refresh_token: 'smoke-refresh', expires_in: 3600, token_type: 'bearer', user: { id: USER_ID, email: 'smoke@example.com' } }) })
    if (path.includes('/rest/v1/app_user_role')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ role: 'ADMIN', email: 'smoke@example.com' }) })
    const table = path.split('/').pop() || ''
    if (SOURCE_ROWS[table]) return route.fulfill({ status: 200, headers, body: JSON.stringify(SOURCE_ROWS[table]) })
    if (path.includes('/rest/v1/equipment_master')) return route.fulfill({ status: 200, headers, body: JSON.stringify(EQUIPMENT) })
    if (path.includes('/storage/v1/')) return route.fulfill({ status: 200, headers, body: '[]' })
    if (path.includes('/rest/v1/')) return route.fulfill({ status: 200, headers, body: '[]' })
    return route.fulfill({ status: 200, headers, body: '{}' })
  })
}

async function openApp(page: Page) {
  await installSupabaseMocks(page)
  await page.goto('/')
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
  await expect(page.locator('.fatal-screen')).toHaveCount(0)
}

async function clickNav(page: Page, label: string) {
  const mobile = Boolean(page.viewportSize() && page.viewportSize()!.width <= 900)
  if (!mobile) {
    const button = page.locator('.sidebar nav').getByRole('button', { name: label, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-current', 'page')
  } else if (label === 'Quét QR' || label === 'Thiết bị') {
    await page.locator('.bottom-nav').getByRole('button', { name: label, exact: true }).click()
  } else if (label === 'Bảo trì') {
    await page.locator('.bottom-nav').getByRole('button', { name: 'Công việc', exact: true }).click()
  } else {
    await page.locator('.bottom-nav').getByRole('button', { name: 'Thêm', exact: true }).click()
    await page.getByRole('dialog', { name: 'Các chức năng khác' }).getByRole('button', { name: label, exact: true }).click()
  }
  await expect(page.locator('.workspace-loading')).toHaveCount(0)
  await expect(page.locator('.fatal-screen')).toHaveCount(0)
}

async function expectEquipmentProfile(page: Page) {
  const dialog = page.locator('.equipment-profile-layer')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { level: 2 })).toContainText('CEV-PR-001')
}

test('all operational workspaces navigate without browser crash', async ({ page }) => {
  await openApp(page)
  for (const label of ['Quét QR', 'Thiết bị', 'Kiểm tra ngày', 'Bảo trì', 'Jig, gá & dụng cụ', 'Hiệu chuẩn', 'Hồ sơ A4', 'Nhật ký & cấu hình']) {
    await clickNav(page, label)
    await expect(page.locator('main')).toBeVisible()
  }
})

test('A4 renderer exposes source-driven document and print action', async ({ page }) => {
  await openApp(page)
  await clickNav(page, 'Hồ sơ A4')
  await expect(page.getByRole('heading', { name: 'Hồ sơ A4 / PDF' })).toBeVisible()
  await expect(page.locator('.a4-document')).toContainText('CEV-PR-001')
  await expect(page.getByRole('button', { name: 'In / Xuất PDF A4' })).toBeEnabled()
})

test('QR entry remains usable when CI camera is denied', async ({ page }) => {
  await openApp(page)
  await clickNav(page, 'Quét QR')
  await page.getByRole('button', { name: 'Chạm để bật camera' }).click()
  await expect(page.locator('.qr-message')).toContainText('Không mở được camera')
  await page.getByRole('combobox', { name: 'Tìm mã hoặc tên thiết bị' }).fill('CEV-PR-001')
  await page.getByRole('button', { name: 'Mở', exact: true }).click()
  await expectEquipmentProfile(page)
})

test('signed-out login preserves equipment target and logout works', async ({ page }) => {
  await installSupabaseMocks(page, false)
  await page.goto('/?phase3=equipment&equipment=CEV-PR-001')
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill('smoke@example.com')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('browser-fixture-password')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
  await expectEquipmentProfile(page)
  const mobile = Boolean(page.viewportSize() && page.viewportSize()!.width <= 900)
  if (mobile) {
    await page.locator('.bottom-nav').getByRole('button', { name: 'Thêm', exact: true }).click()
    await page.getByRole('dialog', { name: 'Các chức năng khác' }).getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  } else {
    await page.locator('.sidebar-user').getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
})

test('recovery form saves a new password', async ({ page }) => {
  await installSupabaseMocks(page, false)
  await page.goto(`/#access_token=${jwt}&refresh_token=smoke-refresh&expires_in=3600&token_type=bearer&type=recovery`)
  await expect(page.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible()
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('Fixture-password-123')
  await page.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill('Fixture-password-123')
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu mật khẩu mới' })).toBeVisible()
})

test('account controls are accessible in desktop and mobile shells', async ({ page }) => {
  await openApp(page)
  const mobile = Boolean(page.viewportSize() && page.viewportSize()!.width <= 900)
  if (mobile) {
    await page.locator('.bottom-nav').getByRole('button', { name: 'Thêm', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Các chức năng khác' })
    await expect(sheet).toContainText('Quản trị hệ thống')
    await expect(sheet.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible()
  } else {
    await expect(page.locator('.sidebar-user')).toContainText('Quản trị hệ thống')
    await expect(page.locator('.sidebar-user').getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible()
  }
})
