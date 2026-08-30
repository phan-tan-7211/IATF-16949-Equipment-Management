import { expect, test, type Page } from '@playwright/test'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const jwt = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify({ sub: USER_ID, aud: 'authenticated', exp: 4102444800, email: 'smoke@example.com', role: 'authenticated' })).toString('base64url')}.`

async function installSupabaseMocks(page: Page) {
  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem('sb-supabase-not-configured-auth-token', JSON.stringify({
      access_token: token,
      refresh_token: 'smoke-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 4102444800,
      user: { id: userId, email: 'smoke@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }))
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException('Camera unavailable in CI', 'NotAllowedError') }, enumerateDevices: async () => [] },
    })
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true })
  }, { token: jwt, userId: USER_ID })

  await page.route('https://supabase-not-configured.invalid/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
    if (path.includes('/auth/v1/user')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ id: USER_ID, email: 'smoke@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }) })
    if (path.includes('/auth/v1/token')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ access_token: jwt, refresh_token: 'smoke-refresh', expires_in: 3600, token_type: 'bearer', user: { id: USER_ID, email: 'smoke@example.com' } }) })
    if (path.includes('/rest/v1/app_user_role')) return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '0-0/1' }, body: JSON.stringify({ role: 'ADMIN', email: 'smoke@example.com' }) })
    if (path.includes('/rest/v1/equipment_master')) return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '0-0/1' }, body: JSON.stringify([{ equipment_id: 'CEV-PR-001', equipment_type: 'PRODUCTION', control_number: 'SMOKE', qr_code: 'CEV-PR-001', equipment_name: 'Smoke Equipment', model: 'M1', manufacturer: 'CEV', serial_number: 'S1', department: 'PRODUCTION', status: 'RUNNING', active: true, source_data: {}, created_at: '2026-08-30T00:00:00Z', updated_at: '2026-08-30T00:00:00Z' }]) })
    if (path.includes('/storage/v1/')) return route.fulfill({ status: 200, headers, body: '[]' })
    if (path.includes('/rest/v1/')) return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '*/0' }, body: '[]' })
    return route.fulfill({ status: 200, headers, body: '{}' })
  })
}

async function openApp(page: Page) {
  await installSupabaseMocks(page)
  await page.goto('/')
  await expect(page.locator('.connection-pill')).toHaveText('SUPABASE LIVE')
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
}

async function clickNav(page: Page, label: string) {
  await page.locator('button:visible', { hasText: label }).first().click()
  await expect(page.locator('.topbar h1')).toContainText(label)
}

test('all operational workspaces navigate without browser crash', async ({ page }) => {
  await openApp(page)
  for (const label of ['Quét QR', 'Thiết bị', 'Kiểm tra ngày', 'Bảo trì', 'Jig & Tooling', 'Hiệu chuẩn', 'Hồ sơ A4', 'Audit & Cấu hình']) {
    await clickNav(page, label)
    await expect(page.locator('main')).toBeVisible()
  }
})

test('A4 renderer exposes source-driven document and print action', async ({ page }) => {
  await openApp(page)
  await clickNav(page, 'Hồ sơ A4')
  await expect(page.getByRole('heading', { name: 'Hồ sơ A4 / PDF' })).toBeVisible()
  await expect(page.locator('.a4-document')).toContainText('BM-TBSX-01')
  await expect(page.locator('.a4-document')).toContainText('CEV-PR-001')
  await expect(page.getByRole('button', { name: 'In / Xuất PDF A4' })).toBeEnabled()
})

test('ADMIN audit export creates a ZIP download end-to-end', async ({ page }) => {
  await openApp(page)
  await clickNav(page, 'Audit & Cấu hình')
  const exportButton = page.getByRole('button', { name: 'Export Audit Package (.zip)' })
  await expect(exportButton).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^CEV-IATF-Audit-Package-.*\.zip$/)
  await expect(page.locator('.audit-export-control small[role="status"]')).toContainText('Đã tạo CEV-IATF-Audit-Package-')
})

test('QR entry remains usable when CI camera is denied', async ({ page }) => {
  await openApp(page)
  await clickNav(page, 'Quét QR')
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('.topbar h1')).toHaveText('Quét QR')
})
