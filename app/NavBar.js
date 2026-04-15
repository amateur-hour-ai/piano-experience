'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useCurrentUser, clearCachedUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'

export default function NavBar() {
  const { user, isAdmin } = useCurrentUser()
  const { activeProfile, isOwnProfile, availableProfiles, switchProfile, profileDisplayName, canEdit } = useActiveProfile()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function handleSignOut() {
    clearCachedUser()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const hasMultipleProfiles = (availableProfiles || []).length > 0

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/pieces', label: isOwnProfile ? 'My Pieces' : 'Pieces' },
    ...(canEdit ? [{ href: '/add', label: 'Add Piece' }] : []),
    { href: '/schedule', label: 'Practice Schedule' },
    { href: '/experiences', label: 'Experience Log' },
    { href: '/strategies', label: 'Practice Strategies' },
    ...(hasMultipleProfiles ? [{ href: '/dashboard/teacher', label: 'Parent/Teacher View' }] : []),
    { href: '/permissions', label: 'Sharing' },
    ...(isAdmin ? [{ href: '/admin/users', label: 'Manage Users' }] : []),
    { href: '/docs', label: 'Documentation' },
  ]

  return (
    <>
      <nav style={{ background: '#2563eb', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img src="/logo.png" alt="Piano Experience" style={{ height: '40px', borderRadius: '6px' }} />
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: '600', display: 'none' }} className="desktop-table">Piano Experience</span>
        </Link>

        {/* Profile Switcher */}
        {user && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => hasMultipleProfiles && setProfileOpen(!profileOpen)}
              style={{
                background: isOwnProfile ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.35)',
                border: isOwnProfile ? '1px solid rgba(255,255,255,0.3)' : '2px solid #fff',
                borderRadius: '20px', padding: '6px 14px', cursor: hasMultipleProfiles ? 'pointer' : 'default',
                color: '#fff', fontSize: '13px', fontWeight: '500',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              {profileDisplayName(activeProfile)}
              {hasMultipleProfiles && <span style={{ fontSize: '10px' }}>▼</span>}
            </button>

            {profileOpen && (
              <>
                <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
                <div style={{
                  position: 'absolute', top: '40px', right: 0,
                  background: '#fff', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  minWidth: '220px', zIndex: 100, overflow: 'hidden'
                }}>
                  <button
                    onClick={() => { switchProfile(user.email); setProfileOpen(false) }}
                    style={{
                      display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left',
                      background: isOwnProfile ? '#eff6ff' : '#fff', border: 'none', cursor: 'pointer',
                      fontSize: '14px', color: '#1a1a1a', borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>My Profile</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{user.email}</div>
                  </button>
                  {availableProfiles.map(p => (
                    <button
                      key={p.email}
                      onClick={() => { switchProfile(p.email); setProfileOpen(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left',
                        background: activeProfile === p.email ? '#eff6ff' : '#fff', border: 'none', cursor: 'pointer',
                        fontSize: '14px', color: '#1a1a1a', borderBottom: '1px solid #f0f0f0'
                      }}
                    >
                      <div style={{ fontWeight: '500' }}>{profileDisplayName(p.email)}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {p.email} — {p.accessLevel === 'edit' ? 'Full access' : 'View only'}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: '20px' }}
        >
          ☰
        </button>

        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
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

      {/* Banner when viewing another profile */}
      {!isOwnProfile && activeProfile && (
        <div style={{
          background: '#dbeafe', padding: '8px 24px', fontSize: '13px', color: '#1e40af',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: '500'
        }}>
          Viewing {profileDisplayName(activeProfile)}'s profile
          {canEdit ? ' (full access)' : ' (view only)'}
          <button onClick={() => switchProfile(user.email)} style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px',
            padding: '3px 10px', fontSize: '12px', cursor: 'pointer', marginLeft: '4px'
          }}>
            Back to mine
          </button>
        </div>
      )}
    </>
  )
}
