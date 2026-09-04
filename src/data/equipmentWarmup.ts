import { loadSupabaseEquipment } from './supabaseEquipment'

let warmupPromise: Promise<void> | null = null
let lastWarmupAt = 0
const MIN_WARMUP_INTERVAL_MS = 30_000

export function warmEquipmentCache(force = false) {
  const now = Date.now()
  if (!force && now - lastWarmupAt < MIN_WARMUP_INTERVAL_MS) return warmupPromise || Promise.resolve()
  if (warmupPromise) return warmupPromise

  lastWarmupAt = now
  warmupPromise = loadSupabaseEquipment({ force })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => { warmupPromise = null })
  return warmupPromise
}

export function installEquipmentWarmup() {
  if (typeof window === 'undefined') return () => undefined

  const schedule = () => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => { void warmEquipmentCache(false) }, { timeout: 1200 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => { void warmEquipmentCache(false) }, 350)
    return () => window.clearTimeout(id)
  }

  const cancelScheduled = schedule()
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void warmEquipmentCache(false)
  }
  const onFocus = () => { void warmEquipmentCache(false) }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)

  return () => {
    cancelScheduled()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
  }
}
