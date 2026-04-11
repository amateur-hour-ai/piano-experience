'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'

export default function AdminUsers() {
  const { user, isAdmin, loading: userLoading } = useCurrentUser()
  const [users, setUsers] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('users')

  useEffect(() => {
    if (userLoading) return
    if (!isAdmin) return
    loadData()
  }, [userLoading, isAdmin])

  async function loadData() {
    const [usersRes, actRes] = await Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/activity?limit=100').then(r => r.json()),
    ])
    setUsers(usersRes.users || [])
    setActivities(actRes.activities || [])
    setLoading(false)
  }

  if (userLoading) return null
  if (!isAdmin) return (
    <main style={{ padding: '24px', textAlign: 'center' }}>
      <p style={{ color: '#dc2626' }}>Access denied. Admin only.</p>
      <Link href="/">← Back to Dashboard</Link>
    </main>
  )

  if (loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  // Group activities by user
  const activityByUser = {}
  activities.forEach(a => {
    const email = a.user_email || 'Unknown'
    if (!activityByUser[email]) activityByUser[email] = []
    activityByUser[email].push(a)
  })

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 24px' }}>Admin Panel</h1>

      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb', marginBottom: '24px' }}>
        {['users', 'activity'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 24px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '15px', fontWeight: tab === t ? '600' : '400',
            color: tab === t ? '#2563eb' : '#666',
            borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: '-2px', textTransform: 'capitalize'
          }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>{users.length} registered users</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {users.map(u => (
              <div key={u.id} style={{
                background: '#fff', borderRadius: '10px', padding: '14px 20px', border: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: '500' }}>{u.email}</span>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                    Joined {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span style={{
                  fontSize: '12px', padding: '4px 10px', borderRadius: '12px', fontWeight: '500',
                  background: u.approved ? '#f0fdf4' : '#fef2f2',
                  color: u.approved ? '#059669' : '#dc2626',
                }}>
                  {u.approved ? 'Active' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div>
          {Object.entries(activityByUser).map(([email, acts]) => (
            <div key={email} style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', color: '#2563eb', marginBottom: '8px' }}>{email} ({acts.length} actions)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {acts.map(a => (
                  <div key={a.id} style={{ fontSize: '14px', padding: '8px 12px', background: '#f9fafb', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      <strong style={{ color: '#374151' }}>{a.action}</strong>
                      {a.piece_title && <span style={{ color: '#666' }}> — {a.piece_title}</span>}
                      {a.details && <span style={{ color: '#999' }}> ({a.details})</span>}
                    </span>
                    <span style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {activities.length === 0 && <p style={{ color: '#666' }}>No activity yet.</p>}
        </div>
      )}
    </main>
  )
}
