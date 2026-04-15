'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getPendingCount, replayQueue } from './syncManager'

const OfflineContext = createContext()

export function useOffline() {
  return useContext(OfflineContext)
}

export default function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const retryTimer = useRef(null)

  // Track online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine)

    function goOnline() { setIsOnline(true) }
    function goOffline() { setIsOnline(false) }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Update pending count periodically
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch {}
  }, [])

  useEffect(() => {
    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 5000)
    return () => clearInterval(interval)
  }, [refreshPendingCount])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncing) {
      syncNow()
    }
  }, [isOnline, pendingCount])

  // Retry sync on flaky connections
  useEffect(() => {
    if (!isOnline && pendingCount > 0) {
      // Try every 30 seconds even when "offline" — connection might come back
      retryTimer.current = setInterval(async () => {
        try {
          const res = await fetch('/api/theme', { signal: AbortSignal.timeout(5000) })
          if (res.ok) {
            setIsOnline(true)
          }
        } catch {}
      }, 30000)
      return () => clearInterval(retryTimer.current)
    }
  }, [isOnline, pendingCount])

  async function syncNow() {
    if (syncing) return
    setSyncing(true)
    setSyncMessage(`Syncing ${pendingCount} change${pendingCount !== 1 ? 's' : ''}...`)

    const result = await replayQueue((progress) => {
      setSyncMessage(`Syncing... ${progress.synced}/${progress.total}`)
    })

    setSyncing(false)
    await refreshPendingCount()

    if (result.aborted) {
      setSyncMessage('Connection lost — will retry')
      setTimeout(() => setSyncMessage(null), 3000)
    } else if (result.failed > 0) {
      setSyncMessage(`${result.synced} synced, ${result.failed} failed`)
      setTimeout(() => setSyncMessage(null), 5000)
    } else if (result.synced > 0) {
      setSyncMessage('Synced!')
      setTimeout(() => setSyncMessage(null), 2000)
    } else {
      setSyncMessage(null)
    }
  }

  // Helper: make a fetch that falls back gracefully
  // Returns { data, fromCache }
  async function fetchWithFallback(url, cacheGetter) {
    if (!isOnline) {
      const cached = cacheGetter ? await cacheGetter() : null
      return { data: cached, fromCache: true }
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        return { data, fromCache: false }
      }
      throw new Error('Request failed')
    } catch {
      // Network failed or timed out — fall back to cache
      setIsOnline(false)
      const cached = cacheGetter ? await cacheGetter() : null
      return { data: cached, fromCache: true }
    }
  }

  return (
    <OfflineContext.Provider value={{
      isOnline,
      pendingCount,
      syncing,
      syncMessage,
      syncNow,
      refreshPendingCount,
      fetchWithFallback,
    }}>
      {children}
      {/* Offline / Sync indicator bar */}
      {(!isOnline || pendingCount > 0 || syncMessage) && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: syncMessage?.includes('Synced!') ? '#059669'
            : syncMessage?.includes('failed') ? '#dc2626'
            : isOnline && syncing ? '#2563eb'
            : '#d97706',
          color: '#fff',
          padding: '10px 24px',
          fontSize: '13px',
          fontWeight: '500',
          textAlign: 'center',
          zIndex: 9998,
          transition: 'background 0.3s',
        }}>
          {syncMessage || (
            !isOnline
              ? `Offline${pendingCount > 0 ? ` — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending` : ''}`
              : pendingCount > 0
                ? `${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending sync`
                : ''
          )}
        </div>
      )}
    </OfflineContext.Provider>
  )
}
