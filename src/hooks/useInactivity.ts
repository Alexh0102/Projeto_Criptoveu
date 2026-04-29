import { useEffect, useState } from 'react'

const DEFAULT_INACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'mousedown',
  'touchstart',
] as const

type InactivityEventName = (typeof DEFAULT_INACTIVITY_EVENTS)[number]

type UseInactivityOptions = {
  timeout?: number
  events?: readonly InactivityEventName[]
  disabled?: boolean
}

export function useInactivity({
  timeout = 120_000,
  events = DEFAULT_INACTIVITY_EVENTS,
  disabled = false,
}: UseInactivityOptions = {}) {
  const [isInactive, setIsInactive] = useState(false)

  useEffect(() => {
    if (disabled) {
      return
    }

    let timeoutId = window.setTimeout(() => setIsInactive(true), timeout)

    function resetTimer() {
      setIsInactive(false)
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => setIsInactive(true), timeout)
    }

    for (const eventName of events) {
      window.addEventListener(eventName, resetTimer, { passive: true })
    }

    return () => {
      window.clearTimeout(timeoutId)

      for (const eventName of events) {
        window.removeEventListener(eventName, resetTimer)
      }
    }
  }, [disabled, events, timeout])

  return disabled ? false : isInactive
}
