import { imageTypes, platforms, threatLevels } from '@fbls/shared'

const maxAccount = 64
const maxDescription = 2000
const maxEvidence = 4000
const maxImageCount = 4
const maxImageSize = 5 * 1024 * 1024

const clean = (value: string) => value.trim().replace(/\s+/g, ' ')
const base64Of = (bytes: Uint8Array) => {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

export const validatePlatform = (value: string) => {
  const normalized = clean(value)
  if (!platforms.includes(normalized as (typeof platforms)[number])) {
    throw new Error('平台选项无效。')
  }
  return normalized
}

export const validateThreat = (value: string) => {
  const normalized = clean(value)
  if (!threatLevels.includes(normalized as (typeof threatLevels)[number])) {
    throw new Error('威胁程度选项无效。')
  }
  return normalized
}

export const validateAccount = (value: string) => {
  const normalized = clean(value)
  if (!normalized) throw new Error('账号 ID 不能为空。')
  if (!/^[\x00-\x7F]+$/.test(normalized)) {
    throw new Error('账号 ID 只能包含 ASCII 字符。')
  }
  if (normalized.length > maxAccount) {
    throw new Error(`账号 ID 不能超过 ${maxAccount} 个字符。`)
  }
  return normalized
}

export const validateCheckCode = (value: string) => {
  const normalized = clean(value)
  if (!normalized) throw new Error('校验码不能为空。')
  if (!/^\d+$/.test(normalized)) {
    throw new Error('校验码格式无效。')
  }
  return normalized
}

export const validateDescription = (value: string) => {
  const normalized = value.trim()
  if (!normalized) throw new Error('描述不能为空。')
  if (normalized.length > maxDescription) {
    throw new Error(`描述不能超过 ${maxDescription} 个字符。`)
  }
  return normalized
}

export const validateEvidence = (value: string) => {
  const normalized = value.trim()
  if (!normalized) throw new Error('证据不能为空。')
  if (normalized.length > maxEvidence) {
    throw new Error(`证据不能超过 ${maxEvidence} 个字符。`)
  }
  return normalized
}

export const validateAgreement = (value: string | null) => {
  if (value !== 'yes') {
    throw new Error('请先阅读并同意《极端福瑞/反福瑞行为档案库许可协议》。')
  }
}

export const validateImages = async (files: File[]) => {
  const valid = files.filter((file) => file.name)
  if (valid.length > maxImageCount) {
    throw new Error(`最多只能上传 ${maxImageCount} 张图片。`)
  }
  return Promise.all(
    valid.map(async (file) => {
      if (!imageTypes.includes(file.type as (typeof imageTypes)[number])) {
        throw new Error('只允许上传 JPG、PNG、WEBP 或 GIF 图片。')
      }
      if (!file.size) throw new Error('上传的图片为空。')
      if (file.size > maxImageSize) {
        throw new Error(`单张图片不能超过 ${maxImageSize / 1024 / 1024} MB。`)
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      const base64 = base64Of(bytes)
      return { filename: file.name, mimeType: file.type, imageData: base64 }
    })
  )
}
