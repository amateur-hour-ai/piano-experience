'use client'

import { useEffect, useRef } from 'react'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useOffline } from '@/lib/useOffline'
import { preloadProfileData, preloadTheme } from '@/lib/dataCacher'

export default function BackgroundCacher() {
  const { user, loading: userLoading } = useCurrentUser()
  const { availableProfiles } = useActiveProfile()
  const { isOnline } = useOffline()
  const hasCached = useRef(false)

  useEffect(() => {
    if (userLoading || !user || !isOnline || hasCached.current) return
    hasCached.current = true

    async function cacheAll() {
      // Cache own profile
      await preloadProfileData(user.email, true)
      // Cache theme
      await preloadTheme()
      // Cache all shared profiles
      for (const profile of (availableProfiles || [])) {
        await preloadProfileData(profile.email, false)
      }
    }

    // Run after a short delay to not block initial page load
    const timer = setTimeout(cacheAll, 3000)
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

  return null
}
