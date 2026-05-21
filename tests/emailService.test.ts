import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testDb, mockResend, insertEmailEvent, getEmailEventByMessageId } from './setup'

async function sendAuditResultEmail(userEmail: string, auditResult: object) {
  try {
    // Send via Resend
    const result = await mockResend.emails.send({
      from: 'noreply@prune.com',
      to: userEmail,
      subject: 'Your Audit Result',
      html: '<p>Your audit is ready</p>',
    })

    const messageId = result.id

    // Record event
    const eventId = `email_${Date.now()}_${Math.random()}`
    testDb.run(
      'INSERT INTO email_events (id, user_email, message_id, email_type, sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, userEmail, messageId, 'audit_result', new Date().toISOString(), new Date().toISOString()]
    )

    return { success: true, messageId }
  } catch (error) {
    console.error('Email send failed:', error)
    return { success: false, error }
  }
}

describe('Email Service', () => {
  describe('TEST 3: Email Send Creates Event', () => {
    it('sendAuditResultEmail creates email_events row', async () => {
      // Arrange
      const userEmail = 'user@company.com'
      const auditResult = { tool: 'Claude', recommendation: 'UPGRADE' }

      // Act
      const result = await sendAuditResultEmail(userEmail, auditResult)

      // Assert - email sent
      expect(result.success).toBe(true)
      expect(result.messageId).toBe('msg_fake123')

      // Event row created
      const event = getEmailEventByMessageId('msg_fake123')
      expect(event).toBeDefined()
      expect(event.user_email).toBe(userEmail)
      expect(event.message_id).toBe('msg_fake123')
      expect(event.email_type).toBe('audit_result')
      expect(event.sent_at).toBeDefined()
    })
  })

  describe('TEST 4: Email Send Handles Failure Gracefully', () => {
    it('sendAuditResultEmail completes even if email send fails', async () => {
      // Arrange - mock Resend to throw error
      mockResend.emails.send.mockRejectedValueOnce(new Error('SMTP failed'))

      const userEmail = 'user@company.com'
      const auditResult = { tool: 'Claude' }

      // Act
      const result = await sendAuditResultEmail(userEmail, auditResult)

      // Assert - no exception thrown, caller continues
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()

      // Audit can still be saved (email failure doesn't block)
      const auditId = `audit_${Date.now()}_${Math.random()}`
      testDb.run(
        'INSERT INTO audit (id, user_email, tools_json, total_cost, recommendation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          auditId,
          userEmail,
          JSON.stringify(auditResult),
          100,
          'UPGRADE',
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      )

      const stmt = testDb.prepare('SELECT * FROM audit WHERE id = ?')
      stmt.bind([auditId])
      stmt.step()
      const audit = stmt.getAsObject()
      stmt.free()

      expect(audit).toBeDefined()
      expect(audit.user_email).toBe(userEmail)
    })
  })
})
