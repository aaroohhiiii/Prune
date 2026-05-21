import { describe, it, expect } from 'vitest'

interface AuditTool {
  name: string
  plan: string
  cost: number
  billing: 'monthly' | 'yearly'
}

interface AuditResult {
  tools: AuditTool[]
  totalCost: number
}

interface AuditDelta {
  toolsRemoved: Array<{ name: string; savings: number }>
  toolsAdded: Array<{ name: string; cost: number }>
  planChanges: Array<{ name: string; oldPlan: string; newPlan: string; delta: number }>
  totalSavingsDelta: number
}

function calculateAuditDelta(current: AuditResult, previous: AuditResult): AuditDelta {
  const prevMap = new Map(previous.tools.map((t) => [t.name, t]))
  const currMap = new Map(current.tools.map((t) => [t.name, t]))

  const toolsRemoved: AuditDelta['toolsRemoved'] = []
  const toolsAdded: AuditDelta['toolsAdded'] = []
  const planChanges: AuditDelta['planChanges'] = []

  // Find removed and changed
  prevMap.forEach((prevTool, name) => {
    const currTool = currMap.get(name)
    if (!currTool) {
      // Tool removed
      const annualSavings = prevTool.billing === 'yearly' ? prevTool.cost : prevTool.cost * 12
      toolsRemoved.push({ name, savings: annualSavings })
    } else if (prevTool.plan !== currTool.plan) {
      // Plan changed
      const prevAnnual = prevTool.billing === 'yearly' ? prevTool.cost : prevTool.cost * 12
      const currAnnual = currTool.billing === 'yearly' ? currTool.cost : currTool.cost * 12
      planChanges.push({
        name,
        oldPlan: prevTool.plan,
        newPlan: currTool.plan,
        delta: currAnnual - prevAnnual,
      })
    }
  })

  // Find added
  currMap.forEach((currTool, name) => {
    if (!prevMap.has(name)) {
      const annualCost = currTool.billing === 'yearly' ? currTool.cost : currTool.cost * 12
      toolsAdded.push({ name, cost: annualCost })
    }
  })

  const totalSavingsDelta =
    toolsRemoved.reduce((sum, t) => sum + t.savings, 0) + planChanges.reduce((sum, p) => sum + p.delta, 0)

  return {
    toolsRemoved,
    toolsAdded,
    planChanges,
    totalSavingsDelta,
  }
}

describe('Audit Diff', () => {
  describe('TEST 5: Diff Calculation - Removed Tools', () => {
    it('calculateAuditDelta detects removed tools correctly', () => {
      // Arrange
      const previous: AuditResult = {
        tools: [
          { name: 'Cursor Pro', plan: 'Pro', cost: 20, billing: 'monthly' },
          { name: 'GitHub Copilot Pro', plan: 'Pro', cost: 10, billing: 'monthly' },
          { name: 'Claude Pro', plan: 'Pro', cost: 20, billing: 'monthly' },
        ],
        totalCost: 50,
      }

      const current: AuditResult = {
        tools: [
          { name: 'Cursor Pro', plan: 'Pro', cost: 20, billing: 'monthly' },
          { name: 'Claude Pro', plan: 'Pro', cost: 20, billing: 'monthly' },
        ],
        totalCost: 40,
      }

      // Act
      const delta = calculateAuditDelta(current, previous)

      // Assert
      expect(delta.toolsRemoved).toHaveLength(1)
      expect(delta.toolsRemoved[0].name).toBe('GitHub Copilot Pro')
      expect(delta.toolsRemoved[0].savings).toBe(120) // 10 * 12
      expect(delta.totalSavingsDelta).toBe(120)
    })
  })

  describe('TEST 6: Diff Shows Plan Changes', () => {
    it('calculateAuditDelta detects plan downgrades', () => {
      // Arrange
      const previous: AuditResult = {
        tools: [{ name: 'Claude', plan: 'Team', cost: 40, billing: 'monthly' }],
        totalCost: 40,
      }

      const current: AuditResult = {
        tools: [{ name: 'Claude', plan: 'Pro', cost: 20, billing: 'monthly' }],
        totalCost: 20,
      }

      // Act
      const delta = calculateAuditDelta(current, previous)

      // Assert
      expect(delta.planChanges).toHaveLength(1)
      expect(delta.planChanges[0].name).toBe('Claude')
      expect(delta.planChanges[0].oldPlan).toBe('Team')
      expect(delta.planChanges[0].newPlan).toBe('Pro')
      expect(delta.planChanges[0].delta).toBe(-240) // (20 - 40) * 12
      expect(delta.totalSavingsDelta).toBe(-240)
    })
  })
})
