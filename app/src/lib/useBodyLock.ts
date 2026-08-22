import { useEffect } from 'react'

export function useBodyLock(locked: boolean = true) {
  useEffect(() => {
    if (!locked) return
    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
    }
  }, [locked])
}
