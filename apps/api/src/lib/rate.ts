import { and, count, lt, sql } from 'drizzle-orm'
import { rateLimitEvents } from './schema'
import { env } from './env'
import { getDb } from './db'

const digest = async (value: string) => {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  )
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const keyOf = async (scope: string, request: Request) => {
  const headers = request.headers
  const raw = [
    scope,
    new URL(request.url).pathname,
    request.method,
    headers.get('user-agent')?.slice(0, 120) || '',
    headers.get('accept')?.slice(0, 120) || '',
    headers.get('x-forwarded-proto')?.slice(0, 20) || ''
  ].join('|')

  return digest(raw)
}

export const clientIpOf = (request: Request) =>
  request.headers.get('cf-connecting-ip') ||
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  'unknown'

export const checkRate = async (
  scope: string,
  limit: number,
  windowSeconds: number,
  request: Request
) => {
  const db = await getDb()
  const clientIp = clientIpOf(request)
  const now = Date.now()
  const cutoff = now - windowSeconds * 1000

  const [{ total }] = await db
    .select({ total: count() })
    .from(rateLimitEvents)
    .where(
      and(
        sql`scope = ${scope}`,
        sql`client_ip = ${clientIp}`,
        sql`created_at >= ${cutoff}`
      )
    )

  if (total >= limit) throw new Error('RATE_LIMIT')

  await db.insert(rateLimitEvents).values({
    scope,
    clientIp,
    requestKey: await keyOf(scope, request),
    createdAt: now
  })

  if (Math.floor(now / 1000) % 30 === 0) {
    await db.delete(rateLimitEvents).where(lt(rateLimitEvents.createdAt, cutoff))
    const [{ total: rows }] = await db.select({ total: count() }).from(rateLimitEvents)
    if (rows > env.rateLimitMaxEntries) {
      const overflow = rows - env.rateLimitMaxEntries
      await db.run(sql`
        DELETE FROM rate_limit_events
        WHERE id IN (
          SELECT id
          FROM rate_limit_events
          ORDER BY created_at ASC
          LIMIT ${overflow}
        )
      `)
    }
  }
}
