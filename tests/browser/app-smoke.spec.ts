import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'

const SOURCE_ROWS: Record<string, Record<string, unknown>[]> = {
 maintenance_plan: [{ plan_id: 'PLAN-1', equipment_id: 'CEV-PR-001', source_data: { maintenanceType: 'PM', frequency: '3 tháng', responsiblePerson: 'Người thực hiện mẫu' } }],
 maintenance_plan_item: [{ item_id: 'PI-1', plan_id: 'PLAN-1', source_data: { itemName: 'Kiểm tra dây đai', standard: 'Không nứt', method: 'Quan sát', sequence: 1 } }],
 maintenance_execution: [{ execution_id: 'EX-1', equipment_id: 'CEV-PR-001', source_data: { executionDate: '2026-09-03', periodicFrequency: '3 tháng' } }],
 maintenance_result_item: [{ result_item_id: 'RI-1', execution_id: 'EX-1', source_data: { itemName: 'Dây đai', resultMark: '△', repairContent: 'Thay dây', inspector: 'Người kiểm tra mẫu' } }],
 equipment_handover: [{ handover_id: 'HO-1', equipment_id: 'CEV-PR-001', source_data: { handoverPerson: 'Người giao mẫu', receiverPerson: 'Người nhận mẫu', attachedItems: 'Sổ hướng dẫn' } }],
 downtime_event: [{ downtime_id: 'DT-1', equipment_id: 'CEV-PR-001', started_at: '2026-09-03T01:00:00Z', ended_at: '2026-09-03T02:00:00Z', source_data: { causeCategory: 'MECHANICAL', actionTaken: 'Thay vòng bi', detail: 'Kẹt trục' } }],
 calibration_log: [{ calibration_log_id: 'CL-1', equipment_id: 'CEV-ME-001', result: 'PASS', source_data: { provider: 'Phòng đo mẫu', certificatePath: 'CEV-ME-001/certificate.pdf' } }],
}

const USER_ID = '00000000-0000-4000-8000-000000000001'
const jwt = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify({ sub: USER_ID, aud: 'authenticated', exp: 4102444800, email: 'smoke@example.com', role: 'authenticated' })).toString('base64url')}.`

async function installSupabaseMocks(page: Page, signedIn = true) {
  await page.addInitScript(({ token, userId, signedIn }) => {
    if (signedIn) localStorage.setItem('sb-supabase-not-configured-auth-token', JSON.stringify({
      access_token: token,
      refresh_token: 'smoke-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 4102444800,
      user: { id: userId, email: 'smoke@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }))
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException('Camera unavailable in CI', 'NotAllowedError') }, enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'denied-camera', label: 'CI camera' }] },
    })
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true })
  }, { token: jwt, userId: USER_ID, signedIn })

  await page.route('https://supabase-not-configured.invalid/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
    if (path.includes('/auth/v1/user')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ id: USER_ID, email: 'smoke@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }) })
    if (path.includes('/auth/v1/token')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ access_token: jwt, refresh_token: 'smoke-refresh', expires_in: 3600, token_type: 'bearer', user: { id: USER_ID, email: 'smoke@example.com' } }) })
    if (path.includes('/rest/v1/app_user_role')) return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '0-0/1' }, body: JSON.stringify({ role: 'ADMIN', email: 'smoke@example.com' }) })
    if ([...url.searchParams.values()].some(value => value.startsWith('gt.'))) return route.fulfill({ status: 200, headers, body: '[]' })
    const table = path.split('/').pop() || ''
    if (SOURCE_ROWS[table]) return route.fulfill({ status: 200, headers, body: JSON.stringify(SOURCE_ROWS[table]) })
    if (path.includes('/rest/v1/equipment_master')) return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '0-0/1' }, body: JSON.stringify([{ equipment_id: 'CEV-PR-001', equipment_type: 'PRODUCTION', control_number: 'SMOKE', qr_code: 'CEV-PR-001', equipment_name: 'Smoke Equipment', model: 'M1', manufacturer: 'CEV', serial_number: 'S1', department: 'PRODUCTION', status: 'RUNNING', active: true, source_data: {}, created_at: '2026-08-30T00:00:00Z', updated_at: '2026-08-30T00:00:00Z' }]) })
    if (path.includes('/storage/v1/')) return route.fulfill({ status: 200, headers, body: '[]' })
    if (path.includes('/rest/v1/')) return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '*/0' }, body: '[]' })
    return route.fulfill({ status: 200, headers, body: '{}' })
  })
}

async function normalizeEmulatedMobileViewport(page: Page) {
  const viewport = page.viewportSize()
  if (!viewport || viewport.width > 900) return
  let actual = await page.evaluate(() => ({
    innerWidth,
    innerHeight,
    visualWidth: visualViewport?.width ?? innerWidth,
    visualHeight: visualViewport?.height ?? innerHeight,
    meta: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
    dpr: devicePixelRatio,
    userAgent: navigator.userAgent,
  }))
  if (Math.abs(actual.innerWidth - viewport.width) > 2 || Math.abs(actual.innerHeight - viewport.height) > 2) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(50)
    actual = await page.evaluate(() => ({
      innerWidth,
      innerHeight,
      visualWidth: visualViewport?.width ?? innerWidth,
      visualHeight: visualViewport?.height ?? innerHeight,
      meta: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
      dpr: devicePixelRatio,
      userAgent: navigator.userAgent,
    }))
  }
  console.log(`[mobile-viewport] configured=${JSON.stringify(viewport)} actual=${JSON.stringify(actual)}`)
  expect(actual.meta).toContain('width=device-width')
  expect(actual.innerWidth, `Emulated mobile layout width drifted: ${JSON.stringify(actual)}`).toBeLessThanOrEqual(viewport.width + 2)
  expect(actual.innerHeight, `Emulated mobile layout height drifted: ${JSON.stringify(actual)}`).toBeLessThanOrEqual(viewport.height + 2)
}

async function openApp(page: Page) {
  await installSupabaseMocks(page)
  await page.goto('/')
  await normalizeEmulatedMobileViewport(page)
  await expect(page.locator('.connection-pill')).toHaveText('SUPABASE LIVE')
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
}

async function clickNav(page: Page, label: string) {
  const viewport = page.viewportSize()
  const mobile = Boolean(viewport && viewport.width <= 900)
  const nav = mobile ? page.locator('.bottom-nav') : page.locator('.sidebar nav')
  const button = nav.getByRole('button', { name: label, exact: true })
  await expect(button).toBeVisible()
  if (mobile) {
    const hit = await button.evaluate((element) => {
      element.scrollIntoView({ block: 'nearest', inline: 'center' })
      const rect = element.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const target = document.elementFromPoint(x, y)
      const navElement = element.closest('.bottom-nav')
      const navRect = navElement?.getBoundingClientRect()
      const style = navElement ? getComputedStyle(navElement) : null
      const targetPath: string[] = []
      let node: Element | null = target
      while (node && targetPath.length < 6) {
        targetPath.push(`${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${node.className && typeof node.className === 'string' ? `.${node.className.trim().replace(/\s+/g, '.')}` : ''}`)
        node = node.parentElement
      }
      return {
        viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width ?? null, visualHeight: visualViewport?.height ?? null, scale: visualViewport?.scale ?? null },
        button: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, x, y },
        nav: navRect ? { left: navRect.left, top: navRect.top, right: navRect.right, bottom: navRect.bottom, width: navRect.width, height: navRect.height, zIndex: style?.zIndex, position: style?.position, pointerEvents: style?.pointerEvents } : null,
        hit: targetPath,
        targetInsideButton: Boolean(target && element.contains(target)),
      }
    })
    console.log(`[mobile-nav-hit] ${label}: ${JSON.stringify(hit)}`)
    expect(hit.targetInsideButton, `Mobile nav hit-test failed: ${JSON.stringify(hit)}`).toBe(true)
  }
  await button.click()
  await expect(page.locator('.topbar h1')).toContainText(label)
  await expect(page.locator('.workspace-loading')).toHaveCount(0)
  await expect(page.locator('.fatal-screen')).toHaveCount(0)
  if (mobile) expect(await page.evaluate(() => innerWidth)).toBeLessThanOrEqual(viewport!.width + 2)
}

test('all operational workspaces navigate without browser crash', async ({ page }) => {
  await openApp(page)
  for (const label of ['Quét QR', 'Thiết bị', 'Kiểm tra ngày', 'Bảo trì', 'Jig & Tooling', 'Hiệu chuẩn', 'Hồ sơ A4', 'Audit & Cấu hình']) {
    await clickNav(page, label)
    await expect(page.locator('main')).toBeVisible()
  }
})

test('A4 renderer exposes source-driven document and print action', async ({ page }, testInfo) => {
  await openApp(page)
  await clickNav(page, 'Hồ sơ A4')
  await expect(page.getByRole('heading', { name: 'Hồ sơ A4 / PDF' })).toBeVisible()
  await expect(page.locator('.a4-document')).toContainText('BM-TBSX-01')
  await expect(page.locator('.a4-document')).toContainText('CEV-PR-001')
  await expect(page.getByRole('button', { name: 'In / Xuất PDF A4' })).toBeEnabled()
  if (testInfo.project.name === 'desktop-chromium') {
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
    const box = /\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf.toString('latin1'))
    expect(box).not.toBeNull()
    expect(Number(box![1])).toBeCloseTo(595, 0)
    expect(Number(box![2])).toBeCloseTo(842, 0)
    await testInfo.attach('A4-equipment.pdf', { body: pdf, contentType: 'application/pdf' })
  }
})

test('ADMIN audit export creates a ZIP download end-to-end', async ({ page }, testInfo) => {
  await openApp(page)
  await clickNav(page, 'Audit & Cấu hình')
  const exportButton = page.getByRole('button', { name: 'Export Audit Package (.zip)' })
  await expect(exportButton).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  const download = await downloadPromise
  const file = testInfo.outputPath('audit.zip')
  await download.saveAs(file)
  execFileSync('python3', ['-c', `import sys,zipfile,hashlib,json
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 lines=z.read('checksums.sha256').decode().splitlines()
 assert len(lines)==22
 assert {line.split('  ',1)[1] for line in lines} == set(z.namelist())-{'checksums.sha256'}
 for line in lines:
  digest,name=line.split('  ',1)
  assert hashlib.sha256(z.read(name)).hexdigest()==digest,name
 manifest=json.loads(z.read('manifest.json'))
 assert len(manifest['tableCounts'])==20
 assert len(manifest['bucketCounts'])==9
 assert json.loads(z.read('database/equipment_master.json'))[0]['equipment_id']=='CEV-PR-001'
 assert 'storage/evidence-manifest.json' in z.namelist()
`, file])
  expect(download.suggestedFilename()).toMatch(/^CEV-IATF-Audit-Package-.*\.zip$/)
  await expect(page.locator('.audit-export-control small[role="status"]')).toContainText('Đã tạo CEV-IATF-Audit-Package-')
})

test('QR entry remains usable when CI camera is denied', async ({ page }) => {
  await openApp(page)
  await clickNav(page, 'Quét QR')
  await expect(page.locator('main')).toBeVisible()
  await page.getByRole('button', { name: 'Mở camera & quét ngay' }).click()
  await expect(page.locator('.qr-message')).toContainText('Không mở được camera')
  await page.getByPlaceholder('CEV-PR-001').fill('CEV-PR-001')
  await page.getByRole('button', { name: 'Mở', exact: true }).click()
  await expect(page.locator('.topbar h1')).toHaveText('CEV-PR-001')
})


for (const [doc, expected] of [
 ['bm03', 'Kiểm tra dây đai'], ['bm08', 'Thay dây'], ['bm05', 'Người nhận mẫu'],
 ['bm06', 'Thay vòng bi'], ['calibration', 'Phòng đo mẫu'],
]) {
 test(`A4 source fields: ${doc}`, async ({ page }) => {
  await openApp(page)
  await clickNav(page, 'Hồ sơ A4')
  await page.getByLabel('Biểu mẫu', { exact: true }).selectOption(doc)
  await expect(page.locator('.a4-document')).toContainText(expected)
  await expect(page.getByRole('button', { name: 'In / Xuất PDF A4' })).toBeEnabled()
  await expect(page.locator('.print-error')).toHaveCount(0)
 })
}

test('A4 detail failure prevents incomplete printing', async ({ page }) => {
 await openApp(page)
 await page.route('**/rest/v1/maintenance_plan_item*', route => route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message:'detail unavailable'})}))
 await clickNav(page, 'Hồ sơ A4')
 await page.getByLabel('Biểu mẫu', { exact: true }).selectOption('bm03')
 await expect(page.locator('.print-error')).toContainText('detail unavailable')
 await expect(page.getByRole('button', { name: 'In / Xuất PDF A4' })).toBeDisabled()
})


test('signed-out login resolves ADMIN, preserves QR target and logout removes data', async ({ page }) => {
  await installSupabaseMocks(page, false)
  await page.goto('/?phase3=equipment&equipment=CEV-PR-001')
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await expect(page.locator('.app-shell')).toHaveCount(0)
  await page.getByLabel('Email', { exact: true }).fill('smoke@example.com')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('browser-fixture-password')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
  await expect(page.locator('.topbar h1')).toHaveText('CEV-PR-001')
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await expect(page.locator('.app-shell')).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible()
})

test('recovery email callback opens password form before role checks and saves', async ({ page }) => {
  await installSupabaseMocks(page, false)
  let roleReads = 0
  let passwordWrites = 0
  page.on('request', request => {
    if (request.url().includes('/rest/v1/app_user_role')) roleReads++
    if (request.url().includes('/auth/v1/user') && request.method() === 'PUT') passwordWrites++
  })
  await page.goto(`/#access_token=${jwt}&refresh_token=smoke-refresh&expires_in=3600&token_type=bearer&type=recovery`)
  await expect(page.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible()
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('Fixture-password-123')
  await page.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill('Mismatched-password-123')
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
  await expect(page.getByRole('alert')).toContainText('chưa trùng nhau')
  expect(passwordWrites).toBe(0)
  expect(roleReads).toBe(0)
  await page.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill('Fixture-password-123')
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu mật khẩu mới' })).toBeVisible()
  expect(passwordWrites).toBe(1)
  await page.getByRole('button', { name: 'Tiếp tục vào ứng dụng' }).click()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
})

test('expired recovery offers a fresh email pointing back to the application', async ({ page }) => {
  await installSupabaseMocks(page, false)
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Expired')
  await expect(page.getByRole('alert')).toContainText('Link không hợp lệ')
  await expect(page.getByLabel('Mật khẩu mới', { exact: true })).toHaveCount(0)
  await page.getByLabel('Email', { exact: true }).fill('smoke@example.com')
  const request = page.waitForRequest(request => request.url().includes('/auth/v1/recover'))
  await page.getByRole('button', { name: 'Gửi link đặt mật khẩu' }).click()
  expect(new URL((await request).url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4173/')
  await expect(page.getByRole('status').filter({ hasText: 'Nếu email có tài khoản' })).toBeVisible()
})
