'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function handleReset() {
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#2563eb',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo.png" alt="Piano Experience" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          <h1 style={{ fontSize: '22px', marginTop: '12px', color: '#1a1a1a' }}>Set New Password</h1>
        </div>

        {done ? (
          <div>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#166534', textAlign: 'center' }}>
              Password updated successfully!
            </div>
            <button onClick={() => { window.location.href = '/' }} style={{
              width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer'
            }}>Go to Home</button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#991b1b' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters" autoFocus
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Type password again"
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleReset} disabled={loading} style={{
              width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer'
            }}>{loading ? 'Updating...' : 'Update Password'}</button>
          </>
        )}
      </div>
    </div>
  )
}
