import { createClient } from "@supabase/supabase-js"
import { pricingData, PricingPlan, ToolPricing } from "./pricingData"
import type { ToolName } from "./types"

// In-memory cache structure
interface CacheEntry {
  data: ToolPricing[]
  timestamp: number
}

let pricingCache: CacheEntry | null = null
let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const key = supabaseServiceRoleKey || supabaseAnonKey

  if (supabaseUrl && key) {
    supabaseClient = createClient(supabaseUrl, key)
  }
  return supabaseClient
}

function getCacheTTLMs(): number {
  const ttlMinutes = process.env.PRICING_CACHE_TTL_MINUTES
    ? parseInt(process.env.PRICING_CACHE_TTL_MINUTES, 10)
    : 5
  return (isNaN(ttlMinutes) ? 5 : ttlMinutes) * 60 * 1000
}

/**
 * Invalidate the in-memory pricing cache
 */
export function invalidatePricingCache(): void {
  pricingCache = null
}

/**
 * Fetch all active pricing from Supabase or fallback to hardcoded defaults.
 * Caches results in-memory for the configured TTL duration.
 */
export async function getCachedPricing(): Promise<ToolPricing[]> {
  const now = Date.now()
  const ttl = getCacheTTLMs()

  if (pricingCache && now - pricingCache.timestamp < ttl) {
    return pricingCache.data
  }

  try {
    const supabase = getSupabase()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const { data, error } = await supabase
      .from("pricing_snapshot")
      .select("*")
      .eq("is_active", true)

    if (error) throw error

    if (!data || data.length === 0) {
      return pricingData
    }

    const groupedData = groupPricingRows(data)
    pricingCache = {
      data: groupedData,
      timestamp: now,
    }
    return groupedData
  } catch (err) {
    console.warn("[pricingService] Failed to load from database, falling back to hardcoded defaults:", err)
    return pricingData
  }
}

interface PricingRow {
  tool_name: string
  plan_name: string
  price_per_month: string
  min_seats: number | null
  source_url: string
  verified_date: string
  features?: string[]
}

/**
 * Helper to group flat DB rows into nested ToolPricing structures
 */
function groupPricingRows(rows: PricingRow[]): ToolPricing[] {
  const result: ToolPricing[] = JSON.parse(JSON.stringify(pricingData))

  rows.forEach((row) => {
    const toolLower = row.tool_name.toLowerCase()
    const planLower = row.plan_name.toLowerCase()

    let toolPricing = result.find((t) => t.toolName.toLowerCase() === toolLower)
    if (!toolPricing) {
      toolPricing = {
        toolName: row.tool_name as ToolName,
        displayName: row.tool_name,
        category: (planLower.includes("api") ? "api" : "chat") as "IDE" | "chat" | "api",
        plans: [],
      }
      result.push(toolPricing)
    }

    let plan = toolPricing.plans.find((p) => p.planName.toLowerCase() === planLower)
    if (!plan) {
      plan = {
        planName: row.plan_name,
        pricePerUserPerMonth: parseFloat(row.price_per_month),
        isPerUser: planLower.includes("team") || planLower.includes("business") || planLower.includes("enterprise") || (row.min_seats !== null && row.min_seats > 1),
        minSeats: row.min_seats || undefined,
        sourceUrl: row.source_url,
        verifiedDate: row.verified_date,
        allowCustomAmount: planLower.includes("enterprise") || planLower.includes("api") || planLower.includes("usage"),
      }
      toolPricing.plans.push(plan)
    } else {
      plan.pricePerUserPerMonth = parseFloat(row.price_per_month)
      plan.sourceUrl = row.source_url
      plan.verifiedDate = row.verified_date
      if (row.min_seats !== undefined) {
        plan.minSeats = row.min_seats || undefined
      }
    }
  })

  return result
}

/**
 * Fetch pricing plans for a specific tool.
 */
export async function getPricingData(tool: ToolName): Promise<PricingPlan[]> {
  const allPricing = await getCachedPricing()
  const toolPricing = allPricing.find((t) => t.toolName.toLowerCase() === tool.toLowerCase())
  return toolPricing ? toolPricing.plans : []
}

/**
 * Get the pricing configuration active as of a specific date/timestamp (historical lookup).
 */
function findMatchingPlan(plans: PricingPlan[], planName: string): PricingPlan | undefined {
  const planLower = planName.toLowerCase()
  
  // 1. Exact match
  let matched = plans.find((p) => p.planName.toLowerCase() === planLower)
  if (matched) return matched
  
  // 2. Keyword check
  matched = plans.find((p) => planLower.includes(p.planName.toLowerCase()) || p.planName.toLowerCase().includes(planLower))
  if (matched) return matched
  
  // 3. Paid fallback (Pro, Plus, Individual, or first plan)
  const paidPlans = plans.filter((p) => p.pricePerUserPerMonth > 0)
  return paidPlans.find((p) => p.planName === "Pro" || p.planName === "Plus" || p.planName === "Individual") || paidPlans[0] || plans[0]
}

/**
 * Get the pricing configuration active as of a specific date/timestamp (historical lookup).
 */
export async function getPricingAsOf(
  tool: ToolName,
  planName: string,
  timestamp: Date
): Promise<PricingPlan | null> {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const { data, error } = await supabase
      .from("pricing_snapshot")
      .select("*")
      .eq("tool_name", tool)
      .lte("created_at", timestamp.toISOString())
      .order("created_at", { ascending: false })

    if (error) throw error

    if (data && data.length > 0) {
      // Deduplicate to keep only the newest snapshot row per plan_name
      const activePlansMap = new Map<string, PricingRow>()
      for (const row of data as PricingRow[]) {
        const pName = row.plan_name.toLowerCase()
        if (!activePlansMap.has(pName)) {
          activePlansMap.set(pName, row)
        }
      }

      const plansList: PricingPlan[] = Array.from(activePlansMap.values()).map((row) => {
        const hardcoded = pricingData
          .find((t) => t.toolName.toLowerCase() === tool.toLowerCase())
          ?.plans.find((p) => p.planName.toLowerCase() === row.plan_name.toLowerCase())

        return {
          planName: row.plan_name,
          pricePerUserPerMonth: parseFloat(row.price_per_month),
          isPerUser: hardcoded ? hardcoded.isPerUser : (row.plan_name.toLowerCase().includes("team") || (row.min_seats !== null && row.min_seats > 1)),
          minSeats: row.min_seats || undefined,
          sourceUrl: row.source_url,
          verifiedDate: row.verified_date,
          allowCustomAmount: hardcoded ? hardcoded.allowCustomAmount : row.plan_name.toLowerCase().includes("enterprise"),
        }
      })

      const matched = findMatchingPlan(plansList, planName)
      if (matched) return matched
    }
  } catch (err) {
    console.warn("[pricingService] getPricingAsOf DB query failed, falling back to hardcoded plan:", err)
  }

  // Fallback to current hardcoded values
  const allPricing = pricingCache ? pricingCache.data : pricingData
  const toolPricing = allPricing.find((t) => t.toolName.toLowerCase() === tool.toLowerCase())
  if (toolPricing) {
    const matched = findMatchingPlan(toolPricing.plans, planName)
    if (matched) return matched
  }
  return null
}

/* ──────────────────────────────────────────────────────────────
   SYNCHRONOUS GETTERS (FOR RUNTIME CALLS IN AUDIT ENGINE)
   ────────────────────────────────────────────────────────────── */

export function getToolPricingSync(tool: ToolName): ToolPricing | undefined {
  const data = pricingCache ? pricingCache.data : pricingData
  return data.find((item) => item.toolName.toLowerCase() === tool.toLowerCase())
}

export function getPlanPricingSync(tool: ToolName, plan: string): PricingPlan | undefined {
  const toolPricing = getToolPricingSync(tool)
  if (!toolPricing) return undefined
  return findMatchingPlan(toolPricing.plans, plan)
}

export function getOfficialPriceSync(tool: ToolName, plan: string, seats: number): number {
  const matchedPlan = getPlanPricingSync(tool, plan)
  if (!matchedPlan) return 0
  if (matchedPlan.allowCustomAmount && matchedPlan.pricePerUserPerMonth === 0) {
    return 0
  }
  const effectiveSeats = Math.max(seats, matchedPlan.minSeats ?? seats)
  if (matchedPlan.isPerUser) {
    return matchedPlan.pricePerUserPerMonth * effectiveSeats
  }
  return matchedPlan.pricePerUserPerMonth
}
