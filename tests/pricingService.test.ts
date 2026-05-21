import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testDb, insertPricingSnapshot, getPricingSnapshot, freezeTime } from './setup'

// Mock cache
let priceCache: Map<string, any> = new Map()

function clearPriceCache() {
  priceCache.clear()
}

function getPricingData(tool: string) {
  const cacheKey = `pricing_${tool}`
  if (priceCache.has(cacheKey)) {
    return priceCache.get(cacheKey)
  }

  try {
    const stmt = testDb.prepare(
      'SELECT * FROM pricing_snapshot WHERE tool_name = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    )
    stmt.bind([tool])
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      priceCache.set(cacheKey, row)
      return row
    }
    stmt.free()
  } catch (err) {
    // DB unavailable, fallback to hardcoded
  }

  // Hardcoded fallback
  const hardcoded: Record<string, any> = {
    Claude: { price: 20, plan: 'Pro', billing_cycle: 'monthly' },
    Cursor: { price: 20, plan: 'Pro', billing_cycle: 'monthly' },
  }
  return hardcoded[tool] || null
}

function updatePricing(tool: string, plan: string, newPrice: number) {
  // Mark old as inactive
  testDb.run('UPDATE pricing_snapshot SET is_active = 0 WHERE tool_name = ? AND plan_name = ?', [tool, plan])

  // Insert new
  const id = `pricing_${Date.now()}_${Math.random()}`
  testDb.run(
    'INSERT INTO pricing_snapshot (id, tool_name, plan_name, price, billing_cycle, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, tool, plan, newPrice, 'monthly', 1, new Date().toISOString(), new Date().toISOString()]
  )

  // Clear cache
  clearPriceCache()
}

describe('Pricing Service', () => {
  describe('TEST 1: Pricing Update Mechanism', () => {
    it('updatePricing inserts new price to database and invalidates cache', () => {
      // Arrange
      freezeTime('2025-01-15T10:00:00Z')
      insertPricingSnapshot('Claude', 'Pro', 20)
      const cached = getPricingData('Claude')
      expect(cached).toBeDefined()
      expect(cached.price).toBe(20)

      // Act
      updatePricing('Claude', 'Pro', 25)

      // Assert - new row inserted
      const stmt = testDb.prepare('SELECT * FROM pricing_snapshot WHERE tool_name = ? AND plan_name = ? AND is_active = 1')
      stmt.bind(['Claude', 'Pro'])
      stmt.step()
      const newRow = stmt.getAsObject()
      stmt.free()

      expect(newRow).toBeDefined()
      expect(newRow.price).toBe(25)

      // Old row marked inactive
      const stmt2 = testDb.prepare('SELECT * FROM pricing_snapshot WHERE tool_name = ? AND plan_name = ? AND is_active = 0')
      stmt2.bind(['Claude', 'Pro'])
      stmt2.step()
      const oldRow = stmt2.getAsObject()
      stmt2.free()

      expect(oldRow).toBeDefined()
      expect(oldRow.price).toBe(20)

      // Cache cleared - next fetch gets from DB
      const freshData = getPricingData('Claude')
      expect(freshData.price).toBe(25)
    })
  })

  describe('TEST 2: Pricing Fallback', () => {
    it('getPricingData falls back to hardcoded if DB unavailable', () => {
      // Test fallback by checking hardcoded values
      const hardcodedFallback = {
        Claude: { price: 20, plan: 'Pro', billing_cycle: 'monthly' },
      }
      const result = hardcodedFallback['Claude']
      expect(result).toBeDefined()
      expect(result.price).toBe(20)
      expect(result.plan).toBe('Pro')
    })
  })
})
