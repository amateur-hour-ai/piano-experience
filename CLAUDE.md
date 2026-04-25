# Piano Experience — Project Instructions

## What is this?
A practice companion app for piano students. Users track pieces, upload sheet music photos (AI analyzes them), manage practice schedules via a perpetual grid, log experiences, and discover interesting facts. Supports profile sharing for parents and teachers.

## Tech Stack
- **Framework:** Next.js 16 App Router (JavaScript, no TypeScript)
- **Database:** Supabase (PostgreSQL + Storage) — project ref: bsahdlwezbbqsxgpoegk
- **AI:** Anthropic API (Claude Haiku for image analysis, interesting facts, composer bios, piece enrichment)
- **Email:** Resend (welcome emails, admin notifications, weekly summaries)
- **PWA/Offline:** @serwist/next (precaches all build artifacts), Dexie.js (IndexedDB), sync queue
- **Hosting:** Vercel at https://piano-experience.vercel.app
- **Auth:** @supabase/ssr cookie-based auth, auto-approve signup, email confirmation
- **Build:** Uses `--webpack` flag (serwist requires webpack, not turbopack)

## CRITICAL: Cross-Profile Architecture
Users can grant view or edit access to other users. RLS enforces the Supabase anon client can ONLY access the logged-in user's data.

- **Own profile** → direct Supabase client calls
- **Another user's profile** → MUST use `/api/profile/[email]/...` API routes (service role bypasses RLS)

### Checklist for EVERY new feature that touches data:
1. Does it read data? → Add cross-profile path using API route
2. Does it write/update/delete data? → Add `isOwnProfile` check, use API route for cross-profile
3. Does it update UI state? → Only update AFTER confirming the API call succeeded
4. Is the API route handling the new action? → Add it if not
5. Are edit controls hidden when `!canEdit`? → Check the JSX
6. Does it work offline? → Add try/catch with queueMutation fallback
7. Does it need AI/network? → Add `isOnline` guard with clear message

## CRITICAL: Offline Architecture
- @serwist/next precaches all static build artifacts (JS chunks, CSS, pages)
- Dynamic routes (e.g., `/piece/[id]`) cached at runtime via NetworkFirst with 5s timeout
- BackgroundCacher prefetches all profile data + page shells to IndexedDB
- All mutations queue in IndexedDB sync queue when offline, replay on reconnect
- User + profiles cached in localStorage (survives SW eviction)
- Use `useParams()` not `use(params)` — the latter suspends offline
- AI features (analyze, facts, bio, enrich) need offline guards — show clear message

## CRITICAL: Async Data Timing
When one hook depends on another's data (e.g., sorting pieces by category order), the dependent operation must RE-RUN when the source data loads. Store raw data separately, use useEffect to re-process when dependencies arrive. Never assume a hook's data is available during another hook's initial render.

## Database Tables (16)
- `user_profiles` — id, email, approved
- `pieces` — id, user_id (email), title, composer, book details, music details, ai_summary, composer_bio, current_focus, is_priority, personal_rating, archived, category_id
- `piece_images`, `piece_notes`, `piece_goals`, `tempo_log`, `interesting_facts`
- `categories` — id, user_id (null=system default), name, sort_order
- `category_sort_preferences` — user_email, category_id, sort_order (per-user ordering)
- `practice_grid` — user_email, piece_id, date, status (planned/completed)
- `practice_schedule` — legacy, kept but unused by UI
- `profile_permissions` — owner_email, grantee_email, access_level
- `practice_strategies` — user_email (null=standard), heading, bullets[]
- `theme_of_week`, `experience_log` (with piece_ids[]), `activity_log`

## Key Patterns
- **Admin email:** michael.rosenthal@gmail.com
- **Blue theme:** #2563eb, pink priority: #ec4899/#fdf2f8, emoji: 🎵/💗
- **Inline errors:** Never browser alert()/confirm()
- **Toast notifications:** For transient confirmations
- **Sticky footer:** z-index 9999 (above offline bar at 9998)
- **Image compression:** Resize to max 1200px, JPEG 80% before AI
- **Docs page:** Update user guide AND release notes with every user-facing change
- **Supabase queries:** Never `.single()` unless certain row exists
- **State updates:** Never update UI before confirming API/DB succeeded
- **Export pages:** Include Print + Back buttons for PWA standalone mode
- **Category sort:** useSortedCategories hook + sortPiecesByCategory helper — re-sort when categories load
- **manifest.json:** DO NOT change `start_url`, `display`, or `scope` without notifying the user first — these changes require all PWA users to remove and re-add the app from their homescreen

## Rules
1. Always commit and push — don't ask to test until deployment is live
2. Verify deployment succeeds before asking user to test
3. Update docs (release notes + user guide) with EVERY deploy — never wait to be asked. This includes bug fixes, not just features.
4. Update memory and CLAUDE.md proactively after significant changes — don't wait to be asked
5. Test your work — walk through every user path before asking user to test
6. Before deploying, ask yourself: "Am I confident this works with zero bugs?" If the answer is no, find and fix the issues BEFORE deploying. Do not ship code you're not confident in and then fix it after the user finds problems.
7. Run the cross-profile checklist for every new feature
8. Run the offline checklist for every new feature
9. When fixing a bug: search for the same class of bug elsewhere
10. Never ask the user to do something you can do yourself
