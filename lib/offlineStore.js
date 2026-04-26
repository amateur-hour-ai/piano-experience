import Dexie from 'dexie'

const db = new Dexie('PianoExperience')

db.version(1).stores({
  pieces: 'id, user_id, category_id, archived',
  pieceImages: 'id, piece_id',
  pieceNotes: 'id, piece_id, user_id',
  pieceGoals: 'id, piece_id',
  categories: 'id, user_id',
  practiceSchedule: 'id, user_id, day_of_week',
  interestingFacts: 'id, piece_id',
  tempoLog: 'id, piece_id',
  practiceStrategies: 'id, user_email',
  experienceLog: 'id, user_email',
  themeOfWeek: 'id',
  activityLog: 'id, user_email',
  // Sync queue — stores pending mutations to replay when online
  syncQueue: '++id, timestamp, status',
  // Cache metadata — tracks when each profile was last cached
  cacheMeta: 'profileEmail',
})

db.version(2).stores({
  pieces: 'id, user_id, category_id, archived',
  pieceImages: 'id, piece_id',
  pieceNotes: 'id, piece_id, user_id',
  pieceGoals: 'id, piece_id',
  categories: 'id, user_id',
  practiceSchedule: 'id, user_id, day_of_week',
  interestingFacts: 'id, piece_id',
  tempoLog: 'id, piece_id',
  practiceStrategies: 'id, user_email',
  experienceLog: 'id, user_email',
  themeOfWeek: 'id',
  activityLog: 'id, user_email',
  userActivities: 'id, user_email',
  syncQueue: '++id, timestamp, status',
  cacheMeta: 'profileEmail',
})

export default db

// Cache data for a profile (own or cross-profile)
export async function cacheProfileData(profileEmail, data) {
  try {
    await db.transaction('rw',
      db.pieces, db.pieceImages, db.pieceNotes, db.pieceGoals,
      db.categories, db.practiceSchedule, db.interestingFacts,
      db.tempoLog, db.practiceStrategies, db.experienceLog,
      db.activityLog, db.userActivities, db.cacheMeta,
      async () => {
        // Clear old data for this profile
        await db.pieces.where('user_id').equals(profileEmail).delete()
        await db.practiceSchedule.where('user_id').equals(profileEmail).delete()
        await db.practiceStrategies.where('user_email').equals(profileEmail).delete()
        await db.experienceLog.where('user_email').equals(profileEmail).delete()
        await db.activityLog.where('user_email').equals(profileEmail).delete()

        // Insert fresh data
        if (data.pieces?.length) {
          await db.pieces.bulkPut(data.pieces)
          // Cache related data for each piece
          for (const piece of data.pieces) {
            if (piece._images) await db.pieceImages.bulkPut(piece._images)
            if (piece._notes) await db.pieceNotes.bulkPut(piece._notes)
            if (piece._goals) await db.pieceGoals.bulkPut(piece._goals)
            if (piece._facts) await db.interestingFacts.bulkPut(piece._facts)
            if (piece._tempoLog) await db.tempoLog.bulkPut(piece._tempoLog)
          }
        }
        if (data.categories?.length) await db.categories.bulkPut(data.categories)
        if (data.schedule?.length) await db.practiceSchedule.bulkPut(data.schedule)
        if (data.strategies?.length) await db.practiceStrategies.bulkPut(data.strategies)
        if (data.experiences?.length) await db.experienceLog.bulkPut(data.experiences)
        if (data.activities?.length) await db.activityLog.bulkPut(data.activities)
        // User-created activities (practice tasks)
        await db.userActivities.where('user_email').equals(profileEmail).delete()
        if (data.userActivities?.length) await db.userActivities.bulkPut(data.userActivities)

        // Update cache timestamp
        await db.cacheMeta.put({ profileEmail, lastCached: new Date().toISOString() })
      }
    )
  } catch (err) {
    console.error('Failed to cache profile data:', err)
  }
}

// Read cached data for a profile
export async function getCachedProfileData(profileEmail) {
  try {
    const pieces = await db.pieces.where('user_id').equals(profileEmail).toArray()
    const schedule = await db.practiceSchedule.where('user_id').equals(profileEmail).toArray()
    const strategies = await db.practiceStrategies.where('user_email').equals(profileEmail).toArray()
    const experiences = await db.experienceLog.where('user_email').equals(profileEmail).toArray()
    const activities = await db.activityLog.where('user_email').equals(profileEmail).toArray()
    const userActivities = await db.userActivities.where('user_email').equals(profileEmail).toArray()
    const categories = await db.categories.toArray() // categories include system defaults

    // For each piece, load related data
    for (const piece of pieces) {
      piece._images = await db.pieceImages.where('piece_id').equals(piece.id).toArray()
      piece._notes = await db.pieceNotes.where('piece_id').equals(piece.id).toArray()
      piece._goals = await db.pieceGoals.where('piece_id').equals(piece.id).toArray()
      piece._facts = await db.interestingFacts.where('piece_id').equals(piece.id).toArray()
      piece._tempoLog = await db.tempoLog.where('piece_id').equals(piece.id).toArray()
    }

    return { pieces, schedule, strategies, experiences, activities, userActivities, categories }
  } catch (err) {
    console.error('Failed to read cached data:', err)
    return null
  }
}

// Get cached piece detail
export async function getCachedPieceDetail(pieceId) {
  try {
    const piece = await db.pieces.get(pieceId)
    if (!piece) return null
    const images = await db.pieceImages.where('piece_id').equals(pieceId).toArray()
    const notes = await db.pieceNotes.where('piece_id').equals(pieceId).sortBy('created_at')
    const facts = await db.interestingFacts.where('piece_id').equals(pieceId).toArray()
    const goals = await db.pieceGoals.where('piece_id').equals(pieceId).toArray()
    const tempoLog = await db.tempoLog.where('piece_id').equals(pieceId).toArray()
    const categories = await db.categories.toArray()
    return { piece, images, notes: notes.reverse(), facts: facts.reverse(), goals, tempoLog: tempoLog.reverse(), categories }
  } catch (err) {
    console.error('Failed to read cached piece:', err)
    return null
  }
}

// Get cached theme
export async function getCachedTheme() {
  const themes = await db.themeOfWeek.toArray()
  return themes.length > 0 ? themes[themes.length - 1] : null
}

export async function cacheTheme(theme) {
  if (theme) await db.themeOfWeek.put(theme)
}
