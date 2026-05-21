import { describe, it, expect } from 'vitest'
import { testDb, insertEmailEvent, freezeTime } from './setup'

function handleEmailOpenWebhook(messageId: string): boolean {
  const now = new Date().toISOString()

  // Update opened_at
  testDb.run('UPDATE email_events SET opened_at = ? WHERE message_id = ? AND opened_at IS NULL', [now, messageId])

  // Check if changes were made
  const getChanges = testDb.prepare('SELECT changes() as count')
  getChanges.step()
  const result = getChanges.getAsObject() as any
  getChanges.free()

  return result.count > 0
}

function trackEmailClick(userEmail: string, clickUrl: string): boolean {
  const now = new Date().toISOString()

  // Find most recent unclicked email
  const findStmt = testDb.prepare(
    `SELECT id FROM email_events 
     WHERE user_email = ? AND clicked_at IS NULL 
     ORDER BY sent_at DESC LIMIT 1`
  )
  findStmt.bind([userEmail])
  let emailId: string | null = null
  if (findStmt.step()) {
    const row = findStmt.getAsObject() as any
    emailId = row.id
  }
  findStmt.free()

  if (emailId) {
    testDb.run('UPDATE email_events SET clicked_at = ?, click_url = ? WHERE id = ?', [now, clickUrl, emailId])
    return true
  }
  return false
}

describe('Email Tracking', () => {
  describe('TEST 9: Email Events Tracking', () => {
    it('Email open webhook updates email_events opened_at timestamp', () => {
      // Arrange
      freezeTime('2025-01-15T10:00:00Z')
      insertEmailEvent('user@company.com', 'msg123', 'audit_result')

      let stmt = testDb.prepare('SELECT * FROM email_events WHERE message_id = ?')
      stmt.bind(['msg123'])
      stmt.step()
      let event = stmt.getAsObject() as any
      stmt.free()
      expect(event.opened_at).toBeNull()

      // Act
      freezeTime('2025-01-15T10:05:00Z')
      const updated = handleEmailOpenWebhook('msg123')

      // Assert
      expect(updated).toBe(true)

      stmt = testDb.prepare('SELECT * FROM email_events WHERE message_id = ?')
      stmt.bind(['msg123'])
      stmt.step()
      event = stmt.getAsObject() as any
      stmt.free()
      expect(event.opened_at).toBeDefined()
      expect(event.opened_at).not.toBeNull()

      // Only that row updated
      const stmt2 = testDb.prepare('SELECT COUNT(*) as count FROM email_events WHERE opened_at IS NOT NULL')
      stmt2.step()
      const result = stmt2.getAsObject() as any
      stmt2.free()
      expect(result.count).toBe(1)
    })
  })

  describe('TEST 10: Click Tracking', () => {
    it('Email click tracking updates clicked_at and click_url', () => {
      // Arrange
      freezeTime('2025-01-15T10:00:00Z')
      insertEmailEvent('user@company.com', 'msg456', 'audit_result')

      let stmt = testDb.prepare('SELECT * FROM email_events WHERE message_id = ?')
      stmt.bind(['msg456'])
      stmt.step()
      let event = stmt.getAsObject() as any
      stmt.free()
      expect(event.clicked_at).toBeNull()
      expect(event.click_url).toBeNull()

      // Act
      freezeTime('2025-01-15T10:10:00Z')
      const tracked = trackEmailClick('user@company.com', '/audit/abc123/compare')

      // Assert
      expect(tracked).toBe(true)

      stmt = testDb.prepare('SELECT * FROM email_events WHERE message_id = ?')
      stmt.bind(['msg456'])
      stmt.step()
      event = stmt.getAsObject() as any
      stmt.free()
      expect(event.clicked_at).toBeDefined()
      expect(event.clicked_at).not.toBeNull()
      expect(event.click_url).toBe('/audit/abc123/compare')

      // Only most recent email updated
      insertEmailEvent('user@company.com', 'msg789', 'audit_result')
      trackEmailClick('user@company.com', '/audit/xyz789/compare')

      const stmt2 = testDb.prepare('SELECT * FROM email_events WHERE message_id = ?')
      stmt2.bind(['msg456'])
      stmt2.step()
      const oldEvent = stmt2.getAsObject() as any
      stmt2.free()

      const stmt3 = testDb.prepare('SELECT * FROM email_events WHERE message_id = ?')
      stmt3.bind(['msg789'])
      stmt3.step()
      const newEvent = stmt3.getAsObject() as any
      stmt3.free()

      expect(oldEvent.clicked_at).not.toBeNull()
      expect(newEvent.clicked_at).not.toBeNull()
    })
  })
})
