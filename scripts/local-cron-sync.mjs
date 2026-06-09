import fs from 'node:fs'
import path from 'node:path'

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue

    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

async function triggerSync(baseUrl, secret) {
  const response = await fetch(`${baseUrl}/api/internal/sync-matches`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  const payload = await response.json().catch(() => ({}))

  const stamp = new Date().toISOString()
  if (!response.ok) {
    console.error(`[${stamp}] Sync failed:`, response.status, payload)
    return
  }

  console.log(
    `[${stamp}] Sync ok: eventsProcessed=${payload.eventsProcessed ?? 0}, eventsSkipped=${payload.eventsSkipped ?? 0}, matchesUpserted=${payload.matchesUpserted ?? 0}`
  )
}

async function triggerEventDeactivation(baseUrl, secret) {
  const response = await fetch(`${baseUrl}/api/internal/deactivate-finished-events`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  const payload = await response.json().catch(() => ({}))
  const stamp = new Date().toISOString()

  if (!response.ok) {
    console.error(`[${stamp}] Event deactivation failed:`, response.status, payload)
    return
  }

  console.log(
    `[${stamp}] Event deactivation ok: checked=${payload.checked ?? 0}, deactivated=${payload.deactivated ?? 0}`
  )
}

async function triggerScoring(baseUrl, secret) {
  const response = await fetch(`${baseUrl}/api/internal/score-finished-matches`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  const payload = await response.json().catch(() => ({}))
  const stamp = new Date().toISOString()

  if (!response.ok) {
    console.error(`[${stamp}] Scoring failed:`, response.status, payload)
    return
  }

  console.log(
    `[${stamp}] Scoring ok: jobsPicked=${payload.jobsPicked ?? 0}, betsUpdated=${payload.betsUpdated ?? 0}, roomPlayersUpdated=${payload.roomPlayersUpdated ?? 0}`
  )
}

async function triggerPickemScoring(baseUrl, secret) {
  const response = await fetch(`${baseUrl}/api/internal/score-pickem`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  const payload = await response.json().catch(() => ({}))
  const stamp = new Date().toISOString()

  if (!response.ok) {
    console.error(`[${stamp}] Pickem scoring failed:`, response.status, payload)
    return
  }

  console.log(
    `[${stamp}] Pickem scoring ok: roomsChecked=${payload.roomsChecked ?? 0}, picksUpdated=${payload.picksUpdated ?? 0}, roomPlayersUpdated=${payload.roomPlayersUpdated ?? 0}`
  )
}
async function main() {
  loadDotEnvLocal()

  const secret = process.env.CRON_SECRET
  const baseUrl = process.env.LOCAL_CRON_BASE_URL || 'http://localhost:3000'
  const intervalMs = Number(process.env.LOCAL_CRON_INTERVAL_MS || 5 * 60 * 1000)

  if (!secret) {
    throw new Error('Missing CRON_SECRET in environment.')
  }

  if (!Number.isFinite(intervalMs) || intervalMs < 5000) {
    throw new Error('LOCAL_CRON_INTERVAL_MS must be a number >= 5000.')
  }

  const runOnce = process.argv.includes('--once')

  await triggerEventDeactivation(baseUrl, secret)
  await triggerSync(baseUrl, secret)
  await triggerScoring(baseUrl, secret)
  await triggerPickemScoring(baseUrl, secret)

  if (runOnce) {
    return
  }

  console.log(`Local cron started. Running every ${Math.round(intervalMs / 1000)}s against ${baseUrl}.`)

  setInterval(() => {
    ;(async () => {
      await triggerEventDeactivation(baseUrl, secret)
      await triggerSync(baseUrl, secret)
      await triggerScoring(baseUrl, secret)
      await triggerPickemScoring(baseUrl, secret)
    })().catch((error) => {
      const stamp = new Date().toISOString()
      console.error(`[${stamp}] Unexpected sync error:`, error)
    })
  }, intervalMs)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
