'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  // Check if this is a network/offline error
  const isOffline = !navigator.onLine ||
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.message?.includes('Failed to fetch') ||
    error?.digest

  return (
    <div style={{ padding: '40px 24px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      {isOffline ? (
        <>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📶</div>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>You're offline</h2>
          <p style={{ color: '#666', fontSize: '15px', marginBottom: '24px' }}>
            This page isn't available offline yet. Try going back to a page you've already visited.
          </p>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#666', fontSize: '15px', marginBottom: '24px' }}>
            {error?.message || 'An unexpected error occurred.'}
          </p>
        </>
      )}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button onClick={reset} style={{
          padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
        }}>
          Try Again
        </button>
        <Link href="/">
          <button style={{
            padding: '10px 20px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
            borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
          }}>
            Go to Home
          </button>
        </Link>
      </div>
    </div>
  )
}
