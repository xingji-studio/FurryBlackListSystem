import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { readFile } from 'node:fs/promises'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './env'
import { readAdminToken, signAdminToken, verifyAdmin } from './auth'
import { checkRate } from './rate'
import {
  approveAppeal,
  approveReport,
  createAppeal,
  createReport,
  deleteBlacklistEntry,
  deleteReport,
  listBlacklistEntries,
  listPendingAppeals,
  listPendingReports,
  readBlacklistImage,
  readReportImage,
  rejectAppeal,
  rejectReport,
  searchBlacklist
} from './repo'
import {
  validateAccount,
  validateCheckCode,
  validateAgreement,
  validateDescription,
  validateEvidence,
  validateImages,
  validatePlatform,
  validateThreat
} from './validate'
import { writeTrace } from './trace'

const rateMessage = '请求过于频繁，请稍后再试。'
const moduleDir = dirname(fileURLToPath(import.meta.url))

const candidateCheckCodePaths = (start: string) => {
  const paths: string[] = []
  let current = resolve(start)
  const { root } = parse(current)

  while (true) {
    paths.push(join(current, 'cpwd.txt'))
    if (current === root) break
    current = dirname(current)
  }

  return paths
}

const checkCodePaths = [
  ...candidateCheckCodePaths(process.cwd()),
  ...candidateCheckCodePaths(moduleDir)
].filter((path, index, list) => list.indexOf(path) === index)

const bytesOf = (base64: string) =>
  typeof Buffer !== 'undefined'
    ? Buffer.from(base64, 'base64')
    : Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

const fail = (message: string, status = 400) =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })

const ok = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  })

const tooLarge = (request: Request) =>
  Number(request.headers.get('content-length') || '0') > env.maxContentLength

const replyError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message === 'RATE_LIMIT'
    ? fail(rateMessage, 429)
    : fail(error instanceof Error ? error.message : fallback)

const readCheckCode = async () => {
  for (const path of checkCodePaths) {
    try {
      const content = await readFile(path, 'utf8')
      const code = content.trim()
      if (!code) throw new Error('校验码配置为空。')
      return code
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  throw new Error('未找到校验码配置文件。')
}

const verifyCheckCode = async (value: string) => {
  const expected = await readCheckCode()
  if (value !== expected) {
    throw new Error('校验码错误。')
  }
}

const auth = async (request: Request) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HTTPException(401, { message: '未登录。' })
  await readAdminToken(token)
}

const applyHeaders = (response: Response) => {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )
  return response
}

export const mountRoutes = (api: Hono) => {
  api.use('*', async (c, next) => {
    await next()
    applyHeaders(c.res)
  })

  api.use('/api/blacklist/search', cors({ origin: '*' }))

  api.get('/api/public-images/:id', async (c) => {
    await checkRate('blacklist_image', 180, 300, c.req.raw)
    const image = await readBlacklistImage(Number(c.req.param('id')))
    if (!image) throw new HTTPException(404)
    return new Response(bytesOf(image.imageData), {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Content-Type': image.mimeType
      }
    })
  })

  api.get('/api/blacklist/search', async (c) => {
    try {
      await checkRate('api_search', 60, 300, c.req.raw)
      const platform = validatePlatform(c.req.query('platform') || '')
      const accountId = validateAccount(c.req.query('account_id') || '')
      const checkCode = validateCheckCode(c.req.query('check_code') || '')
      await verifyCheckCode(checkCode)
      const entry = await searchBlacklist(
        `${new URL(c.req.url).origin}`,
        platform,
        accountId
      )

      return ok(
        {
          success: true,
          found: Boolean(entry),
          query: { platform, account_id: accountId },
          entry
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=60, s-maxage=120'
          }
        }
      )
    } catch (error) {
      return replyError(error, '查询失败。')
    }
  })

  api.post('/api/blacklist/search', async (c) => {
    try {
      await checkRate('api_search', 60, 300, c.req.raw)
      const body = await c.req.json()
      const platform = validatePlatform(String(body.platform || ''))
      const accountId = validateAccount(String(body.account_id || ''))
      const checkCode = validateCheckCode(String(body.check_code || ''))
      await verifyCheckCode(checkCode)
      const entry = await searchBlacklist(
        `${new URL(c.req.url).origin}`,
        platform,
        accountId
      )

      return ok(
        {
          success: true,
          found: Boolean(entry),
          query: { platform, account_id: accountId },
          entry
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
          }
        }
      )
    } catch (error) {
      return replyError(error, '查询失败。')
    }
  })

  api.post('/api/reports', async (c) => {
    try {
      if (tooLarge(c.req.raw)) return fail('请求体过大。', 413)
      await checkRate('report', 10, 600, c.req.raw)
      const form = await c.req.formData()
      const platform = validatePlatform(String(form.get('platform') || ''))
      const accountId = validateAccount(String(form.get('account_id') || ''))
      const threatLevel = validateThreat(String(form.get('threat_level') || ''))
      const description = validateDescription(String(form.get('description') || ''))
      const evidence = validateEvidence(String(form.get('evidence') || ''))
      validateAgreement(form.get('license_agreement')?.toString() || null)
      const images = await validateImages(form.getAll('images') as File[])

      const payload = {
        accountId,
        description,
        evidence,
        images,
        platform,
        threatLevel
      }
      const id = await createReport(payload)

      try {
        await writeTrace(id, payload, c.req.raw)
      } catch (error) {
        await deleteReport(id)
        throw error
      }

      return ok({ success: true, message: '举报已提交，等待管理员审核。' })
    } catch (error) {
      return replyError(error, '举报提交失败。')
    }
  })

  api.post('/api/appeals', async (c) => {
    try {
      if (tooLarge(c.req.raw)) return fail('请求体过大。', 413)
      await checkRate('appeal', 10, 600, c.req.raw)
      const body = await c.req.json()
      const platform = validatePlatform(String(body.platform || ''))
      const accountId = validateAccount(String(body.account_id || ''))
      const description = validateDescription(String(body.description || ''))
      const evidence = validateEvidence(String(body.evidence || ''))
      validateAgreement(String(body.license_agreement || null))
      await createAppeal({ accountId, description, evidence, platform })
      return ok({ success: true, message: '申诉已提交，等待管理员审核。' })
    } catch (error) {
      return replyError(error, '申诉提交失败。')
    }
  })

  api.post('/api/admin/login', async (c) => {
    try {
      await checkRate('admin_login', 8, 300, c.req.raw)
      const body = await c.req.json()
      const username = String(body.username || '')
      const password = String(body.password || '')
      if (!(await verifyAdmin(username, password))) {
        return fail('账号或密码错误。', 401)
      }
      return ok(await signAdminToken())
    } catch (error) {
      return replyError(error, '登录失败。')
    }
  })

  api.post('/api/admin/logout', async (c) => {
    await auth(c.req.raw)
    return ok({ success: true })
  })

  api.get('/api/admin/dashboard', async (c) => {
    await auth(c.req.raw)
    return ok({
      reports: await listPendingReports(),
      appeals: await listPendingAppeals(),
      blacklistEntries: await listBlacklistEntries()
    })
  })

  api.post('/api/admin/reports/:id/approve', async (c) => {
    await auth(c.req.raw)
    const body = await c.req.json()
    const id = Number(c.req.param('id'))
    const done = await approveReport(
      id,
      String(body.admin_note || ''),
      validateThreat(String(body.threat_level || ''))
    )
    return done
      ? ok({ success: true, message: `举报 #${id} 已通过并写入黑名单。` })
      : fail(`举报 #${id} 不存在或已处理。`, 404)
  })

  api.post('/api/admin/reports/:id/reject', async (c) => {
    await auth(c.req.raw)
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const done = await rejectReport(id, String(body.admin_note || ''))
    return done
      ? ok({ success: true, message: `举报 #${id} 已驳回。` })
      : fail(`举报 #${id} 不存在或已处理。`, 404)
  })

  api.post('/api/admin/appeals/:id/approve', async (c) => {
    await auth(c.req.raw)
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const done = await approveAppeal(id, String(body.admin_note || ''))
    return done
      ? ok({ success: true, message: `申诉 #${id} 已通过，黑名单记录已删除。` })
      : fail(`申诉 #${id} 不存在或已处理。`, 404)
  })

  api.post('/api/admin/appeals/:id/reject', async (c) => {
    await auth(c.req.raw)
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const done = await rejectAppeal(id, String(body.admin_note || ''))
    return done
      ? ok({ success: true, message: `申诉 #${id} 已驳回。` })
      : fail(`申诉 #${id} 不存在或已处理。`, 404)
  })

  api.post('/api/admin/blacklist/:id/delete', async (c) => {
    await auth(c.req.raw)
    const id = Number(c.req.param('id'))
    const done = await deleteBlacklistEntry(id)
    return done
      ? ok({ success: true, message: `黑名单条目 #${id} 已删除。` })
      : fail(`黑名单条目 #${id} 不存在。`, 404)
  })

  api.get('/api/admin/report-images/:id', async (c) => {
    await auth(c.req.raw)
    const image = await readReportImage(Number(c.req.param('id')))
    if (!image) throw new HTTPException(404)
    return new Response(bytesOf(image.imageData), {
      headers: { 'Content-Type': image.mimeType }
    })
  })

  api.get('/api/admin/blacklist-images/:id', async (c) => {
    await auth(c.req.raw)
    const image = await readBlacklistImage(Number(c.req.param('id')))
    if (!image) throw new HTTPException(404)
    return new Response(bytesOf(image.imageData), {
      headers: { 'Content-Type': image.mimeType }
    })
  })

  api.onError((error) => {
    if (error instanceof HTTPException) {
      return fail(error.message || '请求失败。', error.status)
    }
    return fail(error instanceof Error ? error.message : '服务器错误。', 500)
  })
}
