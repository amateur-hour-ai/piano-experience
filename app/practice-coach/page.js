'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useActiveProfile } from '@/lib/useActiveProfile'
import { useToast } from '@/app/ToastProvider'
import { useOfflineData } from '@/lib/useOfflineData'
import { toLocalDateString } from '@/lib/dateUtils'

export default function PracticeCoach() {
  const { user, loading: userLoading } = useCurrentUser()
  const { activeProfile, isOwnProfile, canEdit, profileDisplayName } = useActiveProfile()
  const { addToast } = useToast()
  const { isOnline } = useOfflineData()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [loadingConversation, setLoadingConversation] = useState(true)
  const [appliedProposals, setAppliedProposals] = useState(new Set())
  const [applyingProposal, setApplyingProposal] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (userLoading || !user || !activeProfile) return
    loadConversation()
  }, [userLoading, user, activeProfile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversation() {
    setLoadingConversation(true)
    try {
      const res = await fetch(`/api/practice-coach?profile=${encodeURIComponent(activeProfile)}`, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      if (data.conversation) {
        setConversationId(data.conversation.id)
        setMessages(data.conversation.messages || [])
      }
    } catch {}
    setLoadingConversation(false)
  }

  async function sendMessage(text) {
    if (!text?.trim() || sending) return

    const userMsg = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/practice-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          profileEmail: isOwnProfile ? undefined : activeProfile,
          conversationId,
        }),
        signal: AbortSignal.timeout(60000),
      })

      if (!res.ok) {
        const err = await res.json()
        addToast(err.error || 'Failed to get response', 'error')
        setSending(false)
        return
      }

      const data = await res.json()
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }
      setMessages(data.messages || updatedMessages)
    } catch {
      addToast('Failed to reach Practice Coach', 'error')
    }
    setSending(false)
  }

  async function applySchedule(proposal) {
    if (applyingProposal) return
    setApplyingProposal(true)

    try {
      // Fetch current grid to avoid overwriting completed statuses
      const dates = [...new Set((proposal.schedule || []).map(e => e.date))].sort()
      const gridRes = await fetch(`/api/practice-grid?profile=${encodeURIComponent(activeProfile)}&start=${dates[0]}&end=${dates[dates.length - 1]}`).then(r => r.json())
      const currentGrid = {}
      for (const g of (gridRes.grid || [])) {
        currentGrid[`${g.piece_id}_${g.date}`] = g.status
      }

      // Apply each schedule entry — skip cells where practice is already completed
      let skipped = 0
      for (const entry of (proposal.schedule || [])) {
        const currentStatus = currentGrid[`${entry.piece_id}_${entry.date}`]
        if (currentStatus === 'played' || currentStatus === 'practiced') {
          skipped++
          continue // Don't overwrite completed work
        }
        await fetch('/api/practice-grid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'toggle_to',
            piece_id: entry.piece_id,
            date: entry.date,
            newStatus: entry.status,
            profileEmail: isOwnProfile ? undefined : activeProfile,
          })
        })
      }
      if (skipped > 0) {
        addToast(`${skipped} completed cell${skipped > 1 ? 's' : ''} preserved`, 'info')
      }

      // Apply focus updates
      for (const update of (proposal.focus_updates || [])) {
        await fetch('/api/practice-grid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_focus',
            piece_id: update.piece_id,
            current_focus: update.focus,
            profileEmail: isOwnProfile ? undefined : activeProfile,
          })
        })
      }

      // Apply weekly focus
      if (proposal.weekly_focus) {
        await fetch('/api/practice-grid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_weekly_focus',
            weekly_focus: proposal.weekly_focus,
            profileEmail: isOwnProfile ? undefined : activeProfile,
          })
        })
      }

      setAppliedProposals(prev => new Set([...prev, JSON.stringify(proposal.schedule)]))
      addToast('Schedule applied!', 'success')
    } catch {
      addToast('Failed to apply schedule', 'error')
    }
    setApplyingProposal(false)
  }

  function newConversation() {
    setMessages([])
    setConversationId(null)
    setAppliedProposals(new Set())
  }

  if (userLoading || loadingConversation) return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading...</div>

  if (!isOnline) {
    return (
      <main style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Home</Link>
        <h1 style={{ margin: '16px 0 24px' }}>Practice Coach</h1>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>🎹</div>
          <p>Practice Coach requires an internet connection.</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>Please connect to the internet and try again.</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '0', maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 64px)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '13px' }}>← Home</Link>
          <h1 style={{ fontSize: '20px', margin: '4px 0 0' }}>
            Practice Coach
            {!isOwnProfile && <span style={{ fontSize: '14px', color: '#666', fontWeight: '400', marginLeft: '8px' }}>for {profileDisplayName(activeProfile)}</span>}
          </h1>
        </div>
        <button onClick={newConversation} style={{
          padding: '6px 14px', background: '#f9fafb', color: '#666', border: '1px solid #d1d5db',
          borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
        }}>New Chat</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎹</div>
            <p style={{ fontSize: '16px', fontWeight: '500', color: '#666' }}>Hi! I'm your Practice Coach.</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Tell me about your practice goals for this week and I'll help you build a schedule.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div style={{
              display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '12px',
            }}>
              <div style={{
                maxWidth: '85%', padding: '12px 16px', borderRadius: '16px',
                background: msg.role === 'user' ? '#2563eb' : '#f3f4f6',
                color: msg.role === 'user' ? '#fff' : '#1a1a1a',
                fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>

            {/* Render proposal card if this message has one */}
            {msg.proposal && (
              <ProposalCard
                proposal={msg.proposal}
                onApply={() => applySchedule(msg.proposal)}
                applied={appliedProposals.has(JSON.stringify(msg.proposal.schedule))}
                applying={applyingProposal}
              />
            )}
          </div>
        ))}

        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
            <div style={{ padding: '12px 16px', borderRadius: '16px', background: '#f3f4f6', color: '#999', fontSize: '14px' }}>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 24px 24px', borderTop: '1px solid #e5e7eb', background: '#fff',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Tell me about your practice goals..."
            disabled={sending}
            rows={1}
            style={{
              flex: 1, padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '20px',
              fontSize: '14px', boxSizing: 'border-box', outline: 'none', resize: 'none',
              lineHeight: '1.4', maxHeight: '120px', overflow: 'auto',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={sending || !input.trim()}
            style={{
              padding: '12px 20px', background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
              opacity: sending || !input.trim() ? 0.5 : 1,
            }}
          >Send</button>
        </div>
      </div>
    </main>
  )
}

function ProposalCard({ proposal, onApply, applied, applying }) {
  // Group schedule by date
  const byDate = {}
  for (const entry of (proposal.schedule || [])) {
    if (!byDate[entry.date]) byDate[entry.date] = []
    byDate[entry.date].push(entry)
  }
  const dates = Object.keys(byDate).sort()

  return (
    <div style={{
      background: '#fff', border: '2px solid #2563eb', borderRadius: '16px',
      padding: '16px', marginBottom: '12px', marginLeft: '8px', marginRight: '8px',
    }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#2563eb', marginBottom: '12px' }}>
        Proposed Schedule
      </div>

      {proposal.weekly_focus && (
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px' }}>
          <strong>Weekly Focus:</strong> {proposal.weekly_focus}
        </div>
      )}

      {/* Schedule grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {dates.map(date => (
          <div key={date}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#999', marginBottom: '4px' }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            {byDate[date].map((entry, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0',
                fontSize: '13px',
              }}>
                <span style={{ fontSize: '16px' }}>
                  {entry.status === 'plan_play' ? '♪' : '🎶'}
                </span>
                <span>{entry.piece_title}</span>
                <span style={{ color: '#999', fontSize: '11px' }}>
                  {entry.status === 'plan_play' ? '(play)' : '(practice)'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Focus updates */}
      {proposal.focus_updates?.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#999', marginBottom: '4px' }}>Focus Areas</div>
          {proposal.focus_updates.map((u, i) => (
            <div key={i} style={{ fontSize: '13px', padding: '2px 0' }}>
              <strong>{u.piece_title}:</strong> <span style={{ color: '#2563eb' }}>{u.focus}</span>
            </div>
          ))}
        </div>
      )}

      {/* Explanation */}
      {proposal.explanation && (
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', fontStyle: 'italic' }}>
          {proposal.explanation}
        </div>
      )}

      {/* Action buttons */}
      {applied ? (
        <div style={{ fontSize: '14px', color: '#059669', fontWeight: '600', textAlign: 'center', padding: '8px' }}>
          ✓ Schedule applied
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onApply} disabled={applying} style={{
            flex: 1, padding: '10px', background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
            opacity: applying ? 0.5 : 1,
          }}>{applying ? 'Applying...' : 'Apply Schedule'}</button>
        </div>
      )}
    </div>
  )
}
