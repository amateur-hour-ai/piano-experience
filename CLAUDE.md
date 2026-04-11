# Piano Experience — Project Instructions

## What is this?
A practice companion app for piano students. Users track pieces they're working on, upload sheet music photos (AI analyzes them), manage practice schedules, and discover interesting facts about their repertoire.

## Tech Stack
- **Framework:** Next.js 16 App Router (JavaScript, no TypeScript)
- **Database:** Supabase (PostgreSQL + Storage)
- **AI:** Anthropic API (Claude Haiku for image analysis + interesting facts)
- **Email:** Resend (welcome emails + admin notifications)
- **Hosting:** Vercel
- **Auth:** @supabase/ssr cookie-based auth, auto-approve on signup

## Key Files
- `app/page.js` — Dashboard (stats, today's practice, pieces by category)
- `app/pieces/page.js` — All pieces list with search and category filter
- `app/add/page.js` — Add piece (photo AI analysis or manual entry)
- `app/piece/[id]/page.js` — Piece detail (images, notes, facts, edit, delete)
- `app/schedule/page.js` — Weekly practice schedule with completion checkboxes
- `app/admin/users/page.js` — Admin: user list + activity log (admin only)
- `app/docs/page.js` — User guide + release notes
- `app/NavBar.js` — Hamburger menu with sign out
- `app/ToastProvider.js` — Toast notification context
- `lib/supabase.js` — Anon Supabase client
- `lib/useCurrentUser.js` — Client-side auth hook (caches user, provides isAdmin)
- `lib/logActivity.js` — Client-side activity logger
- `middleware.js` — Auth protection using @supabase/ssr

## Database Tables
- `user_profiles` — id, email, approved, created_at
- `pieces` — main table with title, composer, book info, music details, goals
- `piece_images` — images linked to pieces (first_page, full_piece, book_cover)
- `piece_notes` — timestamped notes (practice, lesson, general)
- `categories` — user-defined + system defaults
- `practice_schedule` — weekly schedule with completion tracking
- `interesting_facts` — AI-generated facts about pieces
- `activity_log` — all user actions for admin visibility

## API Routes
- `POST /api/analyze-piece` — AI analysis of sheet music photo
- `POST /api/interesting-fact` — AI generates an interesting fact
- `POST /api/upload-image` — Upload image to Supabase Storage
- `GET/POST /api/activity` — Read/write activity log (service role)
- `GET /api/users` — List all users (service role, admin use)
- `POST /api/notify-signup` — Auto-approve + send emails on signup

## Patterns & Conventions
- **Admin email:** michael.rosenthal@gmail.com
- **Service role key:** Used in API routes for admin-level queries (bypasses RLS)
- **Anon key:** Used in client-side code (RLS enforced)
- **Purple theme:** #7c3aed throughout
- **Inline errors:** Never use browser alert()/confirm() dialogs
- **Toast notifications:** For transient confirmations (save, delete, etc.)
- **Mobile/desktop responsive:** Cards on mobile, tables on desktop
- **Docs page:** Update app/docs/page.js (both user guide AND release notes) with every user-facing change

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
```

## Rules
1. Always commit and push after changes — don't ask to test until deployment is live
2. Verify deployment succeeds (run `vercel ls`) before asking user to test
3. Update docs page (release notes + user guide) before every commit with user-facing changes
4. Test your work before asking user to test
5. Never use browser alert()/confirm() — use inline messages and toasts
6. Use service role key in API routes for large queries or admin operations
