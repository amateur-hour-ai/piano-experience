'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from './useCurrentUser'

const ActiveProfileContext = createContext()

export function useActiveProfile() {
  return useContext(ActiveProfileContext)
}

function getStoredProfiles() {
  try {
    const stored = localStorage.getItem('piano_exp_profiles')
    if (stored) return JSON.parse(stored)
  } catch {}
  return []
}

function storeProfiles(profiles) {
  try { localStorage.setItem('piano_exp_profiles', JSON.stringify(profiles)) } catch {}
}

function getStoredActiveProfile() {
  try { return localStorage.getItem('piano_exp_active_profile') } catch {}
  return null
}

function storeActiveProfile(email) {
  try { localStorage.setItem('piano_exp_active_profile', email) } catch {}
}

export default function ActiveProfileProvider({ children }) {
  const { user, loading: userLoading } = useCurrentUser()
  const [activeProfile, setActiveProfile] = useState(() => getStoredActiveProfile())
  const [availableProfiles, setAvailableProfiles] = useState(() => getStoredProfiles())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading || !user) return
    if (!activeProfile) {
      setActiveProfile(user.email)
      storeActiveProfile(user.email)
    }
    loadProfiles()
  }, [userLoading, user])

  async function loadProfiles() {
    // Use stored profiles immediately for offline
    const stored = getStoredProfiles()
    if (stored.length > 0) {
      setAvailableProfiles(stored)
      setLoading(false)
    }

    // Try to refresh from network with timeout
    try {
      const res = await fetch('/api/permissions', { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      const profiles = (data.received || []).map(p => ({
        email: p.owner_email,
        accessLevel: p.access_level,
      }))
      setAvailableProfiles(profiles)
      storeProfiles(profiles)
    } catch {}
    setLoading(false)
  }

  const switchProfile = useCallback((email) => {
    setActiveProfile(email)
    storeActiveProfile(email)
  }, [])

  const isOwnProfile = activeProfile === user?.email
  const currentAccess = isOwnProfile
    ? 'own'
    : availableProfiles.find(p => p.email === activeProfile)?.accessLevel || null
  const canEdit = currentAccess === 'own' || currentAccess === 'edit'

  const profileDisplayName = (email) => {
    if (!email) return ''
    if (email === user?.email) return 'My Profile'
    return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <ActiveProfileContext.Provider value={{
      activeProfile,
      isOwnProfile,
      currentAccess,
      canEdit,
      availableProfiles,
      switchProfile,
      profileDisplayName,
      loading: loading || userLoading,
      refreshProfiles: loadProfiles,
    }}>
      {children}
    </ActiveProfileContext.Provider>
  )
}
