import { useState, useEffect } from 'react'
import { clsx } from 'clsx'

// ─── Hook ─────────────────────────────────────────────────────

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const setOnline  = () => setIsOnline(true)
    const setOffline = () => setIsOnline(false)
    window.addEventListener('online',  setOnline)
    window.addEventListener('offline', setOffline)
    return () => {
      window.removeEventListener('online',  setOnline)
      window.removeEventListener('offline', setOffline)
    }
  }, [])

  return isOnline
}

// ─── Banner ───────────────────────────────────────────────────

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [wasOffline, setWasOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline) {
      // Show "back online" confirmation briefly
      setShowReconnected(true)
      const t = setTimeout(() => {
        setShowReconnected(false)
        setWasOffline(false)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline, wasOffline])

  // Nothing to show
  if (isOnline && !showReconnected) return null

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2.5',
        'px-4 py-2.5 text-sm font-body font-medium transition-all duration-300',
        'animate-slide-down',
        !isOnline
          ? 'bg-red-900/95 border-b border-red-700/50 text-red-100 backdrop-blur'
          : 'bg-green-900/95 border-b border-green-700/50 text-green-100 backdrop-blur'
      )}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      {!isOnline ? (
        <>
          <span className="text-base">📵</span>
          <div>
            <span className="font-semibold">You're offline.</span>
            {' '}Predictions you submit won't save until you reconnect.
          </div>
        </>
      ) : (
        <>
          <span className="text-base">✅</span>
          <span>Back online — your data is syncing.</span>
        </>
      )}
    </div>
  )
}
