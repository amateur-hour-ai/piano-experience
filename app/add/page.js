'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'
import { logActivity } from '@/lib/logActivity'

export default function AddPiece() {
  const router = useRouter()
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit } = useActiveProfile()
  const { addToast } = useToast()
  const fileInputRef = useRef(null)
  const coverInputRef = useRef(null)

  const [categories, setCategories] = useState([])
  const [mode, setMode] = useState(null) // 'photo' or 'manual'
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [awaitingCover, setAwaitingCover] = useState(false) // true after first photo, before analyze
  const [newCategoryName, setNewCategoryName] = useState('')
  const [enriching, setEnriching] = useState(false)

  const [form, setForm] = useState({
    title: '', composer: '', book_title: '', book_editor: '',
    key_signature: '', time_signature: '', tempo_marking: '',
    period: '', ai_summary: '',
    metronome_marking: '', areas_of_focus: '', goals: '', personal_rating: '',
    category_id: '',
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (userLoading || !user) return
    supabase.from('categories').select('*').or(`user_id.eq.${user.email},user_id.is.null`).order('sort_order').then(({ data }) => {
      setCategories(data || [])
    })
  }, [userLoading, user])

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function resizeImage(file, maxDim = 1200) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve(dataUrl.split(',')[1])
      }
      img.src = URL.createObjectURL(file)
    })
  }

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError('')
    setAwaitingCover(true)
  }

  function handleCoverPhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function runAnalysis() {
    setAwaitingCover(false)
    setAnalyzing(true)

    try {
      const images = []
      const base64 = await resizeImage(photoFile)
      images.push({ base64, mediaType: 'image/jpeg', label: 'sheet music' })

      if (coverFile) {
        const coverBase64 = await resizeImage(coverFile)
        images.push({ base64: coverBase64, mediaType: 'image/jpeg', label: 'book cover' })
      }

      const res = await fetch('/api/analyze-piece', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      })
      const data = await res.json()
      if (data.analysis) {
        const a = data.analysis
        setForm(prev => ({
          ...prev,
          title: a.title || prev.title,
          composer: a.composer || prev.composer,
          book_title: a.book_title || prev.book_title,
          book_editor: a.book_editor || prev.book_editor,
          time_signature: a.time_signature || prev.time_signature,
          tempo_marking: a.tempo_marking || prev.tempo_marking,
          period: a.period || prev.period,
          ai_summary: a.ai_summary || prev.ai_summary,
        }))
        addToast('AI analysis complete!', 'success')
      } else {
        setError('AI could not analyze the image. Fill in details manually.')
      }
      setAnalyzing(false)
    } catch {
      setError('Failed to analyze photo.')
      setAnalyzing(false)
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    const { data, error } = await supabase.from('categories').insert([{
      name: newCategoryName.trim(),
      user_id: isOwnProfile ? user.email : activeProfile,
      sort_order: categories.length
    }]).select().single()
    if (error) {
      setError('Failed to create category: ' + error.message)
      return
    }
    setCategories(prev => [...prev, data])
    updateForm('category_id', data.id)
    setNewCategoryName('')
    addToast('Category created!', 'success')
  }

  async function enrichWithAI() {
    if (!navigator.onLine) {
      setError('AI features require an internet connection. You can still save the piece manually and ask AI to fill in details later.')
      return
    }
    if (!form.title && !form.composer) {
      setError('Enter at least a title or composer before asking AI to help.')
      return
    }
    setEnriching(true)
    setError('')
    try {
      const res = await fetch('/api/enrich-piece', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          composer: form.composer,
          bookTitle: form.book_title,
          bookEditor: form.book_editor,
        })
      })
      const data = await res.json()
      if (data.analysis) {
        const a = data.analysis
        setForm(prev => ({
          ...prev,
          title: a.title || prev.title,
          composer: a.composer || prev.composer,
          book_title: a.book_title || prev.book_title,
          book_editor: a.book_editor || prev.book_editor,
          time_signature: a.time_signature || prev.time_signature,
          tempo_marking: a.tempo_marking || prev.tempo_marking,
          period: a.period || prev.period,
          ai_summary: a.ai_summary || prev.ai_summary,
        }))
        addToast('AI filled in details!', 'success')
      } else {
        setError(data.error || 'AI could not find information about this piece.')
      }
    } catch {
      setError('Failed to reach AI. Check your connection.')
    }
    setEnriching(false)
  }

  async function handleSave() {
    if (!form.title?.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const pieceData = {
        title: form.title.trim(),
        composer: form.composer || null,
        book_title: form.book_title || null,
        book_editor: form.book_editor || null,
        key_signature: form.key_signature || null,
        time_signature: form.time_signature || null,
        tempo_marking: form.tempo_marking || null,
        period: form.period || null,
        ai_summary: form.ai_summary || null,
        metronome_marking: form.metronome_marking || null,
        areas_of_focus: form.areas_of_focus || null,
        goals: form.goals || null,
        category_id: form.category_id || null,
        personal_rating: form.personal_rating ? parseFloat(form.personal_rating) : null,
      }

      let piece
      if (isOwnProfile) {
        const { data, error: insertError } = await supabase.from('pieces').insert([{
          ...pieceData, user_id: user.email,
        }]).select().single()
        if (insertError) throw insertError
        piece = data
      } else {
        const res = await fetch(`/api/profile/${encodeURIComponent(activeProfile)}/pieces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pieceData)
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        piece = data.piece
      }

      // Upload photos if taken
      if (photoFile) {
        const formData = new FormData()
        formData.append('file', photoFile)
        formData.append('piece_id', piece.id)
        formData.append('image_type', 'first_page')
        await fetch('/api/upload-image', { method: 'POST', body: formData })
      }
      if (coverFile) {
        const coverFormData = new FormData()
        coverFormData.append('file', coverFile)
        coverFormData.append('piece_id', piece.id)
        coverFormData.append('image_type', 'book_cover')
        await fetch('/api/upload-image', { method: 'POST', body: coverFormData })
      }

      // Auto-generate composer bio in background (don't block navigation)
      if (form.composer) {
        fetch('/api/composer-bio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pieceId: piece.id, composer: form.composer, aiSummary: form.ai_summary })
        }).catch(() => {})
      }

      await logActivity({
        action: 'add_piece',
        piece_id: piece.id,
        piece_title: form.title,
        details: `Added new piece${form.composer ? ` by ${form.composer}` : ''}`,
        user_email: user.email
      })

      addToast('Piece saved!', 'success')
      router.push(`/piece/${piece.id}`)
    } catch (err) {
      setError('Failed to save: ' + err.message)
      setSaving(false)
    }
  }

  if (userLoading) return null
  if (!canEdit) return (
    <main style={{ padding: '24px', maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
      <p style={{ color: '#666', marginTop: '40px' }}>You don't have edit access to this profile.</p>
      <Link href="/" style={{ color: '#2563eb' }}>← Back to Dashboard</Link>
    </main>
  )

  return (
    <main style={{ padding: '24px', maxWidth: '700px', margin: '0 auto', paddingBottom: mode ? '100px' : '24px' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 24px' }}>Add New Piece</h1>

      {!mode && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
          <button onClick={() => setMode('photo')} style={{
            padding: '32px 20px', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '16px',
            cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📷</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>Take a Photo</div>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>AI will identify the piece</div>
          </button>
          <button onClick={() => setMode('manual')} style={{
            padding: '32px 20px', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '16px',
            cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✏️</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>Enter Manually</div>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>Type in the details yourself</div>
          </button>
        </div>
      )}

      {mode && (
        <div>
          {mode === 'photo' && (
            <div style={{ marginBottom: '24px' }}>
              {!photoPreview ? (
                <div>
                  <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handlePhoto} style={{ display: 'none' }} />
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    width: '100%', padding: '40px', background: '#f9fafb', border: '2px dashed #d1d5db',
                    borderRadius: '12px', cursor: 'pointer', fontSize: '16px', color: '#666'
                  }}>
                    📷 Take or upload a photo of the sheet music
                  </button>
                </div>
              ) : awaitingCover ? (
                <div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <img src={photoPreview} alt="Sheet music" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Sheet music</div>
                    </div>
                    {coverPreview && (
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <img src={coverPreview} alt="Book cover" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Book cover</div>
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#dbeafe', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '14px', color: '#1e40af', marginBottom: '12px', fontWeight: '500' }}>
                      Want to add a photo of the book cover? This helps AI identify the book, editor, and more context — especially useful for beginner pieces.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="file" accept="image/*" capture="environment" ref={coverInputRef} onChange={handleCoverPhoto} style={{ display: 'none' }} />
                      <button onClick={() => coverInputRef.current?.click()} style={{
                        padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none',
                        borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
                      }}>
                        {coverPreview ? '📷 Retake Cover Photo' : '📷 Add Book Cover'}
                      </button>
                      <button onClick={runAnalysis} style={{
                        padding: '10px 20px', background: '#fff', color: '#2563eb', border: '1px solid #2563eb',
                        borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
                      }}>
                        {coverPreview ? 'Analyze Both Photos' : 'Skip — Analyze Sheet Music Only'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '8px' }}>
                    <img src={photoPreview} alt="Sheet music" style={{ maxHeight: '200px', borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    {coverPreview && <img src={coverPreview} alt="Book cover" style={{ maxHeight: '200px', borderRadius: '12px', border: '1px solid #e5e7eb' }} />}
                  </div>
                  {analyzing && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#2563eb' }}>
                      <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      AI is analyzing {coverPreview ? 'both images' : 'the music'}...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#991b1b' }}>
              {error}
            </div>
          )}

          {/* Form Fields */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#2563eb' }}>Piece Details</h2>

            <FormField label="Title *" value={form.title} onChange={v => updateForm('title', v)} />
            <FormField label="Composer" value={form.composer} onChange={v => updateForm('composer', v)} />
            <FormField label="Book Title" value={form.book_title} onChange={v => updateForm('book_title', v)} />
            <FormField label="Book Editor" value={form.book_editor} onChange={v => updateForm('book_editor', v)} />

            {/* AI Enrich button — available in manual mode or after photo analysis */}
            {mode === 'manual' || (mode === 'photo' && !analyzing && !awaitingCover) ? (
              <button onClick={enrichWithAI} disabled={enriching || (!form.title && !form.composer)} style={{
                width: '100%', padding: '12px', marginBottom: '20px',
                background: enriching ? '#93c5fd' : '#dbeafe', color: '#1e40af',
                border: '1px solid #93c5fd', borderRadius: '10px',
                fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}>
                {enriching ? (
                  <>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #1e40af', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    AI is looking up this piece...
                  </>
                ) : 'Ask AI to fill in the rest'}
              </button>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <FormField label="Key Signature" value={form.key_signature} onChange={v => updateForm('key_signature', v)} />
              <FormField label="Time Signature" value={form.time_signature} onChange={v => updateForm('time_signature', v)} />
              <FormField label="Tempo Marking" value={form.tempo_marking} onChange={v => updateForm('tempo_marking', v)} />
              <FormField label="Metronome" value={form.metronome_marking} onChange={v => updateForm('metronome_marking', v)} placeholder="e.g. ♩= 120" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <FormField label="Period" value={form.period} onChange={v => updateForm('period', v)} placeholder="e.g. Baroque, Classical" />
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Personal Rating</label>
                <select value={form.personal_rating} onChange={e => updateForm('personal_rating', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                  <option value="">How much do you like this piece?</option>
                  {[1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].map(v => (
                    <option key={v} value={v}>{v}{v === 1 ? " — don't care for it" : v === 5 ? ' — it\'s okay' : v === 10 ? ' — love it!' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Category</label>
              <select value={form.category_id} onChange={e => updateForm('category_id', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff', marginBottom: '8px' }}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name..."
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px' }} />
                <button onClick={addCategory} style={{ padding: '8px 16px', background: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                  Add
                </button>
              </div>
            </div>

            <FormField label="Areas of Focus" value={form.areas_of_focus} onChange={v => updateForm('areas_of_focus', v)} multiline placeholder="e.g. Dynamics in measures 12-16, left hand crossing" />
            <FormField label="Goals" value={form.goals} onChange={v => updateForm('goals', v)} multiline placeholder="e.g. Memorize by end of month, perform at recital" />

            {form.ai_summary && (
              <div style={{ background: '#dbeafe', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#2563eb', marginBottom: '6px' }}>AI Summary</div>
                <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>{form.ai_summary}</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Sticky footer with Save/Cancel */}
      {mode && !awaitingCover && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e5e7eb',
          padding: '12px 24px', display: 'flex', gap: '12px',
          justifyContent: 'center', zIndex: 50,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}>
          <button onClick={handleSave} disabled={saving || analyzing} style={{
            flex: 1, maxWidth: '400px', padding: '14px', background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer'
          }}>
            {saving ? 'Saving...' : 'Save Piece'}
          </button>
          <button onClick={() => { setMode(null); setPhotoPreview(null); setPhotoFile(null); setCoverPreview(null); setCoverFile(null); setAwaitingCover(false); setError('') }} style={{
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

function FormField({ label, value, onChange, multiline, placeholder }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{label}</label>
      <Tag
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', resize: multiline ? 'vertical' : undefined }}
      />
    </div>
  )
}
