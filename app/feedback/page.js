'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useToast } from '@/app/ToastProvider'

export default function Feedback() {
  const { user, loading: userLoading } = useCurrentUser()
  const { addToast } = useToast()
  const [type, setType] = useState('suggestion')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', type, message: message.trim() })
      })
      const data = await res.json()
      if (data.error) { addToast(data.error, 'error'); setSending(false); return }
      addToast('Feedback sent — thank you!', 'success')
      setMessage('')
      setType('suggestion')
    } catch {
      addToast('Failed to send feedback', 'error')
    }
    setSending(false)
  }

  if (userLoading) return null

  return (
    <main style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', paddingBottom: '100px' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 8px', fontSize: '24px' }}>Feedback</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Let us know about issues, suggestions, or questions.</p>

      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Type</label>
          <select value={type} onChange={e => setType(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
            <option value="suggestion">Suggestion</option>
            <option value="bug">Bug Report</option>
            <option value="question">Question</option>
          </select>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            rows={5} placeholder="Tell us what's on your mind..."
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #e5e7eb',
        padding: '12px 24px', display: 'flex', gap: '12px',
        justifyContent: 'center', zIndex: 9999,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
      }}>
        <button onClick={submit} disabled={sending || !message.trim()} style={{
          flex: 1, maxWidth: '400px', padding: '14px', background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer'
        }}>
          {sending ? 'Sending...' : 'Send Feedback'}
        </button>
      </div>
    </main>
  )
}
