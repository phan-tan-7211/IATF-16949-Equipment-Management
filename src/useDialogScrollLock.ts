import { useEffect } from 'react'

let locks = 0
let unlock: (() => void) | undefined

// Reference counting preserves the lock when one dialog opens another.
export function useDialogScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (locks++ === 0) {
      const body = document.body
      const root = document.documentElement
      const x = window.scrollX, y = window.scrollY
      const previous = { position: body.style.position, top: body.style.top,
        left: body.style.left, width: body.style.width, overflow: body.style.overflow,
        rootOverflow: root.style.overflow }
      Object.assign(body.style, { position: 'fixed', top: `${-y}px`, left: `${-x}px`, width: '100%', overflow: 'hidden' })
      root.style.overflow = 'hidden'
      unlock = () => {
        Object.assign(body.style, { position: previous.position, top: previous.top,
          left: previous.left, width: previous.width, overflow: previous.overflow })
        root.style.overflow = previous.rootOverflow
        window.scrollTo({ left: x, top: y, behavior: 'instant' })
      }
    }
    return () => {
      if (--locks === 0) { unlock?.(); unlock = undefined }
    }
  }, [active])
}
