import type { AuthPayload, DashboardPayload, FlashMessage } from '@fbls/shared'
import { apiPaths, localizeTimeFields } from '@fbls/shared'
import { auth, setAuth } from './auth.svelte'

const textOf = async (response: Response) => {
  const payload = await response.json().catch(() => null)
  return payload?.message || payload?.error || '请求失败。'
}

const headers = () => ({
  Authorization: `Bearer ${auth.token}`,
  'Content-Type': 'application/json'
})

const post = async (path: string, body: unknown, withAuth = true) => {
  const response = await fetch(path, {
    method: 'POST',
    headers: withAuth ? headers() : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (response.status === 401 && withAuth) {
    setAuth(null)
    throw new Error('登录已失效。')
  }
  if (!response.ok) throw new Error(await textOf(response))
  return textOf(response)
}

export const adminApi = {
  async dashboard() {
    const response = await fetch(apiPaths.adminDashboard, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    if (response.status === 401) {
      setAuth(null)
      throw new Error('登录已失效。')
    }
    if (!response.ok) throw new Error(await textOf(response))
    const payload = (await response.json()) as DashboardPayload

    return {
      reports: payload.reports.map(localizeTimeFields),
      appeals: payload.appeals.map(localizeTimeFields),
      blacklistEntries: payload.blacklistEntries.map(localizeTimeFields)
    }
  },
  async login(username: string, password: string) {
    const response = await fetch(apiPaths.adminLogin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    if (!response.ok) throw new Error(await textOf(response))
    const payload = (await response.json()) as AuthPayload
    setAuth(payload)
    return payload
  },
  logout: () => post('/api/admin/logout', {}),
  approveAppeal: (id: number, admin_note: string) =>
    post(`/api/admin/appeals/${id}/approve`, { admin_note }),
  approveReport: (id: number, admin_note: string, threat_level: string) =>
    post(`/api/admin/reports/${id}/approve`, { admin_note, threat_level }),
  rejectAppeal: (id: number, admin_note: string) =>
    post(`/api/admin/appeals/${id}/reject`, { admin_note }),
  rejectReport: (id: number, admin_note: string) =>
    post(`/api/admin/reports/${id}/reject`, { admin_note }),
  removeEntry: (id: number) => post(`/api/admin/blacklist/${id}/delete`, {})
}

export const messageOf = (kind: FlashMessage['kind'], message: string): FlashMessage => ({
  kind,
  message
})
