'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const ADMIN_EMAIL = 'michael.rosenthal@gmail.com'

let cached = null

export function useCurrentUser() {
  const [user, setUser] = useState(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user
      if (u) {
        cached = { email: u.email, isAdmin: u.email === ADMIN_EMAIL }
        setUser(cached)
      }
      setLoading(false)
    })
  }, [])

  return { user, loading, isAdmin: user?.isAdmin || false }
}
