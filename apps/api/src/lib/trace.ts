import { reportTraces } from './schema'
import { getDb } from './db'
import { clientIpOf } from './rate'

const safeHeaders = (headers: Headers) => {
  const hidden = new Set([
    'authorization',
    'cookie',
    'proxy-authorization',
    'set-cookie'
  ])

  const entries: [string, string][] = []
  headers.forEach((value, key) => {
    if (!hidden.has(key.toLowerCase())) entries.push([key, value])
  })
  return Object.fromEntries(entries)
}

const bytesOf = (base64: string) => {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'))
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

const hashOf = async (base64: string) => {
  const bytes = bytesOf(base64)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const buildTrace = async (
  reportId: number,
  payload: {
    accountId: string
    description: string
    evidence: string
    images: { filename: string; imageData: string; mimeType: string }[]
    platform: string
    threatLevel: string
  },
  request: Request
) => {
  const now = new Date().toISOString()
  return JSON.stringify(
    {
      report_id: reportId,
      captured_at_utc: now,
      report_summary: {
        platform: payload.platform,
        account_id: payload.accountId,
        threat_level: payload.threatLevel,
        description_length: payload.description.length,
        evidence_length: payload.evidence.length
      },
      network: {
        client_ip: clientIpOf(request),
        forwarded_for: request.headers.get('x-forwarded-for') || '',
        host: new URL(request.url).host,
        scheme: new URL(request.url).protocol.replace(':', ''),
        x_real_ip: request.headers.get('x-real-ip') || ''
      },
      request: {
        method: request.method,
        path: new URL(request.url).pathname,
        query_string: new URL(request.url).search.slice(1),
        content_type: request.headers.get('content-type') || '',
        content_length: request.headers.get('content-length'),
        origin: request.headers.get('origin') || '',
        referrer: request.headers.get('referer') || '',
        user_agent: request.headers.get('user-agent') || '',
        headers: safeHeaders(request.headers)
      },
      upload_summary: {
        image_count: payload.images.length,
        images: await Promise.all(payload.images.map(async (image) => ({
          filename: image.filename,
          mime_type: image.mimeType,
          size_bytes: bytesOf(image.imageData).length,
          sha256: await hashOf(image.imageData)
        })))
      }
    },
    null,
    2
  )
}

export const writeTrace = async (
  reportId: number,
  payload: {
    accountId: string
    description: string
    evidence: string
    images: { filename: string; imageData: string; mimeType: string }[]
    platform: string
    threatLevel: string
  },
  request: Request
) => {
  const db = await getDb()
  await db.insert(reportTraces).values({
    reportId,
    payload: `${await buildTrace(reportId, payload, request)}\n`
  })
}

export const listTraces = async () => {
  const db = await getDb()
  return db.select().from(reportTraces)
}
