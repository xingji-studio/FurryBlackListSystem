import {
  apiPaths,
  localizeTimeFields,
  type FlashMessage,
  type SearchPayload
} from '@fbls/shared'

const messageFrom = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const text = value.trim()
    return text || null
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      messageFrom(record.message) ||
      messageFrom(record.error) ||
      messageFrom(record.cause) ||
      null
    )
  }

  return null
}

const textOf = async (response: Response) => {
  const payload = await response.json().catch(() => null)
  return messageFrom(payload) || '请求失败。'
}

export const publicApi = {
  imageUrl: () => '/paymefifty.jpg',
  async appeal(body: Record<string, unknown>) {
    const response = await fetch(apiPaths.appeal, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new Error(await textOf(response))
    return textOf(response)
  },
  async report(form: FormData) {
    const response = await fetch(apiPaths.report, {
      method: 'POST',
      body: form
    })
    if (!response.ok) throw new Error(await textOf(response))
    return textOf(response)
  },
  async search(platform: string, accountId: string, checkCode: string) {
    const query = new URLSearchParams({ platform, account_id: accountId, check_code: checkCode })
    const response = await fetch(`${apiPaths.search}?${query}`, {
      headers: { Accept: 'application/json' }
    })
    const payload = (await response.json()) as SearchPayload & { error?: unknown; message?: unknown }
    if (!response.ok || !payload.success) {
      throw new Error(messageFrom(payload) || '查询失败。')
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
