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
              color: tab === t ? '#2563eb' : '#666',
              borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
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
      <h2 style={{ fontSize: '18px', color: '#2563eb', borderBottom: '1px solid #dbeafe', paddingBottom: '8px', marginBottom: '16px' }}>{title}</h2>
      {children}
    </section>
  )
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
      <span style={{ background: '#2563eb', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>{n}</span>
      <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', color: '#333' }}>{children}</p>
    </div>
  )
}

function Note({ children }) {
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#1e40af', marginTop: '12px' }}>
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
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginTop: '12px' }}>
          The dashboard shows your stats at a glance — tap any stat card to navigate to the relevant page (pieces, schedule, etc.).
        </p>
      </Section>

      <Section title="Adding a Piece">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          Tap <strong>Add New Piece</strong> from the dashboard or menu. Choose one of two methods:
        </p>
        <p style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>Take a Photo</p>
        <Step n="1">Take or upload a photo of the first page of sheet music.</Step>
        <Step n="2">Optionally add a photo of the book cover — this helps AI identify the book, editor, and more context (especially useful for beginner pieces). You can skip this step.</Step>
        <Step n="3">AI analyzes the image(s) and auto-fills the piece title, composer, key, and more.</Step>
        <Step n="4">Review and edit the details, then save.</Step>
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

      <Section title="About the Composer">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          Each piece with a known composer has a dedicated "About the Composer" section. When you add a piece with a composer name, AI automatically generates a brief biography. If the bio wasn't auto-generated, tap <strong>Generate Bio</strong> on the piece detail page.
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

      <Section title="Practice Strategies">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          Go to <strong>Practice Strategies</strong> from the menu. You'll find a set of practice strategies organized by heading, each with detailed bullet points.
        </p>
        <Step n="1">Tap any heading to expand and read the strategy details.</Step>
        <Step n="2">Tap <strong>Edit</strong> to customize — change headings, edit bullets, add new ones, or remove ones that don't apply to you.</Step>
        <Step n="3">Tap <strong>Done Editing</strong> when finished. Your changes are saved automatically.</Step>
        <Note>Every new user starts with a standard set of strategies. Your edits only affect your own copy. Administrators can edit the default strategies that new users receive by tapping "Edit Defaults".</Note>
      </Section>

      <Section title="Interesting Facts">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          On any piece's detail page, tap <strong>Tell me something interesting</strong> to have AI share a fun fact about the piece, composer, musical period, or related works. Each fact is saved so you can revisit them. The AI avoids repeating information from previous facts, the piece summary, and the composer bio.
        </p>
      </Section>

      <Section title="Sharing & Permissions">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          Share your profile with family members, teachers, or practice partners. Go to <strong>Sharing</strong> from the menu.
        </p>
        <Step n="1">Enter the email address of the person you want to share with (they must have a Piano Experience account).</Step>
        <Step n="2">Choose <strong>View Only</strong> (they can see but not change anything) or <strong>Full Edit</strong> (they can add pieces, edit details, and manage your schedule).</Step>
        <Step n="3">Tap <strong>Share</strong>. They'll see your profile in their profile switcher in the nav bar.</Step>
        <Note>You can change the access level or revoke access at any time from the Sharing page. The profile switcher in the nav bar shows all profiles you have access to — tap to switch between them.</Note>
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
      version: '2.1',
      date: '2026-04-14',
      changes: [
        'Removed difficulty level field from all screens — pieces are no longer categorized by level',
      ]
    },
    {
      version: '2.0',
      date: '2026-04-11',
      changes: [
        'Practice timer — start/stop session timer on the schedule page to track practice duration',
        'Structured goals checklist — add, check off, and delete goals for each piece',
        'Tempo progress tracking — metronome marking changes are logged and displayed as a timeline',
        'Export piece — print or save a piece summary with all details, notes, goals, and facts',
        'Image lightbox — tap any image to view full-screen',
        'Dashboard activity feed — see your recent actions at a glance',
        'Sort pieces by title, composer, date, or category',
        'Search clear button — quickly reset search with the X button',
        'Note author attribution — see who wrote each note on shared profiles',
        'Delete note confirmation — inline "Are you sure?" before removing notes',
        'Practice schedule auto-scrolls to today on load',
        'Loading skeletons across pages for a polished feel',
        'Empty state illustrations with icons on empty pages',
        'Touch feedback — buttons respond to taps on mobile',
        'Favicon — piano icon now shows in browser tabs',
        'Print-friendly styles for piece export',
      ]
    },
    {
      version: '1.4',
      date: '2026-04-11',
      changes: [
        'Profile sharing — share your profile with family, teachers, or practice partners with view-only or full edit access',
        'Profile switcher in nav bar — quickly switch between your profile and profiles shared with you',
        'Visual indicator banner when viewing someone else\'s profile',
        'View-only mode hides edit controls entirely for a clean read-only experience',
        'Sharing & Permissions page — grant, revoke, and manage access levels',
        'New Practice Strategies section — structured practice tips with collapsible headings and editable bullets',
        'Every user starts with standard strategies, fully customizable per user',
        'Admin can edit default strategies that new users receive',
        'AI Summary now visible and editable on the Edit Piece page',
        'Practice and lesson notes can now be edited after they are created',
      ]
    },
    {
      version: '1.3',
      date: '2026-04-11',
      changes: [
        'AI Summary and Composer Bio are now editable — tap Edit to correct inaccuracies',
        'Practice schedule persists until changed — no more weekly reset. Checkmarks reset daily.',
        'Key signature no longer auto-filled by AI (too often incorrect)',
        'Redesigned logo',
      ]
    },
    {
      version: '1.2',
      date: '2026-04-11',
      changes: [
        'Optional book cover photo when adding a piece — AI uses both images for richer analysis, especially helpful for beginner pieces',
        'Persistent Save/Cancel footer on Add Piece and Edit Piece pages — always visible while scrolling',
        'New "About the Composer" section on each piece — auto-generated bio when a composer is known',
        'AI Summary and Composer Bio are now editable — tap Edit to correct any inaccuracies',
        'Practice schedule now persists until you change it — no more weekly reset. Checkmarks reset each day.',
        'Key signature no longer auto-filled by AI (too often incorrect) — enter manually if needed',
        'Blue color theme throughout the app (replacing purple)',
        'Redesigned logo — diagonal grand piano with music notes',
        'Dashboard stat cards are now clickable — tap to navigate to pieces, schedule, etc.',
        'Interesting facts no longer repeat — AI avoids overlap with previous facts, piece summary, and composer bio',
        'Fixed formatting issue where interesting facts started with a # symbol',
      ]
    },
    {
      version: '1.1',
      date: '2026-04-11',
      changes: [
        'Faster photo analysis — images are now compressed before sending to AI, reducing upload time significantly',
        'Fixed email confirmation link — clicking "Confirm" in the signup email now opens the app correctly',
      ]
    },
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
            <h2 style={{ margin: 0, fontSize: '20px', color: '#2563eb' }}>Version {version}</h2>
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
