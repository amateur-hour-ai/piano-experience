'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useToast } from '@/app/ToastProvider'
import { logActivity } from '@/lib/logActivity'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function PracticeSchedule() {
  const { user, loading: userLoading } = useCurrentUser()
  const { addToast } = useToast()
  const [schedule, setSchedule] = useState([])
  const [pieces, setPieces] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingDay, setAddingDay] = useState(null)
  const [selectedPiece, setSelectedPiece] = useState('')
  const [focusNotes, setFocusNotes] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const weekStart = getWeekStart()

  useEffect(() => {
    if (userLoading || !user) return
    loadData()
  }, [userLoading, user])

  async function loadData() {
    const [schedRes, piecesRes] = await Promise.all([
      supabase.from('practice_schedule')
        .select('*, pieces(title, composer)')
        .eq('user_id', user.email)
        .eq('week_start_date', weekStart)
        .order('day_of_week')
        .order('sort_order'),
      supabase.from('pieces').select('id, title, composer').eq('user_id', user.email).order('title'),
    ])
    setSchedule(schedRes.data || [])
    setPieces(piecesRes.data || [])
    setLoading(false)
  }

  async function addToSchedule(dayIdx) {
    if (!selectedPiece) return
    const dayItems = schedule.filter(s => s.day_of_week === dayIdx)
    const { error } = await supabase.from('practice_schedule').insert([{
      user_id: user.email,
      piece_id: selectedPiece,
      day_of_week: dayIdx,
      focus_notes: focusNotes || null,
      sort_order: dayItems.length,
      week_start_date: weekStart,
      completed: false,
    }])
    if (error) { addToast('Failed to add: ' + error.message, 'error'); return }
    addToast('Added to schedule!', 'success')
    setAddingDay(null)
    setSelectedPiece('')
    setFocusNotes('')
    loadData()
  }

  async function toggleComplete(item) {
    const newVal = !item.completed
    await supabase.from('practice_schedule').update({
      completed: newVal,
      completed_at: newVal ? new Date().toISOString() : null
    }).eq('id', item.id)

    if (newVal) {
      await logActivity({
        action: 'practice_complete',
        piece_id: item.piece_id,
        piece_title: item.pieces?.title,
        details: `Completed practice on ${DAYS[item.day_of_week]}`,
        user_email: user.email
      })
    }

    setSchedule(prev => prev.map(s => s.id === item.id ? { ...s, completed: newVal, completed_at: newVal ? new Date().toISOString() : null } : s))
  }

  async function removeItem(itemId) {
    await supabase.from('practice_schedule').delete().eq('id', itemId)
    setSchedule(prev => prev.filter(s => s.id !== itemId))
    addToast('Removed from schedule', 'info')
  }

  async function updateFocus(itemId, newFocus) {
    await supabase.from('practice_schedule').update({ focus_notes: newFocus || null }).eq('id', itemId)
    setSchedule(prev => prev.map(s => s.id === itemId ? { ...s, focus_notes: newFocus } : s))
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  const todayIdx = (new Date().getDay() + 6) % 7

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 8px' }}>Practice Schedule</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

      {pieces.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
          <p>No pieces yet. <Link href="/add">Add a piece</Link> first, then schedule your practice.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {DAYS.map((day, idx) => {
            const dayItems = schedule.filter(s => s.day_of_week === idx)
            const isToday = idx === todayIdx
            return (
              <div key={day} style={{
                background: isToday ? '#eff6ff' : '#fff',
                borderRadius: '12px', padding: '20px', border: `1px solid ${isToday ? '#93c5fd' : '#e5e7eb'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {day}
                    {isToday && <span style={{ fontSize: '11px', background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '8px' }}>Today</span>}
                  </h3>
                  <button onClick={() => setAddingDay(addingDay === idx ? null : idx)} style={{
                    padding: '4px 12px', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px',
                    fontSize: '13px', color: '#666', cursor: 'pointer'
                  }}>
                    + Add
                  </button>
                </div>

                {addingDay === idx && (
                  <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select value={selectedPiece} onChange={e => setSelectedPiece(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                      <option value="">Select a piece...</option>
                      {pieces.map(p => <option key={p.id} value={p.id}>{p.title}{p.composer ? ` — ${p.composer}` : ''}</option>)}
                    </select>
                    <input value={focusNotes} onChange={e => setFocusNotes(e.target.value)} placeholder="Focus notes (optional)..."
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => addToSchedule(idx)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        Add to {day}
                      </button>
                      <button onClick={() => setAddingDay(null)} style={{ padding: '8px 16px', background: '#fff', color: '#666', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {dayItems.length === 0 ? (
                  <p style={{ fontSize: '14px', color: '#999' }}>No pieces scheduled</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dayItems.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                        background: item.completed ? '#f0fdf4' : '#fff', borderRadius: '8px', border: '1px solid #e5e7eb'
                      }}>
                        <button onClick={() => toggleComplete(item)} style={{
                          width: '22px', height: '22px', borderRadius: '6px', border: `2px solid ${item.completed ? '#059669' : '#d1d5db'}`,
                          background: item.completed ? '#059669' : '#fff', color: '#fff', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', cursor: 'pointer', fontSize: '12px', flexShrink: 0
                        }}>
                          {item.completed && '✓'}
                        </button>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: '500', fontSize: '14px', textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? '#059669' : '#1a1a1a' }}>
                            {item.pieces?.title || 'Unknown'}
                          </span>
                          {item.pieces?.composer && <span style={{ color: '#888', fontSize: '13px', marginLeft: '6px' }}>— {item.pieces.composer}</span>}
                          {item.focus_notes && <p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{item.focus_notes}</p>}
                        </div>
                        <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '16px', padding: '4px' }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
