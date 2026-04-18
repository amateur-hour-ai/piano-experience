'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'
import { useOfflineData } from '@/lib/useOfflineData'
import { queueMutation } from '@/lib/syncManager'

export default function PracticeSchedule() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { addToast } = useToast()
  const { isOnline, getCachedProfileData } = useOfflineData()
  const [pieces, setPieces] = useState([])
  const [grid, setGrid] = useState({}) // key: `${pieceId}_${date}` → status
  const [loading, setLoading] = useState(true)
  const [editingFocus, setEditingFocus] = useState(null) // piece id being edited
  const [focusDraft, setFocusDraft] = useState('')
  const scrollRef = useRef(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // Generate 14 days: 7 past + today + 6 future
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = -7; i <= 6; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  const todayStr = today.toISOString().split('T')[0]

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    loadData()
  }, [userLoading, user, activeProfile])

  // Auto-scroll to today on load
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const todayCol = scrollRef.current.querySelector('[data-today="true"]')
      if (todayCol) {
        todayCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [loading])

  async function loadData() {
    const startDate = days[0].toISOString().split('T')[0]
    const endDate = days[days.length - 1].toISOString().split('T')[0]

    // Cache first
    const cached = await getCachedProfileData(activeProfile)
    if (cached?.pieces) {
      setPieces(cached.pieces.filter(p => !p.archived))
      setLoading(false)
    }

    if (isOnline) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))

        // Load pieces
        let piecesData
        if (isOwnProfile) {
          const res = await Promise.race([
            supabase.from('pieces').select('id, title, composer, current_focus, archived, categories(name)').eq('user_id', user.email).eq('archived', false).order('title'),
            timeoutPromise
          ])
          piecesData = res.data || []
        } else {
          const res = await Promise.race([
            fetch(`/api/profile/${encodeURIComponent(activeProfile)}/pieces`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
            timeoutPromise
          ])
          piecesData = (res.pieces || []).filter(p => !p.archived)
        }
        setPieces(piecesData.sort((a, b) => {
          const catA = a.categories?.name || 'Uncategorized'
          const catB = b.categories?.name || 'Uncategorized'
          if (catA !== catB) return catA.localeCompare(catB)
          if (a.is_priority !== b.is_priority) return (b.is_priority ? 1 : 0) - (a.is_priority ? 1 : 0)
          return (a.title || '').localeCompare(b.title || '')
        }))

        // Load grid data
        const gridRes = await Promise.race([
          fetch(`/api/practice-grid?profile=${encodeURIComponent(activeProfile)}&start=${startDate}&end=${endDate}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
          timeoutPromise
        ])
        const gridMap = {}
        for (const item of (gridRes.grid || [])) {
          gridMap[`${item.piece_id}_${item.date}`] = item.status
        }
        setGrid(gridMap)
      } catch {}
    }
    setLoading(false)
  }

  async function toggleCell(pieceId, dateStr) {
    if (!canEdit) return
    const key = `${pieceId}_${dateStr}`
    const current = grid[key] || null

    // Cycle: null → planned → completed → null
    let newStatus
    if (!current) newStatus = 'planned'
    else if (current === 'planned') newStatus = 'completed'
    else newStatus = null

    // Update local state immediately
    setGrid(prev => {
      const next = { ...prev }
      if (newStatus) next[key] = newStatus
      else delete next[key]
      return next
    })

    // Sync to server or queue
    const body = { action: 'toggle', piece_id: pieceId, date: dateStr, currentStatus: current, profileEmail: isOwnProfile ? undefined : activeProfile }
    if (!isOnline) {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: `Toggle practice ${dateStr}` })
      return
    }
    try {
      await fetch('/api/practice-grid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: `Toggle practice ${dateStr}` })
    }
  }

  async function saveFocus(pieceId) {
    const body = { action: 'update_focus', piece_id: pieceId, current_focus: focusDraft, profileEmail: isOwnProfile ? undefined : activeProfile }
    setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, current_focus: focusDraft } : p))
    setEditingFocus(null)

    if (!isOnline) {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: 'Update focus area' })
      addToast('Focus saved offline', 'info')
      return
    }
    try {
      await fetch('/api/practice-grid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: 'Update focus area' })
    }
  }

  async function togglePriority(pieceId, currentPriority) {
    const newPriority = !currentPriority
    setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, is_priority: newPriority } : p))

    const body = { action: 'toggle_priority', piece_id: pieceId, is_priority: newPriority, profileEmail: isOwnProfile ? undefined : activeProfile }
    if (!isOnline) {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: 'Toggle priority' })
      return
    }
    try {
      await fetch('/api/practice-grid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: 'Toggle priority' })
    }
  }

  function exportGrid() {
    const w = window.open('', '_blank')
    const dayHeaders = days.map(d => `<th style="padding:4px 8px;font-size:11px;text-align:center;min-width:40px;${d.toISOString().split('T')[0] === todayStr ? 'background:#dbeafe;font-weight:700' : ''}">${d.toLocaleDateString('en-US', { weekday: 'short' })}<br>${d.getMonth() + 1}/${d.getDate()}</th>`).join('')
    const rows = pieces.map(p => {
      const cells = days.map(d => {
        const key = `${p.id}_${d.toISOString().split('T')[0]}`
        const status = grid[key]
        const isToday = d.toISOString().split('T')[0] === todayStr
        return `<td style="text-align:center;padding:6px;${isToday ? 'background:#eff6ff' : ''}">${status === 'completed' ? '💗' : status === 'planned' ? '🎵' : ''}</td>`
      }).join('')
      return `<tr style="${p.is_priority ? 'background:#fdf2f8' : ''}"><td style="padding:6px 8px;font-weight:500;font-size:13px;white-space:nowrap">${p.is_priority ? '★ ' : ''}${p.title}</td><td style="padding:6px 8px;font-size:12px;color:#666;max-width:150px">${p.current_focus || ''}</td>${cells}</tr>`
    }).join('')

    w.document.write(`<!DOCTYPE html><html><head><title>Practice Schedule</title>
      <style>body{font-family:-apple-system,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb}h1{font-size:18px;color:#2563eb}.no-print{} @media print{.no-print{display:none!important}}</style></head><body>
      <div class="no-print" style="margin-bottom:16px;display:flex;gap:12px">
        <button onclick="window.print()" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Print</button>
        <button onclick="window.close();if(!window.closed)history.back()" style="padding:10px 20px;background:#f9fafb;color:#666;border:1px solid #d1d5db;border-radius:8px;font-size:14px;cursor:pointer">← Back to App</button>
      </div>
      <h1>Practice Schedule — ${profileDisplayName(activeProfile)}</h1>
      <p style="color:#666;font-size:13px">🎵 = planned &nbsp; 💗 = completed</p>
      <table><thead><tr><th style="text-align:left;padding:6px">Piece</th><th style="text-align:left;padding:6px">Focus</th>${dayHeaders}</tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:16px;font-size:11px;color:#999">Exported from Piano Experience — ${new Date().toLocaleDateString()}</p></body></html>`)
    w.document.close()
    w.print()
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  return (
    <main style={{ padding: '24px', maxWidth: '100%', margin: '0 auto' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
          <h1 style={{ fontSize: '24px' }}>
            {isOwnProfile ? 'Practice Schedule' : `${profileDisplayName(activeProfile)}'s Schedule`}
          </h1>
          <button onClick={exportGrid} className="no-print" style={{
            padding: '8px 16px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
            borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
          }}>
            Export
          </button>
        </div>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
          Tap a cell: empty → 🎵 planned → 💗 completed → empty
        </p>
      </div>

      {pieces.length === 0 ? (
        <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>🎵</div>
          <p>No active pieces. <Link href="/add" style={{ color: '#2563eb' }}>Add a piece</Link> to start scheduling.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflowX: 'auto' }} ref={scrollRef}>
          <table style={{ borderCollapse: 'collapse', minWidth: `${140 + days.length * 48}px` }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fff', padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', borderRight: '2px solid #e5e7eb', fontSize: '12px', fontWeight: '600', color: '#999', minWidth: '130px', maxWidth: '160px' }}>
                  PIECE / FOCUS
                </th>
                {days.map(d => {
                  const dateStr = d.toISOString().split('T')[0]
                  const isToday = dateStr === todayStr
                  const isPast = d < today
                  return (
                    <th key={dateStr} data-today={isToday} style={{
                      padding: '6px 4px', textAlign: 'center', borderBottom: '2px solid #e5e7eb',
                      minWidth: '44px', maxWidth: '48px',
                      background: isToday ? '#2563eb' : isPast ? '#f9fafb' : '#fff',
                      color: isToday ? '#fff' : '#666', fontWeight: isToday ? '700' : '400',
                    }}>
                      <div style={{ fontSize: '10px' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{d.getDate()}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {pieces.map((p, idx) => {
                const cat = p.categories?.name || 'Uncategorized'
                const prevCat = idx > 0 ? (pieces[idx - 1].categories?.name || 'Uncategorized') : null
                const showCatHeader = cat !== prevCat
                return (<>
                  {showCatHeader && (
                    <tr key={`cat-${cat}`}>
                      <td colSpan={days.length + 1} style={{
                        position: 'sticky', left: 0, padding: '10px 12px 6px',
                        fontSize: '12px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px',
                        background: '#f0f7ff', borderBottom: '1px solid #dbeafe',
                      }}>{cat}</td>
                    </tr>
                  )}
                  <tr key={p.id} style={{ background: p.is_priority ? '#fdf2f8' : undefined }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: p.is_priority ? '#fdf2f8' : '#fff', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', borderRight: '2px solid #e5e7eb', verticalAlign: 'top', minWidth: '130px', maxWidth: '160px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {canEdit && (
                        <button onClick={() => togglePriority(p.id, p.is_priority)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px', flexShrink: 0,
                          color: p.is_priority ? '#ec4899' : '#ddd',
                        }}>★</button>
                      )}
                      <div style={{ fontWeight: '600', fontSize: '13px', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                    </div>
                    {editingFocus === p.id ? (
                      <div style={{ marginTop: '2px' }}>
                        <textarea value={focusDraft} onChange={e => setFocusDraft(e.target.value)}
                          autoFocus rows={2} onKeyDown={e => { if (e.key === 'Escape') setEditingFocus(null) }}
                          style={{ width: '100%', padding: '2px 6px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '11px', resize: 'vertical', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                          <button onClick={() => saveFocus(p.id)} style={{ padding: '2px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingFocus(null)} style={{ padding: '2px 8px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => { if (canEdit) { setEditingFocus(p.id); setFocusDraft(p.current_focus || '') } }}
                        style={{ fontSize: '11px', color: p.current_focus ? '#2563eb' : '#ccc', marginTop: '2px', cursor: canEdit ? 'pointer' : 'default', fontStyle: p.current_focus ? 'normal' : 'italic', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {p.current_focus || (canEdit ? 'tap to set focus' : '')}
                      </div>
                    )}
                  </td>
                  {days.map(d => {
                    const dateStr = d.toISOString().split('T')[0]
                    const isToday = dateStr === todayStr
                    const isPast = d < today
                    const key = `${p.id}_${dateStr}`
                    const status = grid[key]
                    return (
                      <td key={key} onClick={() => canEdit && toggleCell(p.id, dateStr)} style={{
                        textAlign: 'center', borderBottom: '1px solid #f0f0f0',
                        cursor: canEdit ? 'pointer' : 'default', padding: '8px 4px',
                        background: isToday ? (p.is_priority ? '#fce7f3' : '#eff6ff') : p.is_priority ? '#fdf2f8' : isPast ? '#fafafa' : '#fff',
                        minWidth: '44px',
                      }}>
                        {status === 'completed' && <span style={{ fontSize: '16px' }}>💗</span>}
                        {status === 'planned' && <span style={{ fontSize: '14px' }}>🎵</span>}
                      </td>
                    )
                  })}
                </tr>
                </>)
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
