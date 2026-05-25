import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { sql } from 'drizzle-orm'
import { env } from './env'

let db: ReturnType<typeof drizzle> | null = null
let ready: Promise<void> | null = null

export const getDb = async () => {
  if (db) return db
  const client = createClient({
    url: env.databaseUrl,
    authToken: env.databaseAuthToken || undefined
  })
  db = drizzle(client)
  return db
}

export const initSchema = async () => {
  if (ready) return ready
  ready = (async () => {
    const db = await getDb()
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS blacklist_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        threat_level TEXT NOT NULL,
        description TEXT NOT NULL,
        source_report_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, account_id)
      )
    `)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        threat_level TEXT NOT NULL,
        description TEXT NOT NULL,
        evidence TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS report_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        image_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS blacklist_entry_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blacklist_entry_id INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        image_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS appeals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        description TEXT NOT NULL,
        evidence TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS report_traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS rate_limit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        client_ip TEXT NOT NULL,
        request_key TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_blacklist_lookup
      ON blacklist_entries(platform, account_id)
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_blacklist_updated
      ON blacklist_entries(updated_at, id)
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_reports_status_created
      ON reports(status, created_at, id)
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_appeals_status_created
      ON appeals(status, created_at, id)
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_report_images_report_id
      ON report_images(report_id, id)
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_blacklist_entry_images_entry_id
      ON blacklist_entry_images(blacklist_entry_id, id)
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_report_traces_report_id
      ON report_traces(report_id, id)
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_scope_ip_time
      ON rate_limit_events(scope, client_ip, created_at)
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_request_key
      ON rate_limit_events(request_key)
    `)
  })()
  return ready
}
