'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useOfflineData } from '@/lib/useOfflineData'
import { useSortedCategories } from '@/lib/useSortedCategories'
import { toLocalDateString } from '@/lib/dateUtils'

export default function Dashboard() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { isOnline, fetchOrCache, getCachedProfileData, getCachedTheme } = useOfflineData()
  const { categories: sortedCategories } = useSortedCategories()
  const [pieces, setPieces] = useState([])
  const [schedule, setSchedule] = useState([])
  const [practiceGrid, setPracticeGrid] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [theme, setTheme] = useState(null)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    setLoading(true)
    const failsafe = setTimeout(() => setLoading(false), 5000)
    async function load() {
      try {
        // Show cached data immediately
        const cached = await getCachedProfileData(activeProfile)
        if (cached) {
          setPieces(cached.pieces || [])
          setSchedule(cached.schedule || [])
          setRecentActivity(cached.activities || [])
          setLoading(false)
        }

        // Load theme from cache first
        const cachedTheme = await getCachedTheme()
        if (cachedTheme) setTheme(cachedTheme)
      } catch (cacheErr) {
        console.error('Cache read failed:', cacheErr)
      }

      // If online, refresh from network
      if (isOnline) {
        try {
          // Theme
          fetch('/api/theme', { signal: AbortSignal.timeout(5000) })
            .then(r => r.json()).then(d => { if (d.theme) setTheme(d.theme) }).catch(() => {})

          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))

          // Calculate date range for grid (7 days back + today)
          const gridStart = new Date()
          gridStart.setDate(gridStart.getDate() - 7)
          const gridStartStr = toLocalDateString(gridStart)
          const gridEndStr = toLocalDateString()

          if (isOwnProfile) {
            const dataPromise = Promise.all([
              supabase.from('pieces').select('*, categories(name)').eq('user_id', user.email).order('updated_at', { ascending: false }),
              fetch(`/api/activity?limit=8&user_email=${encodeURIComponent(user.email)}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
              fetch(`/api/practice-grid?profile=${encodeURIComponent(user.email)}&start=${gridStartStr}&end=${gridEndStr}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
            ])
            const [piecesRes, actRes, gridRes] = await Promise.race([dataPromise, timeoutPromise])
            setPieces(piecesRes.data || [])
            setRecentActivity(actRes.activities || [])
            setPracticeGrid(gridRes.grid || [])
          } else {
            const dataPromise = Promise.all([
              fetch(`/api/profile/${encodeURIComponent(activeProfile)}/pieces`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
              fetch(`/api/activity?limit=8&user_email=${encodeURIComponent(activeProfile)}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
              fetch(`/api/practice-grid?profile=${encodeURIComponent(activeProfile)}&start=${gridStartStr}&end=${gridEndStr}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
            ])
            const [piecesRes, actRes, gridRes] = await Promise.race([dataPromise, timeoutPromise])
            setPieces(piecesRes.pieces || [])
            setRecentActivity(actRes.activities || [])
            setPracticeGrid(gridRes.grid || [])
          }
        } catch {
          // Network failed — cached data already displayed
        }
      }
      setLoading(false)
    }
    load().finally(() => clearTimeout(failsafe))
    return () => clearTimeout(failsafe)
  }, [userLoading, user, activeProfile])

  if (userLoading || loading) return <LoadingSkeleton />

  // Group pieces by category in the user's preferred sort order
  const byCategory = {}
  const catOrder = {}
  sortedCategories.forEach((c, i) => { catOrder[c.name] = c.effective_sort !== undefined ? c.effective_sort : i })
  pieces.forEach(p => {
    const cat = p.categories?.name || 'Uncategorized'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(p)
  })
  const sortedCategoryEntries = Object.entries(byCategory).sort((a, b) => {
    const orderA = catOrder[a[0]] !== undefined ? catOrder[a[0]] : 999
    const orderB = catOrder[b[0]] !== undefined ? catOrder[b[0]] : 999
    return orderA - orderB
  })

  const todayStr = toLocalDateString()
  const todayGrid = practiceGrid.filter(g => g.date === todayStr)
  const todayPlanned = todayGrid.filter(g => g.status === 'planned' || g.status === 'completed' || g.status === 'plan_play' || g.status === 'plan_practice' || g.status === 'played' || g.status === 'practiced')
  const todayCompleted = todayGrid.filter(g => g.status === 'completed' || g.status === 'played' || g.status === 'practiced')

  // Sort today's practice by user's category order
  const todayCatOrder = {}
  sortedCategories.forEach((c, i) => { todayCatOrder[c.id] = c.effective_sort !== undefined ? c.effective_sort : i })
  const sortedTodayPlanned = [...todayPlanned].sort((a, b) => {
    const pieceA = pieces.find(p => p.id === a.piece_id)
    const pieceB = pieces.find(p => p.id === b.piece_id)
    const orderA = todayCatOrder[pieceA?.category_id] !== undefined ? todayCatOrder[pieceA?.category_id] : 999
    const orderB = todayCatOrder[pieceB?.category_id] !== undefined ? todayCatOrder[pieceB?.category_id] : 999
    return orderA - orderB
  })

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>
        {isOwnProfile ? 'Welcome back!' : `${profileDisplayName(activeProfile)}'s Dashboard`}
      </h1>

      {/* Theme of the Week */}
      {theme && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', color: '#2563eb', marginBottom: '10px' }}>Theme of the Week</h2>
          <img src={theme.image_url} alt="Theme of the Week" style={{ width: '100%', borderRadius: '12px', border: '1px solid #e5e7eb', aspectRatio: '3.2 / 1', objectFit: 'cover' }} />
        </div>
      )}

      {/* Practice Streak — last 7 days */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Practice Streak — Last 7 Days</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          {(() => {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            const today = new Date()
            const result = []
            for (let i = 6; i >= 0; i--) {
              const d = new Date(today)
              d.setDate(d.getDate() - i)
              const dateStr = d.toLocaleDateString()
              const dayIdx = (d.getDay() + 6) % 7
              const isoDateStr = toLocalDateString(d)
              const practiced = practiceGrid.some(g => g.date === isoDateStr && (g.status === 'completed' || g.status === 'played' || g.status === 'practiced'))
              const isToday = i === 0
              result.push(
                <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '11px', color: isToday ? '#2563eb' : '#999', fontWeight: isToday ? '600' : '400', marginBottom: '6px' }}>
                    {days[dayIdx]}
                  </div>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto',
                    background: practiced ? '#059669' : isToday ? '#dbeafe' : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', color: practiced ? '#fff' : '#999', fontWeight: '600'
                  }}>
                    {practiced ? '✓' : ''}
                  </div>
                </div>
              )
            }
            return result
          })()}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Total Pieces" value={pieces.filter(p => !p.archived).length} color="#2563eb" href="/pieces" />
        <StatCard
          label="Today's Practice"
          value={sortedTodayPlanned.length > 0 ? `${todayCompleted.length}/${sortedTodayPlanned.length}` : 'None planned'}
          color={sortedTodayPlanned.length > 0 && todayCompleted.length === sortedTodayPlanned.length ? '#059669' : '#2563eb'}
          href="/schedule"
        />
      </div>

      {/* Today's Practice */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px' }}>Today's Practice ({new Date().toLocaleDateString('en-US', { weekday: 'long' })})</h2>
          <Link href="/schedule" style={{ fontSize: '14px' }}>View full schedule →</Link>
        </div>
        {sortedTodayPlanned.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
            No pieces scheduled for today. {canEdit && <Link href="/schedule">Set up your practice schedule</Link>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedTodayPlanned.map(g => {
              const p = pieces.find(pp => pp.id === g.piece_id)
              const done = g.status === 'completed' || g.status === 'played' || g.status === 'practiced'
              return (
              <div key={g.id} style={{
                background: done ? '#f0fdf4' : '#fff',
                borderRadius: '10px', padding: '14px 18px', border: `1px solid ${done ? '#86efac' : '#e5e7eb'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{p?.title || 'Unknown piece'}</span>
                  {p?.composer && <span style={{ color: '#666', marginLeft: '8px' }}>— {p.composer}</span>}
                  {p?.current_focus && <p style={{ fontSize: '13px', color: '#2563eb', marginTop: '4px' }}>{p.current_focus}</p>}
                </div>
                {done && <span style={{ color: '#059669', fontWeight: '600' }}>✓</span>}
              </div>
            )})}
          </div>
        )}
      </section>

      {/* Pieces by Category */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px' }}>{isOwnProfile ? 'My Pieces' : 'Pieces'}</h2>
          <Link href="/pieces" style={{ fontSize: '14px' }}>View all →</Link>
        </div>
        {pieces.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
            No pieces yet. {canEdit && <Link href="/add">Add your first piece</Link>}
          </div>
        ) : (
          sortedCategoryEntries.map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', color: '#2563eb', marginBottom: '8px' }}>{cat} ({items.length})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                {items.slice(0, 4).map(p => (
                  <Link key={p.id} href={`/piece/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '14px', border: '1px solid #e5e7eb', transition: 'box-shadow 0.15s' }}>
                      <div style={{ fontWeight: '600', fontSize: '15px' }}>{p.title || 'Untitled'}</div>
                      {p.composer && <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{p.composer}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Recent Activity</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentActivity.map(a => (
              <div key={a.id} style={{ fontSize: '14px', padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <strong style={{ color: '#374151' }}>{a.action.replace('_', ' ')}</strong>
                  {a.piece_title && <span style={{ color: '#666' }}> — {a.piece_title}</span>}
                </span>
                <span style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions — only for own profile or edit access */}
      {canEdit && (
        <section>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Quick Actions</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link href="/add" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                + Add New Piece
              </button>
            </Link>
            <Link href="/schedule" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '12px 24px', background: '#fff', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                Plan Practice Week
              </button>
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}

function isCompletedToday(item) {
  if (!item.completed_at) return false
  const completedDate = new Date(item.completed_at).toLocaleDateString()
  const today = new Date().toLocaleDateString()
  return completedDate === today
}

function StatCard({ label, value, color, href }) {
  const inner = (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', cursor: href ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}>
      <div style={{ fontSize: '28px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{label}</div>
    </div>
  )
  if (href) return <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
  return inner
}

function LoadingSkeleton() {
  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: '#e5e7eb', borderRadius: '12px', height: '80px', marginBottom: '16px', animation: 'pulse-glow 1.5s infinite' }} />
      ))}
    </main>
  )
}
