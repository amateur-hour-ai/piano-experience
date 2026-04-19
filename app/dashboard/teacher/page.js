'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'

export default function TeacherDashboard() {
  const { user, loading: userLoading } = useCurrentUser()
  const { availableProfiles, switchProfile, profileDisplayName } = useActiveProfile()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading || !user) return
    if (availableProfiles.length === 0) { setLoading(false); return }
    loadStudents()
  }, [userLoading, user, availableProfiles])

  async function loadStudents() {
    const results = []
    for (const profile of availableProfiles) {
      try {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const startDate = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`
        const today = new Date()
        const endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

        const [piecesRes, gridRes, actRes] = await Promise.all([
          fetch(`/api/profile/${encodeURIComponent(profile.email)}/pieces`).then(r => r.json()),
          fetch(`/api/practice-grid?profile=${encodeURIComponent(profile.email)}&start=${startDate}&end=${endDate}`).then(r => r.json()),
          fetch(`/api/activity?user_email=${encodeURIComponent(profile.email)}&limit=5`).then(r => r.json()),
        ])

        // Calculate practice days in last 7 days from practice_grid
        const practiceDays = new Set()
        gridRes.grid?.forEach(g => {
          if (g.status === 'completed') practiceDays.add(g.date)
        })

        results.push({
          email: profile.email,
          accessLevel: profile.accessLevel,
          piecesCount: piecesRes.pieces?.filter(p => !p.archived)?.length || 0,
          practiceStreak: practiceDays.size,
          lastActivity: actRes.activities?.[0] || null,
          recentActivities: actRes.activities || [],
        })
      } catch {
        results.push({ email: profile.email, accessLevel: profile.accessLevel, piecesCount: 0, practiceStreak: 0, lastActivity: null, recentActivities: [] })
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
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>👨‍👩‍👧‍👦</div>
          <p>No students have shared their profiles with you yet.</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>Ask your students to go to <strong>Sharing</strong> and grant you access.</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 8px' }}>Parent/Teacher Dashboard</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>{students.length} student{students.length !== 1 ? 's' : ''}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {students.map(s => (
          <div key={s.email} style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>{s.piecesCount}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Active Pieces</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>{s.practiceStreak}/7</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Days This Week</div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>Last Active</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>
                  {s.lastActivity ? new Date(s.lastActivity.created_at).toLocaleDateString() : 'Never'}
                </div>
              </div>
            </div>

            {/* Recent activity */}
            {s.recentActivities.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', color: '#999', marginBottom: '6px' }}>Recent Activity</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {s.recentActivities.slice(0, 3).map(a => (
                    <div key={a.id} style={{ fontSize: '13px', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{a.action.replace('_', ' ')}{a.piece_title ? ` — ${a.piece_title}` : ''}</span>
                      <span style={{ color: '#999', whiteSpace: 'nowrap', marginLeft: '8px' }}>{new Date(a.created_at).toLocaleDateString()}</span>
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
