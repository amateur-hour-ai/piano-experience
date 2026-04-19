// Log activity to the profile being edited, noting who performed it
// profile_email = whose profile this happened in
// performed_by = who made the change (may be different if cross-profile)
export async function logActivity({ action, piece_id, piece_title, details, profile_email, performed_by }) {
  // Use profile_email as the user_email (so it shows in their feed)
  // Append performer info to details if it's a cross-profile action
  let fullDetails = details || ''
  if (performed_by && performed_by !== profile_email) {
    const name = performed_by.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    fullDetails = fullDetails ? `${fullDetails} (by ${name})` : `By ${name}`
  }

  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, piece_id, piece_title, details: fullDetails, user_email: profile_email || performed_by })
    })
  } catch {}
}
