# Piano Experience — Project Instructions

## What is this?
A practice companion app for piano students. Users track pieces they're working on, upload sheet music photos (AI analyzes them), manage practice schedules, log experiences, and discover interesting facts about their repertoire. Supports profile sharing so parents and teachers can view and manage student profiles.

## Tech Stack
- **Framework:** Next.js 16 App Router (JavaScript, no TypeScript)
- **Database:** Supabase (PostgreSQL + Storage) — project ref: bsahdlwezbbqsxgpoegk
- **AI:** Anthropic API (Claude Haiku for image analysis, interesting facts, composer bios)
- **Email:** Resend (welcome emails, admin notifications, weekly summaries)
- **Hosting:** Vercel at https://piano-experience.vercel.app
- **Auth:** @supabase/ssr cookie-based auth, auto-approve on signup, email confirmation required

## CRITICAL: Cross-Profile Architecture
This app has a profile sharing system. Users can grant view or edit access to other users (e.g., parent views daughter's profile).

**RLS (Row Level Security) enforces that the Supabase anon client can ONLY access data belonging to the logged-in user's email.** This means:

- **Own profile** → use direct Supabase client calls (RLS allows it)
- **Another user's profile** → MUST use `/api/profile/[email]/...` API routes (service role key bypasses RLS, server checks permissions)

### Checklist for EVERY new feature that touches data:
1. Does it read data? → Add cross-profile path using API route
2. Does it write/update/delete data? → Add `isOwnProfile` check, use API route for cross-profile
3. Does it update UI state? → Only update AFTER confirming the API call succeeded
4. Is the API route handling the new action? → Add it if not
5. Are edit controls hidden when `!canEdit`? → Check the JSX

**This is the #1 source of bugs in this project. Do not skip this checklist.**

## Database Tables
- `user_profiles` — id (uuid), email, approved, created_at
- `pieces` — id, user_id (email), title, composer, book_title, book_editor, key/time signatures, tempo, period, ai_summary, composer_bio, metronome_marking, areas_of_focus, goals, category_id, personal_rating, archived
- `piece_images` — id, piece_id, image_url, image_type
- `piece_notes` — id, piece_id, user_id (email), note_type, note, created_at
- `categories` — id, user_id (email or null), name, sort_order
- `practice_schedule` — id, user_id (email), piece_id, day_of_week, focus_notes, sort_order, week_start_date, completed, completed_at
- `interesting_facts` — id, piece_id, fact, created_at
- `activity_log` — id, user_email, action, piece_id, piece_title, details, created_at
- `profile_permissions` — id, owner_email, grantee_email, access_level (view/edit)
- `piece_goals` — id, piece_id, text, completed, sort_order, created_at
- `tempo_log` — id, piece_id, bpm, note, created_at
- `practice_strategies` — id, user_email (null=standard), heading, bullets (text[]), sort_order
- `theme_of_week` — id, image_url, created_at
- `experience_log` — id, user_email, date, summary, feedback, assignments, created_at
- Storage bucket: `piece-images` (public)

## Key Patterns
- **Admin email:** michael.rosenthal@gmail.com
- **Blue theme:** #2563eb throughout
- **Inline errors:** Never use browser alert()/confirm() dialogs
- **Toast notifications:** For transient confirmations
- **Sticky footer:** Any page with Save/Cancel buttons uses a fixed-position footer
- **Image compression:** Always resize to max 1200px and JPEG 80% before sending to AI
- **Docs page:** Update app/docs/page.js (both user guide AND release notes) with every user-facing change
- **Supabase queries:** Never use `.single()` unless certain a row exists. Handle "no rows" gracefully.
- **State updates:** Never update UI state before confirming the API/DB call succeeded.

## Rules
1. Always commit and push after changes — don't ask to test until deployment is live
2. Verify deployment succeeds before asking user to test
3. Update docs page before every commit with user-facing changes
4. Test your work — mentally walk through every user path before asking user to test
5. For every new feature: run the cross-profile checklist above
6. When fixing a bug: search for the same class of bug elsewhere before shipping
