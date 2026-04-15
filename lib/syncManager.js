import db from './offlineStore'

// Add a mutation to the sync queue
export async function queueMutation(mutation) {
  // mutation: { url, method, body, description }
  await db.syncQueue.add({
    ...mutation,
    timestamp: new Date().toISOString(),
    status: 'pending',
  })
}

// Get count of pending mutations
export async function getPendingCount() {
  return await db.syncQueue.where('status').equals('pending').count()
}

// Get all pending mutations
export async function getPendingMutations() {
  return await db.syncQueue.where('status').equals('pending').sortBy('timestamp')
}

// Replay all pending mutations
export async function replayQueue(onProgress) {
  const pending = await getPendingMutations()
  if (pending.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const mutation of pending) {
    try {
      const options = {
        method: mutation.method || 'POST',
        signal: AbortSignal.timeout(10000),
      }
      if (mutation.body) {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify(mutation.body)
      }

      const res = await fetch(mutation.url, options)

      if (res.ok) {
        await db.syncQueue.update(mutation.id, { status: 'synced' })
        synced++
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('Sync failed for mutation:', mutation.description, data.error)
        await db.syncQueue.update(mutation.id, { status: 'failed', error: data.error || res.statusText })
        failed++
      }
    } catch (err) {
      console.error('Sync error for mutation:', mutation.description, err.message)
      // Network error — leave as pending for next retry
      if (err.name === 'AbortError' || err.name === 'TypeError') {
        // Connection still bad — stop trying
        return { synced, failed, aborted: true }
      }
      await db.syncQueue.update(mutation.id, { status: 'failed', error: err.message })
      failed++
    }

    if (onProgress) onProgress({ synced, failed, total: pending.length })
  }

  // Clean up synced items
  await db.syncQueue.where('status').equals('synced').delete()

  return { synced, failed }
}

// Clear failed items (after user acknowledges)
export async function clearFailed() {
  await db.syncQueue.where('status').equals('failed').delete()
}
