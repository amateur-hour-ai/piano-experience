'use client'

import { useCallback } from 'react'
import { useOffline } from './useOffline'
import db, { getCachedProfileData, getCachedPieceDetail, getCachedTheme } from './offlineStore'
import { queueMutation, getPendingCount } from './syncManager'

export function useOfflineData() {
  const { isOnline, refreshPendingCount } = useOffline()

  // Fetch with offline fallback — tries network first, falls back to cache
  const fetchOrCache = useCallback(async (url, cacheGetter) => {
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
      const cached = cacheGetter ? await cacheGetter() : null
      return { data: cached, fromCache: true }
    }
  }, [isOnline])

  // Queue a mutation for offline sync, also apply it locally to IndexedDB
  const mutateOrQueue = useCallback(async (url, body, localUpdate, description) => {
    if (isOnline) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          // Also update local cache
          if (localUpdate) await localUpdate()
          return { success: true, data }
        }
        const errData = await res.json().catch(() => ({}))
        return { success: false, error: errData.error || 'Request failed' }
      } catch {
        // Network failed — queue it
        await queueMutation({ url, method: 'POST', body, description })
        if (localUpdate) await localUpdate()
        await refreshPendingCount()
        return { success: true, queued: true }
      }
    } else {
      // Offline — queue and update locally
      await queueMutation({ url, method: 'POST', body, description })
      if (localUpdate) await localUpdate()
      await refreshPendingCount()
      return { success: true, queued: true }
    }
  }, [isOnline, refreshPendingCount])

  // Direct Supabase mutation with offline queue fallback
  // For own-profile operations that use the Supabase client directly
  const supabaseMutateOrQueue = useCallback(async (supabaseCall, apiUrl, apiBody, localUpdate, description) => {
    if (isOnline) {
      try {
        const result = await supabaseCall()
        if (result.error) return { success: false, error: result.error.message }
        if (localUpdate) await localUpdate()
        return { success: true, data: result.data }
      } catch {
        // Network failed — queue the API equivalent
        await queueMutation({ url: apiUrl, method: 'POST', body: apiBody, description })
        if (localUpdate) await localUpdate()
        await refreshPendingCount()
        return { success: true, queued: true }
      }
    } else {
      await queueMutation({ url: apiUrl, method: 'POST', body: apiBody, description })
      if (localUpdate) await localUpdate()
      await refreshPendingCount()
      return { success: true, queued: true }
    }
  }, [isOnline, refreshPendingCount])

  return {
    isOnline,
    fetchOrCache,
    mutateOrQueue,
    supabaseMutateOrQueue,
    db,
    getCachedProfileData,
    getCachedPieceDetail,
    getCachedTheme,
  }
}
