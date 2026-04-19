'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useToast } from '@/app/ToastProvider'

export default function Settings() {
  const { user, loading: userLoading } = useCurrentUser()
  const { addToast } = useToast()
  const [weeklyEmail, setWeeklyEmail] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading || !user) return
    async function load() {
      try {
        const res = await fetch('/api/settings', { signal: AbortSignal.timeout(5000) })
        const data = await res.json()
        if (data.settings) setWeeklyEmail(data.settings.weekly_email_enabled !== false)
      } catch {}
      setLoading(false)
    }
    load()
  }, [userLoading, user])

  async function toggleWeeklyEmail() {
    const newVal = !weeklyEmail
    setWeeklyEmail(newVal)
    try {
      await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_email_enabled: newVal })
      })
      addToast(newVal ? 'Weekly email enabled' : 'Weekly email disabled', 'success')
    } catch {
      setWeeklyEmail(!newVal) // revert on failure
      addToast('Failed to update', 'error')
    }
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  return (
    <main style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 24px', fontSize: '24px' }}>Settings</h1>

      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Email Preferences</h2>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '500' }}>Weekly Practice Summary</div>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>Receive a summary email every Friday at 8pm with your week's practice highlights</div>
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
      </div>
    </main>
  )
}
