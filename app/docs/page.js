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
        <Step n="2">Tap <strong>Ask AI to fill in the rest</strong> — AI will look up the piece and fill in time signature, tempo, period, and an interesting summary.</Step>
        <Step n="3">Review, add your focus areas and goals, then save.</Step>
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

      <Section title="Managing Categories">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          Go to <strong>Manage Categories</strong> from the menu to customize your category order and create new categories.
        </p>
        <Step n="1">Use the <strong>▲ ▼ arrows</strong> to reorder categories. This order applies everywhere — dashboard, practice schedule, pieces list.</Step>
        <Step n="2">Tap <strong>Rename</strong> to change the name of a custom category (system defaults can't be renamed).</Step>
        <Step n="3">Tap <strong>Delete</strong> to remove a custom category. Pieces in that category become uncategorized.</Step>
        <Step n="4">Use the <strong>Add Category</strong> section to create new categories. Custom categories are only visible to you.</Step>
      </Section>

      <Section title="Practice Schedule">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          The practice schedule is a grid showing all your active pieces across 14 days (7 past + today + 6 future). Scroll left to see past days or right for upcoming days.
        </p>
        <Step n="1">Pieces are organized by category. Tap the ★ star next to a piece to mark it as priority (highlighted in pink). Tap the ★ star above a day to mark it as a planned practice day (highlighted in purple).</Step>
        <Step n="2">Tap any cell to cycle through: empty → ♪ (plan to play) → 🎶 (plan to practice) → 💗 (played) → 💕 (practiced) → empty.</Step>
        <Step n="3">Set a focus area for each piece by tapping the focus text next to the piece name.</Step>
        <Step n="4">Use the <strong>Export</strong> button to print your schedule.</Step>
        <Note>You can also edit focus areas from the piece detail page. The dashboard shows today's planned pieces and your practice streak.</Note>
      </Section>

      <Section title="Piano Experience Log">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          Go to <strong>Experience Log</strong> from the menu to record each piano experience (lesson). Log the date, what was covered, teacher feedback, and assignments for next time.
        </p>
        <Step n="1">Tap <strong>+ Log Experience</strong> to create a new entry.</Step>
        <Step n="2">Fill in the date and details.</Step>
        <Step n="3">Save. You can edit or delete entries later.</Step>
      </Section>

      <Section title="Repertoire Archive">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          When you finish a piece, you can archive it instead of deleting it. Archived pieces are hidden from your main list but preserved in your repertoire history. Tap <strong>Archive This Piece</strong> on the piece detail page. To see archived pieces, use the <strong>Show Archived</strong> toggle on the My Pieces page. You can restore archived pieces at any time.
        </p>
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

      <Section title="Offline Mode">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          Piano Experience works offline! Your data is cached on your device so you can view and edit during piano lessons without internet.
        </p>
        <Step n="1">Open the app while on wifi — your data (and any shared profiles) is automatically cached in the background.</Step>
        <Step n="2">When offline, all your pieces, notes, schedule, strategies, and experiences are available from the cache.</Step>
        <Step n="3">You can add notes, edit pieces, update goals, and log experiences while offline. Changes queue locally.</Step>
        <Step n="4">When you're back online, queued changes sync automatically. You'll see a confirmation.</Step>
        <Note>A status bar at the bottom shows your connection state and any pending changes. AI features (piece analysis, interesting facts) and image uploads require internet. For best results, open the app at least once a week to keep the cache fresh.</Note>
      </Section>

      <Section title="Add to Home Screen">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333', marginBottom: '16px' }}>
          Install Piano Experience on your device for the best experience:
        </p>
        <Step n="1">On iPhone: open the app in Safari, tap the Share button, then tap <strong>Add to Home Screen</strong>.</Step>
        <Step n="2">On Android: open in Chrome, tap the menu, then <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</Step>
        <Note>The app launches full-screen like a native app and loads faster from your home screen.</Note>
      </Section>

      <Section title="Settings">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          Go to <strong>Settings</strong> from the menu to manage your preferences. Currently you can toggle the <strong>Weekly Practice Summary</strong> email on or off — this email is sent every Friday at 8pm with your week's practice highlights.
        </p>
      </Section>

      <Section title="Account">
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#333' }}>
          Sign up with your email and password. Your account is automatically approved — no waiting required. To sign out, tap the menu in the top right and select <strong>Sign Out</strong>.
        </p>
      </Section>

      <Section title="Copyright Notice">
        <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#666' }}>
          Sheet music images uploaded to Piano Experience are for personal practice reference only. Users are responsible for ensuring they have the right to photograph and store their music. Images are accessible only to the account owner and anyone they have explicitly shared their profile with. Piano Experience does not distribute, republish, or make uploaded images publicly available.
        </p>
      </Section>
    </div>
  )
}

function ReleaseNotes() {
  const releases = [
    {
      version: '6.0',
      date: '2026-04-25',
      changes: [
        'Practice schedule — 4 status modes: ♪ plan to play → 🎶 plan to practice → 💗 played → 💕 practiced',
        'Experimentation row on practice schedule — track free play and improvisation',
        'Feedback system — submit bug reports, suggestions, or questions from the menu',
        'Soft deletes — deleted items are preserved in the database for recovery',
        'Data export — download all your data (or a shared profile\'s data) as a printable document',
        'Weekly email day picker — choose which day to receive your practice summary (default: off)',
        'Delete interesting facts with confirmation',
        'Fixed duplicate composer bio in edit mode',
        'Copyright disclaimer for uploaded sheet music images',
        'Pieces list defaults to category sort order and has expanded view toggle (rating, metronome, focus)',
        'Dashboard today\'s practice sorted by user\'s category order',
        'Delete experience now asks for confirmation',
        'Weekly email fixed — reads from practice grid (was using old data source)',
        'Experience log piece selector fixed for editing existing entries',
        'All legacy practice_schedule references removed from codebase',
        'Experience log now preserves line breaks between paragraphs in view mode',
      ]
    },
    {
      version: '5.4',
      date: '2026-04-22',
      changes: [
        'Practice day column colors improved — blue-violet shade now distinct from pink priority rows',
        'Pink and purple overlap is now visually clear when both priority piece and practice day intersect',
      ]
    },
    {
      version: '5.3',
      date: '2026-04-19',
      changes: [
        'Practice day stars — tap ★ above any day to mark it as a planned practice day (purple column highlight)',
        'Priority stars and category sort fixed for new users',
      ]
    },
    {
      version: '5.2',
      date: '2026-04-18',
      changes: [
        'Manage Categories page — reorder categories with up/down arrows, add/rename/delete custom categories',
        'Per-user category sort order — your preferred order applies on dashboard, schedule, pieces list, and everywhere categories appear',
        'Settings page — toggle weekly practice summary email on or off',
        'Activity feed now tracks practice completions, goals, and experience entries',
        'Cross-profile actions logged to the correct profile with performer name',
        'Timezone fix — dates use local time consistently (no more UTC mismatch in evenings)',
        'Dashboard consolidated to 2 cards — Total Pieces + Today\'s Practice (shows completed/planned)',
        'Parent/Teacher Dashboard now reads from the practice grid for accurate practice days',
        'Menu organized into labeled sections — Practice, Tools, Account',
      ]
    },
    {
      version: '5.1',
      date: '2026-04-18',
      changes: [
        'Practice schedule pieces grouped by category with section headers',
        'Priority pieces highlighted in pink with pink ★ stars',
        'Fun emoji icons — ♪ for planned, 💗 for completed',
        'Export pages now have Print and Back buttons for PWA standalone mode',
        'Current Focus Area moved below Notes on piece detail page with editable styling',
      ]
    },
    {
      version: '5.0',
      date: '2026-04-18',
      changes: [
        'Redesigned Practice Schedule as a perpetual grid — all pieces × 14 days (7 past + today + 6 future)',
        'Tap cells to cycle: empty → ♪ planned → 💗 completed → empty',
        'Focus areas editable inline on the grid and on each piece detail page',
        'Horizontally scrollable grid with today highlighted and centered',
        'Export schedule as printable PDF',
        'Dashboard reads from new practice grid for today\'s practice and streak',
      ]
    },
    {
      version: '4.2',
      date: '2026-04-17',
      changes: [
        '"Ask AI to fill in the rest" — type a title and composer, then let AI look up the details (works for both manual entry and after photo analysis)',
        'Create pieces offline — saves locally and syncs when you reconnect',
        'Tag pieces in Experience Log — select which pieces were discussed during each experience',
        'Offline guards on all AI features — clear messages when AI, photos, or uploads are unavailable offline',
        'Responsive design fixes for iPhone, iPad, and desktop — dropdowns, grids, and buttons now adapt to all screen sizes',
      ]
    },
    {
      version: '4.1',
      date: '2026-04-16',
      changes: [
        'Full offline editing — add notes, edit pieces, toggle goals, manage schedule, update strategies, and log experiences while offline',
        'All offline changes sync automatically when you reconnect',
        'Music notes background pattern throughout the app',
        'Improved offline reliability with @serwist/next service worker',
        'Cropped logo — piano fills the frame with less whitespace',
        'App icon with light blue background, transparent logo in nav bar',
      ]
    },
    {
      version: '4.0',
      date: '2026-04-15',
      changes: [
        'Progressive Web App (PWA) — add to your home screen for a native app experience',
        'Offline mode — view and edit all data without internet; changes sync when connected',
        'Background data caching — your data and shared profiles are pre-loaded for offline use',
        'Offline status indicator — see when you\'re offline and how many changes are pending sync',
        'Flaky connection handling — automatically falls back to cached data when connection is poor',
        'Service Worker caching — app loads instantly from device cache',
        'Sync queue persists across app closes — changes won\'t be lost',
      ]
    },
    {
      version: '3.0',
      date: '2026-04-14',
      changes: [
        'Theme of the Week — admin-uploaded banner at the top of the dashboard',
        'Practice Streak — visual 7-day streak showing which days you practiced',
        'Piano Experience Log — log each experience with date, what was covered, feedback, and assignments',
        'Repertoire Archive — archive finished pieces instead of deleting; toggle to view archived pieces',
        'Parent/Teacher Dashboard — aggregated view of all students shared with you',
        'Weekly Practice Summary Email — automated email every Friday at 8pm CT with your week\'s highlights',
        'Removed practice timer (practice is about quality and frequency, not minutes)',
        'Removed difficulty level field from all screens',
        'New Personal Rating field (1-10) — rate how much you like each piece, from 1 (don\'t care for it) to 10 (love it!)',
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
