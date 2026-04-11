'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'

export default function NavBar() {
  const { isAdmin } = useCurrentUser()
  const [menuOpen, setMenuOpen] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/pieces', label: 'My Pieces' },
    { href: '/add', label: 'Add Piece' },
    { href: '/schedule', label: 'Practice Schedule' },
    ...(isAdmin ? [{ href: '/admin/users', label: 'Manage Users' }] : []),
    { href: '/docs', label: 'Documentation' },
  ]

  return (
    <nav style={{ background: '#7c3aed', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <img src="/logo.svg" alt="Piano Experience" style={{ height: '36px' }} />
        <span style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>Piano Experience</span>
      </Link>

      <button
        onClick={() => setMenuOpen(!menuOpen)}
        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: '20px' }}
      >
        ☰
      </button>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
          />
          <div style={{
            position: 'absolute', top: '60px', right: '16px',
            background: '#fff', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            minWidth: '200px', zIndex: 100, overflow: 'hidden'
          }}>
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '14px 20px', textDecoration: 'none', color: '#1a1a1a', fontSize: '15px', borderBottom: '1px solid #f0f0f0' }}
              >
                {label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              style={{ display: 'block', width: '100%', padding: '14px 20px', textAlign: 'left', background: 'none', border: 'none', color: '#dc2626', fontSize: '15px', cursor: 'pointer' }}
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </nav>
  )
}
