'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const ADMIN_EMAIL = 'michael.rosenthal@gmail.com'

// Cache in memory AND localStorage for offline resilience
let cached = null

function getStoredUser() {
  if (cached) return cached
  try {
    const stored = localStorage.getItem('piano_exp_user')
    if (stored) {
      cached = JSON.parse(stored)
      return cached
    }
  } catch {}
  return null
}

function storeUser(user) {
  cached = user
  try {
    localStorage.setItem('piano_exp_user', JSON.stringify(user))
  } catch {}
}

export function useCurrentUser() {
  const [user, setUser] = useState(() => getStoredUser())
  const [loading, setLoading] = useState(!getStoredUser())

  useEffect(() => {
    if (cached) return
    const stored = getStoredUser()
    if (stored) {
      setUser(stored)
      setLoading(false)
      return
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Race getUser against a 3s timeout so it doesn't hang offline
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ data: { user: null } }), 3000))
    Promise.race([supabase.auth.getUser(), timeout]).then(({ data }) => {
      const u = data?.user
      if (u) {
        const userData = { email: u.email, isAdmin: u.email === ADMIN_EMAIL }
        storeUser(userData)
        setUser(userData)
      }
      setLoading(false)
    })
  }, [])

  return { user, loading, isAdmin: user?.isAdmin || false }
}

// Call on sign out to clear cached user
export function clearCachedUser() {
  cached = null
  try { localStorage.removeItem('piano_exp_user') } catch {}
}
