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

// Local stand-in for the Supabase pg_cron job: calls /api/internal/tick.
async function triggerTick(baseUrl, secret, jobs) {
  const url = new URL('/api/internal/tick', baseUrl)
  if (jobs) url.searchParams.set('jobs', jobs)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  const payload = await response.json().catch(() => ({}))
  const stamp = new Date().toISOString()

  if (!response.ok) {
    console.error(`[${stamp}] Tick failed:`, response.status, payload)
    return
  }

  console.log(`[${stamp}] Tick ok:`, JSON.stringify(payload))
}

async function main() {
  loadDotEnvLocal()

  const secret = process.env.CRON_SECRET
  const baseUrl = process.env.LOCAL_CRON_BASE_URL || 'http://localhost:3000'
  const intervalMs = Number(process.env.LOCAL_CRON_INTERVAL_MS || 5 * 60 * 1000)
  const jobs = process.env.LOCAL_CRON_JOBS || null

  if (!secret) {
    throw new Error('Missing CRON_SECRET in environment.')
  }

  if (!Number.isFinite(intervalMs) || intervalMs < 5000) {
    throw new Error('LOCAL_CRON_INTERVAL_MS must be a number >= 5000.')
  }

  await triggerTick(baseUrl, secret, jobs)

  if (process.argv.includes('--once')) {
    return
  }

  console.log(`Local cron started. Running every ${Math.round(intervalMs / 1000)}s against ${baseUrl}.`)

  setInterval(() => {
    triggerTick(baseUrl, secret, jobs).catch((error) => {
      const stamp = new Date().toISOString()
      console.error(`[${stamp}] Unexpected tick error:`, error)
    })
  }, intervalMs)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
