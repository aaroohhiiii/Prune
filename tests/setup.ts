import { beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

let SQL: any
export let testDb: any

beforeEach(async () => {
  // Initialize sql.js only once
  if (!SQL) {
    SQL = await initSqlJs()
  }
  testDb = new SQL.Database()
  setupTestDatabase()
})

afterEach(() => {
  if (testDb) {
    testDb.close()
  }
  vi.clearAllMocks()
})

function setupTestDatabase() {
  // pricing_snapshot table
  testDb.run(`
    CREATE TABLE pricing_snapshot (
      id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      price REAL NOT NULL,
      billing_cycle TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // email_events table
  testDb.run(`
    CREATE TABLE email_events (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      message_id TEXT UNIQUE,
      email_type TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      opened_at TEXT,
      clicked_at TEXT,
      click_url TEXT,
      created_at TEXT NOT NULL
    )
  `)

  // audit table
  testDb.run(`
    CREATE TABLE audit (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      tools_json TEXT NOT NULL,
      total_cost REAL NOT NULL,
      recommendation TEXT NOT NULL,
      previous_audit_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // pricing_change_log table
  testDb.run(`
    CREATE TABLE pricing_change_log (
      id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      old_price REAL NOT NULL,
      new_price REAL NOT NULL,
      detected_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
}

// Mock Resend client
export const mockResend = {
  emails: {
    send: vi.fn().mockResolvedValue({ id: 'msg_fake123' }),
  },
}

// Mock date/time utilities
export function freezeTime(timestamp: string | Date) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  vi.setSystemTime(date)
}

export function thawTime() {
  vi.useRealTimers()
}

// Database utilities
export function insertPricingSnapshot(
  tool: string,
  plan: string,
  price: number,
  isActive = true
) {
  const id = `pricing_${Date.now()}_${Math.random()}`
  testDb.run(
    `INSERT INTO pricing_snapshot (id, tool_name, plan_name, price, billing_cycle, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tool, plan, price, 'monthly', isActive ? 1 : 0, new Date().toISOString(), new Date().toISOString()]
  )
  return id
}

export function insertAudit(
  email: string,
  tools: object,
  totalCost: number,
  recommendation: string,
  previousAuditId: string | null = null
) {
  const id = `audit_${Date.now()}_${Math.random()}`
  testDb.run(
    `INSERT INTO audit (id, user_email, tools_json, total_cost, recommendation, previous_audit_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      email,
      JSON.stringify(tools),
      totalCost,
      recommendation,
      previousAuditId,
      new Date().toISOString(),
      new Date().toISOString(),
    ]
  )
  return id
}

export function insertEmailEvent(
  userEmail: string,
  messageId: string,
  emailType: string
) {
  const id = `email_${Date.now()}_${Math.random()}`
  testDb.run(
    `INSERT INTO email_events (id, user_email, message_id, email_type, sent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userEmail, messageId, emailType, new Date().toISOString(), new Date().toISOString()]
  )
  return id
}

export function getEmailEventByMessageId(messageId: string) {
  const stmt = testDb.prepare('SELECT * FROM email_events WHERE message_id = ?')
  stmt.bind([messageId])
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

export function getPricingSnapshot(tool: string, plan: string, isActive = true) {
  const stmt = testDb.prepare(
    'SELECT * FROM pricing_snapshot WHERE tool_name = ? AND plan_name = ? AND is_active = ? ORDER BY created_at DESC LIMIT 1'
  )
  stmt.bind([tool, plan, isActive ? 1 : 0])
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}
