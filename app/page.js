'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useOfflineData } from '@/lib/useOfflineData'
import { useSortedCategories } from '@/lib/useSortedCategories'
import { useToast } from '@/app/ToastProvider'
import { logActivity } from '@/lib/logActivity'
import { queueMutation } from '@/lib/syncManager'
import { toLocalDateString } from '@/lib/dateUtils'

export default function Dashboard() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { isOnline, fetchOrCache, getCachedProfileData, getCachedTheme } = useOfflineData()
  const { addToast } = useToast()
  const { categories: sortedCategories } = useSortedCategories()
  const [pieces, setPieces] = useState([])
  const [schedule, setSchedule] = useState([])
  const [practiceGrid, setPracticeGrid] = useState([])
  const [weeklyFocus, setWeeklyFocus] = useState('')
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
              fetch(`/api/practice-grid?profile=${encodeURIComponent(user.email)}&start=${gridStartStr}&end=${gridEndStr}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
            ])
            const [piecesRes, gridRes] = await Promise.race([dataPromise, timeoutPromise])
            setPieces(piecesRes.data || [])
            setPracticeGrid(gridRes.grid || [])
            if (gridRes.weeklyFocus !== undefined) setWeeklyFocus(gridRes.weeklyFocus || '')
          } else {
            const dataPromise = Promise.all([
              fetch(`/api/profile/${encodeURIComponent(activeProfile)}/pieces`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
              fetch(`/api/practice-grid?profile=${encodeURIComponent(activeProfile)}&start=${gridStartStr}&end=${gridEndStr}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
            ])
            const [piecesRes, gridRes] = await Promise.race([dataPromise, timeoutPromise])
            setPieces(piecesRes.pieces || [])
            setPracticeGrid(gridRes.grid || [])
            if (gridRes.weeklyFocus !== undefined) setWeeklyFocus(gridRes.weeklyFocus || '')
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

  const todayStr = toLocalDateString()
  const todayGrid = practiceGrid.filter(g => g.date === todayStr)
  const todayPlanned = todayGrid.filter(g => g.status === 'plan_play' || g.status === 'plan_practice' || g.status === 'played' || g.status === 'practiced')
  const todayCompleted = todayGrid.filter(g => g.status === 'played' || g.status === 'practiced')

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

  async function toggleTodayStatus(gridItem) {
    if (!canEdit) return
    // Toggle between planned and completed versions of the same intent
    const toggleMap = { plan_play: 'played', played: 'plan_play', plan_practice: 'practiced', practiced: 'plan_practice' }
    const newStatus = toggleMap[gridItem.status] || gridItem.status

    // Update local state
    setPracticeGrid(prev => prev.map(g =>
      g.piece_id === gridItem.piece_id && g.date === gridItem.date ? { ...g, status: newStatus } : g
    ))

    // Log completion
    if (newStatus === 'played' || newStatus === 'practiced') {
      const p = pieces.find(pp => pp.id === gridItem.piece_id)
      logActivity({ action: 'practice_completed', piece_id: gridItem.piece_id, piece_title: p?.title, details: newStatus === 'practiced' ? 'Practiced (focused work)' : 'Played', profile_email: activeProfile, performed_by: user.email })
    }

    // Sync to server
    const body = { action: 'toggle_to', piece_id: gridItem.piece_id, date: gridItem.date, newStatus, profileEmail: isOwnProfile ? undefined : activeProfile }
    if (!isOnline) {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: 'Update practice status' })
      return
    }
    try {
      await fetch('/api/practice-grid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: 'Update practice status' })
    }
  }

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>
        {isOwnProfile ? 'Welcome back!' : `${profileDisplayName(activeProfile)}'s Home`}
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
              const practiced = practiceGrid.some(g => g.date === isoDateStr && (g.status === 'played' || g.status === 'practiced'))
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

      {/* Weekly Focus */}
      {weeklyFocus && (
        <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', fontSize: '14px' }}>
          <span style={{ fontWeight: '600', color: '#2563eb' }}>Focus this week:</span> {weeklyFocus}
        </div>
      )}

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
              const done = g.status === 'played' || g.status === 'practiced'
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
                {canEdit ? (
                  <button onClick={() => toggleTodayStatus(g)} style={{
                    fontSize: '22px', flexShrink: 0, background: 'none', border: 'none',
                    cursor: 'pointer', padding: '4px 8px', borderRadius: '8px', lineHeight: 1,
                    color: '#1a1a1a',
                  }}>
                    {g.status === 'plan_play' && <span>♪</span>}
                    {g.status === 'plan_practice' && <span>🎶</span>}
                    {g.status === 'played' && <span style={{ color: '#ec4899' }}>♥</span>}
                    {g.status === 'practiced' && <span>💕</span>}
                  </button>
                ) : (
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>
                    {g.status === 'plan_play' && <span>♪</span>}
                    {g.status === 'plan_practice' && <span>🎶</span>}
                    {g.status === 'played' && <span style={{ color: '#ec4899' }}>♥</span>}
                    {g.status === 'practiced' && <span>💕</span>}
                  </span>
                )}
              </div>
            )})}
          </div>
        )}
      </section>

    </main>
  )
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
