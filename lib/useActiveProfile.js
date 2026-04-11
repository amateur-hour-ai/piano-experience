'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from './useCurrentUser'

const ActiveProfileContext = createContext()

export function useActiveProfile() {
  return useContext(ActiveProfileContext)
}

export default function ActiveProfileProvider({ children }) {
  const { user, loading: userLoading } = useCurrentUser()
  const [activeProfile, setActiveProfile] = useState(null) // email of profile being viewed
  const [availableProfiles, setAvailableProfiles] = useState([]) // profiles I can access
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading || !user) return
    setActiveProfile(user.email)
    loadProfiles()
  }, [userLoading, user])

  async function loadProfiles() {
    try {
      const res = await fetch('/api/permissions')
      const data = await res.json()
      // Profiles others have shared with me
      const profiles = (data.received || []).map(p => ({
        email: p.owner_email,
        accessLevel: p.access_level,
      }))
      setAvailableProfiles(profiles)
    } catch {}
    setLoading(false)
  }

  const switchProfile = useCallback((email) => {
    setActiveProfile(email)
  }, [])

  const isOwnProfile = activeProfile === user?.email
  const currentAccess = isOwnProfile
    ? 'own'
    : availableProfiles.find(p => p.email === activeProfile)?.accessLevel || null
  const canEdit = currentAccess === 'own' || currentAccess === 'edit'

  // Helper: get display name from email (part before @)
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
