'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'

export default function Settings() {
  const { user, loading: userLoading, isAdmin } = useCurrentUser()
  const { activeProfile, isOwnProfile, availableProfiles, profileDisplayName } = useActiveProfile()
  const { addToast } = useToast()
  const [userName, setUserName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [philosophy, setPhilosophy] = useState('')
  const [editingPhilosophy, setEditingPhilosophy] = useState(false)
  const [philosophyDraft, setPhilosophyDraft] = useState('')
  const [savingPhilosophy, setSavingPhilosophy] = useState(false)
  const [weeklyEmail, setWeeklyEmail] = useState(false)
  const [emailDay, setEmailDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (userLoading || !user) return
    async function load() {
      try {
        const res = await fetch('/api/settings', { signal: AbortSignal.timeout(5000) })
        const data = await res.json()
        if (data.settings) {
          setWeeklyEmail(data.settings.weekly_email_enabled === true)
          setEmailDay(data.settings.weekly_email_day)
          setUserName(data.settings.name || '')
          setPhilosophy(data.settings.practice_philosophy || '')
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [userLoading, user])

  async function saveName() {
    if (!nameDraft.trim()) return
    setSavingName(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDraft.trim() })
      })
      if (res.ok) {
        setUserName(nameDraft.trim())
        setEditingName(false)
        addToast('Name updated', 'success')
      }
    } catch {
      addToast('Failed to update name', 'error')
    }
    setSavingName(false)
  }

  async function savePhilosophy() {
    setSavingPhilosophy(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practice_philosophy: philosophyDraft })
      })
      if (res.ok) {
        setPhilosophy(philosophyDraft)
        setEditingPhilosophy(false)
        addToast('Practice philosophy updated', 'success')
      }
    } catch {
      addToast('Failed to save', 'error')
    }
    setSavingPhilosophy(false)
  }

  async function toggleWeeklyEmail() {
    const newVal = !weeklyEmail
    setWeeklyEmail(newVal)
    if (!newVal) setEmailDay(null)
    try {
      await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_email_enabled: newVal, weekly_email_day: newVal ? (emailDay ?? 4) : null })
      })
      if (newVal && emailDay === null) setEmailDay(4) // default to Friday
      addToast(newVal ? 'Weekly email enabled' : 'Weekly email disabled', 'success')
    } catch {
      setWeeklyEmail(!newVal)
      addToast('Failed to update', 'error')
    }
  }

  async function changeEmailDay(day) {
    setEmailDay(day)
    try {
      await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_email_day: day })
      })
      addToast('Email day updated', 'success')
    } catch {
      addToast('Failed to update', 'error')
    }
  }

  async function exportData(profileEmail) {
    setExporting(true)
    const isSelf = profileEmail === user.email

    // Open window immediately (before any async work) to avoid popup blocker on iOS
    const w = window.open('', '_blank')
    if (!w) {
      addToast('Popup blocked — please allow popups for this site', 'error')
      setExporting(false)
      return
    }
    w.document.write('<!DOCTYPE html><html><head><title>Exporting...</title></head><body style="font-family:-apple-system,sans-serif;padding:40px;text-align:center;color:#666"><p>Loading data...</p></body></html>')

    try {
      const piecesUrl = isSelf
        ? `/api/profile-data?type=pieces&email=${encodeURIComponent(profileEmail)}`
        : `/api/profile/${encodeURIComponent(profileEmail)}/pieces`
      const res = await fetch(piecesUrl, { signal: AbortSignal.timeout(15000) })
      const piecesData = await res.json()
      const pieces = isSelf ? (piecesData.pieces || []) : (piecesData.pieces || [])

      // Load details for each piece
      for (const piece of pieces) {
        try {
          const detailUrl = isSelf
            ? `/api/profile-data?type=piece-detail&id=${piece.id}`
            : `/api/profile/${encodeURIComponent(profileEmail)}/piece/${piece.id}`
          const detailRes = await fetch(detailUrl, { signal: AbortSignal.timeout(10000) })
          const detail = await detailRes.json()
          piece._notes = detail.notes || []
          piece._goals = detail.goals || []
          piece._facts = detail.facts || []
          piece._tempoLog = detail.tempoLog || []
        } catch {}
      }

      // Load experiences
      const expRes = await fetch(`/api/experiences?profile=${encodeURIComponent(profileEmail)}`, { signal: AbortSignal.timeout(10000) })
      const expData = await expRes.json()

      // Load strategies
      const strRes = await fetch(`/api/strategies?profile=${encodeURIComponent(profileEmail)}`, { signal: AbortSignal.timeout(10000) })
      const strData = await strRes.json()

      // Load user activities
      const actUrl = isSelf
        ? `/api/user-activities?profile=${encodeURIComponent(profileEmail)}`
        : `/api/profile/${encodeURIComponent(profileEmail)}/activities`
      const actRes = await fetch(actUrl, { signal: AbortSignal.timeout(10000) })
      const actData = await actRes.json()

      // Build export document in the already-opened window
      const name = profileEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      let html = `<!DOCTYPE html><html><head><title>${name} — Piano Experience Data Export</title>
        <style>body{font-family:-apple-system,sans-serif;padding:30px;max-width:800px;margin:0 auto;color:#1a1a1a;font-size:14px}
        h1{font-size:22px;color:#2563eb}h2{font-size:18px;color:#2563eb;margin:28px 0 12px;border-bottom:1px solid #dbeafe;padding-bottom:6px}
        h3{font-size:15px;margin:16px 0 8px}.section{margin-bottom:24px}.field{margin-bottom:4px}.label{color:#999;font-size:12px}
        .note{padding:8px 12px;background:#f9fafb;border-radius:6px;margin-bottom:6px;border-left:3px solid #2563eb}
        .fact{padding:8px;background:#eff6ff;border-radius:6px;margin-bottom:6px}
        .no-print{} @media print{.no-print{display:none!important}}</style></head><body>
        <div class="no-print" style="margin-bottom:16px;display:flex;gap:12px">
          <button onclick="window.print()" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Print</button>
          <button onclick="window.close();if(!window.closed)history.back()" style="padding:10px 20px;background:#f9fafb;color:#666;border:1px solid #d1d5db;border-radius:8px;font-size:14px;cursor:pointer">← Back</button>
        </div>
        <h1>${name} — Piano Experience Data Export</h1>
        <p style="color:#666">Exported ${new Date().toLocaleDateString()}</p>`

      // Pieces
      html += `<h2>Pieces (${pieces.length})</h2>`
      for (const p of pieces) {
        html += `<div class="section"><h3>${p.title || 'Untitled'}${p.composer ? ' — ' + p.composer : ''}</h3>`
        if (p.categories?.name) html += `<div class="field"><span class="label">Category:</span> ${p.categories.name}</div>`
        if (p.current_focus) html += `<div class="field"><span class="label">Focus:</span> ${p.current_focus}</div>`
        if (p.personal_rating) html += `<div class="field"><span class="label">Rating:</span> ${p.personal_rating}/10</div>`
        if (p.metronome_marking) html += `<div class="field"><span class="label">Metronome:</span> ${p.metronome_marking}</div>`
        if (p.ai_summary) html += `<div class="field"><span class="label">AI Summary:</span> ${p.ai_summary}</div>`
        if (p.composer_bio) html += `<div class="field"><span class="label">Composer Bio:</span> ${p.composer_bio}</div>`
        if (p.areas_of_focus) html += `<div class="field"><span class="label">Areas of Focus:</span> ${p.areas_of_focus}</div>`
        if (p.goals) html += `<div class="field"><span class="label">Goals:</span> ${p.goals}</div>`
        if (p._goals?.length) html += `<div class="field"><span class="label">Goal Checklist:</span><ul>${p._goals.map(g => `<li>${g.completed ? '✓' : '☐'} ${g.text}</li>`).join('')}</ul></div>`
        if (p._notes?.length) {
          html += `<div class="label" style="margin-top:8px">Notes:</div>`
          p._notes.forEach(n => { html += `<div class="note"><strong>${n.note_type}</strong> — ${new Date(n.created_at).toLocaleDateString()}<br>${n.note}</div>` })
        }
        if (p._facts?.length) {
          html += `<div class="label" style="margin-top:8px">Interesting Facts:</div>`
          p._facts.forEach(f => { html += `<div class="fact">${f.fact}</div>` })
        }
        html += `</div><hr style="border:none;border-top:1px solid #e5e7eb">`
      }

      // Experiences
      const experiences = expData.experiences || []
      if (experiences.length) {
        html += `<h2>Experience Log (${experiences.length})</h2>`
        experiences.forEach(e => {
          html += `<div class="section"><h3>${new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>`
          if (e.summary) html += `<div class="field" style="white-space:pre-wrap"><span class="label">Covered:</span> ${e.summary}</div>`
          if (e.feedback) html += `<div class="field" style="white-space:pre-wrap"><span class="label">Feedback:</span> ${e.feedback}</div>`
          if (e.assignments) html += `<div class="field" style="white-space:pre-wrap"><span class="label">Assignments:</span> ${e.assignments}</div>`
          html += `</div>`
        })
      }

      // Strategies
      const strategies = strData.strategies || []
      if (strategies.length) {
        html += `<h2>Practice Strategies</h2>`
        strategies.forEach(s => {
          html += `<h3>${s.heading}</h3><ul>${(s.bullets || []).map(b => `<li>${b}</li>`).join('')}</ul>`
        })
      }

      // Activities
      const userActivities = actData.activities || []
      if (userActivities.length) {
        html += `<h2>Activities (${userActivities.length})</h2>`
        userActivities.forEach(a => {
          html += `<div class="section"><div class="field"><strong>${a.completed_date ? '✓' : '☐'}</strong> ${a.description}`
          if (a.completed_date) html += ` <span style="color:#999;font-size:12px">(completed ${new Date(a.completed_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>`
          html += `</div>`
          if (a.reflection) html += `<div class="field" style="white-space:pre-wrap;margin-left:20px;color:#666"><span class="label">Reflection:</span> ${a.reflection}</div>`
          html += `</div>`
        })
      }

      html += `<p style="margin-top:32px;font-size:12px;color:#999">Generated by Piano Experience — pianoexperience.app</p></body></html>`
      w.document.write(html)
      w.document.close()
    } catch {
      if (w && !w.closed) w.close()
      addToast('Failed to export data', 'error')
    }
    setExporting(false)
  }

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  return (
    <main style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Home</Link>
      <h1 style={{ margin: '16px 0 24px', fontSize: '24px' }}>Settings</h1>

      {/* Profile */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Profile</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '2px' }}>Name</div>
            {editingName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="text" value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  autoFocus
                  style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '200px' }} />
                <button onClick={saveName} disabled={savingName || !nameDraft.trim()} style={{
                  padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
                }}>{savingName ? '...' : 'Save'}</button>
                <button onClick={() => setEditingName(false)} style={{
                  padding: '6px 12px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
                }}>Cancel</button>
              </div>
            ) : (
              <div style={{ fontSize: '15px', fontWeight: '500' }}>
                {userName || <span style={{ color: '#999', fontStyle: 'italic' }}>Not set</span>}
                <button onClick={() => { setNameDraft(userName); setEditingName(true) }} style={{
                  background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', cursor: 'pointer', marginLeft: '8px', textDecoration: 'underline'
                }}>Edit</button>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '2px' }}>Email</div>
          <div style={{ fontSize: '15px', fontWeight: '500' }}>{user?.email}</div>
        </div>
      </div>

      {/* Email Preferences */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Email Preferences</h2>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: weeklyEmail ? '16px' : '0' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '500' }}>Weekly Practice Summary</div>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>Receive a summary email at 8pm CT on your chosen day</div>
          </div>
          <button onClick={toggleWeeklyEmail} style={{
            width: '50px', height: '28px', borderRadius: '14px', border: 'none',
            background: weeklyEmail ? '#2563eb' : '#d1d5db',
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, marginLeft: '12px',
          }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%', background: '#fff',
              position: 'absolute', top: '3px',
              left: weeklyEmail ? '25px' : '3px',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        {weeklyEmail && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Send on</label>
            <select value={emailDay ?? 4} onChange={e => changeEmailDay(parseInt(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
              {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Data Export */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Data Export</h2>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>Download all data as a printable document — pieces, notes, goals, practice history, experience log, and strategies.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => exportData(user.email)} disabled={exporting} style={{
            padding: '12px 20px', background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
          }}>
            {exporting ? 'Exporting...' : 'Export My Data'}
          </button>

          {availableProfiles.map(p => (
            <button key={p.email} onClick={() => exportData(p.email)} disabled={exporting} style={{
              padding: '12px 20px', background: '#f9fafb', color: '#374151', border: '1px solid #d1d5db',
              borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
            }}>
              Export {profileDisplayName(p.email)}'s Data
            </button>
          ))}
        </div>
      </div>

      {/* Practice Coach Philosophy — admin only */}
      {isAdmin && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '8px' }}>Practice Coach Philosophy</h2>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            These instructions guide the Practice Coach AI when helping students plan their practice. Include your teaching philosophy, practice principles, and any specific guidance.
          </p>
          {editingPhilosophy ? (
            <div>
              <textarea value={philosophyDraft} onChange={e => setPhilosophyDraft(e.target.value)}
                rows={8} placeholder="e.g., Always have students count aloud for the first pass of a new piece. Balance technique work with repertoire. Prioritize pieces with upcoming performances..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.6' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={savePhilosophy} disabled={savingPhilosophy} style={{
                  padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none',
                  borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                }}>{savingPhilosophy ? 'Saving...' : 'Save'}</button>
                <button onClick={() => setEditingPhilosophy(false)} style={{
                  padding: '8px 16px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
                  borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              {philosophy ? (
                <div style={{ fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '12px' }}>{philosophy}</div>
              ) : (
                <div style={{ fontSize: '14px', color: '#999', fontStyle: 'italic', marginBottom: '12px' }}>No practice philosophy set yet.</div>
              )}
              <button onClick={() => { setPhilosophyDraft(philosophy); setEditingPhilosophy(true) }} style={{
                padding: '8px 16px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
              }}>{philosophy ? 'Edit' : 'Add Philosophy'}</button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
