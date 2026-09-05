import { useEffect } from 'react'

/**
 * Equipment layout ownership boundary.
 * Desktop and mobile presentation are loaded from separate files so layout rules
 * do not live in the global entrypoint and future changes stay mode-specific.
 */
export function EquipmentViewportStyles() {
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)').matches
    if (desktop) void import('./desktop/EquipmentDesktop.css')
    else void import('./mobile/EquipmentMobile.css')
  }, [])
  return null
}
