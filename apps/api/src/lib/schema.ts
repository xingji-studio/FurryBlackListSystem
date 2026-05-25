import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const currentTimestamp = sql`CURRENT_TIMESTAMP`

export const blacklistEntries = sqliteTable(
  'blacklist_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    platform: text('platform').notNull(),
    accountId: text('account_id').notNull(),
    threatLevel: text('threat_level').notNull(),
    description: text('description').notNull(),
    sourceReportId: integer('source_report_id'),
    createdAt: text('created_at').notNull().default(currentTimestamp),
    updatedAt: text('updated_at').notNull().default(currentTimestamp)
  },
  (table) => [
    uniqueIndex('idx_blacklist_unique').on(table.platform, table.accountId),
    index('idx_blacklist_lookup').on(table.platform, table.accountId),
    index('idx_blacklist_updated').on(table.updatedAt, table.id)
  ]
)

export const reports = sqliteTable(
  'reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    platform: text('platform').notNull(),
    accountId: text('account_id').notNull(),
    threatLevel: text('threat_level').notNull(),
    description: text('description').notNull(),
    evidence: text('evidence').notNull(),
    status: text('status').notNull().default('pending'),
    adminNote: text('admin_note').notNull().default(''),
    createdAt: text('created_at').notNull().default(currentTimestamp),
    updatedAt: text('updated_at').notNull().default(currentTimestamp)
  },
  (table) => [index('idx_reports_status_created').on(table.status, table.createdAt, table.id)]
)

export const reportImages = sqliteTable(
  'report_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reportId: integer('report_id').notNull(),
    mimeType: text('mime_type').notNull(),
    filename: text('filename').notNull(),
    imageData: text('image_data').notNull(),
    createdAt: text('created_at').notNull().default(currentTimestamp)
  },
  (table) => [index('idx_report_images_report_id').on(table.reportId, table.id)]
)

export const blacklistEntryImages = sqliteTable(
  'blacklist_entry_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    blacklistEntryId: integer('blacklist_entry_id').notNull(),
    mimeType: text('mime_type').notNull(),
    filename: text('filename').notNull(),
    imageData: text('image_data').notNull(),
    createdAt: text('created_at').notNull().default(currentTimestamp)
  },
  (table) => [
    index('idx_blacklist_entry_images_entry_id').on(table.blacklistEntryId, table.id)
  ]
)

export const appeals = sqliteTable(
  'appeals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    platform: text('platform').notNull(),
    accountId: text('account_id').notNull(),
    description: text('description').notNull(),
    evidence: text('evidence').notNull(),
    status: text('status').notNull().default('pending'),
    adminNote: text('admin_note').notNull().default(''),
    createdAt: text('created_at').notNull().default(currentTimestamp),
    updatedAt: text('updated_at').notNull().default(currentTimestamp)
  },
  (table) => [index('idx_appeals_status_created').on(table.status, table.createdAt, table.id)]
)

export const reportTraces = sqliteTable(
  'report_traces',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reportId: integer('report_id').notNull(),
    payload: text('payload').notNull(),
    createdAt: text('created_at').notNull().default(currentTimestamp)
  },
  (table) => [index('idx_report_traces_report_id').on(table.reportId, table.id)]
)

export const rateLimitEvents = sqliteTable(
  'rate_limit_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    scope: text('scope').notNull(),
    clientIp: text('client_ip').notNull(),
    requestKey: text('request_key').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (table) => [
    index('idx_rate_limit_scope_ip_time').on(table.scope, table.clientIp, table.createdAt),
    index('idx_rate_limit_request_key').on(table.requestKey)
  ]
)
