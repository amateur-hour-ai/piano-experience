'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'

export default function Permissions() {
  const { user, loading: userLoading } = useCurrentUser()
  const { refreshProfiles } = useActiveProfile()
  const { addToast } = useToast()
  const [granted, setGranted] = useState([])
  const [received, setReceived] = useState([])
  const [nameMap, setNameMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newLevel, setNewLevel] = useState('view')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (userLoading || !user) return
    loadPermissions()
  }, [userLoading, user])

  async function loadPermissions() {
    const res = await fetch('/api/permissions')
    const data = await res.json()
    setGranted(data.granted || [])
    setReceived(data.received || [])
    setNameMap(data.nameMap || {})
    setLoading(false)
  }

  async function grantAccess() {
    if (!newEmail.trim()) return
    setSaving(true)
    setError('')

    const res = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grantee_email: newEmail.trim(), access_level: newLevel })
    })
    const data = await res.json()

    if (data.error) {
      setError(data.error)
    } else {
      addToast(`Access granted to ${newEmail}`, 'success')
      setNewEmail('')
      loadPermissions()
    }
    setSaving(false)
  }

  async function revokeAccess(granteeEmail) {
    await fetch(`/api/permissions?grantee_email=${encodeURIComponent(granteeEmail)}`, { method: 'DELETE' })
    addToast('Access revoked', 'info')
    loadPermissions()
    refreshProfiles()
  }

  async function updateLevel(granteeEmail, newAccessLevel) {
    await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grantee_email: granteeEmail, access_level: newAccessLevel })
    })
    addToast('Access level updated', 'success')
    loadPermissions()
  }

  if (userLoading || loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  return (
    <main style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 24px' }}>Sharing & Permissions</h1>

      {/* Grant access */}
      <section style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Share My Profile</h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
          Allow another user to view or edit your pieces and practice schedule.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#991b1b' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="Enter their email address..."
            style={{ flex: 1, minWidth: '200px', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
          />
          <select
            value={newLevel}
            onChange={e => setNewLevel(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
          >
            <option value="view">View Only</option>
            <option value="edit">Full Edit</option>
          </select>
          <button
            onClick={grantAccess}
            disabled={saving}
            style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
          >
            {saving ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </section>

      {/* People I've shared with */}
      <section style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>People I've Shared With</h2>
        {granted.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#999' }}>You haven't shared your profile with anyone yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {granted.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb'
              }}>
                <div>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>{nameMap[p.grantee_email] || p.grantee_email}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {nameMap[p.grantee_email] ? `${p.grantee_email} — ` : ''}Shared {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={p.access_level}
                    onChange={e => updateLevel(p.grantee_email, e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="view">View Only</option>
                    <option value="edit">Full Edit</option>
                  </select>
                  <button
                    onClick={() => revokeAccess(p.grantee_email)}
                    style={{ padding: '6px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Profiles shared with me */}
      <section style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '18px', color: '#2563eb', marginBottom: '16px' }}>Profiles Shared With Me</h2>
        {received.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#999' }}>No one has shared their profile with you yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {received.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb'
              }}>
                <div>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>{nameMap[p.owner_email] || p.owner_email}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {nameMap[p.owner_email] ? `${p.owner_email} — ` : ''}{p.access_level === 'edit' ? 'Full access' : 'View only'}
                  </div>
                </div>
                <span style={{
                  fontSize: '12px', padding: '4px 10px', borderRadius: '12px', fontWeight: '500',
                  background: p.access_level === 'edit' ? '#dbeafe' : '#f0fdf4',
                  color: p.access_level === 'edit' ? '#2563eb' : '#059669',
                }}>
                  {p.access_level === 'edit' ? 'Edit' : 'View'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
