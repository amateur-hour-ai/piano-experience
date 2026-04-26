'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { toLocalDateString } from '@/lib/dateUtils'

export default function TeacherDashboard() {
  const { user, loading: userLoading } = useCurrentUser()
  const { availableProfiles, switchProfile, profileDisplayName } = useActiveProfile()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dayRange, setDayRange] = useState(7)

  useEffect(() => {
    if (userLoading || !user) return
    if (availableProfiles.length === 0) { setLoading(false); return }
    loadStudents()
  }, [userLoading, user, availableProfiles, dayRange])

  async function loadStudents() {
    setLoading(true)
    const results = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDay = new Date(today)
    startDay.setDate(startDay.getDate() - dayRange + 1)
    const startDate = toLocalDateString(startDay)
    const endDate = toLocalDateString(today)

    for (const profile of availableProfiles) {
      try {
        const enc = encodeURIComponent(profile.email)
        const [piecesRes, gridRes, activitiesRes] = await Promise.all([
          fetch(`/api/profile/${enc}/pieces`).then(r => r.json()),
          fetch(`/api/practice-grid?profile=${enc}&start=${startDate}&end=${endDate}`).then(r => r.json()),
          fetch(`/api/profile/${enc}/activities`).then(r => r.json()),
        ])

        const activePieces = (piecesRes.pieces || []).filter(p => !p.archived)

        // Build per-piece stats from grid data
        const pieceStats = {}
        const expStats = { played: 0, practiced: 0 }
        const daysWithActivity = new Set()

        for (const g of (gridRes.grid || [])) {
          if (g.status === 'played' || g.status === 'practiced') {
            daysWithActivity.add(g.date)
          }

          if (g.piece_id === '00000000-0000-0000-0000-experimentation') {
            if (g.status === 'played') expStats.played++
            else if (g.status === 'practiced') expStats.practiced++
            continue
          }

          if (!pieceStats[g.piece_id]) pieceStats[g.piece_id] = { played: 0, practiced: 0 }
          if (g.status === 'played') pieceStats[g.piece_id].played++
          else if (g.status === 'practiced') pieceStats[g.piece_id].practiced++
        }

        // Sort pieces: most activity first, practiced weighted higher for ties
        const sortedPieces = activePieces.sort((a, b) => {
          const aStats = pieceStats[a.id] || { played: 0, practiced: 0 }
          const bStats = pieceStats[b.id] || { played: 0, practiced: 0 }
          const aTotal = aStats.played + aStats.practiced
          const bTotal = bStats.played + bStats.practiced
          if (bTotal !== aTotal) return bTotal - aTotal
          return bStats.practiced - aStats.practiced
        })

        results.push({
          email: profile.email,
          accessLevel: profile.accessLevel,
          piecesCount: activePieces.length,
          daysActive: daysWithActivity.size,
          pieces: sortedPieces,
          pieceStats,
          expStats,
          experimentationFocus: gridRes.experimentationFocus || '',
          activities: (activitiesRes.activities || []),
        })
      } catch {
        results.push({ email: profile.email, accessLevel: profile.accessLevel, piecesCount: 0, daysActive: 0, pieces: [], pieceStats: {}, expStats: { played: 0, practiced: 0 }, experimentationFocus: '', activities: [] })
      }
    }
    setStudents(results)
    setLoading(false)
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  if (availableProfiles.length === 0) {
    return (
      <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
        <h1 style={{ margin: '16px 0 24px' }}>Parent/Teacher Dashboard</h1>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
          <p>No students have shared their profiles with you yet.</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>Ask your students to go to <strong>Sharing</strong> and grant you access.</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', minWidth: 0 }}>Parent/Teacher Dashboard</h1>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
          <button onClick={() => setDayRange(7)} style={{
            padding: '6px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', border: 'none',
            background: dayRange === 7 ? '#2563eb' : 'transparent',
            color: dayRange === 7 ? '#fff' : '#666',
          }}>7 days</button>
          <button onClick={() => setDayRange(14)} style={{
            padding: '6px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', border: 'none',
            background: dayRange === 14 ? '#2563eb' : 'transparent',
            color: dayRange === 14 ? '#fff' : '#666',
          }}>14 days</button>
        </div>
      </div>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>{students.length} student{students.length !== 1 ? 's' : ''}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {students.map(s => (
          <div key={s.email} style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', margin: 0 }}>{profileDisplayName(s.email)}</h2>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{s.email}</div>
              </div>
              <button onClick={() => { switchProfile(s.email); window.location.href = '/' }} style={{
                padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
              }}>
                View Profile
              </button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>{s.piecesCount}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Active Pieces</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>{s.daysActive}/{dayRange}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Days Active (last {dayRange})</div>
              </div>
            </div>

            {/* Per-piece cards */}
            {s.pieces.length > 0 && (
              <div style={{ marginBottom: s.activities.length > 0 || (s.expStats.played + s.expStats.practiced > 0) ? '16px' : 0 }}>
                <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: '600' }}>Pieces</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {s.pieces.map(p => {
                    const stats = s.pieceStats[p.id] || { played: 0, practiced: 0 }
                    return (
                      <div key={p.id} style={{
                        background: '#f9fafb', borderRadius: '8px', padding: '10px 14px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        border: p.is_priority ? '1px solid #fce7f3' : '1px solid #f3f4f6',
                        backgroundColor: p.is_priority ? '#fdf2f8' : '#f9fafb',
                      }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.is_priority && <span style={{ color: '#ec4899', marginRight: '4px' }}>★</span>}
                            {p.title}
                          </div>
                          {p.current_focus && (
                            <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px', lineHeight: '1.4', wordBreak: 'break-word' }}>
                              {p.current_focus}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexShrink: 0, marginLeft: '12px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: stats.practiced > 0 ? '#059669' : '#ccc' }}>{stats.practiced}</div>
                            <div style={{ fontSize: '10px', color: '#999' }}>💕</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: stats.played > 0 ? '#2563eb' : '#ccc' }}>{stats.played}</div>
                            <div style={{ fontSize: '10px', color: '#999' }}>💗</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Experimentation card */}
            {(s.expStats.played + s.expStats.practiced > 0 || s.experimentationFocus) && (
              <div style={{ marginBottom: s.activities.length > 0 ? '16px' : 0 }}>
                <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: '600' }}>Experimentation</div>
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f3f4f6' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>Free Play / Experimentation</div>
                    {s.experimentationFocus && (
                      <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px' }}>{s.experimentationFocus}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexShrink: 0, marginLeft: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: s.expStats.practiced > 0 ? '#059669' : '#ccc' }}>{s.expStats.practiced}</div>
                      <div style={{ fontSize: '10px', color: '#999' }}>💕</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: s.expStats.played > 0 ? '#2563eb' : '#ccc' }}>{s.expStats.played}</div>
                      <div style={{ fontSize: '10px', color: '#999' }}>💗</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Activities */}
            {s.activities.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: '600' }}>Activities</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {s.activities.map(a => (
                    <div key={a.id} style={{
                      background: '#f9fafb', borderRadius: '8px', padding: '10px 14px',
                      border: '1px solid #f3f4f6', opacity: a.completed_date ? 0.8 : 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: a.completed_date ? '#059669' : '#d1d5db', fontSize: '14px' }}>
                          {a.completed_date ? '✓' : '○'}
                        </span>
                        <span style={{
                          fontSize: '14px', fontWeight: '500',
                          textDecoration: a.completed_date ? 'line-through' : 'none',
                          color: a.completed_date ? '#999' : '#1a1a1a',
                        }}>
                          {a.description}
                        </span>
                        {a.completed_date && (
                          <span style={{ fontSize: '11px', color: '#999', marginLeft: 'auto', flexShrink: 0 }}>
                            {new Date(a.completed_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {a.reflection && (
                        <div style={{ fontSize: '13px', color: '#666', marginTop: '6px', marginLeft: '22px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          {a.reflection}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
