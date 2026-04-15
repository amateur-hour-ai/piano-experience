'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'

export default function ExperienceLog() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { addToast } = useToast()
  const [experiences, setExperiences] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ date: '', summary: '', feedback: '', assignments: '' })

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    loadExperiences()
  }, [userLoading, user, activeProfile])

  async function loadExperiences() {
    setLoading(true)
    const profileParam = isOwnProfile ? '' : `?profile=${encodeURIComponent(activeProfile)}`
    const res = await fetch(`/api/experiences${profileParam}`)
    const data = await res.json()
    setExperiences(data.experiences || [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ date: new Date().toISOString().split('T')[0], summary: '', feedback: '', assignments: '' })
  }

  async function saveExperience() {
    const action = editingId ? 'update' : 'add'
    const res = await fetch('/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action, ...form,
        ...(editingId ? { id: editingId } : {}),
        profileEmail: isOwnProfile ? undefined : activeProfile
      })
    })
    const data = await res.json()
    if (data.error) { addToast(data.error, 'error'); return }
    addToast(editingId ? 'Experience updated!' : 'Experience logged!', 'success')
    setAdding(false)
    setEditingId(null)
    loadExperiences()
  }

  async function deleteExperience(id) {
    const res = await fetch('/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id, profileEmail: isOwnProfile ? undefined : activeProfile })
    })
    const data = await res.json()
    if (data.error) { addToast('Failed to delete', 'error'); return }
    addToast('Experience removed', 'info')
    loadExperiences()
  }

  function startEdit(exp) {
    setForm({ date: exp.date, summary: exp.summary || '', feedback: exp.feedback || '', assignments: exp.assignments || '' })
    setEditingId(exp.id)
    setAdding(true)
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  return (
    <main style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', paddingBottom: adding ? '100px' : '24px' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px' }}>
        <h1 style={{ fontSize: '24px' }}>
          {isOwnProfile ? 'Piano Experience Log' : `${profileDisplayName(activeProfile)}'s Experience Log`}
        </h1>
        {canEdit && !adding && (
          <button onClick={() => { resetForm(); setAdding(true) }} style={{
            padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
          }}>
            + Log Experience
          </button>
        )}
      </div>

      {adding && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>{editingId ? 'Edit Experience' : 'New Experience'}</h2>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>What was covered</label>
            <textarea value={form.summary} onChange={e => setForm(prev => ({ ...prev, summary: e.target.value }))}
              rows={3} placeholder="What did you work on during this experience?"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Teacher Feedback</label>
            <textarea value={form.feedback} onChange={e => setForm(prev => ({ ...prev, feedback: e.target.value }))}
              rows={3} placeholder="What feedback did the teacher give?"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Assignments for Next Time</label>
            <textarea value={form.assignments} onChange={e => setForm(prev => ({ ...prev, assignments: e.target.value }))}
              rows={3} placeholder="What should you work on before the next experience?"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
          </div>
        </div>
      )}

      {/* Sticky footer for save */}
      {adding && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e5e7eb',
          padding: '12px 24px', display: 'flex', gap: '12px',
          justifyContent: 'center', zIndex: 50,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}>
          <button onClick={saveExperience} style={{
            flex: 1, maxWidth: '400px', padding: '14px', background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer'
          }}>
            {editingId ? 'Save Changes' : 'Log Experience'}
          </button>
          <button onClick={() => { setAdding(false); setEditingId(null) }} style={{
            padding: '14px 24px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
            borderRadius: '10px', fontSize: '14px', cursor: 'pointer'
          }}>
            Cancel
          </button>
        </div>
      )}

      {/* Experience list */}
      {experiences.length === 0 && !adding ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📝</div>
          <p>No experiences logged yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {experiences.map(exp => (
            <div key={exp.id} style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', color: '#2563eb', margin: 0 }}>
                  {new Date(exp.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => startEdit(exp)} style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
                    <button onClick={() => deleteExperience(exp.id)} style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Delete</button>
                  </div>
                )}
              </div>
              {exp.summary && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>What was covered</div>
                  <p style={{ fontSize: '14px', lineHeight: '1.6' }}>{exp.summary}</p>
                </div>
              )}
              {exp.feedback && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Teacher Feedback</div>
                  <p style={{ fontSize: '14px', lineHeight: '1.6' }}>{exp.feedback}</p>
                </div>
              )}
              {exp.assignments && (
                <div>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Assignments</div>
                  <p style={{ fontSize: '14px', lineHeight: '1.6' }}>{exp.assignments}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
