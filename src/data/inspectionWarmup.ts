import { loadLiveInspection } from './liveInspection'

let warmupPromise: Promise<void> | null = null
let lastWarmupAt = 0
const MIN_WARMUP_INTERVAL_MS = 30_000

export function warmInspectionCache(force = false) {
  const now = Date.now()
  if (!force && now - lastWarmupAt < MIN_WARMUP_INTERVAL_MS) return warmupPromise || Promise.resolve()
  if (warmupPromise) return warmupPromise
  lastWarmupAt = now
  warmupPromise = loadLiveInspection({ force: true })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => { warmupPromise = null })
  return warmupPromise
}

export function installInspectionWarmup() {
  if (typeof window === 'undefined') return () => undefined
  const schedule = () => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => { void warmInspectionCache(false) }, { timeout: 1800 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => { void warmInspectionCache(false) }, 700)
    return () => window.clearTimeout(id)
  }
  const cancelScheduled = schedule()
  const onVisibility = () => { if (document.visibilityState === 'visible') void warmInspectionCache(false) }
  const onFocus = () => { void warmInspectionCache(false) }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)
  return () => {
    cancelScheduled()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
  }
}
