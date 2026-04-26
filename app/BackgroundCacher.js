'use client'

import { useEffect, useRef, useState } from 'react'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useOffline } from '@/lib/useOffline'
import { preloadProfileData, preloadTheme } from '@/lib/dataCacher'

export default function BackgroundCacher() {
  const { user, loading: userLoading } = useCurrentUser()
  const { availableProfiles, loading: profilesLoading, profileDisplayName } = useActiveProfile()
  const { isOnline } = useOffline()
  const hasCached = useRef(false)
  const [cacheStatus, setCacheStatus] = useState(null)
  const [cacheProgress, setCacheProgress] = useState('')

  useEffect(() => {
    // Wait until BOTH user AND profiles are fully loaded before caching
    if (userLoading || profilesLoading || !user || !isOnline || hasCached.current) return
    hasCached.current = true

    async function cacheAll() {
      setCacheStatus('caching')

      // Cache theme first (fast)
      setCacheProgress('Caching theme...')
      await preloadTheme()

      // Cache own profile
      setCacheProgress('Caching your data...')
      await preloadProfileData(user.email, true)

      // Cache shared profiles
      const profiles = availableProfiles || []
      for (let i = 0; i < profiles.length; i++) {
        const name = profileDisplayName(profiles[i].email)
        setCacheProgress(`Caching ${name}'s data... (${i + 1}/${profiles.length})`)
        await preloadProfileData(profiles[i].email, false)
      }

      // Pre-cache page shells for offline navigation
      setCacheProgress('Caching pages for offline...')
      try {
        // Fetch piece detail pages to warm the SW cache
        const allPieces = []
        // Own pieces
        const ownRes = await fetch(`/api/profile-data?type=pieces&email=${encodeURIComponent(user.email)}`, { signal: AbortSignal.timeout(10000) }).catch(() => null)
        if (ownRes?.ok) {
          const ownData = await ownRes.json()
          allPieces.push(...(ownData.pieces || []))
        }
        // Shared profile pieces
        for (const profile of (availableProfiles || [])) {
          const pRes = await fetch(`/api/profile/${encodeURIComponent(profile.email)}/pieces`, { signal: AbortSignal.timeout(10000) }).catch(() => null)
          if (pRes?.ok) {
            const pData = await pRes.json()
            allPieces.push(...(pData.pieces || []))
          }
        }
        // Prefetch each piece detail page AND other key pages to warm the SW cache
        const pagesToCache = [
          '/', '/pieces', '/schedule', '/strategies', '/experiences',
          ...allPieces.map(p => `/piece/${p.id}`)
        ]
        for (const url of pagesToCache) {
          try {
            await fetch(url, { signal: AbortSignal.timeout(5000) })
          } catch {}
        }
      } catch {}

      setCacheStatus('done')
      setTimeout(() => setCacheStatus(null), 2000)
    }

    const timer = setTimeout(cacheAll, 500)
    return () => clearTimeout(timer)
  }, [userLoading, profilesLoading, user, isOnline, availableProfiles])

  // Re-cache periodically while online (every 5 minutes)
  useEffect(() => {
    if (!user || !isOnline || profilesLoading) return
    const interval = setInterval(async () => {
      await preloadProfileData(user.email, true)
      await preloadTheme()
      for (const profile of (availableProfiles || [])) {
        await preloadProfileData(profile.email, false)
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user, isOnline, availableProfiles, profilesLoading])

  if (!cacheStatus) return null

  return (
    <div style={{
      position: 'fixed', top: '60px', right: '16px',
      background: cacheStatus === 'done' ? '#059669' : '#2563eb',
      color: '#fff', padding: '8px 16px', borderRadius: '8px',
      fontSize: '12px', fontWeight: '500', zIndex: 9997,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      animation: 'slideIn 0.25s ease-out',
      maxWidth: '280px',
    }}>
      {cacheStatus === 'done' ? '✓ Data cached for offline use' : cacheProgress}
    </div>
  )
}
