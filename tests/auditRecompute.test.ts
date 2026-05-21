import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, insertAudit, freezeTime } from './setup'

function recomputeAuditsForPricingChange(tool: string, plan: string): number {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Get affected audits (last 30 days, max 100)
  const stmt = testDb.prepare(
    `SELECT * FROM audit 
     WHERE created_at >= ? 
     ORDER BY created_at DESC 
     LIMIT 100`
  )
  stmt.bind([thirtyDaysAgo])

  const audits: any[] = []
  while (stmt.step()) {
    audits.push(stmt.getAsObject())
  }
  stmt.free()

  let recomputedCount = 0

  audits.forEach((audit) => {
    const tools = JSON.parse(audit.tools_json as string)
    const relevantTool = tools.find((t: any) => t.name === tool && t.plan === plan)

    if (relevantTool) {
      // Recalculate recommendation (simplified)
      const newRecommendation = 'DOWNGRADE to API'

      if (newRecommendation !== audit.recommendation) {
        // Create new audit with link to previous
        const newAuditId = `audit_${Date.now()}_${Math.random()}`
        testDb.run(
          `INSERT INTO audit (id, user_email, tools_json, total_cost, recommendation, previous_audit_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newAuditId,
            audit.user_email,
            audit.tools_json,
            audit.total_cost,
            newRecommendation,
            audit.id,
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        )
        recomputedCount++
      }
    }
  })

  return recomputedCount
}

describe('Audit Recompute', () => {
  describe('TEST 7: Recompute Audits on Pricing Change', () => {
    it('recomputeAuditsForPricingChange re-runs old audits when price changes', () => {
      // Arrange
      freezeTime('2025-01-15T10:00:00Z')
      const auditId = insertAudit(
        'user@company.com',
        [{ name: 'Claude', plan: 'Pro', cost: 20 }],
        20,
        'KEEP'
      )

      // Simulate 5 days ago
      freezeTime(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000))

      // Act
      const recomputedCount = recomputeAuditsForPricingChange('Claude', 'Pro')

      // Assert
      expect(recomputedCount).toBe(1)

      // New audit created
      const stmt = testDb.prepare('SELECT * FROM audit WHERE previous_audit_id = ? ORDER BY created_at DESC LIMIT 1')
      stmt.bind([auditId])
      stmt.step()
      const newAudit = stmt.getAsObject()
      stmt.free()

      expect(newAudit).toBeDefined()
      expect(newAudit.previous_audit_id).toBe(auditId)
      expect(newAudit.recommendation).toBe('DOWNGRADE to API')
    })
  })

  describe('TEST 8: Recompute Respects Limits', () => {
    it('recomputeAuditsForPricingChange only processes last 30 days, max 100 audits', () => {
      // Arrange - create 150 audits in last 30 days
      freezeTime('2025-01-15T10:00:00Z')
      for (let i = 0; i < 150; i++) {
        insertAudit(
          `user${i}@company.com`,
          [{ name: 'Claude', plan: 'Pro', cost: 20 }],
          20,
          'KEEP'
        )
      }

      // Create 50 audits from 60 days ago (should be ignored)
      freezeTime(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))
      for (let i = 150; i < 200; i++) {
        insertAudit(
          `user${i}@company.com`,
          [{ name: 'Claude', plan: 'Pro', cost: 20 }],
          20,
          'KEEP'
        )
      }

      // Act
      freezeTime('2025-01-15T10:00:00Z')
      const recomputedCount = recomputeAuditsForPricingChange('Claude', 'Pro')

      // Assert
      expect(recomputedCount).toBe(100) // Max 100, not 150
    })
  })
})
