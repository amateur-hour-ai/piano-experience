'use client'

import { useEffect, useRef, useState } from 'react'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useOffline } from '@/lib/useOffline'
import { preloadProfileData, preloadTheme } from '@/lib/dataCacher'

export default function BackgroundCacher() {
  const { user, loading: userLoading } = useCurrentUser()
  const { availableProfiles } = useActiveProfile()
  const { isOnline } = useOffline()
  const hasCached = useRef(false)
  const [cacheStatus, setCacheStatus] = useState(null) // null, 'caching', 'done'
  const [cacheProgress, setCacheProgress] = useState('')

  useEffect(() => {
    if (userLoading || !user || !isOnline || hasCached.current) return
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
        setCacheProgress(`Caching ${profiles[i].email.split('@')[0]}'s data... (${i + 1}/${profiles.length})`)
        await preloadProfileData(profiles[i].email, false)
      }

      setCacheStatus('done')
      setTimeout(() => setCacheStatus(null), 2000)
    }

    // Start immediately — don't wait
    const timer = setTimeout(cacheAll, 500)
    return () => clearTimeout(timer)
  }, [userLoading, user, isOnline, availableProfiles])

  // Re-cache periodically while online (every 5 minutes)
  useEffect(() => {
    if (!user || !isOnline) return
    const interval = setInterval(async () => {
      await preloadProfileData(user.email, true)
      await preloadTheme()
      for (const profile of (availableProfiles || [])) {
        await preloadProfileData(profile.email, false)
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user, isOnline, availableProfiles])

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
