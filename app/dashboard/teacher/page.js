'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { toLocalDateString } from '@/lib/dateUtils'

function buildProfileData(email, accessLevel, activePieces, gridRes, activitiesRes) {
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

  const sortedPieces = [...activePieces].sort((a, b) => {
    const aStats = pieceStats[a.id] || { played: 0, practiced: 0 }
    const bStats = pieceStats[b.id] || { played: 0, practiced: 0 }
    const aTotal = aStats.played + aStats.practiced
    const bTotal = bStats.played + bStats.practiced
    if (bTotal !== aTotal) return bTotal - aTotal
    return bStats.practiced - aStats.practiced
  })

  return {
    email,
    accessLevel,
    piecesCount: activePieces.length,
    daysActive: daysWithActivity.size,
    pieces: sortedPieces,
    pieceStats,
    expStats,
    experimentationFocus: gridRes.experimentationFocus || '',
    activities: activitiesRes.activities || [],
  }
}

export default function TeacherDashboard() {
  const { user, loading: userLoading } = useCurrentUser()
  const { availableProfiles, switchProfile, profileDisplayName } = useActiveProfile()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dayRange, setDayRange] = useState(7)

  useEffect(() => {
    if (userLoading || !user) return
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

    // Load own profile first
    try {
      const enc = encodeURIComponent(user.email)
      const [piecesRes, gridRes, activitiesRes] = await Promise.all([
        fetch(`/api/profile-data?type=pieces&email=${enc}`).then(r => r.json()),
        fetch(`/api/practice-grid?profile=${enc}&start=${startDate}&end=${endDate}`).then(r => r.json()),
        fetch(`/api/user-activities?profile=${enc}`).then(r => r.json()),
      ])
      const ownResult = buildProfileData(user.email, 'own', piecesRes.pieces || [], gridRes, activitiesRes)
      results.push(ownResult)
    } catch {
      results.push({ email: user.email, accessLevel: 'own', piecesCount: 0, daysActive: 0, pieces: [], pieceStats: {}, expStats: { played: 0, practiced: 0 }, experimentationFocus: '', activities: [] })
    }

    // Load shared profiles
    for (const profile of availableProfiles) {
      try {
        const enc = encodeURIComponent(profile.email)
        const [piecesRes, gridRes, activitiesRes] = await Promise.all([
          fetch(`/api/profile/${enc}/pieces`).then(r => r.json()),
          fetch(`/api/practice-grid?profile=${enc}&start=${startDate}&end=${endDate}`).then(r => r.json()),
          fetch(`/api/profile/${enc}/activities`).then(r => r.json()),
        ])

        const result = buildProfileData(profile.email, profile.accessLevel, (piecesRes.pieces || []).filter(p => !p.archived), gridRes, activitiesRes)
        results.push(result)
      } catch {
        results.push({ email: profile.email, accessLevel: profile.accessLevel, piecesCount: 0, daysActive: 0, pieces: [], pieceStats: {}, expStats: { played: 0, practiced: 0 }, experimentationFocus: '', activities: [] })
      }
    }
    setStudents(results)
    setLoading(false)
  }

  function printSummary(s) {
    const name = profileDisplayName(s.email)
    const pieceRows = s.pieces.map(p => {
      const stats = s.pieceStats[p.id] || { played: 0, practiced: 0 }
      return `<tr style="${p.is_priority ? 'background:#fdf2f8' : ''}">
        <td style="padding:6px 10px;font-size:13px">${p.is_priority ? '<span style="color:#ec4899">★</span> ' : ''}${p.title}</td>
        <td style="padding:6px 10px;font-size:12px;color:#2563eb">${p.current_focus || ''}</td>
        <td style="padding:6px 10px;text-align:center;font-weight:600;color:${stats.practiced > 0 ? '#059669' : '#ccc'}">${stats.practiced}</td>
        <td style="padding:6px 10px;text-align:center;font-weight:600;color:${stats.played > 0 ? '#2563eb' : '#ccc'}">${stats.played}</td>
      </tr>`
    }).join('')

    let expHtml = ''
    if (s.expStats.played + s.expStats.practiced > 0 || s.experimentationFocus) {
      expHtml = `<tr style="border-top:2px solid #e5e7eb">
        <td style="padding:6px 10px;font-size:13px">Experimentation</td>
        <td style="padding:6px 10px;font-size:12px;color:#2563eb">${s.experimentationFocus || ''}</td>
        <td style="padding:6px 10px;text-align:center;font-weight:600;color:${s.expStats.practiced > 0 ? '#059669' : '#ccc'}">${s.expStats.practiced}</td>
        <td style="padding:6px 10px;text-align:center;font-weight:600;color:${s.expStats.played > 0 ? '#2563eb' : '#ccc'}">${s.expStats.played}</td>
      </tr>`
    }

    let activitiesHtml = ''
    if (s.activities.length > 0) {
      activitiesHtml = `<div style="margin-top:16px"><div style="font-size:12px;color:#999;font-weight:600;margin-bottom:6px">ACTIVITIES</div>`
      s.activities.forEach(a => {
        activitiesHtml += `<div style="font-size:13px;margin-bottom:4px">${a.completed_date ? '✓' : '○'} ${a.completed_date ? '<s style="color:#999">' : ''}${a.description}${a.completed_date ? '</s>' : ''}`
        if (a.completed_date) activitiesHtml += ` <span style="color:#999;font-size:11px">(${new Date(a.completed_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>`
        activitiesHtml += `</div>`
        if (a.reflection) activitiesHtml += `<div style="font-size:12px;color:#666;margin:2px 0 6px 18px;white-space:pre-wrap">${a.reflection}</div>`
      })
      activitiesHtml += `</div>`
    }

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>${name} — Practice Summary</title>
      <style>
        body{font-family:-apple-system,sans-serif;padding:24px;max-width:700px;margin:0 auto;color:#1a1a1a;font-size:14px}
        h1{font-size:20px;color:#2563eb;margin:0 0 4px}
        table{border-collapse:collapse;width:100%;margin-top:12px}
        th{text-align:left;padding:6px 10px;font-size:11px;color:#999;border-bottom:2px solid #e5e7eb}
        td{border-bottom:1px solid #f3f4f6}
        .stats{display:flex;gap:16px;margin:12px 0}
        .stat{background:#f9fafb;border-radius:8px;padding:10px 20px;text-align:center}
        .stat-val{font-size:22px;font-weight:700}
        .stat-label{font-size:11px;color:#666;margin-top:2px}
        .no-print{} @media print{.no-print{display:none!important}}
      </style></head><body>
      <div class="no-print" style="margin-bottom:16px;display:flex;gap:12px">
        <button onclick="window.print()" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Print</button>
        <button onclick="window.close();if(!window.closed)history.back()" style="padding:10px 20px;background:#f9fafb;color:#666;border:1px solid #d1d5db;border-radius:8px;font-size:14px;cursor:pointer">← Back to App</button>
      </div>
      <h1>${name} — Practice Summary</h1>
      <div style="font-size:13px;color:#666;margin-bottom:4px">${s.email}</div>
      <div style="font-size:12px;color:#999">Last ${dayRange} days — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <div class="stats">
        <div class="stat"><div class="stat-val" style="color:#2563eb">${s.piecesCount}</div><div class="stat-label">Active Pieces</div></div>
        <div class="stat"><div class="stat-val" style="color:#059669">${s.daysActive}/${dayRange}</div><div class="stat-label">Days Active</div></div>
      </div>
      ${s.pieces.length > 0 ? `<table>
        <thead><tr><th>Piece</th><th>Focus</th><th style="text-align:center">💕</th><th style="text-align:center"><span style="color:#ec4899">♥</span></th></tr></thead>
        <tbody>${pieceRows}${expHtml}</tbody>
      </table>` : ''}
      ${activitiesHtml}
      <div style="margin-top:20px;font-size:11px;color:#999">Piano Experience — pianoexperience.app</div>
    </body></html>`)
    w.document.close()
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Home</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', minWidth: 0 }}>Practice Summary</h1>
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
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
        {availableProfiles.length > 0
          ? `You + ${availableProfiles.length} shared profile${availableProfiles.length !== 1 ? 's' : ''}`
          : 'Your practice summary'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {students.map(s => (
          <div key={s.email} style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            {/* Header */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', margin: 0 }}>
                    {profileDisplayName(s.email)}
                    {s.accessLevel === 'own' && <span style={{ fontSize: '13px', color: '#666', fontWeight: '400', marginLeft: '6px' }}>(You)</span>}
                  </h2>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{s.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => printSummary(s)} style={{
                  padding: '8px 16px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
                  borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
                }}>
                  Print Summary
                </button>
                {s.accessLevel !== 'own' && (
                  <button onClick={() => { switchProfile(s.email); window.location.href = '/' }} style={{
                    padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
                  }}>
                    View Profile
                  </button>
                )}
              </div>
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
                            <div style={{ fontSize: '13px', color: '#ec4899' }}>♥</div>
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
                      <div style={{ fontSize: '13px', color: '#ec4899' }}>♥</div>
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
