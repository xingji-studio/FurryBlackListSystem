const need = (key: string) => {
  const value = process.env[key]?.trim()
  if (!value) throw new Error(`Missing required env: ${key}`)
  return value
}

const int = (key: string, defaultValue?: number) => {
  const raw = defaultValue === undefined ? need(key) : process.env[key]?.trim()
  if (!raw) return defaultValue!
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value)) throw new Error(`Invalid integer env: ${key}`)
  return value
}

const databaseUrl = need('DATABASE_URL')

export const env = {
  adminPassword: process.env.ADMIN_PASSWORD?.trim() || '',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH?.trim() || '',
  adminTokenMinutes: int('ADMIN_TOKEN_MINUTES', 10),
  adminUsername: need('ADMIN_USERNAME'),
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN?.trim() || '',
  databaseUrl,
  jwtSecret: need('JWT_SECRET'),
  maxContentLength: int('MAX_CONTENT_LENGTH', 6291456),
  rateLimitMaxEntries: int('RATE_LIMIT_MAX_ENTRIES', 20000),
}

if (!env.adminPassword && !env.adminPasswordHash) {
  throw new Error('Missing required env: ADMIN_PASSWORD or ADMIN_PASSWORD_HASH')
}
