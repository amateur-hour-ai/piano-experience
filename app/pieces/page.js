'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import EmptyState, { Skeleton } from '@/app/EmptyState'
import { useOfflineData } from '@/lib/useOfflineData'
import { useSortedCategories } from '@/lib/useSortedCategories'

export default function Pieces() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { isOnline, getCachedProfileData } = useOfflineData()
  const { categories: sortedCats } = useSortedCategories()
  const [pieces, setPieces] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortBy, setSortBy] = useState('category')
  const [showArchived, setShowArchived] = useState(false)
  const [expandedView, setExpandedView] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    setLoading(true)
    async function load() {
      // Cache first
      const cached = await getCachedProfileData(activeProfile)
      if (cached) {
        setPieces(cached.pieces || [])
        setCategories(cached.categories || [])
        setLoading(false)
      }

      // Refresh from network if online
      if (isOnline) {
        try {
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          if (isOwnProfile) {
            const dataPromise = Promise.all([
              supabase.from('pieces').select('*, categories(name)').eq('user_id', user.email).order('updated_at', { ascending: false }),
              supabase.from('categories').select('*').or(`user_id.eq.${user.email},user_id.is.null`).order('sort_order'),
            ])
            const [piecesRes, catsRes] = await Promise.race([dataPromise, timeoutPromise])
            setPieces(piecesRes.data || [])
            setCategories(catsRes.data || [])
          } else {
            const res = await Promise.race([
              fetch(`/api/profile/${encodeURIComponent(activeProfile)}/pieces`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
              timeoutPromise
            ])
            setPieces(res.pieces || [])
            const cats = {}
            res.pieces?.forEach(p => { if (p.categories?.name) cats[p.category_id] = { id: p.category_id, name: p.categories.name } })
            setCategories(Object.values(cats))
          }
        } catch {}
      }
      setLoading(false)
    }
    load()
  }, [userLoading, user, activeProfile])

  const filtered = pieces.filter(p => {
    const matchArchive = showArchived ? p.archived : !p.archived
    const matchSearch = !search || [p.title, p.composer, p.book_title].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    const matchCat = !categoryFilter || p.category_id === categoryFilter
    return matchArchive && matchSearch && matchCat
  }).sort((a, b) => {
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '')
    if (sortBy === 'composer') return (a.composer || '').localeCompare(b.composer || '')
    if (sortBy === 'category') {
      const catOrderMap = {}
      sortedCats.forEach((c, i) => { catOrderMap[c.id] = c.effective_sort !== undefined ? c.effective_sort : i })
      const orderA = catOrderMap[a.category_id] !== undefined ? catOrderMap[a.category_id] : 999
      const orderB = catOrderMap[b.category_id] !== undefined ? catOrderMap[b.category_id] : 999
      if (orderA !== orderB) return orderA - orderB
      return (a.title || '').localeCompare(b.title || '')
    }
    return new Date(b.updated_at) - new Date(a.updated_at)
  })

  if (userLoading || loading) return <Skeleton rows={5} height={60} />

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px' }}>
        <h1 style={{ fontSize: '24px' }}>{isOwnProfile ? 'My Pieces' : `${profileDisplayName(activeProfile)}'s Pieces`} ({filtered.length})</h1>
        {canEdit && (
          <Link href="/add">
            <button style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              + Add Piece
            </button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, composer, book..."
            style={{ width: '100%', padding: '10px 36px 10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#999', fontSize: '18px', cursor: 'pointer', padding: '4px'
            }}>×</button>
          )}
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
        >
          <option value="">All Categories</option>
          {(sortedCats.length > 0 ? sortedCats : categories).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
        >
          <option value="date">Sort: Recent</option>
          <option value="title">Sort: Title</option>
          <option value="composer">Sort: Composer</option>
          <option value="category">Sort: Category</option>
        </select>
        <button onClick={() => setShowArchived(!showArchived)} style={{
          padding: '10px 14px', border: `1px solid ${showArchived ? '#2563eb' : '#d1d5db'}`,
          borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
          background: showArchived ? '#dbeafe' : '#fff',
          color: showArchived ? '#2563eb' : '#666',
        }}>
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </button>
        <button onClick={() => setExpandedView(!expandedView)} style={{
          padding: '10px 14px', border: `1px solid ${expandedView ? '#2563eb' : '#d1d5db'}`,
          borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
          background: expandedView ? '#dbeafe' : '#fff',
          color: expandedView ? '#2563eb' : '#666',
        }}>
          {expandedView ? 'Simple View' : 'Expanded View'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={pieces.length === 0 ? '🎵' : '🔍'}
          message={pieces.length === 0 ? 'No pieces yet.' : 'No pieces match your search.'}
        >
          {pieces.length === 0 && canEdit && <Link href="/add" style={{ color: '#2563eb' }}>Add your first piece!</Link>}
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(p => (
            <Link key={p.id} href={`/piece/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                background: '#fff', borderRadius: '10px', padding: '16px 20px', border: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'box-shadow 0.15s'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '16px' }}>{p.title || 'Untitled'}</div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                    {[p.composer, p.book_title].filter(Boolean).join(' — ')}
                  </div>
                  {expandedView && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {p.personal_rating && (
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: '#999' }}>Rating: </span>
                          <span style={{ fontWeight: '600', color: '#2563eb' }}>{p.personal_rating}/10</span>
                        </div>
                      )}
                      {p.metronome_marking && (
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: '#999' }}>Metronome: </span>
                          <span style={{ fontWeight: '600' }}>{p.metronome_marking}</span>
                        </div>
                      )}
                      {p.current_focus && (
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: '#999' }}>Focus: </span>
                          <span style={{ color: '#2563eb' }}>{p.current_focus}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  {p.categories?.name && (
                    <span style={{ fontSize: '12px', padding: '4px 10px', background: '#dbeafe', color: '#2563eb', borderRadius: '12px', fontWeight: '500' }}>
                      {p.categories.name}
                    </span>
                  )}
                  <span style={{ color: '#999', fontSize: '20px' }}>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
