'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'
import { useOfflineData } from '@/lib/useOfflineData'
import { logActivity } from '@/lib/logActivity'
import { queueMutation } from '@/lib/syncManager'
import { useSortedCategories } from '@/lib/useSortedCategories'
import { toLocalDateString } from '@/lib/dateUtils'

export default function PracticeSchedule() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { addToast } = useToast()
  const { isOnline, getCachedProfileData } = useOfflineData()
  const { categories: sortedCats, sortPiecesByCategory } = useSortedCategories()
  const [pieces, setPieces] = useState([])
  const [rawPieces, setRawPieces] = useState([])
  const [grid, setGrid] = useState({}) // key: `${pieceId}_${date}` → status
  const [practiceDays, setPracticeDays] = useState(new Set()) // dates marked as practice days
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
  const todayStr = toLocalDateString(today)
  const EXPERIMENTATION_ID = '00000000-0000-0000-0000-experimentation'
  const expFocus = typeof window !== 'undefined' ? (localStorage.getItem('exp_focus_' + activeProfile) || '') : ''
  const experimentationPiece = { id: EXPERIMENTATION_ID, title: 'Experimentation', composer: null, current_focus: expFocus, is_priority: false, category_id: null, categories: null, isExperimentation: true }

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    loadData()
  }, [userLoading, user, activeProfile])

  // Re-sort pieces when category preferences load
  useEffect(() => {
    if (rawPieces.length > 0 && sortedCats.length > 0) {
      setPieces(sortPiecesByCategory(rawPieces))
    }
  }, [sortedCats, rawPieces])

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
    const startDate = toLocalDateString(days[0])
    const endDate = toLocalDateString(days[days.length - 1])

    // Cache first
    const cached = await getCachedProfileData(activeProfile)
    if (cached?.pieces) {
      const activePieces = cached.pieces.filter(p => !p.archived)
      setRawPieces(activePieces)
      setPieces(sortPiecesByCategory(activePieces))
      setLoading(false)
    }

    if (isOnline) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))

        // Load pieces
        let piecesData
        if (isOwnProfile) {
          const res = await Promise.race([
            supabase.from('pieces').select('id, title, composer, current_focus, archived, is_priority, category_id, categories(name)').eq('user_id', user.email).eq('archived', false).order('title'),
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
        setRawPieces(piecesData)
        setPieces(sortPiecesByCategory(piecesData))

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
        setPracticeDays(new Set(gridRes.practiceDays || []))
      } catch {}
    }
    setLoading(false)
  }

  async function toggleCell(pieceId, dateStr) {
    if (!canEdit) return
    const key = `${pieceId}_${dateStr}`
    const current = grid[key] || null

    // Cycle: null → plan_play → plan_practice → played → practiced → null
    const cycle = [null, 'plan_play', 'plan_practice', 'played', 'practiced']
    const currentIdx = cycle.indexOf(current)
    const newStatus = cycle[(currentIdx + 1) % cycle.length]

    // Update local state immediately
    setGrid(prev => {
      const next = { ...prev }
      if (newStatus) next[key] = newStatus
      else delete next[key]
      return next
    })

    // Log completion
    if (newStatus === 'played' || newStatus === 'practiced') {
      const p = pieces.find(pp => pp.id === pieceId)
      logActivity({ action: 'practice_completed', piece_id: pieceId, piece_title: p?.title, details: newStatus === 'practiced' ? 'Practiced (focused work)' : 'Played', profile_email: activeProfile, performed_by: user.email })
    }

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
    // Experimentation row — save focus locally only (no DB piece)
    if (pieceId === EXPERIMENTATION_ID) {
      experimentationPiece.current_focus = focusDraft
      try { localStorage.setItem('exp_focus_' + activeProfile, focusDraft) } catch {}
      setEditingFocus(null)
      return
    }

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

  async function togglePracticeDay(dateStr) {
    const isPlanned = practiceDays.has(dateStr)
    setPracticeDays(prev => {
      const next = new Set(prev)
      if (isPlanned) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })

    const body = { action: 'toggle_practice_day', date: dateStr, isPlanned, profileEmail: isOwnProfile ? undefined : activeProfile }
    if (!isOnline) {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: 'Toggle practice day' })
      return
    }
    try {
      await fetch('/api/practice-grid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch {
      await queueMutation({ url: '/api/practice-grid', method: 'POST', body, description: 'Toggle practice day' })
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
    const dayHeaders = days.map(d => `<th style="padding:4px 8px;font-size:11px;text-align:center;min-width:40px;${toLocalDateString(d) === todayStr ? 'background:#dbeafe;font-weight:700' : ''}">${d.toLocaleDateString('en-US', { weekday: 'short' })}<br>${d.getMonth() + 1}/${d.getDate()}</th>`).join('')
    const rows = pieces.map(p => {
      const cells = days.map(d => {
        const key = `${p.id}_${toLocalDateString(d)}`
        const status = grid[key]
        const isToday = toLocalDateString(d) === todayStr
        const icon = status === 'plan_play' ? '♪' : status === 'plan_practice' ? '🎶' : status === 'played' || status === 'completed' ? '💗' : status === 'practiced' ? '💕' : status === 'planned' ? '♪' : ''
        return `<td style="text-align:center;padding:6px;${isToday ? 'background:#eff6ff' : ''}">${icon}</td>`
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
      <p style="color:#666;font-size:13px">♪ plan to play &nbsp; 🎶 plan to practice &nbsp; 💗 played &nbsp; 💕 practiced</p>
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
          Tap a cell: empty → ♪ plan to play → 🎶 plan to practice → 💗 played → 💕 practiced → empty
        </p>
      </div>

      {pieces.length === 0 ? (
        <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>♪</div>
          <p>No active pieces. <Link href="/add" style={{ color: '#2563eb' }}>Add a piece</Link> to start scheduling.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'auto', maxHeight: '70vh' }} ref={scrollRef}>
          <table style={{ borderCollapse: 'collapse', minWidth: `${140 + days.length * 48}px` }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 3, background: '#fff', padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', borderRight: '2px solid #e5e7eb', fontSize: '12px', fontWeight: '600', color: '#999', minWidth: '130px', maxWidth: '160px' }}>
                  PIECE / FOCUS
                </th>
                {days.map(d => {
                  const dateStr = toLocalDateString(d)
                  const isToday = dateStr === todayStr
                  const isPast = d < today
                  return (
                    <th key={dateStr} data-today={isToday} style={{
                      position: 'sticky', top: 0, zIndex: 2,
                      padding: '4px 2px', textAlign: 'center',
                      borderBottom: '2px solid #e5e7eb', borderLeft: '1px solid #e5e7eb',
                      minWidth: '44px', maxWidth: '48px',
                      background: isToday ? '#2563eb' : practiceDays.has(dateStr) ? '#e8e4ff' : isPast ? '#f0f0f0' : '#fff',
                      color: isToday ? '#fff' : '#666', fontWeight: isToday ? '700' : '400',
                    }}>
                      {canEdit && (
                        <button onClick={() => togglePracticeDay(dateStr)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '12px',
                          color: practiceDays.has(dateStr) ? '#9333ea' : (isToday ? 'rgba(255,255,255,0.5)' : '#ddd'),
                        }}>★</button>
                      )}
                      <div style={{ fontSize: '10px' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{d.getDate()}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[...pieces, experimentationPiece].map((p, idx) => {
                const allItems = [...pieces, experimentationPiece]
                const cat = p.isExperimentation ? 'Free Play' : (p.categories?.name || 'Uncategorized')
                const prevCat = idx > 0 ? (allItems[idx - 1].isExperimentation ? 'Free Play' : (allItems[idx - 1].categories?.name || 'Uncategorized')) : null
                const isFirstInCategory = cat !== prevCat
                return (
                  <tr key={p.id} style={{ background: p.is_priority ? '#fdf2f8' : undefined }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: p.is_priority ? '#fdf2f8' : '#fff', padding: isFirstInCategory ? '14px 10px 8px' : '8px 10px', borderBottom: '1px solid #e5e7eb', borderRight: '2px solid #e5e7eb', verticalAlign: 'top', minWidth: '130px', maxWidth: '160px' }}>
                    {isFirstInCategory && (
                      <div style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{cat}</div>
                    )}
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
                    const dateStr = toLocalDateString(d)
                    const isToday = dateStr === todayStr
                    const isPast = d < today
                    const key = `${p.id}_${dateStr}`
                    const status = grid[key]
                    return (
                      <td key={key} onClick={() => canEdit && toggleCell(p.id, dateStr)} style={{
                        textAlign: 'center',
                        borderBottom: '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb',
                        cursor: canEdit ? 'pointer' : 'default', padding: '8px 4px',
                        background: isToday ? (p.is_priority ? '#fce7f3' : '#dbeafe')
                          : p.is_priority && practiceDays.has(dateStr) ? '#f0e4f8'
                          : p.is_priority ? '#fdf2f8'
                          : practiceDays.has(dateStr) ? '#e8e4ff'
                          : isPast ? '#fafafa' : '#fff',
                        borderLeft: '1px solid #e5e7eb',
                        minWidth: '44px',
                      }}>
                        {status === 'plan_play' && <span style={{ fontSize: '14px' }}>♪</span>}
                        {status === 'plan_practice' && <span style={{ fontSize: '14px' }}>🎶</span>}
                        {status === 'played' && <span style={{ fontSize: '14px' }}>💗</span>}
                        {status === 'practiced' && <span style={{ fontSize: '14px' }}>💕</span>}
                        {status === 'planned' && <span style={{ fontSize: '14px' }}>♪</span>}
                        {status === 'completed' && <span style={{ fontSize: '14px' }}>💗</span>}
                      </td>
                    )
                  })}
                </tr>
              )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
