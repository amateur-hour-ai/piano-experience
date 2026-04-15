'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'
import { useOfflineData } from '@/lib/useOfflineData'

export default function Strategies() {
  const { user, isAdmin, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { addToast } = useToast()
  const { isOnline, getCachedProfileData } = useOfflineData()
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editingStandard, setEditingStandard] = useState(false)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    loadStrategies()
  }, [userLoading, user, activeProfile, editingStandard])

  async function loadStrategies() {
    setLoading(true)
    if (isOnline) {
      try {
        const params = editingStandard ? '?standard=true' : `?profile=${encodeURIComponent(isOwnProfile ? user.email : activeProfile)}`
        const res = await fetch(`/api/strategies${params}`)
        const data = await res.json()
        setStrategies(data.strategies || [])
      } catch {
        const cached = await getCachedProfileData(activeProfile)
        if (cached) setStrategies(cached.strategies || [])
      }
    } else {
      const cached = await getCachedProfileData(activeProfile)
      if (cached) setStrategies(cached.strategies || [])
    }
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function updateStrategy(strategy) {
    const action = editingStandard ? 'update_standard' : 'update'
    await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id: strategy.id, heading: strategy.heading, bullets: strategy.bullets, profileEmail: isOwnProfile ? undefined : activeProfile })
    })
    addToast('Saved!', 'success')
  }

  async function addStrategy() {
    const action = editingStandard ? 'add_standard' : 'add'
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, heading: 'New Strategy', bullets: ['Add your first point here.'], sort_order: strategies.length, profileEmail: isOwnProfile ? undefined : activeProfile })
    })
    const data = await res.json()
    if (data.strategy) {
      setStrategies(prev => [...prev, data.strategy])
      setExpanded(prev => ({ ...prev, [data.strategy.id]: true }))
      addToast('Strategy added!', 'success')
    }
  }

  async function deleteStrategy(id) {
    const action = editingStandard ? 'delete_standard' : 'delete'
    await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id, profileEmail: isOwnProfile ? undefined : activeProfile })
    })
    setStrategies(prev => prev.filter(s => s.id !== id))
    addToast('Strategy removed', 'info')
  }

  function updateHeading(id, heading) {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, heading } : s))
  }

  function updateBullet(strategyId, bulletIndex, text) {
    setStrategies(prev => prev.map(s => {
      if (s.id !== strategyId) return s
      const bullets = [...s.bullets]
      bullets[bulletIndex] = text
      return { ...s, bullets }
    }))
  }

  function addBullet(strategyId) {
    setStrategies(prev => prev.map(s => {
      if (s.id !== strategyId) return s
      return { ...s, bullets: [...s.bullets, ''] }
    }))
  }

  function removeBullet(strategyId, bulletIndex) {
    setStrategies(prev => prev.map(s => {
      if (s.id !== strategyId) return s
      const bullets = s.bullets.filter((_, i) => i !== bulletIndex)
      return { ...s, bullets }
    }))
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  const showEditControls = editMode && (canEdit || editingStandard)

  return (
    <main style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', paddingBottom: editMode ? '100px' : '24px' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px' }}>
        <h1 style={{ fontSize: '24px' }}>
          {editingStandard ? 'Standard Practice Strategies' : isOwnProfile ? 'Practice Strategies' : `${profileDisplayName(activeProfile)}'s Strategies`}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(canEdit || editingStandard) && (
            <button onClick={() => setEditMode(!editMode)} style={{
              padding: '8px 16px', background: editMode ? '#059669' : '#2563eb', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
            }}>
              {editMode ? 'Done Editing' : 'Edit'}
            </button>
          )}
          {isAdmin && isOwnProfile && (
            <button onClick={() => { setEditingStandard(!editingStandard); setEditMode(false) }} style={{
              padding: '8px 16px', background: editingStandard ? '#d97706' : '#f9fafb', color: editingStandard ? '#fff' : '#666',
              border: editingStandard ? 'none' : '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
            }}>
              {editingStandard ? 'Back to Mine' : 'Edit Defaults'}
            </button>
          )}
        </div>
      </div>

      {editingStandard && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '14px', color: '#92400e' }}>
          You are editing the standard strategies that all new users receive. Changes here do not affect existing users who have already customized their strategies.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {strategies.map(s => (
          <div key={s.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {/* Heading */}
            <div
              onClick={() => !showEditControls && toggleExpand(s.id)}
              style={{
                padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: showEditControls ? 'default' : 'pointer', background: expanded[s.id] ? '#eff6ff' : '#fff'
              }}
            >
              {showEditControls ? (
                <input
                  value={s.heading}
                  onChange={e => updateHeading(s.id, e.target.value)}
                  onBlur={() => updateStrategy(s)}
                  style={{ flex: 1, fontSize: '16px', fontWeight: '600', border: '1px solid #93c5fd', borderRadius: '6px', padding: '6px 10px', marginRight: '8px' }}
                />
              ) : (
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: 0 }}>{s.heading}</h3>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showEditControls && (
                  <button onClick={() => deleteStrategy(s.id)} style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
                {!showEditControls && (
                  <span style={{ fontSize: '14px', color: '#999', transition: 'transform 0.2s', transform: expanded[s.id] ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                )}
              </div>
            </div>

            {/* Bullets — always visible in edit mode, toggle in view mode */}
            {(expanded[s.id] || showEditControls) && (
              <div style={{ padding: '0 20px 16px' }}>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {s.bullets.map((bullet, bi) => (
                    <li key={bi} style={{ marginBottom: showEditControls ? '8px' : '6px', fontSize: '14px', lineHeight: '1.6', color: '#374151' }}>
                      {showEditControls ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                          <textarea
                            value={bullet}
                            onChange={e => updateBullet(s.id, bi, e.target.value)}
                            onBlur={() => updateStrategy(s)}
                            rows={2}
                            style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', lineHeight: '1.5', resize: 'vertical' }}
                          />
                          <button onClick={() => { removeBullet(s.id, bi); setTimeout(() => updateStrategy({ ...s, bullets: s.bullets.filter((_, i) => i !== bi) }), 0) }}
                            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', flexShrink: 0 }}>
                            ×
                          </button>
                        </div>
                      ) : (
                        bullet
                      )}
                    </li>
                  ))}
                </ul>
                {showEditControls && (
                  <button onClick={() => addBullet(s.id)} style={{
                    marginTop: '4px', marginLeft: '20px', padding: '4px 12px', background: '#f9fafb', border: '1px solid #d1d5db',
                    borderRadius: '6px', fontSize: '13px', color: '#666', cursor: 'pointer'
                  }}>
                    + Add bullet
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new heading */}
      {showEditControls && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e5e7eb',
          padding: '12px 24px', display: 'flex', gap: '12px',
          justifyContent: 'center', zIndex: 50,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}>
          <button onClick={addStrategy} style={{
            flex: 1, maxWidth: '400px', padding: '14px', background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer'
          }}>
            + Add New Strategy Heading
          </button>
        </div>
      )}
    </main>
  )
}
