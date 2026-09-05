import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Equipment platform architecture', () => {
  it('routes Equipment through the viewport workspace instead of the legacy mixed panel', () => {
    const app = read('src/App.tsx')
    expect(app).toContain("./equipment/EquipmentWorkspace")
    expect(app).not.toContain("./LiveEquipmentPanel")
    expect(existsSync(resolve(root, 'src/LiveEquipmentPanel.tsx'))).toBe(false)
  })

  it('keeps desktop and mobile composition independent', () => {
    const desktop = read('src/equipment/desktop/EquipmentDesktopWorkspace.tsx')
    const mobile = read('src/equipment/mobile/EquipmentMobileWorkspace.tsx')

    expect(desktop).toContain('EquipmentDesktopPanel')
    expect(desktop).not.toContain('EquipmentMobile')
    expect(desktop).not.toContain('LiveEquipmentPanel')

    expect(mobile).toContain('EquipmentMobilePanel')
    expect(mobile).not.toContain('EquipmentDesktop')
    expect(mobile).not.toContain('LiveEquipmentPanel')
  })

  it('keeps shared controller free of platform presentation imports', () => {
    const shared = read('src/equipment/shared/useEquipmentPanelController.ts')
    expect(shared).not.toContain('/desktop/')
    expect(shared).not.toContain('/mobile/')
    expect(shared).not.toContain('EquipmentDesktop')
    expect(shared).not.toContain('EquipmentMobile')
  })

  it('uses one explicit 901px platform boundary', () => {
    const workspace = read('src/equipment/EquipmentWorkspace.tsx')
    const desktopCss = read('src/equipment/desktop/EquipmentDesktop.css')
    const mobileCss = read('src/equipment/mobile/EquipmentMobile.css')

    expect(workspace).toContain("(min-width: 901px)")
    expect(desktopCss).toContain('(min-width:901px)')
    expect(mobileCss).toContain('(max-width:900px)')
  })
})
