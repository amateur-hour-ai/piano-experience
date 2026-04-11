'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'

export default function Pieces() {
  const { user, loading: userLoading } = useCurrentUser()
  const [pieces, setPieces] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (userLoading || !user) return
    async function load() {
      const [piecesRes, catsRes] = await Promise.all([
        supabase.from('pieces').select('*, categories(name)').eq('user_id', user.email).order('updated_at', { ascending: false }),
        supabase.from('categories').select('*').or(`user_id.eq.${user.email},user_id.is.null`).order('sort_order'),
      ])
      setPieces(piecesRes.data || [])
      setCategories(catsRes.data || [])
      setLoading(false)
    }
    load()
  }, [userLoading, user])

  const filtered = pieces.filter(p => {
    const matchSearch = !search || [p.title, p.composer, p.book_title].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    const matchCat = !categoryFilter || p.category_id === categoryFilter
    return matchSearch && matchCat
  })

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px' }}>
        <h1 style={{ fontSize: '24px' }}>My Pieces ({filtered.length})</h1>
        <Link href="/add">
          <button style={{ padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            + Add Piece
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, composer, book..."
          style={{ flex: 1, minWidth: '200px', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
          {pieces.length === 0 ? (
            <p>No pieces yet. <Link href="/add">Add your first piece!</Link></p>
          ) : (
            <p>No pieces match your search.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(p => (
            <Link key={p.id} href={`/piece/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                background: '#fff', borderRadius: '10px', padding: '16px 20px', border: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'box-shadow 0.15s'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px' }}>{p.title || 'Untitled'}</div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                    {[p.composer, p.book_title].filter(Boolean).join(' — ')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {p.categories?.name && (
                    <span style={{ fontSize: '12px', padding: '4px 10px', background: '#ede9fe', color: '#7c3aed', borderRadius: '12px', fontWeight: '500' }}>
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
