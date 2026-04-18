'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'
import { logActivity } from '@/lib/logActivity'
import { useOfflineData } from '@/lib/useOfflineData'
import { queueMutation, getPendingCount } from '@/lib/syncManager'
import db from '@/lib/offlineStore'

export default function PieceDetail() {
  const { id } = useParams()
  const { activeProfile, isOwnProfile, canEdit } = useActiveProfile()
  const { isOnline, getCachedPieceDetail } = useOfflineData()
  const router = useRouter()
  const { user, loading: userLoading } = useCurrentUser()
  const { addToast } = useToast()
  const fileInputRef = useRef(null)

  const [piece, setPiece] = useState(null)
  const [images, setImages] = useState([])
  const [notes, setNotes] = useState([])
  const [facts, setFacts] = useState([])
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState('practice')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [factLoading, setFactLoading] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [goals, setGoals] = useState([])
  const [newGoalText, setNewGoalText] = useState('')
  const [tempoLog, setTempoLog] = useState([])
  const [deletingNoteId, setDeletingNoteId] = useState(null)
  const [editingFocusOnDetail, setEditingFocusOnDetail] = useState(false)
  const [focusDetailDraft, setFocusDetailDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // Load cached data immediately (just needs id, no user/profile needed)
  useEffect(() => {
    if (!id) return
    loadCachedData()
  }, [id])

  // Refresh from network when user/profile are available
  useEffect(() => {
    if (userLoading || !user || !activeProfile || !id) return
    refreshFromNetwork()
  }, [userLoading, user, id, activeProfile])

  async function loadCachedData() {
    try {
      const cached = await getCachedPieceDetail(id)
      if (cached?.piece) {
        setPiece(cached.piece); setForm(cached.piece)
        setImages(cached.images || [])
        setNotes(cached.notes || [])
        setFacts(cached.facts || [])
        setCategories(cached.categories || [])
        setGoals(cached.goals || [])
        setTempoLog(cached.tempoLog || [])
      }
    } catch (err) {
      console.error('Cache read failed:', err)
    }
    setLoading(false)
  }

  async function refreshFromNetwork() {
    if (!isOnline) return
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      if (isOwnProfile) {
        const dataPromise = Promise.all([
          supabase.from('pieces').select('*, categories(name)').eq('id', id).single(),
          supabase.from('piece_images').select('*').eq('piece_id', id).order('created_at'),
          supabase.from('piece_notes').select('*').eq('piece_id', id).order('created_at', { ascending: false }),
          supabase.from('interesting_facts').select('*').eq('piece_id', id).order('created_at', { ascending: false }),
          supabase.from('categories').select('*').or(`user_id.eq.${user.email},user_id.is.null`).order('sort_order'),
          supabase.from('piece_goals').select('*').eq('piece_id', id).order('sort_order'),
          supabase.from('tempo_log').select('*').eq('piece_id', id).order('created_at', { ascending: false }),
        ])
        const [pieceRes, imagesRes, notesRes, factsRes, catsRes, goalsRes, tempoRes] = await Promise.race([dataPromise, timeoutPromise])
        if (pieceRes.data) { setPiece(pieceRes.data); setForm(pieceRes.data) }
        setImages(imagesRes.data || [])
        setNotes(notesRes.data || [])
        setFacts(factsRes.data || [])
        setCategories(catsRes.data || [])
        setGoals(goalsRes.data || [])
        setTempoLog(tempoRes.data || [])
      } else {
        const res = await Promise.race([
          fetch(`/api/profile/${encodeURIComponent(activeProfile)}/piece/${id}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
          timeoutPromise
        ])
        if (res.piece) { setPiece(res.piece); setForm(res.piece) }
        setImages(res.images || [])
        setNotes(res.notes || [])
        setFacts(res.facts || [])
        setCategories(res.categories || [])
        setGoals(res.goals || [])
        setTempoLog(res.tempoLog || [])
      }
    } catch {}
  }

  // Called after edits to reload data
  async function loadPiece() {
    await loadCachedData()
    await refreshFromNetwork()
  }

  async function handleSave() {
    setSaving(true)
    const fields = {
      title: form.title, composer: form.composer, book_title: form.book_title,
      book_editor: form.book_editor, key_signature: form.key_signature,
      time_signature: form.time_signature, tempo_marking: form.tempo_marking,
      period: form.period,
      metronome_marking: form.metronome_marking, areas_of_focus: form.areas_of_focus,
      goals: form.goals, category_id: form.category_id || null, ai_summary: form.ai_summary,
      personal_rating: form.personal_rating ? parseFloat(form.personal_rating) : null,
      composer_bio: form.composer_bio || null,
    }

    // Include old metronome marking so API can detect changes for tempo logging
    const oldMetronome = piece.metronome_marking

    if (!isOnline) {
      await queueMutation({ url: pieceApiBase, method: 'POST', body: { action: 'update', fields, oldMetronome }, description: `Update ${form.title}` })
      try { await db.pieces.update(id, fields) } catch {}
      setPiece(prev => ({ ...prev, ...fields }))
      addToast('Changes saved offline — will sync later', 'info')
      setEditing(false)
      setSaving(false)
      return
    }

    let error
    try {
      if (isOwnProfile) {
        const newBpm = form.metronome_marking
        if (newBpm && newBpm !== oldMetronome) {
          const bpmNum = parseInt(newBpm.replace(/[^\d]/g, ''))
          if (bpmNum > 0) await supabase.from('tempo_log').insert([{ piece_id: id, bpm: bpmNum }])
        }
        const res = await supabase.from('pieces').update(fields).eq('id', id)
        error = res.error
      } else {
        const res = await fetch(pieceApiBase, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', fields, oldMetronome })
        })
        const data = await res.json()
        if (data.error) error = { message: data.error }
      }
    } catch {
      await queueMutation({ url: pieceApiBase, method: 'POST', body: { action: 'update', fields, oldMetronome }, description: `Update ${form.title}` })
      try { await db.pieces.update(id, fields) } catch {}
      setPiece(prev => ({ ...prev, ...fields }))
      addToast('Changes saved offline — will sync later', 'info')
      setEditing(false)
      setSaving(false)
      return
    }

    if (error) {
      addToast('Failed to save: ' + error.message, 'error')
    } else {
      await logActivity({ action: 'edit_piece', piece_id: id, piece_title: form.title, details: 'Updated piece details', user_email: user.email })
      addToast('Changes saved!', 'success')
      setEditing(false)
      loadPiece()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (isOwnProfile) {
      await supabase.from('piece_notes').delete().eq('piece_id', id)
      await supabase.from('piece_images').delete().eq('piece_id', id)
      await supabase.from('interesting_facts').delete().eq('piece_id', id)
      await supabase.from('practice_schedule').delete().eq('piece_id', id)
      await supabase.from('pieces').delete().eq('id', id)
    } else {
      await fetch(`/api/profile/${encodeURIComponent(activeProfile)}/piece/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' })
      })
    }
    await logActivity({ action: 'delete_piece', piece_id: id, piece_title: piece.title, details: 'Deleted piece', user_email: user.email })
    addToast('Piece deleted', 'info')
    router.push('/pieces')
  }

  async function addNote() {
    if (!newNote.trim()) return
    const noteData = { piece_id: id, user_id: user?.email || activeProfile, note_type: noteType, note: newNote.trim() }
    const tempId = crypto.randomUUID()

    if (isOnline) {
      try {
        if (isOwnProfile) {
          const { error } = await supabase.from('piece_notes').insert([noteData])
          if (error) { addToast('Failed to add note', 'error'); return }
        } else {
          const res = await fetch(pieceApiBase, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add_note', note_type: noteType, note: newNote.trim() })
          })
          const data = await res.json()
          if (data.error) { addToast('Failed to add note', 'error'); return }
        }
        await logActivity({ action: 'add_note', piece_id: id, piece_title: piece.title, details: `Added ${noteType} note`, user_email: user.email })
      } catch {
        // Network failed — queue it
        await queueOfflineNote(noteData, tempId)
        addToast('Note saved offline — will sync later', 'info')
        return
      }
    } else {
      // Offline — queue and show locally
      await queueOfflineNote(noteData, tempId)
      addToast('Note saved offline — will sync later', 'info')
      return
    }
    setNewNote('')
    addToast('Note added!', 'success')
    loadPiece()
  }

  async function queueOfflineNote(noteData, tempId) {
    // Save to local IndexedDB for immediate display
    try {
      await db.pieceNotes.put({ ...noteData, id: tempId, created_at: new Date().toISOString() })
    } catch {}
    // Queue for sync
    const apiUrl = isOwnProfile
      ? '/api/activity' // We'll use a generic mutation endpoint
      : pieceApiBase
    await queueMutation({
      url: pieceApiBase,
      method: 'POST',
      body: { action: 'add_note', note_type: noteData.note_type, note: noteData.note },
      description: `Add ${noteData.note_type} note to ${piece?.title || 'piece'}`
    })
    // Update local state to show the note immediately
    setNotes(prev => [{ ...noteData, id: tempId, created_at: new Date().toISOString() }, ...prev])
    setNewNote('')
  }

  const pieceApiBase = `/api/profile/${encodeURIComponent(activeProfile)}/piece/${id}`

  async function updateNote(noteId) {
    if (!editingNoteText.trim()) return
    if (isOwnProfile) {
      const { error } = await supabase.from('piece_notes').update({ note: editingNoteText.trim() }).eq('id', noteId)
      if (error) { addToast('Failed to update note', 'error'); return }
    } else {
      await fetch(pieceApiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_note', noteId, note: editingNoteText.trim() }) })
    }
    setEditingNoteId(null)
    setEditingNoteText('')
    addToast('Note updated!', 'success')
    loadPiece()
  }

  async function deleteNote(noteId) {
    if (isOwnProfile) {
      await supabase.from('piece_notes').delete().eq('id', noteId)
    } else {
      await fetch(pieceApiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_note', noteId }) })
    }
    setDeletingNoteId(null)
    addToast('Note deleted', 'info')
    loadPiece()
  }

  async function addGoal() {
    if (!newGoalText.trim()) return
    const tempId = crypto.randomUUID()
    const goalData = { id: tempId, piece_id: id, text: newGoalText.trim(), completed: false, sort_order: goals.length, created_at: new Date().toISOString() }

    if (!isOnline) {
      await queueMutation({ url: pieceApiBase, method: 'POST', body: { action: 'add_goal', text: newGoalText.trim(), sort_order: goals.length }, description: `Add goal to ${piece?.title}` })
      try { await db.pieceGoals.put(goalData) } catch {}
      setGoals(prev => [...prev, goalData])
      setNewGoalText('')
      addToast('Goal saved offline', 'info')
      return
    }

    try {
      if (isOwnProfile) {
        const { data, error } = await supabase.from('piece_goals').insert([{
          piece_id: id, text: newGoalText.trim(), sort_order: goals.length
        }]).select().single()
        if (error) { addToast('Failed to add goal', 'error'); return }
        setGoals(prev => [...prev, data])
      } else {
        const res = await fetch(pieceApiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_goal', text: newGoalText.trim(), sort_order: goals.length }) })
        const data = await res.json()
        if (data.goal) setGoals(prev => [...prev, data.goal])
      }
    } catch {
      await queueMutation({ url: pieceApiBase, method: 'POST', body: { action: 'add_goal', text: newGoalText.trim(), sort_order: goals.length }, description: `Add goal` })
      setGoals(prev => [...prev, goalData])
      addToast('Goal saved offline', 'info')
    }
    setNewGoalText('')
  }

  async function toggleGoal(goalId, completed) {
    // Update locally immediately
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, completed: !completed } : g))

    if (!isOnline) {
      await queueMutation({ url: pieceApiBase, method: 'POST', body: { action: 'toggle_goal', goalId, completed: !completed }, description: 'Toggle goal' })
      return
    }

    try {
      if (isOwnProfile) {
        await supabase.from('piece_goals').update({ completed: !completed }).eq('id', goalId)
      } else {
        await fetch(pieceApiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle_goal', goalId, completed: !completed }) })
      }
    } catch {
      await queueMutation({ url: pieceApiBase, method: 'POST', body: { action: 'toggle_goal', goalId, completed: !completed }, description: 'Toggle goal' })
    }
  }

  async function deleteGoal(goalId) {
    setGoals(prev => prev.filter(g => g.id !== goalId))

    if (!isOnline) {
      await queueMutation({ url: pieceApiBase, method: 'POST', body: { action: 'delete_goal', goalId }, description: 'Delete goal' })
      return
    }

    try {
      if (isOwnProfile) {
        await supabase.from('piece_goals').delete().eq('id', goalId)
      } else {
        await fetch(pieceApiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_goal', goalId }) })
      }
    } catch {
      await queueMutation({ url: pieceApiBase, method: 'POST', body: { action: 'delete_goal', goalId }, description: 'Delete goal' })
    }
  }

  function exportPiece() {
    const w = window.open('', '_blank')
    const html = `<!DOCTYPE html><html><head><title>${piece.title || 'Piece'} - Piano Experience</title>
      <style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:700px;margin:0 auto;color:#1a1a1a}
      h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;color:#2563eb;margin:24px 0 12px;border-bottom:1px solid #dbeafe;padding-bottom:6px}
      .meta{color:#666;font-size:14px}.field{margin-bottom:8px}.label{font-size:12px;color:#999}.value{font-size:14px}
      .note{padding:8px 12px;background:#f9fafb;border-radius:6px;margin-bottom:6px;font-size:14px;border-left:3px solid #2563eb}
      .note-meta{font-size:12px;color:#999;margin-bottom:4px}ul{padding-left:20px}li{margin-bottom:4px;font-size:14px}
      .fact{padding:8px;background:#eff6ff;border-radius:6px;margin-bottom:6px;font-size:14px}
      .no-print{} @media print{.no-print{display:none!important}}</style></head><body>
      <div class="no-print" style="margin-bottom:16px;display:flex;gap:12px">
        <button onclick="window.print()" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Print</button>
        <button onclick="window.close();if(!window.closed)history.back()" style="padding:10px 20px;background:#f9fafb;color:#666;border:1px solid #d1d5db;border-radius:8px;font-size:14px;cursor:pointer">← Back to App</button>
      </div>
      <h1>${piece.title || 'Untitled'}</h1>
      ${piece.composer ? `<p class="meta">${piece.composer}</p>` : ''}
      ${piece.categories?.name ? `<p class="meta">${piece.categories.name}</p>` : ''}
      <h2>Details</h2>
      ${['Book', 'Editor', 'Key', 'Time', 'Tempo', 'Metronome', 'Period', 'Personal Rating'].map((label, i) => {
        const fields = [piece.book_title, piece.book_editor, piece.key_signature, piece.time_signature, piece.tempo_marking, piece.metronome_marking, piece.period, piece.personal_rating ? `${piece.personal_rating}/10` : null]
        return fields[i] ? `<div class="field"><span class="label">${label}:</span> <span class="value">${fields[i]}</span></div>` : ''
      }).join('')}
      ${piece.ai_summary ? `<h2>AI Summary</h2><p style="font-size:14px;line-height:1.6">${piece.ai_summary}</p>` : ''}
      ${piece.composer_bio ? `<h2>About ${piece.composer}</h2><p style="font-size:14px;line-height:1.6">${piece.composer_bio}</p>` : ''}
      ${goals.length > 0 ? `<h2>Goals</h2><ul>${goals.map(g => `<li>${g.completed ? '✓ ' : '☐ '}${g.text}</li>`).join('')}</ul>` : ''}
      ${piece.areas_of_focus ? `<h2>Areas of Focus</h2><p style="font-size:14px">${piece.areas_of_focus}</p>` : ''}
      ${notes.length > 0 ? `<h2>Notes</h2>${notes.map(n => `<div class="note"><div class="note-meta">${n.note_type} — ${new Date(n.created_at).toLocaleDateString()}</div>${n.note}</div>`).join('')}` : ''}
      ${facts.length > 0 ? `<h2>Interesting Facts</h2>${facts.map(f => `<div class="fact">${f.fact}</div>`).join('')}` : ''}
      <p style="margin-top:32px;font-size:12px;color:#999">Exported from Piano Experience — ${new Date().toLocaleDateString()}</p>
      </body></html>`
    w.document.write(html)
    w.document.close()
    w.print()
  }

  async function requestFact() {
    if (!isOnline) { addToast('AI features require an internet connection', 'error'); return }
    setFactLoading(true)
    try {
      const res = await fetch('/api/interesting-fact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pieceId: id, title: piece.title, composer: piece.composer,
          bookTitle: piece.book_title, bookEditor: piece.book_editor, period: piece.period,
          existingFacts: facts.map(f => f.fact),
          aiSummary: piece.ai_summary,
          composerBio: piece.composer_bio
        })
      })
      const data = await res.json()
      if (data.fact) {
        setFacts(prev => [{ id: Date.now(), fact: data.fact, created_at: new Date().toISOString() }, ...prev])
        addToast('New fact discovered!', 'success')
      }
    } catch {
      addToast('Failed to get fact', 'error')
    }
    setFactLoading(false)
  }

  async function generateBio() {
    if (!isOnline) { addToast('AI features require an internet connection', 'error'); return }
    if (!piece.composer) return
    setBioLoading(true)
    try {
      const res = await fetch('/api/composer-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceId: id, composer: piece.composer, aiSummary: piece.ai_summary })
      })
      const data = await res.json()
      if (data.bio) {
        setPiece(prev => ({ ...prev, composer_bio: data.bio }))
        addToast('Composer bio generated!', 'success')
      }
    } catch {
      addToast('Failed to generate bio', 'error')
    }
    setBioLoading(false)
  }



  async function handleImageUpload(e, imageType) {
    if (!isOnline) { addToast('Image uploads require an internet connection', 'error'); return }
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('piece_id', id)
    formData.append('image_type', imageType)
    const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
    if (res.ok) {
      addToast('Image uploaded!', 'success')
      loadPiece()
    } else {
      addToast('Upload failed', 'error')
    }
  }

  if (loading || userLoading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading{!isOnline ? ' (offline)' : ''}...</div>
  if (!piece) return <div style={{ padding: '24px', textAlign: 'center' }}>Piece not found. <Link href="/pieces">Back to pieces</Link></div>

  const noteTypeColors = { practice: '#059669', lesson: '#2563eb', general: '#2563eb' }

  return (
    <main style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', paddingBottom: editing ? '100px' : '24px' }}>
      <Link href="/pieces" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← My Pieces</Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '16px 0 24px' }}>
        <div>
          <h1 style={{ fontSize: '26px' }}>{piece.title || 'Untitled'}</h1>
          {piece.composer && <p style={{ fontSize: '16px', color: '#666', marginTop: '4px' }}>{piece.composer}</p>}
          {piece.categories?.name && (
            <span style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', padding: '4px 12px', background: '#dbeafe', color: '#2563eb', borderRadius: '12px', fontWeight: '500' }}>
              {piece.categories.name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportPiece} style={{ padding: '8px 16px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }} className="no-print">
            Export
          </button>
          {canEdit && (
            !editing ? (
              <button onClick={() => setEditing(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Edit
              </button>
            ) : (
              <>
                <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setEditing(false); setForm(piece) }} style={{ padding: '8px 16px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', overflowX: 'auto' }}>
          {images.map(img => (
            <div key={img.id} style={{ flexShrink: 0, cursor: 'zoom-in' }} onClick={() => setLightboxUrl(img.image_url)}>
              <img src={img.image_url} alt={img.image_type} style={{ height: '200px', borderRadius: '10px', border: '1px solid #e5e7eb' }} />
              <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', marginTop: '4px' }}>{img.image_type.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Upload more images */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['first_page', 'full_piece', 'book_cover'].map(type => (
          <label key={type} style={{ padding: '8px 14px', background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#666' }}>
            📷 Upload {type.replace('_', ' ')}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e, type)} />
          </label>
        ))}
      </div>

      {/* Details */}
      {editing ? (
        <EditForm form={form} setForm={setForm} categories={categories} />
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Details</h2>
          <DetailGrid piece={piece} />
          {piece.ai_summary && (
            <div style={{ background: '#dbeafe', borderRadius: '10px', padding: '14px', marginTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#2563eb' }}>AI Summary</span>
              <p style={{ fontSize: '14px', marginTop: '6px', lineHeight: '1.5' }}>{piece.ai_summary}</p>
            </div>
          )}
        </div>
      )}

      {/* About the Composer */}
      {piece.composer && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', color: '#2563eb' }}>About {piece.composer}</h2>
            {!piece.composer_bio && (
              <button onClick={generateBio} disabled={bioLoading} style={{
                padding: '8px 16px', background: '#dbeafe', color: '#2563eb', border: 'none',
                borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
              }}>
                {bioLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Generating...
                  </span>
                ) : 'Generate Bio'}
              </button>
            )}
          </div>
          {piece.composer_bio ? (
            <div style={{ background: '#dbeafe', borderRadius: '10px', padding: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#2563eb' }}>AI Composer Bio</span>
              <p style={{ fontSize: '14px', marginTop: '6px', lineHeight: '1.5' }}>{piece.composer_bio}</p>
            </div>
          ) : (
            <p style={{ fontSize: '14px', color: '#999' }}>Click "Generate Bio" to learn about this composer.</p>
          )}
        </div>
      )}

      {/* Interesting Facts */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', color: '#2563eb' }}>Interesting Facts</h2>
          <button onClick={requestFact} disabled={factLoading} style={{
            padding: '8px 16px', background: '#dbeafe', color: '#2563eb', border: 'none',
            borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
          }}>
            {factLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Thinking...
              </span>
            ) : 'Tell me something interesting'}
          </button>
        </div>
        {facts.length === 0 ? (
          <p style={{ color: '#666', fontSize: '14px' }}>No facts yet. Click the button to discover something!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {facts.map(f => (
              <div key={f.id} style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', fontSize: '14px', lineHeight: '1.5' }}>
                {f.fact}
                <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>{new Date(f.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Notes</h2>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {['practice', 'lesson', 'general'].map(t => (
            <button key={t} onClick={() => setNoteType(t)} style={{
              padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              background: noteType === t ? noteTypeColors[t] : '#f9fafb',
              color: noteType === t ? '#fff' : '#666',
              border: noteType === t ? 'none' : '1px solid #d1d5db',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder={`Add a ${noteType} note...`}
            rows={2} style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
          <button onClick={addNote} style={{ padding: '10px 18px', background: noteTypeColors[noteType], color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', alignSelf: 'flex-end' }}>
            Add
          </button>
        </div>

        {notes.length === 0 ? (
          <p style={{ color: '#666', fontSize: '14px' }}>No notes yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notes.map(n => (
              <div key={n.id} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', borderLeft: `3px solid ${noteTypeColors[n.note_type] || '#999'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: noteTypeColors[n.note_type] || '#666', textTransform: 'capitalize' }}>{n.note_type}</span>
                    {!isOwnProfile && n.user_id && (
                      <span style={{ fontSize: '11px', color: '#999', background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}>
                        {n.user_id === user?.email ? 'You' : n.user_id.split('@')[0]}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#999' }}>{new Date(n.created_at).toLocaleString()}</span>
                    {canEdit && editingNoteId !== n.id && deletingNoteId !== n.id && (
                      <>
                        <button onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.note) }}
                          style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                          Edit
                        </button>
                        <button onClick={() => setDeletingNoteId(n.id)}
                          style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {deletingNoteId === n.id && (
                  <div style={{ background: '#fef2f2', borderRadius: '6px', padding: '8px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#991b1b' }}>Delete this note?</span>
                    <button onClick={() => deleteNote(n.id)}
                      style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Yes</button>
                    <button onClick={() => setDeletingNoteId(null)}
                      style={{ padding: '4px 10px', background: '#fff', color: '#666', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>No</button>
                  </div>
                )}
                {editingNoteId === n.id ? (
                  <div>
                    <textarea value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)} rows={3}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', marginBottom: '8px' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => updateNote(n.id)} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingNoteId(null)} style={{ padding: '6px 14px', background: '#fff', color: '#666', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{n.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Focus Area */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', margin: '0 0 12px' }}>Current Focus Area</h2>
        {editingFocusOnDetail ? (
          <div>
            <textarea value={focusDetailDraft} onChange={e => setFocusDetailDraft(e.target.value)}
              autoFocus rows={3} placeholder="What are you focusing on with this piece?"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #93c5fd', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={async () => {
                if (isOwnProfile) {
                  await supabase.from('pieces').update({ current_focus: focusDetailDraft }).eq('id', id)
                } else {
                  await fetch(pieceApiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_field', field: 'current_focus', value: focusDetailDraft }) })
                }
                setPiece(prev => ({ ...prev, current_focus: focusDetailDraft }))
                setEditingFocusOnDetail(false)
                addToast('Focus updated!', 'success')
              }} style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingFocusOnDetail(false)} style={{ padding: '8px 14px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div onClick={() => { if (canEdit) { setEditingFocusOnDetail(true); setFocusDetailDraft(piece.current_focus || '') } }}
            style={{
              padding: '12px', borderRadius: '8px', fontSize: '15px', lineHeight: '1.5',
              border: canEdit ? '1px dashed #93c5fd' : '1px solid #e5e7eb',
              background: canEdit ? '#f8faff' : '#f9fafb',
              color: piece.current_focus ? '#374151' : '#999',
              cursor: canEdit ? 'pointer' : 'default',
            }}>
            {piece.current_focus || (canEdit ? '✏️ Tap to set a focus area for this piece' : 'No focus area set')}
          </div>
        )}
      </div>

      {/* Goals Checklist */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Goals</h2>
        {goals.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: canEdit ? '12px' : '0' }}>
            {goals.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                {canEdit ? (
                  <button onClick={() => toggleGoal(g.id, g.completed)} style={{
                    width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${g.completed ? '#059669' : '#d1d5db'}`,
                    background: g.completed ? '#059669' : '#fff', color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', fontSize: '11px', flexShrink: 0
                  }}>{g.completed && '✓'}</button>
                ) : (
                  <span style={{ fontSize: '14px' }}>{g.completed ? '✓' : '☐'}</span>
                )}
                <span style={{ flex: 1, fontSize: '14px', textDecoration: g.completed ? 'line-through' : 'none', color: g.completed ? '#059669' : '#1a1a1a' }}>{g.text}</span>
                {canEdit && (
                  <button onClick={() => deleteGoal(g.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '16px' }}>×</button>
                )}
              </div>
            ))}
          </div>
        )}
        {goals.length === 0 && <p style={{ fontSize: '14px', color: '#999', marginBottom: canEdit ? '12px' : '0' }}>No goals set yet.</p>}
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={newGoalText} onChange={e => setNewGoalText(e.target.value)} placeholder="Add a goal..."
              onKeyDown={e => e.key === 'Enter' && addGoal()}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
            <button onClick={addGoal} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>Add</button>
          </div>
        )}
      </div>

      {/* Tempo Progress */}
      {(tempoLog.length > 0 || piece.metronome_marking) && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Tempo Progress</h2>
          {tempoLog.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {tempoLog.slice().reverse().map((t, i) => (
                  <div key={t.id} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: i === tempoLog.length - 1 ? '#2563eb' : '#666' }}>{t.bpm}</div>
                    <div style={{ fontSize: '11px', color: '#999' }}>{new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
              {tempoLog.length >= 2 && (
                <div style={{ fontSize: '13px', color: '#059669', marginTop: '8px' }}>
                  {tempoLog[0].bpm > tempoLog[tempoLog.length - 1].bpm
                    ? `+${tempoLog[0].bpm - tempoLog[tempoLog.length - 1].bpm} BPM improvement`
                    : tempoLog[0].bpm < tempoLog[tempoLog.length - 1].bpm
                    ? `${tempoLog[tempoLog.length - 1].bpm - tempoLog[0].bpm} BPM decrease`
                    : 'Same tempo'}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '14px', color: '#666' }}>
              <span style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>{piece.metronome_marking}</span>
              <span style={{ marginLeft: '8px' }}>BPM (current)</span>
              <p style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>Edit the piece and change the metronome marking to start tracking tempo progress over time.</p>
            </div>
          )}
        </div>
      )}

      {/* Archive & Delete — only for edit access */}
      {canEdit && <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <button onClick={async () => {
            const newArchived = !piece.archived
            let success = false
            if (isOwnProfile) {
              const res = await supabase.from('pieces').update({ archived: newArchived }).eq('id', id)
              success = !res.error
            } else {
              const res = await fetch(pieceApiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_field', field: 'archived', value: newArchived }) })
              const data = await res.json()
              success = !data.error
            }
            if (!success) { addToast('Failed to update', 'error'); return }
            setPiece(prev => ({ ...prev, archived: newArchived }))
            addToast(newArchived ? 'Piece archived' : 'Piece restored', 'success')
          }} style={{ padding: '10px 20px', background: piece.archived ? '#dbeafe' : '#f9fafb', color: piece.archived ? '#2563eb' : '#666', border: `1px solid ${piece.archived ? '#93c5fd' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
            {piece.archived ? 'Restore from Archive' : 'Archive This Piece'}
          </button>
        </div>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ padding: '10px 20px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
            Delete Permanently
          </button>
        ) : (
          <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: '#991b1b' }}>Are you sure? This cannot be undone.</span>
            <button onClick={handleDelete} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
              Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ padding: '8px 16px', background: '#fff', color: '#666', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}
      </div>}

      {/* Image lightbox */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Full size" />
        </div>
      )}

      {/* Sticky footer when editing */}
      {editing && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e5e7eb',
          padding: '12px 24px', display: 'flex', gap: '12px',
          justifyContent: 'center', zIndex: 9999,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, maxWidth: '400px', padding: '14px', background: '#059669', color: '#fff', border: 'none',
            borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer'
          }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={() => { setEditing(false); setForm(piece) }} style={{
            padding: '14px 24px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
            borderRadius: '10px', fontSize: '14px', cursor: 'pointer'
          }}>
            Cancel
          </button>
        </div>
      )}
    </main>
  )
}

function DetailGrid({ piece }) {
  const fields = [
    ['Book', piece.book_title], ['Editor', piece.book_editor],
    ['Key', piece.key_signature], ['Time', piece.time_signature],
    ['Tempo', piece.tempo_marking], ['Metronome', piece.metronome_marking],
    ['Period', piece.period],
    ['Personal Rating', piece.personal_rating ? `${piece.personal_rating}/10` : 'Not rated'],
  ].filter(([label, v]) => v || label === 'Personal Rating')

  return (
    <div>
      {fields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          {fields.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {piece.areas_of_focus && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Areas of Focus</div>
          <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{piece.areas_of_focus}</p>
        </div>
      )}
      {piece.goals && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Goals</div>
          <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{piece.goals}</p>
        </div>
      )}
    </div>
  )
}

function EditForm({ form, setForm, categories }) {
  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
      <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Edit Details</h2>
      {[
        ['Title', 'title'], ['Composer', 'composer'], ['Book Title', 'book_title'], ['Book Editor', 'book_editor'],
        ['Key Signature', 'key_signature'], ['Time Signature', 'time_signature'],
        ['Tempo Marking', 'tempo_marking'], ['Metronome', 'metronome_marking'],
        ['Period', 'period'],
      ].map(([label, field]) => (
        <div key={field} style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>{label}</label>
          <input value={form[field] || ''} onChange={e => update(field, e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
        </div>
      ))}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>Category</label>
        <select value={form.category_id || ''} onChange={e => update('category_id', e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
          <option value="">None</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>Personal Rating (1-10)</label>
        <select value={form.personal_rating || ''} onChange={e => update('personal_rating', e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
          <option value="">Not rated</option>
          {[1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].map(v => (
            <option key={v} value={v}>{v}{v === 1 ? " — don't care for it" : v === 5 ? " — it's okay" : v === 10 ? ' — love it!' : ''}</option>
          ))}
        </select>
      </div>
      {['areas_of_focus', 'goals'].map(field => (
        <div key={field} style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>{field.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
          <textarea value={form[field] || ''} onChange={e => update(field, e.target.value)} rows={3}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
        </div>
      ))}
      {form.ai_summary && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>AI Summary</label>
          <textarea value={form.ai_summary || ''} onChange={e => update('ai_summary', e.target.value)} rows={4}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #93c5fd', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: '#eff6ff' }} />
        </div>
      )}
      {form.composer_bio && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>Composer Bio</label>
          <textarea value={form.composer_bio || ''} onChange={e => update('composer_bio', e.target.value)} rows={4}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #93c5fd', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: '#eff6ff' }} />
        </div>
      )}
    </div>
  )
}
