import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { BlacklistEntry, PendingAppeal, PendingReport } from '@fbls/shared'
import {
  appeals,
  blacklistEntries,
  blacklistEntryImages,
  reportTraces,
  reportImages,
  reports
} from './schema'
import { getDb } from './db'

type ImageInput = {
  filename: string
  mimeType: string
  imageData: string
}

const withUrl = (base: string, image: any) => ({
  id: image.id,
  filename: image.filename,
  mime_type: image.mimeType || image.mime_type,
  url: `${base}/api/public-images/${image.id}`
})

const asDataUrl = (image: { imageData: string; mimeType: string }) =>
  `data:${image.mimeType};base64,${image.imageData}`

type EntryImageRow = {
  id: number
  filename: string
  mimeType: string
  imageData: string
}

type ReportRow = {
  id: number
  platform: string
  accountId: string
  threatLevel: string
  description: string
  evidence: string
  status: string
  adminNote: string
  createdAt: string
  updatedAt: string
}

type AppealRow = {
  id: number
  platform: string
  accountId: string
  description: string
  evidence: string
  status: string
  adminNote: string
  createdAt: string
  updatedAt: string
}

type BlacklistRow = {
  id: number
  platform: string
  accountId: string
  threatLevel: string
  description: string
  createdAt: string
  updatedAt: string
}

export const createReport = async (
  payload: {
    accountId: string
    description: string
    evidence: string
    images: ImageInput[]
    platform: string
    threatLevel: string
  }
) => {
  const db = await getDb()
  const result = await db
    .insert(reports)
    .values({
      accountId: payload.accountId,
      description: payload.description,
      evidence: payload.evidence,
      platform: payload.platform,
      threatLevel: payload.threatLevel
    })
    .returning({ id: reports.id })

  const id = result[0]?.id
  if (!id) throw new Error('举报创建失败。')
  if (payload.images.length) {
    await db.insert(reportImages).values(
      payload.images.map((image) => ({
        reportId: id,
        mimeType: image.mimeType,
        filename: image.filename,
        imageData: image.imageData
      }))
    )
  }
  return id
}

export const deleteReport = async (id: number) => {
  const db = await getDb()
  await db.delete(reportImages).where(eq(reportImages.reportId, id))
  await db.delete(reportTraces).where(eq(reportTraces.reportId, id))
  await db.delete(reports).where(eq(reports.id, id))
}

export const createAppeal = async (
  payload: {
    accountId: string
    description: string
    evidence: string
    platform: string
  }
) => {
  const db = await getDb()
  const hit = await db
    .select({ id: blacklistEntries.id })
    .from(blacklistEntries)
    .where(
      and(
        sql`lower(${blacklistEntries.platform}) = lower(${payload.platform})`,
        sql`lower(${blacklistEntries.accountId}) = lower(${payload.accountId})`
      )
    )
    .limit(1)

  if (!hit.length) {
    throw new Error('该平台下的账号 ID 不在黑名单中，不能提交申诉。')
  }

  await db.insert(appeals).values(payload)
}

export const searchBlacklist = async (
  base: string,
  platform: string,
  accountId: string
): Promise<BlacklistEntry | null> => {
  const db = await getDb()
  const rows = await db
    .select()
    .from(blacklistEntries)
    .where(
      and(
        sql`lower(${blacklistEntries.platform}) = lower(${platform})`,
        sql`lower(${blacklistEntries.accountId}) = lower(${accountId})`
      )
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null
  const images = await db
    .select()
    .from(blacklistEntryImages)
    .where(eq(blacklistEntryImages.blacklistEntryId, row.id))
    .orderBy(asc(blacklistEntryImages.id))

  return {
    id: row.id,
    platform: row.platform,
    account_id: row.accountId,
    threat_level: row.threatLevel,
    description: row.description,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    images: images.map((image: EntryImageRow) => withUrl(base, image))
  }
}

export const listPendingReports = async (): Promise<PendingReport[]> => {
  const db = await getDb()
  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.status, 'pending'))
    .orderBy(asc(reports.createdAt), asc(reports.id))

  return Promise.all(
    rows.map(async (row: ReportRow) => {
      const images = await db
        .select()
        .from(reportImages)
        .where(eq(reportImages.reportId, row.id))
        .orderBy(asc(reportImages.id))

      return {
        id: row.id,
        platform: row.platform,
        account_id: row.accountId,
        threat_level: row.threatLevel,
        description: row.description,
        evidence: row.evidence,
        status: row.status,
        admin_note: row.adminNote,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        images: images.map((image: EntryImageRow) => ({
          id: image.id,
          filename: image.filename,
          mime_type: image.mimeType,
          url: asDataUrl(image)
        }))
      }
    })
  )
}

export const listPendingAppeals = async (): Promise<PendingAppeal[]> => {
  const db = await getDb()
  const rows = await db
    .select()
    .from(appeals)
    .where(eq(appeals.status, 'pending'))
    .orderBy(asc(appeals.createdAt), asc(appeals.id))

  return rows.map((row: AppealRow) => ({
    id: row.id,
    platform: row.platform,
    account_id: row.accountId,
    description: row.description,
    evidence: row.evidence,
    status: row.status,
    admin_note: row.adminNote,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  }))
}

export const listBlacklistEntries = async (): Promise<BlacklistEntry[]> => {
  const db = await getDb()
  const rows = await db
    .select()
    .from(blacklistEntries)
    .orderBy(desc(blacklistEntries.updatedAt), desc(blacklistEntries.id))

  return Promise.all(
    rows.map(async (row: BlacklistRow) => {
      const images = await db
        .select()
        .from(blacklistEntryImages)
        .where(eq(blacklistEntryImages.blacklistEntryId, row.id))
        .orderBy(asc(blacklistEntryImages.id))

      return {
        id: row.id,
        platform: row.platform,
        account_id: row.accountId,
        threat_level: row.threatLevel,
        description: row.description,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        images: images.map((image: EntryImageRow) => ({
          id: image.id,
          filename: image.filename,
          mime_type: image.mimeType,
          url: asDataUrl(image)
        }))
      }
    })
  )
}

export const approveReport = async (
  id: number,
  adminNote: string,
  threatLevel: string
) => {
  const db = await getDb()
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.status, 'pending')))
    .limit(1)

  const report = rows[0]
  if (!report) return false

  const images = await db
    .select()
    .from(reportImages)
    .where(eq(reportImages.reportId, id))
    .orderBy(asc(reportImages.id))

  const existing = await db
    .select({ id: blacklistEntries.id })
    .from(blacklistEntries)
    .where(
      and(
        sql`lower(${blacklistEntries.platform}) = lower(${report.platform})`,
        sql`lower(${blacklistEntries.accountId}) = lower(${report.accountId})`
      )
    )
    .limit(1)

  let entryId = existing[0]?.id

  if (entryId) {
    await db
      .update(blacklistEntries)
      .set({
        threatLevel,
        description: report.description,
        sourceReportId: report.id,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(blacklistEntries.id, entryId))
  } else {
    const created = await db
      .insert(blacklistEntries)
      .values({
        platform: report.platform,
        accountId: report.accountId,
        threatLevel,
        description: report.description,
        sourceReportId: report.id
      })
      .returning({ id: blacklistEntries.id })
    entryId = created[0]?.id
  }

  if (!entryId) return false

  await db
    .delete(blacklistEntryImages)
    .where(eq(blacklistEntryImages.blacklistEntryId, entryId))

  if (images.length) {
    await db.insert(blacklistEntryImages).values(
      images.map((image: EntryImageRow) => ({
        blacklistEntryId: entryId!,
        mimeType: image.mimeType,
        filename: image.filename,
        imageData: image.imageData
      }))
    )
  }

  await db
    .update(reports)
    .set({
      status: 'approved',
      adminNote: adminNote.trim(),
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(reports.id, id))

  return true
}

export const rejectReport = async (id: number, adminNote: string) => {
  const db = await getDb()
  const result = await db
    .update(reports)
    .set({
      status: 'rejected',
      adminNote: adminNote.trim(),
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(and(eq(reports.id, id), eq(reports.status, 'pending')))
    .returning({ id: reports.id })

  return Boolean(result[0]?.id)
}

export const approveAppeal = async (id: number, adminNote: string) => {
  const db = await getDb()
  const rows = await db
    .select()
    .from(appeals)
    .where(and(eq(appeals.id, id), eq(appeals.status, 'pending')))
    .limit(1)

  const appeal = rows[0]
  if (!appeal) return false

  const hits = await db
    .select({ id: blacklistEntries.id })
    .from(blacklistEntries)
    .where(
      and(
        sql`lower(${blacklistEntries.platform}) = lower(${appeal.platform})`,
        sql`lower(${blacklistEntries.accountId}) = lower(${appeal.accountId})`
      )
    )

  for (const hit of hits) {
    await db
      .delete(blacklistEntryImages)
      .where(eq(blacklistEntryImages.blacklistEntryId, hit.id))
  }

  await db
    .delete(blacklistEntries)
    .where(
      and(
        sql`lower(${blacklistEntries.platform}) = lower(${appeal.platform})`,
        sql`lower(${blacklistEntries.accountId}) = lower(${appeal.accountId})`
      )
    )

  await db
    .update(appeals)
    .set({
      status: 'approved',
      adminNote: adminNote.trim(),
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(appeals.id, id))

  return true
}

export const rejectAppeal = async (id: number, adminNote: string) => {
  const db = await getDb()
  const result = await db
    .update(appeals)
    .set({
      status: 'rejected',
      adminNote: adminNote.trim(),
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(and(eq(appeals.id, id), eq(appeals.status, 'pending')))
    .returning({ id: appeals.id })

  return Boolean(result[0]?.id)
}

export const deleteBlacklistEntry = async (id: number) => {
  const db = await getDb()
  await db
    .delete(blacklistEntryImages)
    .where(eq(blacklistEntryImages.blacklistEntryId, id))
  const result = await db
    .delete(blacklistEntries)
    .where(eq(blacklistEntries.id, id))
    .returning({ id: blacklistEntries.id })
  return Boolean(result[0]?.id)
}

export const readReportImage = async (id: number) => {
  const db = await getDb()
  const rows = await db
    .select({
      id: reportImages.id,
      filename: reportImages.filename,
      mimeType: reportImages.mimeType,
      imageData: reportImages.imageData
    })
    .from(reportImages)
    .innerJoin(reports, eq(reports.id, reportImages.reportId))
    .where(and(eq(reportImages.id, id), eq(reports.status, 'pending')))
    .limit(1)

  return rows[0] || null
}

export const readBlacklistImage = async (id: number) => {
  const db = await getDb()
  const rows = await db
    .select({
      id: blacklistEntryImages.id,
      filename: blacklistEntryImages.filename,
      mimeType: blacklistEntryImages.mimeType,
      imageData: blacklistEntryImages.imageData
    })
    .from(blacklistEntryImages)
    .where(eq(blacklistEntryImages.id, id))
    .limit(1)

  return rows[0] || null
}
