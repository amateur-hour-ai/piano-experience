import db, { cacheProfileData, cacheTheme } from './offlineStore'

// Pre-load all data for a profile into IndexedDB
// For own profile: uses direct API calls
// For cross-profile: uses the profile API routes
export async function preloadProfileData(profileEmail, isOwnProfile) {
  try {
    let pieces, schedule, strategies, experiences, activities
    let categories = []
    if (isOwnProfile) {
      const [pRes, sRes, strRes, eRes, aRes, catRes] = await Promise.all([
        fetchJson(`/api/profile-data?type=pieces&email=${enc(profileEmail)}`),
        fetchJson(`/api/profile-data?type=schedule&email=${enc(profileEmail)}`),
        fetchJson(`/api/strategies?profile=${enc(profileEmail)}`),
        fetchJson(`/api/experiences?profile=${enc(profileEmail)}`),
        fetchJson(`/api/activity?user_email=${enc(profileEmail)}&limit=20`),
        fetchJson(`/api/categories?profile=${enc(profileEmail)}`),
      ])
      pieces = pRes.pieces || []
      schedule = pRes.schedule || []
      strategies = strRes.strategies || []
      experiences = eRes.experiences || []
      activities = aRes.activities || []
      categories = catRes.categories || []
    } else {
      const [pRes, sRes, strRes, eRes, aRes, catRes] = await Promise.all([
        fetchJson(`/api/profile/${enc(profileEmail)}/pieces`),
        fetchJson(`/api/profile/${enc(profileEmail)}/schedule`),
        fetchJson(`/api/strategies?profile=${enc(profileEmail)}`),
        fetchJson(`/api/experiences?profile=${enc(profileEmail)}`),
        fetchJson(`/api/activity?user_email=${enc(profileEmail)}&limit=20`),
        fetchJson(`/api/categories?profile=${enc(profileEmail)}`),
      ])
      pieces = pRes.pieces || []
      schedule = sRes.schedule || []
      strategies = strRes.strategies || []
      experiences = eRes.experiences || []
      activities = aRes.activities || []
      categories = catRes.categories || []
    }

    // For each piece, load detail data
    for (const piece of pieces) {
      try {
        let detail
        if (isOwnProfile) {
          detail = await fetchJson(`/api/profile-data?type=piece-detail&id=${piece.id}`)
        } else {
          detail = await fetchJson(`/api/profile/${enc(profileEmail)}/piece/${piece.id}`)
        }
        piece._images = detail.images || []
        piece._notes = detail.notes || []
        piece._goals = detail.goals || []
        piece._facts = detail.facts || []
        piece._tempoLog = detail.tempoLog || []
        // Merge any additional piece fields from detail
        if (detail.piece) Object.assign(piece, detail.piece)
      } catch {}
    }

    await cacheProfileData(profileEmail, {
      pieces, schedule, strategies, experiences, activities, categories,
    })

    return true
  } catch (err) {
    console.error('Failed to preload data for', profileEmail, err)
    return false
  }
}

// Pre-load theme
export async function preloadTheme() {
  try {
    const data = await fetchJson('/api/theme')
    if (data.theme) await cacheTheme(data.theme)
  } catch {}
}

function enc(s) { return encodeURIComponent(s) }

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return res.json()
}
