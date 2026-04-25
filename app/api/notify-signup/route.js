import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { email, userId } = await request.json()

    // Auto-approve: create user profile as approved
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    await supabase.from('user_profiles').upsert({
      id: userId,
      email,
      approved: true
    })

    // Log the signup activity
    await supabase.from('activity_log').insert([{
      user_email: email,
      action: 'signup',
      details: 'New user signed up (auto-approved)'
    }])

    // Notify admin
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Piano Experience <hello@pianoexperience.app>',
      to: 'michael.rosenthal@gmail.com',
      subject: 'New user signup - Piano Experience',
      html: `
        <h2>New User Signup</h2>
        <p><strong>${email}</strong> has signed up for Piano Experience and has been auto-approved.</p>
        <p>User ID: ${userId}</p>
      `
    })

    // Send welcome email to user
    await resend.emails.send({
      from: 'Piano Experience <hello@pianoexperience.app>',
      to: email,
      subject: 'Welcome to Piano Experience!',
      html: `
        <h2>Welcome to Piano Experience!</h2>
        <p>Your account has been created and you're ready to go.</p>
        <p>Start by adding your first piece — take a photo of the sheet music and let AI discover interesting facts about it!</p>
        <p>Happy practicing!</p>
      `
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error in signup notification:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
