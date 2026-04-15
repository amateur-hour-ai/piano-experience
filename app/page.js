'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useOfflineData } from '@/lib/useOfflineData'

export default function Dashboard() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { isOnline, fetchOrCache, getCachedProfileData, getCachedTheme } = useOfflineData()
  const [pieces, setPieces] = useState([])
  const [schedule, setSchedule] = useState([])
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
    async function load() {
      // Load theme — try network, fall back to cache
      const themeResult = await fetchOrCache('/api/theme', getCachedTheme)
      setTheme(themeResult.data?.theme || themeResult.data || null)

      if (isOnline) {
        // Online path — fetch from server
        try {
          if (isOwnProfile) {
            const [piecesRes, scheduleRes, actRes] = await Promise.all([
              supabase.from('pieces').select('*, categories(name)').eq('user_id', user.email).order('updated_at', { ascending: false }),
              supabase.from('practice_schedule').select('*, pieces(title, composer)').eq('user_id', user.email).order('day_of_week').order('sort_order'),
              fetch(`/api/activity?limit=8&user_email=${encodeURIComponent(user.email)}`).then(r => r.json()),
            ])
            setPieces(piecesRes.data || [])
            setSchedule(scheduleRes.data || [])
            setRecentActivity(actRes.activities || [])
          } else {
            const [piecesRes, scheduleRes, actRes] = await Promise.all([
              fetch(`/api/profile/${encodeURIComponent(activeProfile)}/pieces`).then(r => r.json()),
              fetch(`/api/profile/${encodeURIComponent(activeProfile)}/schedule`).then(r => r.json()),
              fetch(`/api/activity?limit=8&user_email=${encodeURIComponent(activeProfile)}`).then(r => r.json()),
            ])
            setPieces(piecesRes.pieces || [])
            setSchedule(scheduleRes.schedule || [])
            setRecentActivity(actRes.activities || [])
          }
        } catch {
          // Network failed mid-request — fall back to cache
          await loadFromCache()
        }
      } else {
        // Offline — load from IndexedDB
        await loadFromCache()
      }
      setLoading(false)
    }

    async function loadFromCache() {
      const cached = await getCachedProfileData(activeProfile)
      if (cached) {
        setPieces(cached.pieces || [])
        setSchedule(cached.schedule || [])
        setRecentActivity(cached.activities || [])
      }
    }
    load()
  }, [userLoading, user, activeProfile])

  if (userLoading || loading) return <LoadingSkeleton />

  const byCategory = {}
  pieces.forEach(p => {
    const cat = p.categories?.name || 'Uncategorized'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(p)
  })

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const todayIdx = (new Date().getDay() + 6) % 7
  const todaySchedule = schedule.filter(s => s.day_of_week === todayIdx)

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>
        {isOwnProfile ? 'Welcome back!' : `${profileDisplayName(activeProfile)}'s Dashboard`}
      </h1>

      {/* Theme of the Week */}
      {theme && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', color: '#2563eb', marginBottom: '10px' }}>Theme of the Week</h2>
          <img src={theme.image_url} alt="Theme of the Week" style={{ width: '100%', borderRadius: '12px', border: '1px solid #e5e7eb', maxHeight: '200px', objectFit: 'cover' }} />
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
              const practiced = schedule.some(s => s.completed_at && new Date(s.completed_at).toLocaleDateString() === dateStr)
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Total Pieces" value={pieces.length} color="#2563eb" href="/pieces" />
        <StatCard label="Categories" value={Object.keys(byCategory).length} color="#1d4ed8" href="/pieces" />
        <StatCard label="Today's Practice" value={todaySchedule.length} color="#059669" href="/schedule" />
        <StatCard label="Completed Today" value={todaySchedule.filter(s => isCompletedToday(s)).length} color="#d97706" href="/schedule" />
      </div>

      {/* Today's Practice */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px' }}>Today's Practice ({days[todayIdx]})</h2>
          <Link href="/schedule" style={{ fontSize: '14px' }}>View full schedule →</Link>
        </div>
        {todaySchedule.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
            No pieces scheduled for today. {canEdit && <Link href="/schedule">Set up your practice schedule</Link>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todaySchedule.map(s => {
              const done = isCompletedToday(s)
              return (
              <div key={s.id} style={{
                background: done ? '#f0fdf4' : '#fff',
                borderRadius: '10px', padding: '14px 18px', border: `1px solid ${done ? '#86efac' : '#e5e7eb'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{s.pieces?.title || 'Unknown piece'}</span>
                  {s.pieces?.composer && <span style={{ color: '#666', marginLeft: '8px' }}>— {s.pieces.composer}</span>}
                  {s.focus_notes && <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{s.focus_notes}</p>}
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
          Object.entries(byCategory).map(([cat, items]) => (
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
