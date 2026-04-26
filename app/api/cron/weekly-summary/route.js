import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function adminSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminSupabase()
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Get all users who have the weekly email enabled with a day preference
  const { data: users } = await supabase.from('user_profiles').select('email, name, weekly_email_enabled, weekly_email_day')
  if (!users?.length) return Response.json({ message: 'No users' })

  // Current day of week in CT — DST-safe using toLocaleDateString
  const now = new Date()
  const ctDayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' })
  const dayMap = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 }
  const todayDayOfWeek = dayMap[ctDayName]

  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

  let sentCount = 0
  for (const user of users) {
    // Skip users who opted out or whose day doesn't match today
    if (!user.weekly_email_enabled) continue
    if (user.weekly_email_day === null || user.weekly_email_day === undefined) continue
    if (user.weekly_email_day !== todayDayOfWeek) continue
    try {
      // Get practice grid data for this week
      const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const { data: gridItems } = await supabase.from('practice_grid')
        .select('*, pieces:piece_id(title)')
        .eq('user_email', user.email)
        .gte('date', weekAgoStr)
        .lte('date', nowStr)

      const completedItems = (gridItems || []).filter(g => g.status === 'played' || g.status === 'practiced')

      // Get new pieces added this week
      const { data: newPieces } = await supabase.from('pieces')
        .select('title, composer')
        .eq('user_id', user.email)
        .eq('archived', false)
        .gte('created_at', weekAgo.toISOString())

      // Get goals completed this week
      const { data: goals } = await supabase.from('piece_goals')
        .select('text, piece_id')
        .eq('completed', true)
        .in('piece_id', (await supabase.from('pieces').select('id').eq('user_id', user.email)).data?.map(p => p.id) || [])

      // Calculate practice days this week
      const practiceDays = new Set()
      completedItems.forEach(g => practiceDays.add(g.date))

      // Build email
      const uniquePieces = [...new Set(completedItems.map(c => c.pieces?.title || 'Unknown piece'))]
      const completedList = uniquePieces.length
        ? uniquePieces.map(t => `<li>${t}</li>`).join('')
        : '<li>No practice items completed</li>'

      const newPiecesList = newPieces?.length
        ? newPieces.map(p => `<li>${p.title}${p.composer ? ` — ${p.composer}` : ''}</li>`).join('')
        : ''

      const html = `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
          <div style="background:#2563eb;padding:20px 24px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">Weekly Practice Summary</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Week of ${weekAgo.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
            <div style="margin-bottom:20px">
              <h2 style="font-size:16px;color:#2563eb;margin:0 0 8px">Practice Streak</h2>
              <p style="font-size:24px;font-weight:700;margin:0">${practiceDays.size} of 7 days</p>
            </div>
            <div style="margin-bottom:20px">
              <h2 style="font-size:16px;color:#2563eb;margin:0 0 8px">Pieces Practiced</h2>
              <ul style="margin:0;padding-left:20px">${completedList}</ul>
            </div>
            ${newPiecesList ? `<div style="margin-bottom:20px"><h2 style="font-size:16px;color:#2563eb;margin:0 0 8px">New Pieces Added</h2><ul style="margin:0;padding-left:20px">${newPiecesList}</ul></div>` : ''}
            ${goals?.length ? `<div style="margin-bottom:20px"><h2 style="font-size:16px;color:#2563eb;margin:0 0 8px">Goals Completed</h2><ul style="margin:0;padding-left:20px">${goals.map(g => `<li>${g.text}</li>`).join('')}</ul></div>` : ''}
            <p style="font-size:13px;color:#999;margin-top:24px">Keep up the great work! — Piano Experience</p>
          </div>
        </div>
      `

      // Send to user
      await resend.emails.send({
        from: 'Piano Experience <hello@pianoexperience.app>',
        to: user.email,
        subject: `Your Weekly Practice Summary — ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
        html
      })

      // Send to anyone who has view/edit access to this user's profile
      const { data: viewers } = await supabase.from('profile_permissions')
        .select('grantee_email').eq('owner_email', user.email)
      if (viewers?.length) {
        for (const viewer of viewers) {
          await resend.emails.send({
            from: 'Piano Experience <hello@pianoexperience.app>',
            to: viewer.grantee_email,
            subject: `${user.name || user.email.split('@')[0]}'s Weekly Practice Summary`,
            html
          })
        }
      }
      sentCount++
    } catch (err) {
      console.error(`Failed to send summary to ${user.email}:`, err)
    }
  }

  return Response.json({ message: `Sent summaries to ${sentCount} users (day ${todayDayOfWeek})` })
}
