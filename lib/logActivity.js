export async function logActivity({ action, piece_id, piece_title, details, user_email }) {
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, piece_id, piece_title, details, user_email })
    })
  } catch {}
}
