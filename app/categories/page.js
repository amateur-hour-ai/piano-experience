'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'
import { useOffline } from '@/lib/useOffline'

export default function ManageCategories() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { addToast } = useToast()
  const { isOnline } = useOffline()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    loadCategories()
  }, [userLoading, user, activeProfile])

  async function loadCategories() {
    setLoading(true)
    try {
      const res = await fetch(`/api/categories?profile=${encodeURIComponent(activeProfile)}`, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      setCategories(data.categories || [])
    } catch {}
    setLoading(false)
  }

  async function moveCategory(index, direction) {
    const newList = [...categories]
    const swapIdx = index + direction
    if (swapIdx < 0 || swapIdx >= newList.length) return

    const temp = newList[index]
    newList[index] = newList[swapIdx]
    newList[swapIdx] = temp

    // Update sort orders
    const items = newList.map((c, i) => ({ category_id: c.id, sort_order: i }))
    setCategories(newList.map((c, i) => ({ ...c, effective_sort: i })))

    try {
      await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', items, profileEmail: isOwnProfile ? undefined : activeProfile })
      })
    } catch {}
  }

  async function addCategory() {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: newName.trim(), sort_order: categories.length, profileEmail: isOwnProfile ? undefined : activeProfile })
      })
      const data = await res.json()
      if (data.category) {
        setCategories(prev => [...prev, { ...data.category, effective_sort: prev.length }])
        setNewName('')
        addToast('Category added!', 'success')
      }
    } catch {
      addToast('Failed to add category', 'error')
    }
  }

  async function renameCategory(id) {
    if (!renameDraft.trim()) return
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', id, name: renameDraft.trim(), profileEmail: isOwnProfile ? undefined : activeProfile })
      })
      const data = await res.json()
      if (data.error) { addToast(data.error, 'error'); return }
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: renameDraft.trim() } : c))
      setRenamingId(null)
      addToast('Category renamed!', 'success')
    } catch {
      addToast('Failed to rename', 'error')
    }
  }

  async function deleteCategory(id) {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id, profileEmail: isOwnProfile ? undefined : activeProfile })
      })
      const data = await res.json()
      if (data.error) { addToast(data.error, 'error'); return }
      setCategories(prev => prev.filter(c => c.id !== id))
      addToast('Category deleted', 'info')
    } catch {
      addToast('Failed to delete', 'error')
    }
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  return (
    <main style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Home</Link>
      <h1 style={{ margin: '16px 0 8px', fontSize: '24px' }}>
        {isOwnProfile ? 'Manage Categories' : `${profileDisplayName(activeProfile)}'s Categories`}
      </h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
        Reorder categories with the arrows. This order applies on your dashboard, practice schedule, and pieces list.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {categories.map((c, idx) => {
          const isSystem = !c.user_id
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#fff', borderRadius: '10px', padding: '12px 16px',
              border: '1px solid #e5e7eb',
            }}>
              {/* Up/Down arrows */}
              {canEdit && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                  <button onClick={() => moveCategory(idx, -1)} disabled={idx === 0} style={{
                    background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer',
                    color: idx === 0 ? '#ddd' : '#666', fontSize: '14px', padding: '0', lineHeight: 1,
                  }}>▲</button>
                  <button onClick={() => moveCategory(idx, 1)} disabled={idx === categories.length - 1} style={{
                    background: 'none', border: 'none', cursor: idx === categories.length - 1 ? 'default' : 'pointer',
                    color: idx === categories.length - 1 ? '#ddd' : '#666', fontSize: '14px', padding: '0', lineHeight: 1,
                  }}>▼</button>
                </div>
              )}

              {/* Name */}
              <div style={{ flex: 1 }}>
                {renamingId === c.id ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input value={renameDraft} onChange={e => setRenameDraft(e.target.value)}
                      autoFocus onKeyDown={e => { if (e.key === 'Enter') renameCategory(c.id); if (e.key === 'Escape') setRenamingId(null) }}
                      style={{ flex: 1, padding: '4px 8px', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '14px' }} />
                    <button onClick={() => renameCategory(c.id)} style={{ padding: '4px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setRenamingId(null)} style={{ padding: '4px 10px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '500' }}>{c.name}</span>
                    {isSystem && <span style={{ fontSize: '10px', color: '#999', background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}>default</span>}
                  </div>
                )}
              </div>

              {/* Actions */}
              {canEdit && !isSystem && renamingId !== c.id && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => { setRenamingId(c.id); setRenameDraft(c.name) }}
                    style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Rename</button>
                  <button onClick={() => deleteCategory(c.id)}
                    style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add new category */}
      {canEdit && (
        <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '16px', color: '#2563eb', marginBottom: '12px' }}>Add Category</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="New category name..."
              onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
            <button onClick={addCategory} style={{
              padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
            }}>Add</button>
          </div>
        </div>
      )}
    </main>
  )
}
