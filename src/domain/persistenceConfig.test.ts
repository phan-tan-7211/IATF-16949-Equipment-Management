import { describe, expect, it } from 'vitest'
import { EVIDENCE_FOLDERS, PERSISTENCE_CONTRACT_VERSION, PERSISTENCE_TABLES } from './persistenceContract'
import { GOOGLE_PERSISTENCE_CONFIG } from './persistenceConfig'

describe('GOOGLE_PERSISTENCE_CONFIG', () => {
  it('points to the frozen G1 contract through the Apps Script boundary', () => {
    expect(GOOGLE_PERSISTENCE_CONFIG.contractVersion).toBe(PERSISTENCE_CONTRACT_VERSION)
    expect(GOOGLE_PERSISTENCE_CONFIG.tables).toBe(PERSISTENCE_TABLES)
    expect(GOOGLE_PERSISTENCE_CONFIG.frontendDirectGoogleApiAllowed).toBe(false)
    expect(GOOGLE_PERSISTENCE_CONFIG.persistenceBoundary).toBe('APPS_SCRIPT_WEB_APP')
    expect(GOOGLE_PERSISTENCE_CONFIG.transport).toBe('GOOGLE_APPS_SCRIPT')
    expect(GOOGLE_PERSISTENCE_CONFIG.deploymentUrlEnv).toBe('VITE_APPS_SCRIPT_WEB_APP_URL')
    expect(GOOGLE_PERSISTENCE_CONFIG.deploymentUrl).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/)
  })

  it('maps every frozen evidence folder exactly once', () => {
    expect(Object.keys(GOOGLE_PERSISTENCE_CONFIG.evidenceFolders).sort()).toEqual([...EVIDENCE_FOLDERS].sort())
    expect(Object.values(GOOGLE_PERSISTENCE_CONFIG.evidenceFolders).every(Boolean)).toBe(true)
  })

  it('uses the seeded canonical Google Sheet', () => {
    expect(GOOGLE_PERSISTENCE_CONFIG.spreadsheetId).toBe('1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE')
  })
})
