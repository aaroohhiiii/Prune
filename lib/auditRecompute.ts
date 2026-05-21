import { supabaseService } from "./supabase"
import { runAudit } from "./auditEngineV2"
import { getCachedPricing, getOfficialPriceSync } from "./pricingService"
import type { AuditInput, ToolAuditResult } from "./types"

export interface AuditChange {
  originalId: string
  newId: string
  userEmail: string
  tool: string
  oldRecommendation: string
  newRecommendation: string
  savingsDelta: number
  why?: string
}

interface AuditRow {
  id: string
  input: AuditInput
  results: ToolAuditResult[]
  total_monthly_savings: number
  total_annual_savings: number
  ai_summary: string
  is_optimal: boolean
  show_credex: boolean
  summary: Record<string, unknown> | null
  efficiency_score: number | null
  created_at: string
  is_stale?: boolean
  price_snapshot_id?: string | null
}

interface LeadWithAuditRow {
  email: string
  company_name: string | null
  role: string | null
  audit_id: string
  audits: AuditRow | null
}

export async function recomputeAuditsForPricingChange(
  toolName?: string,
  options?: {
    lookbackDays?: number
    dryRun?: boolean
    maxAudits?: number
  }
): Promise<{
  auditsProcessed: number
  auditsChanged: number
  changedAudits: AuditChange[]
}> {
  const lookbackDays = options?.lookbackDays ?? 30
  const maxAudits = options?.maxAudits ?? 100
  const dryRun = options?.dryRun ?? false

  const dateThreshold = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  // 1. Warm pricing cache first to avoid redundant hits
  await getCachedPricing()

  // 2. Safely detect if is_stale and price_snapshot_id columns exist in audits table
  let hasIsStale = false
  let hasPriceSnapshotId = false

  try {
    const { error } = await supabaseService!
      .from("audits")
      .select("is_stale, price_snapshot_id")
      .limit(1)
    
    if (!error) {
      hasIsStale = true
      hasPriceSnapshotId = true
    }
  } catch (err) {
    console.warn("[auditRecompute] Could not query is_stale columns, assuming not migrated yet:", err)
  }

  // Build dynamic select query
  const auditSelect = [
    "id",
    "input",
    "results",
    "total_monthly_savings",
    "total_annual_savings",
    "ai_summary",
    "is_optimal",
    "show_credex",
    "summary",
    "efficiency_score",
    "created_at",
    hasIsStale ? "is_stale" : "",
    hasPriceSnapshotId ? "price_snapshot_id" : "",
  ].filter(Boolean).join(",")

  // 3. Query leads with audits
  // Using audits!inner to filter leads where audits.created_at matches and audits.is_stale is false
  let query = supabaseService!
    .from("leads")
    .select(`
      email,
      company_name,
      role,
      audit_id,
      audits!inner (${auditSelect})
    `)
    .gte("audits.created_at", dateThreshold)

  if (hasIsStale) {
    query = query.eq("audits.is_stale", false)
  }

  const { data: leads, error: fetchError } = await (query as unknown as {
    order: (field: string, options: Record<string, unknown>) => {
      limit: (l: number) => Promise<{ data: LeadWithAuditRow[] | null; error: unknown }>
    }
  })
    .order("created_at", { ascending: false })
    .limit(maxAudits * 2)

  if (fetchError) {
    console.error("[auditRecompute] Error fetching leads/audits:", fetchError)
    throw fetchError as Error
  }

  if (!leads || leads.length === 0) {
    return { auditsProcessed: 0, auditsChanged: 0, changedAudits: [] }
  }

  const processedAudits = new Set<string>()
  const changedAuditsList: AuditChange[] = []
  let auditsProcessedCount = 0

  // 4. Fetch the target price snapshot ID if a tool is specified and table is migrated
  let priceSnapshotId: string | null = null
  if (toolName && hasPriceSnapshotId) {
    try {
      const { data: snapshot } = await supabaseService!
        .from("pricing_snapshot")
        .select("id")
        .eq("tool_name", toolName.toLowerCase())
        .eq("is_active", true)
        .limit(1)

      if (snapshot && snapshot.length > 0) {
        priceSnapshotId = snapshot[0].id
      }
    } catch {
      console.warn("[auditRecompute] Failed to fetch price snapshot ID")
    }
  }

  for (const lead of leads) {
    if (auditsProcessedCount >= maxAudits) break

    const audit = lead.audits
    if (!audit || processedAudits.has(audit.id)) continue

    const auditInput = JSON.parse(JSON.stringify(audit.input)) as AuditInput
    if (!auditInput || !auditInput.tools) continue

    // Update tools with the latest official pricing so the engine computes correct savings
    for (const tool of auditInput.tools) {
      const officialPrice = getOfficialPriceSync(tool.tool, tool.plan, tool.seats)
      if (officialPrice > 0) {
        tool.monthlySpend = officialPrice
      }
    }

    // Filter by tool if specified
    if (toolName) {
      const normalizedTarget = toolName.toLowerCase().replace("-", "")
      const hasTargetTool = auditInput.tools.some(
        (t) => t.tool.toLowerCase().replace("-", "") === normalizedTarget
      )
      if (!hasTargetTool) continue
    }

    processedAudits.add(audit.id)
    auditsProcessedCount++

    // Re-run audit engine
    const freshAudit = runAudit(auditInput)

    // Compare new recommendations against historical results
    const originalResults = audit.results as ToolAuditResult[]
    let recommendationChanged = false
    const auditChanges: AuditChange[] = []

    for (const newRes of freshAudit.results) {
      const oldRes = originalResults.find((r) => r.tool === newRes.tool)
      if (!oldRes) continue

      const actionChanged = oldRes.recommendedAction !== newRes.recommendedAction
      const planChanged = oldRes.recommendedPlan !== newRes.recommendedPlan
      const targetToolChanged = oldRes.recommendedTool !== newRes.recommendedTool
      const savingsChanged = Math.abs(oldRes.annualSavings - newRes.annualSavings) > 0.01

      if (actionChanged || planChanged || targetToolChanged || savingsChanged) {
        recommendationChanged = true

        const formatRec = (res: ToolAuditResult) => {
          const action = res.recommendedAction.toUpperCase()
          if (res.recommendedAction === "keep") {
            return `Keep ${res.currentPlan}`
          }
          if (res.recommendedAction === "downgrade") {
            return `Downgrade to ${res.recommendedPlan || "lower plan"}`
          }
          if (res.recommendedAction === "switch") {
            return `Switch to ${res.recommendedTool || "alternative tool"}`
          }
          return `${action} ${res.currentPlan}`
        }

        auditChanges.push({
          originalId: audit.id,
          newId: "", // Will be filled below if not dryRun
          userEmail: lead.email,
          tool: newRes.tool.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          oldRecommendation: formatRec(oldRes),
          newRecommendation: formatRec(newRes),
          savingsDelta: newRes.annualSavings - oldRes.annualSavings,
          why: newRes.reason,
        })
      }
    }

    if (recommendationChanged) {
      let newAuditId = "dry-run-new-id"

      if (!dryRun) {
        // Generate AI Summary or fallback to original
        let aiSummaryText = audit.ai_summary || ""
        try {
          const { generateEnhancedAiSummary } = await import("./enhancedAiSummary")
          aiSummaryText = await generateEnhancedAiSummary({
            input: auditInput,
            results: freshAudit.results,
            totalMonthlySavings: freshAudit.totalMonthlySavings,
            totalAnnualSavings: freshAudit.totalAnnualSavings,
            isOptimal: freshAudit.isOptimal,
            showCredex: freshAudit.showCredex,
          })
        } catch (aiErr) {
          console.warn("[auditRecompute] AI summary generator failed, using original text fallback:", aiErr)
        }

        // Save new optimal audit
        const insertPayload: Record<string, unknown> = {
          input: auditInput,
          results: freshAudit.results,
          total_monthly_savings: freshAudit.totalMonthlySavings,
          total_annual_savings: freshAudit.totalAnnualSavings,
          ai_summary: aiSummaryText,
          is_optimal: freshAudit.isOptimal,
          show_credex: freshAudit.showCredex,
          summary: freshAudit.summary ?? null,
          efficiency_score: freshAudit.efficiencyScore ?? null,
          previous_audit_id: audit.id,
        }

        if (hasIsStale) {
          insertPayload.is_stale = false
        }
        if (hasPriceSnapshotId && priceSnapshotId) {
          insertPayload.price_snapshot_id = priceSnapshotId
        }

        const { data: insertedAudit, error: insertError } = await supabaseService!
          .from("audits")
          .insert(insertPayload)
          .select("id")
          .single()

        if (insertError) {
          console.error("[auditRecompute] Failed to insert recomputed audit:", insertError)
          continue
        }

        newAuditId = insertedAudit.id

        // Mark original audit as stale
        if (hasIsStale) {
          await supabaseService!
            .from("audits")
            .update({ is_stale: true })
            .eq("id", audit.id)
        }

        // Link lead to the new audit
        await supabaseService!
          .from("leads")
          .insert({
            audit_id: newAuditId,
            email: lead.email,
            company_name: lead.company_name || null,
            role: lead.role || null,
            team_size: auditInput.teamSize,
          })
      }

      // Add to changedAuditsList with updated newAuditId
      for (const change of auditChanges) {
        change.newId = newAuditId
        changedAuditsList.push(change)
      }
    }
  }

  // Count distinct audits that changed
  const uniqueChangedAudits = new Set(changedAuditsList.map((c) => c.originalId))

  return {
    auditsProcessed: auditsProcessedCount,
    auditsChanged: uniqueChangedAudits.size,
    changedAudits: changedAuditsList,
  }
}
