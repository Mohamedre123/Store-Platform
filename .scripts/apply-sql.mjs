import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
import fs from 'fs'

loadEnv({ path: '.env.local', quiet: true })
loadEnv({ quiet: true })

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) throw new Error('no DB url')

const file = process.argv[2]
const sql = fs.readFileSync(file, 'utf8')
const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)

const client = postgres(url, { max: 1, prepare: false })
try {
  for (const st of statements) {
    // skip pure-comment chunks
    const stripped = st.replace(/\/\*[\s\S]*?\*\//g, '').trim()
    if (!stripped) continue
    process.stdout.write('→ ' + stripped.split('\n')[0].slice(0, 80) + ' ... ')
    await client.unsafe(stripped)
    console.log('ok')
  }
  console.log('\nDONE')
} finally {
  await client.end()
}
