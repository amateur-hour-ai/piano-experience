'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from './useCurrentUser'
import { useActiveProfile } from './useActiveProfile'
import { useOffline } from './useOffline'

export function useSortedCategories() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile } = useActiveProfile()
  const { isOnline } = useOffline()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    loadCategories()
  }, [userLoading, user, activeProfile])

  async function loadCategories() {
    if (isOnline) {
      try {
        const res = await fetch(`/api/categories?profile=${encodeURIComponent(activeProfile)}`, { signal: AbortSignal.timeout(5000) })
        const data = await res.json()
        setCategories(data.categories || [])
      } catch {}
    }
    setLoading(false)
  }

  // Sort pieces by the user's category sort order
  function sortPiecesByCategory(pieces) {
    const catOrder = {}
    categories.forEach((c, i) => { catOrder[c.id] = c.effective_sort !== undefined ? c.effective_sort : i })

    return [...pieces].sort((a, b) => {
      const orderA = catOrder[a.category_id] !== undefined ? catOrder[a.category_id] : 999
      const orderB = catOrder[b.category_id] !== undefined ? catOrder[b.category_id] : 999
      if (orderA !== orderB) return orderA - orderB
      return (a.title || '').localeCompare(b.title || '')
    })
  }

  // Get category name by id
  function getCategoryName(categoryId) {
    const cat = categories.find(c => c.id === categoryId)
    return cat?.name || 'Uncategorized'
  }

  return { categories, loading, sortPiecesByCategory, getCategoryName, reload: loadCategories }
}
