'use client'

import Link from 'next/link'

export default function Confirmed() {
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
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
        <h1 style={{ fontSize: '22px', color: '#1a1a1a', marginBottom: '8px' }}>Email Confirmed!</h1>
        <p style={{ color: '#666', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          Your account has been verified. You're all set to start using Piano Experience.
        </p>
        <Link href="/">
          <button style={{
            width: '100%', padding: '12px', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer'
          }}>
            Go to Home
          </button>
        </Link>
      </div>
    </div>
  )
}
