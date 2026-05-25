import {
  apiPaths,
  localizeTimeFields,
  type FlashMessage,
  type SearchPayload
} from '@fbls/shared'

const base = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || ''

const textOf = async (response: Response) => {
  const payload = await response.json().catch(() => null)
  return payload?.message || payload?.error || '请求失败。'
}

export const publicApi = {
  imageUrl: () => '/paymefifty.jpg',
  async appeal(body: Record<string, unknown>) {
    const response = await fetch(`${base}${apiPaths.appeal}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new Error(await textOf(response))
    return textOf(response)
  },
  async report(form: FormData) {
    const response = await fetch(`${base}${apiPaths.report}`, {
      method: 'POST',
      body: form
    })
    if (!response.ok) throw new Error(await textOf(response))
    return textOf(response)
  },
  async search(platform: string, accountId: string) {
    const query = new URLSearchParams({ platform, account_id: accountId })
    const response = await fetch(`${base}${apiPaths.search}?${query}`, {
      headers: { Accept: 'application/json' }
    })
    const payload = (await response.json()) as SearchPayload & { error?: string }
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '查询失败。')
    }
    return payload.entry
      ? { ...payload, entry: localizeTimeFields(payload.entry) }
      : payload
  }
}

export const messageOf = (kind: FlashMessage['kind'], message: string): FlashMessage => ({
  kind,
  message
})
