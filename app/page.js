'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'

export default function Dashboard() {
  const { user, loading: userLoading } = useCurrentUser()
  const [pieces, setPieces] = useState([])
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (userLoading || !user) return
    async function load() {
      const [piecesRes, scheduleRes] = await Promise.all([
        supabase.from('pieces').select('*, categories(name)').eq('user_id', user.email).order('updated_at', { ascending: false }),
        supabase.from('practice_schedule').select('*, pieces(title, composer)').eq('user_id', user.email).gte('week_start_date', getWeekStart()).order('day_of_week').order('sort_order'),
      ])
      setPieces(piecesRes.data || [])
      setSchedule(scheduleRes.data || [])
      setLoading(false)
    }
    load()
  }, [userLoading, user])

  if (userLoading || loading) return <LoadingSkeleton />

  const byCategory = {}
  pieces.forEach(p => {
    const cat = p.categories?.name || 'Uncategorized'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(p)
  })

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const todayIdx = (new Date().getDay() + 6) % 7 // Monday = 0
  const todaySchedule = schedule.filter(s => s.day_of_week === todayIdx)

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>Welcome back!</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Total Pieces" value={pieces.length} color="#7c3aed" />
        <StatCard label="Categories" value={Object.keys(byCategory).length} color="#2563eb" />
        <StatCard label="Today's Practice" value={todaySchedule.length} color="#059669" />
        <StatCard label="Completed Today" value={todaySchedule.filter(s => s.completed).length} color="#d97706" />
      </div>

      {/* Today's Practice */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px' }}>Today's Practice ({days[todayIdx]})</h2>
          <Link href="/schedule" style={{ fontSize: '14px' }}>View full schedule →</Link>
        </div>
        {todaySchedule.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
            No pieces scheduled for today. <Link href="/schedule">Set up your practice schedule</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todaySchedule.map(s => (
              <div key={s.id} style={{
                background: s.completed ? '#f0fdf4' : '#fff',
                borderRadius: '10px', padding: '14px 18px', border: `1px solid ${s.completed ? '#86efac' : '#e5e7eb'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{s.pieces?.title || 'Unknown piece'}</span>
                  {s.pieces?.composer && <span style={{ color: '#666', marginLeft: '8px' }}>— {s.pieces.composer}</span>}
                  {s.focus_notes && <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{s.focus_notes}</p>}
                </div>
                {s.completed && <span style={{ color: '#059669', fontWeight: '600' }}>✓</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pieces by Category */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px' }}>My Pieces</h2>
          <Link href="/pieces" style={{ fontSize: '14px' }}>View all →</Link>
        </div>
        {pieces.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
            No pieces yet. <Link href="/add">Add your first piece</Link>
          </div>
        ) : (
          Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', color: '#7c3aed', marginBottom: '8px' }}>{cat} ({items.length})</h3>
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

      {/* Quick Actions */}
      <section>
        <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/add" style={{ textDecoration: 'none' }}>
            <button style={{ padding: '12px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
              + Add New Piece
            </button>
          </Link>
          <Link href="/schedule" style={{ textDecoration: 'none' }}>
            <button style={{ padding: '12px 24px', background: '#fff', color: '#7c3aed', border: '1px solid #7c3aed', borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
              Plan Practice Week
            </button>
          </Link>
        </div>
      </section>
    </main>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '28px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{label}</div>
    </div>
  )
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

function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}
