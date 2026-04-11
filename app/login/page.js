'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function handleLogin() {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  async function handleSignup() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Notify admin of new signup
    await fetch('/api/notify-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userId: data.user.id })
    })

    setMessage('Account created! You can now sign in.')
    setMode('login')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#2563eb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo.svg" alt="Piano Experience" style={{ width: '80px', height: '80px' }} />
          <h1 style={{ fontSize: '22px', marginTop: '12px', color: '#1a1a1a' }}>Piano Experience</h1>
          <p style={{ color: '#666', marginTop: '4px', fontSize: '14px' }}>Your practice companion</p>
        </div>

        <div style={{ display: 'flex', marginBottom: '24px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <button
            onClick={() => { setMode('login'); setError(''); setMessage('') }}
            style={{ flex: 1, padding: '10px', background: mode === 'login' ? '#2563eb' : '#fff', color: mode === 'login' ? '#fff' : '#666', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setMessage('') }}
            style={{ flex: 1, padding: '10px', background: mode === 'signup' ? '#2563eb' : '#fff', color: mode === 'signup' ? '#fff' : '#666', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Sign Up
          </button>
        </div>

        {message && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#166534' }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#991b1b' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}
          />
        </div>

        <button
          onClick={mode === 'login' ? handleLogin : handleSignup}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </div>
    </div>
  )
}
