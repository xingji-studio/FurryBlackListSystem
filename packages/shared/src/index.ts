export const platforms = ['QQ', '微信', 'B站', '快手', '抖音', 'Discord'] as const

export const threatLevels = ['低', '中', '高', '严重'] as const

export const imageTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const

export const apiPaths = {
  appeal: '/api/appeals',
  adminBlacklist: '/api/admin/blacklist',
  adminDashboard: '/api/admin/dashboard',
  adminLogin: '/api/admin/login',
  adminLogout: '/api/admin/logout',
  adminExports: '/api/admin/exports',
  adminImages: '/api/admin',
  report: '/api/reports',
  search: '/api/blacklist/search',
  sponsorImage: '/api/sponsor-image'
} as const

export const clientLinks = {
  apk: 'https://gitee.com/GuoqiFish/xingji-interactive-software-download-item-storage/releases/download/20260519-1/aeab-release-1.0.0.apk',
  docs: 'https://docs.xingjisoft.com/furries/AEAB_API.html',
  eula: 'https://docs.xingjisoft.com/licenses/AEAB_EULA.html',
  org: 'https://furries.com.cn',
  team: 'https://www.xingjisoft.com'
} as const

export type Platform = (typeof platforms)[number]
export type ThreatLevel = (typeof threatLevels)[number]

export type SearchQuery = {
  platform: string
  account_id: string
}

export type ImageItem = {
  id: number
  filename: string
  mime_type: string
  url: string
}

export type BlacklistEntry = {
  id: number
  platform: string
  account_id: string
  threat_level: string
  description: string
  created_at: string
  updated_at: string
  images: ImageItem[]
}

export type SearchPayload = {
  success: boolean
  found: boolean
  query: SearchQuery
  entry: BlacklistEntry | null
}

export type ApiError = {
  success: false
  error: string
}

export type ReportImage = {
  id: number
  filename: string
  mime_type: string
  url: string
}

export type PendingReport = {
  id: number
  platform: string
  account_id: string
  threat_level: string
  description: string
  evidence: string
  status: string
  admin_note: string
  created_at: string
  updated_at: string
  images: ReportImage[]
}

export type PendingAppeal = {
  id: number
  platform: string
  account_id: string
  description: string
  evidence: string
  status: string
  admin_note: string
  created_at: string
  updated_at: string
}

export type DashboardPayload = {
  reports: PendingReport[]
  appeals: PendingAppeal[]
  blacklistEntries: BlacklistEntry[]
}

export type AuthPayload = {
  token: string
  expiresAt: string
}

export type FlashKind = 'success' | 'error'

export type FlashMessage = {
  kind: FlashKind
  message: string
}

const localTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium'
})

type TimeFields = {
  created_at?: string
  updated_at?: string
}

const formatLocalTime = (value: string) => {
  const iso = value.replace(' ', 'T')
  const utc = /(?:Z|[+-]\d\d:\d\d)$/.test(iso) ? iso : `${iso}Z`
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? value : localTimeFormat.format(date)
}

export const localizeTimeFields = <T extends TimeFields>(value: T): T => {
  const localized = { ...value } as T & Record<keyof TimeFields, string | undefined>

  if (typeof value.created_at === 'string') {
    localized.created_at = formatLocalTime(value.created_at)
  }
  if (typeof value.updated_at === 'string') {
    localized.updated_at = formatLocalTime(value.updated_at)
  }

  return localized
}
