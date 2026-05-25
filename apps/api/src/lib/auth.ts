import { SignJWT, jwtVerify } from 'jose'
import { env } from './env'

const secret = new TextEncoder().encode(env.jwtSecret)

const hexOf = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

const sha256 = async (value: string) =>
  hexOf(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  )

export const verifyAdmin = async (username: string, password: string) => {
  const passwordOk = env.adminPasswordHash
    ? (await sha256(password)) === env.adminPasswordHash
    : password === env.adminPassword

  return username === env.adminUsername && passwordOk
}

export const signAdminToken = async () => {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + env.adminTokenMinutes * 60
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secret)

  return {
    token,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  }
}

export const readAdminToken = async (token: string) => {
  await jwtVerify(token, secret)
}
