'use client'

import { useState } from 'react'
import Link from 'next/link'

const TABS = ['User Guide', 'Release Notes']

export default function Docs() {
  const [tab, setTab] = useState('User Guide')

  return (
    <main style={{ padding: '24px', maxWidth: '760px', margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#666', fontSize: '14px' }}>← Dashboard</Link>
      <h1 style={{ margin: '16px 0 24px' }}>Documentation</h1>

      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb', marginBottom: '32px' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '15px', fontWeight: tab === t ? '600' : '400',
              color: tab === t ? '#7c3aed' : '#666',
              borderBottom: tab === t ? '2px solid #7c3aed' : '2px solid transparent',
              marginBottom: '-2px'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'User Guide' && <UserGuide />}
      {tab === 'Release Notes' && <ReleaseNotes />}
    </main>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '36px' }}>
      <h2 style={{ fontSize: '18px', color: '#7c3aed', borderBottom: '1px solid #ede9fe', paddingBottom: '8px', marginBottom: '16px' }}>{title}</h2>
      {children}
    </section>
  )
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
      <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>{n}</span>
      <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', color: '#333' }}>{children}</p>
    </div>
  )
}

function Note({ children }) {
  return (
    <div style={{ background: '#faf5ff', border: '1px solid #c4b5fd', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#5b21b6', marginTop: '12px' }}>
      {children}
    </div>
  )
}

function UserGuide() {
  return (
    <div>
      <Section title="Overview">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          Piano Experience is your personal practice companion. Track the pieces you're working on, organize your practice schedule, capture photos of sheet music, and discover interesting facts about your repertoire with AI.
        </p>
      </Section>

      <Section title="Adding a Piece">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          Tap <strong>Add New Piece</strong> from the dashboard or menu. Choose one of two methods:
        </p>
        <p style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>Take a Photo</p>
        <Step n="1">Take or upload a photo of the first page of sheet music.</Step>
        <Step n="2">AI analyzes the image and auto-fills the piece title, composer, key, and more.</Step>
        <Step n="3">Review and edit the details, then save.</Step>
        <p style={{ fontSize: '15px', fontWeight: '600', color: '#333', margin: '16px 0 8px' }}>Enter Manually</p>
        <Step n="1">Type in the piece title, composer, and any other details you know.</Step>
        <Step n="2">Add your focus areas and goals, then save.</Step>
        <Note>You can upload additional photos later — first page, full piece, or book cover — from the piece detail page.</Note>
      </Section>

      <Section title="Managing Your Pieces">
        <Step n="1">Go to <strong>My Pieces</strong> to see all your pieces.</Step>
        <Step n="2">Search by title, composer, or book. Filter by category.</Step>
        <Step n="3">Tap any piece to view details, add notes, upload images, or get interesting facts.</Step>
      </Section>

      <Section title="Categories">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          Organize your pieces into categories like <strong>Technical Piece</strong>, <strong>New Piece</strong>, or <strong>Finished Piece</strong>. You can also create your own categories when adding or editing a piece.
        </p>
      </Section>

      <Section title="Practice Notes">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          On each piece's detail page, add timestamped notes in three types: <strong>Practice</strong> (for daily practice observations), <strong>Lesson</strong> (for teacher feedback), and <strong>General</strong> (for anything else). Notes are shown newest first with their date and time.
        </p>
      </Section>

      <Section title="Practice Schedule">
        <Step n="1">Go to <strong>Practice Schedule</strong> from the dashboard or menu.</Step>
        <Step n="2">For each day of the week, tap <strong>+ Add</strong> to assign pieces.</Step>
        <Step n="3">Add optional focus notes for each scheduled piece.</Step>
        <Step n="4">During practice, check off each piece as you complete it.</Step>
        <Note>The dashboard shows today's practice items so you can jump right in.</Note>
      </Section>

      <Section title="Interesting Facts">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          On any piece's detail page, tap <strong>Tell me something interesting</strong> to have AI share a fun fact about the piece, composer, musical period, or related works. Each fact is saved so you can revisit them.
        </p>
      </Section>

      <Section title="Account">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          Sign up with your email and password. Your account is automatically approved — no waiting required. To sign out, tap the menu in the top right and select <strong>Sign Out</strong>.
        </p>
      </Section>
    </div>
  )
}

function ReleaseNotes() {
  const releases = [
    {
      version: '1.0',
      date: '2026-04-11',
      changes: [
        'Initial release of Piano Experience',
        'Add pieces with photo AI analysis or manual entry',
        'AI-powered piece identification from sheet music photos',
        '"Tell me something interesting" — AI discovers facts about your pieces',
        'Practice notes with timestamped entries (practice, lesson, general)',
        'Categories for organizing pieces (with custom category creation)',
        'Practice schedule — plan your week and check off completed items',
        'Image uploads for first page, full piece, and book cover',
        'Dashboard with stats, today\'s practice, and pieces by category',
        'Admin panel — view all users and user activity',
        'User guide and release notes documentation',
        'Auto-approve signup with welcome email',
        'Mobile-responsive design with purple theme',
      ]
    }
  ]

  return (
    <div>
      {releases.map(({ version, date, changes }) => (
        <div key={version} style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#7c3aed' }}>Version {version}</h2>
            <span style={{ fontSize: '14px', color: '#999' }}>{date}</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {changes.map((c, i) => (
              <li key={i} style={{ fontSize: '15px', lineHeight: '2', color: '#333' }}>{c}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
