'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useToast } from '@/app/ToastProvider'
import { logActivity } from '@/lib/logActivity'

export default function AddPiece() {
  const router = useRouter()
  const { user, loading: userLoading } = useCurrentUser()
  const { addToast } = useToast()
  const fileInputRef = useRef(null)

  const [categories, setCategories] = useState([])
  const [mode, setMode] = useState(null) // 'photo' or 'manual'
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [form, setForm] = useState({
    title: '', composer: '', book_title: '', book_editor: '',
    key_signature: '', time_signature: '', tempo_marking: '',
    difficulty_level: '', period: '', ai_summary: '',
    metronome_marking: '', areas_of_focus: '', goals: '',
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

  async function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError('')
    setAnalyzing(true)

    try {
      const base64 = await resizeImage(file)
      const res = await fetch('/api/analyze-piece', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, imageMediaType: 'image/jpeg' })
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
          key_signature: a.key_signature || prev.key_signature,
          time_signature: a.time_signature || prev.time_signature,
          tempo_marking: a.tempo_marking || prev.tempo_marking,
          difficulty_level: a.difficulty_level || prev.difficulty_level,
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
      user_id: user.email,
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

  async function handleSave() {
    if (!form.title?.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const { data: piece, error: insertError } = await supabase.from('pieces').insert([{
        user_id: user.email,
        title: form.title.trim(),
        composer: form.composer || null,
        book_title: form.book_title || null,
        book_editor: form.book_editor || null,
        key_signature: form.key_signature || null,
        time_signature: form.time_signature || null,
        tempo_marking: form.tempo_marking || null,
        difficulty_level: form.difficulty_level || null,
        period: form.period || null,
        ai_summary: form.ai_summary || null,
        metronome_marking: form.metronome_marking || null,
        areas_of_focus: form.areas_of_focus || null,
        goals: form.goals || null,
        category_id: form.category_id || null,
      }]).select().single()

      if (insertError) throw insertError

      // Upload photo if one was taken
      if (photoFile) {
        const formData = new FormData()
        formData.append('file', photoFile)
        formData.append('piece_id', piece.id)
        formData.append('image_type', 'first_page')
        await fetch('/api/upload-image', { method: 'POST', body: formData })
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

  return (
    <main style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 24px' }}>Add New Piece</h1>

      {!mode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <img src={photoPreview} alt="Sheet music" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                  {analyzing && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#7c3aed' }}>
                      <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      AI is analyzing the music...
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
            <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#7c3aed' }}>Piece Details</h2>

            <FormField label="Title *" value={form.title} onChange={v => updateForm('title', v)} />
            <FormField label="Composer" value={form.composer} onChange={v => updateForm('composer', v)} />
            <FormField label="Book Title" value={form.book_title} onChange={v => updateForm('book_title', v)} />
            <FormField label="Book Editor" value={form.book_editor} onChange={v => updateForm('book_editor', v)} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="Key Signature" value={form.key_signature} onChange={v => updateForm('key_signature', v)} />
              <FormField label="Time Signature" value={form.time_signature} onChange={v => updateForm('time_signature', v)} />
              <FormField label="Tempo Marking" value={form.tempo_marking} onChange={v => updateForm('tempo_marking', v)} />
              <FormField label="Metronome" value={form.metronome_marking} onChange={v => updateForm('metronome_marking', v)} placeholder="e.g. ♩= 120" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Difficulty</label>
                <select value={form.difficulty_level} onChange={e => updateForm('difficulty_level', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                  <option value="">Select...</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
              <FormField label="Period" value={form.period} onChange={v => updateForm('period', v)} placeholder="e.g. Baroque, Classical" />
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
                <button onClick={addCategory} style={{ padding: '8px 16px', background: '#ede9fe', color: '#7c3aed', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                  Add
                </button>
              </div>
            </div>

            <FormField label="Areas of Focus" value={form.areas_of_focus} onChange={v => updateForm('areas_of_focus', v)} multiline placeholder="e.g. Dynamics in measures 12-16, left hand crossing" />
            <FormField label="Goals" value={form.goals} onChange={v => updateForm('goals', v)} multiline placeholder="e.g. Memorize by end of month, perform at recital" />

            {form.ai_summary && (
              <div style={{ background: '#ede9fe', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#7c3aed', marginBottom: '6px' }}>AI Summary</div>
                <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>{form.ai_summary}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={handleSave} disabled={saving || analyzing} style={{
                flex: 1, padding: '12px', background: '#7c3aed', color: '#fff', border: 'none',
                borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer'
              }}>
                {saving ? 'Saving...' : 'Save Piece'}
              </button>
              <button onClick={() => { setMode(null); setPhotoPreview(null); setPhotoFile(null); setError('') }} style={{
                padding: '12px 24px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
              }}>
                Cancel
              </button>
            </div>
          </div>
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
